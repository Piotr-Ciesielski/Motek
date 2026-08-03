-- Prywatny, monotoniczny licznik wersji magazynu włóczek.
create schema if not exists private;

create table if not exists private.yarn_store_versions (
  user_id uuid primary key,
  version bigint not null default 0 check (version >= 0),
  constraint yarn_store_versions_user_fk
    foreign key (user_id) references auth.users(id) on delete cascade
);

insert into private.yarn_store_versions (user_id)
select distinct user_id from public.yarns
on conflict (user_id) do nothing;

revoke all on schema private from public, anon, authenticated;
revoke all on table private.yarn_store_versions from public, anon, authenticated;

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
  insert into private.yarn_store_versions (user_id) values (current_user_id) on conflict (user_id) do nothing;
  select version into current_version from private.yarn_store_versions where user_id = current_user_id for update;
  if current_version is distinct from p_expected_version then
    raise exception using errcode = 'P0003', message = 'yarn version conflict';
  end if;
  update public.yarns
  set name = p_name, color = p_color, materials = p_materials, weight_class = p_weight_class,
      length_meters = p_length_meters, weight_grams = p_weight_grams
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
  insert into private.yarn_store_versions (user_id) values (current_user_id) on conflict (user_id) do nothing;
  select version into current_version from private.yarn_store_versions where user_id = current_user_id for update;
  if current_version is distinct from p_expected_version then
    raise exception using errcode = 'P0003', message = 'yarn version conflict';
  end if;
  delete from public.yarns where id = p_id and user_id = current_user_id returning * into deleted_yarn;
  if not found then
    raise exception using errcode = 'P0002', message = 'yarn not found';
  end if;
  next_version := current_version + 1;
  update private.yarn_store_versions set version = next_version where user_id = current_user_id;
  return jsonb_build_object('yarn', to_jsonb(deleted_yarn), 'version', next_version);
end;
$$;

revoke execute on function public.get_yarn_store_version() from public, anon, authenticated;
revoke execute on function public.insert_yarn_versioned(bigint, text, text, text[], text, integer, integer) from public, anon, authenticated;
revoke execute on function public.update_yarn_versioned(bigint, bigint, text, text, text[], text, integer, integer) from public, anon, authenticated;
revoke execute on function public.delete_yarn_versioned(bigint, bigint) from public, anon, authenticated;
grant execute on function public.get_yarn_store_version() to authenticated;
grant execute on function public.insert_yarn_versioned(bigint, text, text, text[], text, integer, integer) to authenticated;
grant execute on function public.update_yarn_versioned(bigint, bigint, text, text, text[], text, integer, integer) to authenticated;
grant execute on function public.delete_yarn_versioned(bigint, bigint) to authenticated;

comment on table private.yarn_store_versions is 'Prywatny licznik wersji dla atomowej kontroli współbieżnych zapisów magazynu.';

