-- Versioned yarn inventory API used by the authenticated backend.
-- The version is kept per user so the ETag/If-Match contract can detect
-- concurrent edits without exposing another user's inventory.

create table if not exists public.yarn_store_versions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version bigint not null default 0 check (version >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.yarn_store_versions enable row level security;

drop policy if exists "yarn_store_versions_select_own" on public.yarn_store_versions;
create policy "yarn_store_versions_select_own"
  on public.yarn_store_versions for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "yarn_store_versions_insert_own" on public.yarn_store_versions;
create policy "yarn_store_versions_insert_own"
  on public.yarn_store_versions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "yarn_store_versions_update_own" on public.yarn_store_versions;
create policy "yarn_store_versions_update_own"
  on public.yarn_store_versions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.yarn_store_versions from anon;
grant select, insert, update on table public.yarn_store_versions to authenticated;

create or replace function public.get_yarn_store_version()
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    (select version from public.yarn_store_versions where user_id = (select auth.uid())),
    0
  );
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
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_version bigint;
  next_version bigint;
  inserted_yarn public.yarns;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.yarn_store_versions (user_id, version)
  values (current_user_id, 0)
  on conflict (user_id) do nothing;

  select version into current_version
  from public.yarn_store_versions
  where user_id = current_user_id
  for update;

  if current_version <> coalesce(p_expected_version, -1) then
    raise exception 'Yarn inventory version conflict' using errcode = 'P0003';
  end if;

  insert into public.yarns (user_id, name, color, materials, weight_class, length_meters, weight_grams)
  values (current_user_id, p_name, p_color, p_materials, p_weight_class, p_length_meters, p_weight_grams)
  returning * into inserted_yarn;

  next_version := current_version + 1;
  update public.yarn_store_versions
  set version = next_version, updated_at = timezone('utc', now())
  where user_id = current_user_id;

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
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_version bigint;
  next_version bigint;
  updated_yarn public.yarns;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.yarn_store_versions (user_id, version)
  values (current_user_id, 0)
  on conflict (user_id) do nothing;

  select version into current_version
  from public.yarn_store_versions
  where user_id = current_user_id
  for update;

  if current_version <> coalesce(p_expected_version, -1) then
    raise exception 'Yarn inventory version conflict' using errcode = 'P0003';
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

  if updated_yarn.id is null then
    raise exception 'Yarn not found' using errcode = 'P0002';
  end if;

  next_version := current_version + 1;
  update public.yarn_store_versions
  set version = next_version, updated_at = timezone('utc', now())
  where user_id = current_user_id;

  return jsonb_build_object('yarn', to_jsonb(updated_yarn), 'version', next_version);
end;
$$;

create or replace function public.delete_yarn_versioned(
  p_expected_version bigint,
  p_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_version bigint;
  next_version bigint;
  deleted_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.yarn_store_versions (user_id, version)
  values (current_user_id, 0)
  on conflict (user_id) do nothing;

  select version into current_version
  from public.yarn_store_versions
  where user_id = current_user_id
  for update;

  if current_version <> coalesce(p_expected_version, -1) then
    raise exception 'Yarn inventory version conflict' using errcode = 'P0003';
  end if;

  delete from public.yarns
  where id = p_id and user_id = current_user_id;
  get diagnostics deleted_count = row_count;

  if deleted_count = 0 then
    raise exception 'Yarn not found' using errcode = 'P0002';
  end if;

  next_version := current_version + 1;
  update public.yarn_store_versions
  set version = next_version, updated_at = timezone('utc', now())
  where user_id = current_user_id;

  return jsonb_build_object('version', next_version);
end;
$$;

revoke all on function public.get_yarn_store_version() from public, anon;
revoke all on function public.insert_yarn_versioned(bigint, text, text, text[], text, integer, integer) from public, anon;
revoke all on function public.update_yarn_versioned(bigint, bigint, text, text, text[], text, integer, integer) from public, anon;
revoke all on function public.delete_yarn_versioned(bigint, bigint) from public, anon;
grant execute on function public.get_yarn_store_version() to authenticated;
grant execute on function public.insert_yarn_versioned(bigint, text, text, text[], text, integer, integer) to authenticated;
grant execute on function public.update_yarn_versioned(bigint, bigint, text, text, text[], text, integer, integer) to authenticated;
grant execute on function public.delete_yarn_versioned(bigint, bigint) to authenticated;


