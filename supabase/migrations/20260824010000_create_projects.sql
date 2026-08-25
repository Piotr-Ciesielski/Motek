-- Etap 2: jeden aktywny projekt użytkownika i przypisania włóczek (SPEC.md, „Etap 2”).
create table public.projects (
  id bigint generated always as identity primary key,

  user_id uuid not null
    references auth.users (id) on delete cascade,

  pattern_id bigint
    references public.patterns (id) on delete set null,

  variant_id text not null
    check (char_length(trim(variant_id)) between 1 and 100),

  status text not null
    check (status in ('active', 'completed', 'frogged')),

  version integer not null default 1
    check (version >= 1),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  ended_at timestamptz,

  constraint projects_terminal_ended_at_check
    check (
      (status = 'active' and ended_at is null)
      or (status <> 'active' and ended_at is not null)
    )
);

-- Jedyna reguła jednego aktywnego projektu na użytkownika.
create unique index projects_single_active_per_user_idx
  on public.projects (user_id)
  where status = 'active';

create table public.project_yarns (
  project_id bigint not null
    references public.projects (id) on delete cascade,

-- no action zamiast restrict: pojedyncze usunięcie przypisanego motka jest
-- tak samo blokowane (23503), ale odroczone sprawdzenie pozwala dokończyć
-- kaskadę usuwania konta (auth.users → yarns i projects w jednej instrukcji),
-- zamiast zależeć od kolejności wyzwalaczy kluczy obcych.
  yarn_id bigint not null
    references public.yarns (id) on delete no action deferrable initially deferred,

  role text not null
    check (char_length(trim(role)) between 1 and 100),

  initial_length_meters integer not null
    check (initial_length_meters > 0),

  initial_weight_grams integer not null
    check (initial_weight_grams > 0),

  primary key (project_id, yarn_id)
);

alter table public.projects enable row level security;
alter table public.project_yarns enable row level security;

revoke all on table public.projects from anon, authenticated;
grant select on table public.projects to authenticated;

revoke all on table public.project_yarns from anon, authenticated;
grant select on table public.project_yarns to authenticated;

revoke all privileges on sequence public.projects_id_seq
from public, anon, authenticated;

-- Projekty podlegają tej samej bramce prawnej co włóczki (spójnie z
-- 20260810120111_enforce_current_terms_for_private_data.sql), a tworzenie
-- projektu pozostaje wyłącznie ścieżką backendu.
drop policy if exists projects_select_own on public.projects;
create policy projects_select_own
  on public.projects
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and public.has_current_terms_acceptance()
  );

drop policy if exists project_yarns_select_own on public.project_yarns;
create policy project_yarns_select_own
  on public.project_yarns
  for select
  to authenticated
  using (
    public.has_current_terms_acceptance()
    and exists (
      select 1 from public.projects p
      where (select auth.uid()) = p.user_id
        and p.id = project_id
    )
  );

-- Wariant bramki z jawnym identyfikatorem wyłącznie dla backendu; role API
-- korzystają z wersji bezargumentowej, zawsze odczytującej status z JWT.
create or replace function public.has_current_terms_acceptance(p_user_id uuid)
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
      and acceptance.user_id = p_user_id
  );
$$;

revoke all on function public.has_current_terms_acceptance(uuid)
from public, anon, authenticated;
grant execute on function public.has_current_terms_acceptance(uuid)
to service_role;

-- Jedyne tworzenie projektu: backend ponownie wylicza pełne dopasowanie i woła
-- RPC jako service_role z jawnym identyfikatorem właścicielki.
create or replace function public.create_active_project(
  p_user_id uuid,
  p_pattern_id bigint,
  p_variant_id text,
  p_expected_yarn_version bigint,
  p_assignments jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := p_user_id;
  current_version bigint;
  created_project public.projects;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if not public.has_current_terms_acceptance(current_user_id) then
    raise exception using errcode = '42501', message = 'current terms acceptance required';
  end if;

  insert into private.yarn_store_versions (user_id)
  values (current_user_id)
  on conflict (user_id) do nothing;

  select version into current_version
  from private.yarn_store_versions
  where user_id = current_user_id
  for update;

  -- Precondition magazynu: klient musiał widzieć bieżący stan włóczek.
  if current_version is distinct from p_expected_yarn_version then
    raise exception using errcode = 'P0003', message = 'yarn version conflict';
  end if;

  if jsonb_typeof(p_assignments) is distinct from 'array'
    or jsonb_array_length(p_assignments) = 0 then
    raise exception using errcode = 'P0001', message = 'invalid project assignments';
  end if;

  -- Własność i kształt przypisań: wyłącznie własne motki, dodatnie wartości.
  if exists (
    select 1
    from jsonb_array_elements(p_assignments) as assignment
    where jsonb_typeof(assignment) is distinct from 'object'
      or coalesce(char_length(assignment->>'role'), 0) not between 1 and 100
      or coalesce((assignment->>'initial_length_meters')::int, 0) < 1
      or coalesce((assignment->>'initial_weight_grams')::int, 0) < 1
      or not exists (
        select 1 from public.yarns y
        where y.user_id = current_user_id
          and y.id = (assignment->>'yarn_id')::bigint
      )
  ) then
    raise exception using errcode = 'P0002', message = 'yarn not found or invalid assignment';
  end if;

  -- Obrona w głębi: częściowy indeks unikalny pozostaje twardą regułą.
  if exists (
    select 1 from public.projects
    where user_id = current_user_id
      and status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'active project already exists';
  end if;

  insert into public.projects (user_id, pattern_id, variant_id, status)
  values (current_user_id, p_pattern_id, p_variant_id, 'active')
  returning * into created_project;

  insert into public.project_yarns (project_id, yarn_id, role, initial_length_meters, initial_weight_grams)
  select created_project.id,
         (assignment->>'yarn_id')::bigint,
         assignment->>'role',
         (assignment->>'initial_length_meters')::int,
         (assignment->>'initial_weight_grams')::int
  from jsonb_array_elements(p_assignments) as assignment;

  return jsonb_build_object('project', to_jsonb(created_project));
end;
$$;

revoke all on function public.create_active_project(uuid, bigint, text, bigint, jsonb)
from public, anon, authenticated;
grant execute on function public.create_active_project(uuid, bigint, text, bigint, jsonb)
to service_role;

comment on table public.projects is
  'Projekt użytkownika powstający z pełnego dopasowania; dokładnie jeden aktywny na użytkownika.';
comment on table public.project_yarns is
  'Serwerowo wyznaczone przypisania motków do ról; właściciel ma wyłącznie odczyt.';
