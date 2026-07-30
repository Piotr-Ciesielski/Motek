alter table public.patterns
add column project_type text not null default 'other'
check (
  project_type = any (
    array[
      'socks',
      'sweater',
      'cardigan',
      'top',
      'shawl_scarf',
      'head_accessory',
      'gloves',
      'vest',
      'skirt_dress',
      'blanket',
      'other'
    ]::text[]
  )
);

comment on column public.patterns.project_type is
  'Kontrolowana kategoria projektu używana do prezentacji i filtrowania katalogu.';
