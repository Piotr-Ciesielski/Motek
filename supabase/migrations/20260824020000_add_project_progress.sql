-- Etap 3: codzienny postęp aktywnego projektu (SPEC.md, „Etap 3”).
alter table public.projects
  add column progress_unit text not null default 'row'
    constraint projects_progress_unit_check check (progress_unit in ('row', 'round')),
  add column progress_count integer not null default 0
    constraint projects_progress_count_check check (progress_count >= 0),
  add column note text
    constraint projects_note_length_check check (char_length(note) <= 500),
  add column tool_size_mm numeric(4, 1)
    constraint projects_tool_size_range_check check (tool_size_mm between 0.5 and 50.0),
  add column gauge text
    constraint projects_gauge_length_check check (char_length(gauge) <= 120);

-- Jedyne zapisywanie postępu: blokuje aktywny projekt właścicielki,
-- wymaga aktualnej akceptacji regulaminu, waliduje granice jak backend
-- i atomowo zwiększa wersję projektu.
create or replace function public.update_active_project_progress(
  p_expected_version bigint,
  p_progress_unit text,
  p_progress_count integer,
  p_note text,
  p_tool_size_mm numeric,
  p_gauge text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  active_row public.projects;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if not public.has_current_terms_acceptance() then
    raise exception using errcode = '42501', message = 'current terms acceptance required';
  end if;

  select *
  into active_row
  from public.projects
  where user_id = current_user_id
    and status = 'active'
  for update;

  if active_row.id is null then
    raise exception using errcode = 'P0001', message = 'no active project';
  end if;

  -- Obrona w głębi: te same granice co walidacja backendu.
  if p_progress_unit not in ('row', 'round')
    or p_progress_count is null or p_progress_count < 0
    or char_length(coalesce(p_note, '')) > 500
    or char_length(coalesce(p_gauge, '')) > 120
    or (
      p_tool_size_mm is not null
      and (
        p_tool_size_mm < 0.5
        or p_tool_size_mm > 50.0
        or p_tool_size_mm <> round(p_tool_size_mm, 1)
      )
    )
  then
    raise exception using errcode = 'P0002', message = 'invalid progress payload';
  end if;

  update public.projects
  set progress_unit = p_progress_unit,
      progress_count = p_progress_count,
      note = p_note,
      tool_size_mm = p_tool_size_mm,
      gauge = p_gauge,
      version = version + 1,
      updated_at = now()
  where id = active_row.id
    and version = p_expected_version;

  if not found then
    raise exception using errcode = 'P0003', message = 'project version conflict';
  end if;

  select * into active_row from public.projects where id = active_row.id;
  return jsonb_build_object('project', to_jsonb(active_row));
end;
$$;

revoke execute on function public.update_active_project_progress(bigint, text, integer, text, numeric, text)
from public, anon, authenticated;
grant execute on function public.update_active_project_progress(bigint, text, integer, text, numeric, text)
to authenticated;

comment on column public.projects.progress_unit is
  'Jednostka codziennego postępu: row (rzędy) albo round (okrążenia).';
comment on function public.update_active_project_progress(bigint, text, integer, text, numeric, text) is
  'Atomowy zapis postępu wyłącznie aktywnego projektu właścicielki z kontrolą wersji i bramką regulaminu.';
