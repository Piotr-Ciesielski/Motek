-- Etap 1: kolumna technique dla wzorów (SPEC.md, sekcja „Etap 1”).
-- Bez defaultu; dwa ograniczenia najpierw NOT VALID, po klasyfikacji
-- dokładnie trzech bieżących rekordów published — VALIDATE.

alter table public.patterns
  add column technique text;

alter table public.patterns
  add constraint patterns_technique_check
  check (technique is null or technique in ('knitting', 'crochet'))
  not valid;

alter table public.patterns
  add constraint patterns_published_technique_check
  check (
    publication_status <> 'published'
    or technique is not null
  )
  not valid;

do $$
declare
  classified integer;
  unclassified integer;
begin
  update public.patterns
  set technique = 'knitting',
      content_audit_version = '1.0',
      content_audited_at = now()
  where source_filename in (
    'HollyBerryCharitySocks.pdf',
    'Kopia pliku na_pole_wzor.pdf',
    'Oslohuen_2.0_ENGELSK.pdf'
  )
    and publication_status = 'published';

  get diagnostics classified = row_count;

  select count(*) into unclassified
  from public.patterns
  where publication_status = 'published'
    and technique is null;

  -- Pusta baza (np. świeższy reset niż import katalogu) nie ma czego
  -- klasyfikować; istniejący katalog musi mieć dokładnie trzy rekordy.
  if unclassified > 0 or classified not in (0, 3) then
    raise exception 'Oczekiwano dokładnie 3 opublikowanych rekordów do klasyfikacji techniki; sklasyfikowano %, bez techniki zostało %.', classified, unclassified;
  end if;
end $$;

alter table public.patterns validate constraint patterns_technique_check;
alter table public.patterns validate constraint patterns_published_technique_check;

comment on column public.patterns.technique is
  'Technika wykonania wzoru: knitting albo crochet; null tylko dla rekordów nieopublikowanych.';
