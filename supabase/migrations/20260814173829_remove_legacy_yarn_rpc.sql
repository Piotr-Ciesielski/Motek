-- The application uses the versioned yarn RPCs. Keep this cleanup separate
-- from the legal/recovery delta so it can be executed only after the
-- compatibility window and external dependency preflight are complete.
drop function if exists public.insert_yarn_with_limit(
  text,
  text,
  text,
  text,
  integer,
  integer
);

drop function if exists public.insert_yarn_with_limit(
  text,
  text,
  text[],
  text,
  integer,
  integer
);
