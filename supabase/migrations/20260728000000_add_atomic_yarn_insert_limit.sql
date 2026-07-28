-- Atomowy insert włóczki z limitem magazynu na użytkownika.
-- Blokada transakcyjna eliminuje wyścig między sprawdzeniem count(*) a insertem.

create or replace function public.insert_yarn_with_limit(
  p_name text,
  p_color text,
  p_material text,
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
      material,
      weight_class,
      length_meters,
      weight_grams
    )
    values (
      current_user_id,
      p_name,
      p_color,
      p_material,
      p_weight_class,
      p_length_meters,
      p_weight_grams
    )
    returning *;
end;
$$;

revoke execute on function public.insert_yarn_with_limit(text, text, text, text, integer, integer)
  from public, anon;
grant execute on function public.insert_yarn_with_limit(text, text, text, text, integer, integer)
  to authenticated, service_role;

comment on function public.insert_yarn_with_limit(text, text, text, text, integer, integer) is
  'Atomowo dodaje włóczkę i egzekwuje limit 500 rekordów na użytkownika.';
