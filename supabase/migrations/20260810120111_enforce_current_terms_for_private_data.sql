-- Dostęp do prywatnych danych aplikacji wymaga aktualnej akceptacji regulaminu.
create or replace function public.has_current_terms_acceptance()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.legal_document_versions as document_version
    join private.terms_acceptances as acceptance
      on acceptance.terms_version = document_version.version
    where document_version.kind = 'terms'
      and document_version.is_current
      and acceptance.user_id = (select auth.uid())
  );
$$;

revoke all on function public.has_current_terms_acceptance() from public, anon, authenticated;
grant execute on function public.has_current_terms_acceptance() to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id and public.has_current_terms_acceptance());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id and public.has_current_terms_acceptance())
  with check ((select auth.uid()) = id and public.has_current_terms_acceptance());

drop policy if exists yarns_select_own on public.yarns;
create policy yarns_select_own
  on public.yarns
  for select
  to authenticated
  using ((select auth.uid()) = user_id and public.has_current_terms_acceptance());

drop policy if exists yarns_insert_own on public.yarns;
create policy yarns_insert_own
  on public.yarns
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id and public.has_current_terms_acceptance());

drop policy if exists yarns_update_own on public.yarns;
create policy yarns_update_own
  on public.yarns
  for update
  to authenticated
  using ((select auth.uid()) = user_id and public.has_current_terms_acceptance())
  with check ((select auth.uid()) = user_id and public.has_current_terms_acceptance());

drop policy if exists yarns_delete_own on public.yarns;
create policy yarns_delete_own
  on public.yarns
  for delete
  to authenticated
  using ((select auth.uid()) = user_id and public.has_current_terms_acceptance());

-- Stare RPC nie może pozostać alternatywną ścieżką zapisu poza licznikiem wersji.
drop function if exists public.insert_yarn_with_limit(text, text, text, text, integer, integer);
drop function if exists public.insert_yarn_with_limit(text, text, text[], text, integer, integer);

create or replace function public.get_yarn_store_version()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_version bigint;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if not public.has_current_terms_acceptance() then
    raise exception using errcode = '42501', message = 'current terms acceptance required';
  end if;

  insert into private.yarn_store_versions (user_id)
  values (current_user_id)
  on conflict (user_id) do nothing;

  select version into current_version
  from private.yarn_store_versions
  where user_id = current_user_id;

  return current_version;
end;
$$;

create or replace function public.insert_yarn_versioned(
  p_expected_version bigint,
  p_name text,
  p_color text,
  p_materials text[],
  p_weight_class text,
  p_length_meters integer,
  p_weight_grams integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_version bigint;
  next_version bigint;
  inserted_yarn public.yarns;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if not public.has_current_terms_acceptance() then
    raise exception using errcode = '42501', message = 'current terms acceptance required';
  end if;

  insert into private.yarn_store_versions (user_id)
  values (current_user_id)
  on conflict (user_id) do nothing;

  select version into current_version
  from private.yarn_store_versions
  where user_id = current_user_id
  for update;

  if current_version is distinct from p_expected_version then
    raise exception using errcode = 'P0003', message = 'yarn version conflict';
  end if;

  if (select count(*) from public.yarns where user_id = current_user_id) >= 500 then
    raise exception using errcode = 'P0001', message = 'yarn limit reached';
  end if;

  insert into public.yarns (user_id, name, color, materials, weight_class, length_meters, weight_grams)
  values (current_user_id, p_name, p_color, p_materials, p_weight_class, p_length_meters, p_weight_grams)
  returning * into inserted_yarn;

  next_version := current_version + 1;
  update private.yarn_store_versions set version = next_version where user_id = current_user_id;
  return jsonb_build_object('yarn', to_jsonb(inserted_yarn), 'version', next_version);
end;
$$;

create or replace function public.update_yarn_versioned(
  p_expected_version bigint,
  p_id bigint,
  p_name text,
  p_color text,
  p_materials text[],
  p_weight_class text,
  p_length_meters integer,
  p_weight_grams integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_version bigint;
  next_version bigint;
  updated_yarn public.yarns;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if not public.has_current_terms_acceptance() then
    raise exception using errcode = '42501', message = 'current terms acceptance required';
  end if;

  insert into private.yarn_store_versions (user_id)
  values (current_user_id)
  on conflict (user_id) do nothing;

  select version into current_version
  from private.yarn_store_versions
  where user_id = current_user_id
  for update;

  if current_version is distinct from p_expected_version then
    raise exception using errcode = 'P0003', message = 'yarn version conflict';
  end if;

  update public.yarns
  set name = p_name,
      color = p_color,
      materials = p_materials,
      weight_class = p_weight_class,
      length_meters = p_length_meters,
      weight_grams = p_weight_grams
  where id = p_id and user_id = current_user_id
  returning * into updated_yarn;

  if not found then
    raise exception using errcode = 'P0002', message = 'yarn not found';
  end if;

  next_version := current_version + 1;
  update private.yarn_store_versions set version = next_version where user_id = current_user_id;
  return jsonb_build_object('yarn', to_jsonb(updated_yarn), 'version', next_version);
end;
$$;

create or replace function public.delete_yarn_versioned(
  p_expected_version bigint,
  p_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_version bigint;
  next_version bigint;
  deleted_yarn public.yarns;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if not public.has_current_terms_acceptance() then
    raise exception using errcode = '42501', message = 'current terms acceptance required';
  end if;

  insert into private.yarn_store_versions (user_id)
  values (current_user_id)
  on conflict (user_id) do nothing;

  select version into current_version
  from private.yarn_store_versions
  where user_id = current_user_id
  for update;

  if current_version is distinct from p_expected_version then
    raise exception using errcode = 'P0003', message = 'yarn version conflict';
  end if;

  delete from public.yarns
  where id = p_id and user_id = current_user_id
  returning * into deleted_yarn;

  if not found then
    raise exception using errcode = 'P0002', message = 'yarn not found';
  end if;

  next_version := current_version + 1;
  update private.yarn_store_versions set version = next_version where user_id = current_user_id;
  return jsonb_build_object('yarn', to_jsonb(deleted_yarn), 'version', next_version);
end;
$$;

revoke all on function public.get_yarn_store_version() from public, anon, authenticated;
revoke all on function public.insert_yarn_versioned(bigint, text, text, text[], text, integer, integer) from public, anon, authenticated;
revoke all on function public.update_yarn_versioned(bigint, bigint, text, text, text[], text, integer, integer) from public, anon, authenticated;
revoke all on function public.delete_yarn_versioned(bigint, bigint) from public, anon, authenticated;

grant execute on function public.get_yarn_store_version() to authenticated;
grant execute on function public.insert_yarn_versioned(bigint, text, text, text[], text, integer, integer) to authenticated;
grant execute on function public.update_yarn_versioned(bigint, bigint, text, text, text[], text, integer, integer) to authenticated;
grant execute on function public.delete_yarn_versioned(bigint, bigint) to authenticated;
