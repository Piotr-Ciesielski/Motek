-- Motek: jawne wymagania potrzebne do automatycznego dopasowania wzoru.
-- Brak danych oznacza brak możliwości potwierdzenia wykonalności wzoru.

alter table public.patterns
  add column matching_requirements jsonb not null default '{"variants": []}'::jsonb
  check (jsonb_typeof(matching_requirements) = 'object');

comment on column public.patterns.matching_requirements is
  'Kompletne wymagania dopasowania dla wariantów lub rozmiarów; system nie uzupełnia braków domysłami.';
