create table public.patterns (
  id bigint generated always as identity primary key,

  name text not null
    check (char_length(trim(name)) between 1 and 200),

  description text not null
    check (char_length(trim(description)) between 1 and 1000),

  materials text[] not null default '{}',

  meters_per_100g numeric(10, 2)
    check (meters_per_100g is null or meters_per_100g > 0),

  yarn_requirements jsonb not null default '[]'::jsonb
    check (jsonb_typeof(yarn_requirements) = 'array'),

  source_filename text not null unique,

  source_language text not null default 'unknown'
    check (source_language in ('pl', 'en', 'mixed', 'unknown')),

  needs_review boolean not null default true,

  created_at timestamptz not null default now()
);

alter table public.patterns enable row level security;

grant select, insert, update, delete
on table public.patterns
to service_role;

grant usage, select
on sequence public.patterns_id_seq
to service_role;

comment on table public.patterns is
  'Metadane wzorów dziewiarskich pozyskane z lokalnych plików PDF.';

comment on column public.patterns.meters_per_100g is
  'Długość głównej włóczki znormalizowana do liczby metrów na 100 gramów.';

comment on column public.patterns.yarn_requirements is
  'Lista wszystkich włóczek wymaganych przez wzór wraz z rolą, materiałami i parametrem metrów na 100 gramów.';

comment on column public.patterns.source_filename is
  'Nazwa lokalnego pliku PDF, z którego pozyskano informacje.';
