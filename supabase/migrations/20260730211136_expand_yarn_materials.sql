-- Rozszerza skład włóczki z jednej wartości do listy materiałów.
-- Kolumna material zostaje przejściowo zachowana, aby poprzednia wersja
-- aplikacji działała bez przerwy podczas wdrożenia.

create or replace function public.yarn_materials_are_valid(value text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    cardinality(value) between 1 and 15
    and value <@ array[
      'wełna',
      'alpaka',
      'moher',
      'kaszmir',
      'angora',
      'jak',
      'bawełna',
      'len',
      'bambus',
      'wiskoza',
      'jedwab',
      'poliamid',
      'poliester',
      'akryl',
      'mieszanka'
    ]::text[]
    and cardinality(value) = (
      select count(distinct material)
      from unnest(value) as material
    )
    and not (
      'mieszanka' = any(value)
      and cardinality(value) > 1
    );
$$;

alter table public.yarns
  add column materials text[];

update public.yarns
set materials = array[material];

alter table public.yarns
  alter column materials set not null,
  add constraint yarns_materials_check
    check (public.yarn_materials_are_valid(materials));

alter table public.yarns
  drop constraint yarns_material_check,
  add constraint yarns_material_check
    check (material in (
      'wełna',
      'alpaka',
      'moher',
      'kaszmir',
      'angora',
      'jak',
      'bawełna',
      'len',
      'bambus',
      'wiskoza',
      'jedwab',
      'poliamid',
      'poliester',
      'akryl',
      'mieszanka'
    ));

comment on column public.yarns.materials is
  'Pełny skład włóczki; wartości są unikalne i zgodne ze wspólną listą Motka.';

create or replace function public.sync_yarn_material_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.materials is null or cardinality(new.materials) = 0 then
      new.materials := array[new.material];
    else
      new.material := case
        when cardinality(new.materials) = 1 then new.materials[1]
        else 'mieszanka'
      end;
    end if;
  elsif new.material is distinct from old.material
    and new.materials is not distinct from old.materials then
    new.materials := array[new.material];
  elsif new.materials is distinct from old.materials then
    new.material := case
      when cardinality(new.materials) = 1 then new.materials[1]
      else 'mieszanka'
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists yarns_sync_material_columns on public.yarns;

create trigger yarns_sync_material_columns
  before insert or update on public.yarns
  for each row execute function public.sync_yarn_material_columns();

create or replace function public.insert_yarn_with_limit(
  p_name text,
  p_color text,
  p_materials text[],
  p_weight_class text,
  p_length_meters integer,
  p_weight_grams integer
)
returns setof public.yarns
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  yarn_count bigint;
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Użytkownik musi być zalogowany.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 0)
  );

  select count(*)
    into yarn_count
    from public.yarns
   where user_id = current_user_id;

  if yarn_count >= 500 then
    raise exception using
      errcode = 'P0001',
      message = 'Magazyn osiągnął limit 500 włóczek na użytkownika.';
  end if;

  return query
    insert into public.yarns (
      user_id,
      name,
      color,
      materials,
      weight_class,
      length_meters,
      weight_grams
    )
    values (
      current_user_id,
      p_name,
      p_color,
      p_materials,
      p_weight_class,
      p_length_meters,
      p_weight_grams
    )
    returning *;
end;
$$;

revoke execute on function public.insert_yarn_with_limit(
  text,
  text,
  text[],
  text,
  integer,
  integer
) from public, anon;

grant execute on function public.insert_yarn_with_limit(
  text,
  text,
  text[],
  text,
  integer,
  integer
) to authenticated, service_role;

comment on function public.insert_yarn_with_limit(
  text,
  text,
  text[],
  text,
  integer,
  integer
) is
  'Atomowo dodaje włóczkę z pełnym składem i egzekwuje limit 500 rekordów.';
