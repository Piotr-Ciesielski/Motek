-- Motek: magazyn włóczek należący do konkretnego użytkownika.
-- Dane są dostępne przez Data API wyłącznie po zalogowaniu i zgodnie z RLS.

create table public.yarns (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,

  name text not null
    check (char_length(trim(name)) between 1 and 100),
  color text not null
    check (char_length(trim(color)) between 1 and 50),
  material text not null
    check (material in ('wełna', 'bawełna', 'akryl', 'alpaka', 'mieszanka')),
  weight_class text not null
    check (weight_class in ('lace', 'fingering', 'sport', 'dk', 'worsted', 'bulky')),
  length_meters integer not null default 0
    check (length_meters between 0 and 1000000),
  weight_grams integer not null default 0
    check (weight_grams between 0 and 1000000),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index yarns_user_id_idx
  on public.yarns (user_id);

comment on table public.yarns is
  'Włóczki zapisane w prywatnym magazynie użytkownika Motka.';

comment on column public.yarns.user_id is
  'Właściciel rekordu; zgodność z auth.uid() jest wymuszana przez RLS.';

comment on column public.yarns.length_meters is
  'Długość włóczki w metrach.';

comment on column public.yarns.weight_grams is
  'Masa włóczki w gramach.';

create or replace function public.set_yarns_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists yarns_set_updated_at on public.yarns;

create trigger yarns_set_updated_at
  before update on public.yarns
  for each row execute function public.set_yarns_updated_at();

alter table public.yarns enable row level security;

-- Brak dostępu anonimowego. Uprawnienia tabeli i RLS są osobnymi warstwami.
revoke all on table public.yarns from anon;
revoke all on table public.yarns from authenticated;

grant select, insert, update, delete
on table public.yarns
to authenticated;

grant usage, select
on sequence public.yarns_id_seq
to authenticated;

grant select, insert, update, delete
on table public.yarns
to service_role;

grant usage, select
on sequence public.yarns_id_seq
to service_role;

drop policy if exists yarns_select_own on public.yarns;
create policy yarns_select_own
  on public.yarns
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists yarns_insert_own on public.yarns;
create policy yarns_insert_own
  on public.yarns
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists yarns_update_own on public.yarns;
create policy yarns_update_own
  on public.yarns
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists yarns_delete_own on public.yarns;
create policy yarns_delete_own
  on public.yarns
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

comment on policy yarns_select_own on public.yarns is
  'Użytkownik może odczytać wyłącznie własne włóczki.';

comment on policy yarns_insert_own on public.yarns is
  'Użytkownik może dodać włóczkę wyłącznie do własnego magazynu.';

comment on policy yarns_update_own on public.yarns is
  'Użytkownik może zmienić wyłącznie własne włóczki i nie może zmienić ich właściciela.';

comment on policy yarns_delete_own on public.yarns is
  'Użytkownik może usunąć wyłącznie własne włóczki.';
