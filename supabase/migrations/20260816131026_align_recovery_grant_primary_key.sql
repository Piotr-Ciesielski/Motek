-- Ujednolica historyczny wariant z grant_id z aktywnym kontraktem recovery.
-- Zmiana jest forward-only: błędne dane zatrzymują walidację CHECK i cała
-- transakcja migracji zostaje wycofana bez częściowej przebudowy tabeli.

do $$
declare
  recovery_grants_table regclass := to_regclass('private.auth_recovery_grants');
  primary_key_name text;
  primary_key_columns text[];
  missing_columns text[];
  has_grant_id boolean;
  jti_hash_length_constraint_oid oid;
  jti_hash_length_constraint_definition text;
  expires_after_created_constraint_oid oid;
  expires_after_created_constraint_definition text;
begin
  if recovery_grants_table is null then
    raise exception 'private.auth_recovery_grants must exist before aligning its primary key';
  end if;

  select array_agg(required_column order by required_column)
  into missing_columns
  from unnest(array[
    'user_id',
    'jti_hash',
    'expires_at',
    'used_at',
    'created_at',
    'claimed_at'
  ]::text[]) as required_column
  where not exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = recovery_grants_table
      and attribute.attname = required_column
      and attribute.attnum > 0
      and not attribute.attisdropped
  );

  if missing_columns is not null then
    raise exception 'private.auth_recovery_grants is missing RPC columns: %', missing_columns;
  end if;

  select constraint_row.conname,
         array_agg(attribute.attname order by key_column.ordinality)
  into primary_key_name, primary_key_columns
  from pg_catalog.pg_constraint as constraint_row
  cross join lateral unnest(constraint_row.conkey) with ordinality as key_column(attnum, ordinality)
  join pg_catalog.pg_attribute as attribute
    on attribute.attrelid = constraint_row.conrelid
   and attribute.attnum = key_column.attnum
  where constraint_row.conrelid = recovery_grants_table
    and constraint_row.contype = 'p'
  group by constraint_row.oid, constraint_row.conname;

  select exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = recovery_grants_table
      and attribute.attname = 'grant_id'
      and attribute.attnum > 0
      and not attribute.attisdropped
  )
  into has_grant_id;

  if has_grant_id then
    if primary_key_name is null or primary_key_columns is distinct from array['grant_id']::text[] then
      raise exception 'private.auth_recovery_grants has grant_id but not a grant_id-only primary key';
    end if;

    execute format(
      'alter table private.auth_recovery_grants drop constraint %I',
      primary_key_name
    );
    alter table private.auth_recovery_grants
      add constraint auth_recovery_grants_jti_hash_pkey primary key (jti_hash);
    alter table private.auth_recovery_grants drop column grant_id;
  elsif primary_key_name is null or primary_key_columns is distinct from array['jti_hash']::text[] then
    raise exception 'private.auth_recovery_grants must have jti_hash as its only primary key';
  end if;

  select constraint_row.oid,
         pg_catalog.pg_get_constraintdef(constraint_row.oid, true)
  into jti_hash_length_constraint_oid, jti_hash_length_constraint_definition
  from pg_catalog.pg_constraint as constraint_row
  where constraint_row.conrelid = recovery_grants_table
    and constraint_row.conname = 'auth_recovery_grants_jti_hash_length_check';

  if jti_hash_length_constraint_oid is null then
    alter table private.auth_recovery_grants
      add constraint auth_recovery_grants_jti_hash_length_check
      check (char_length(jti_hash) = 64) not valid;
  elsif regexp_replace(jti_hash_length_constraint_definition, '[[:space:]]+', '', 'g')
    !~* $regex$^CHECK\(\(?char_length\(jti_hash\)=64\)?\)$regex$ then
    raise exception
      'constraint auth_recovery_grants_jti_hash_length_check must have definition CHECK (char_length(jti_hash) = 64); found %',
      jti_hash_length_constraint_definition;
  end if;

  select constraint_row.oid,
         pg_catalog.pg_get_constraintdef(constraint_row.oid, true)
  into expires_after_created_constraint_oid, expires_after_created_constraint_definition
  from pg_catalog.pg_constraint as constraint_row
  where constraint_row.conrelid = recovery_grants_table
    and constraint_row.conname = 'auth_recovery_grants_expires_after_created_check';

  if expires_after_created_constraint_oid is null then
    alter table private.auth_recovery_grants
      add constraint auth_recovery_grants_expires_after_created_check
      check (expires_at > created_at) not valid;
  elsif regexp_replace(expires_after_created_constraint_definition, '[[:space:]]+', '', 'g')
    !~* $regex$^CHECK\(\(?expires_at>created_at\)?\)$regex$ then
    raise exception
      'constraint auth_recovery_grants_expires_after_created_check must have definition CHECK (expires_at > created_at); found %',
      expires_after_created_constraint_definition;
  end if;

  alter table private.auth_recovery_grants
    validate constraint auth_recovery_grants_jti_hash_length_check;
  alter table private.auth_recovery_grants
    validate constraint auth_recovery_grants_expires_after_created_check;
end
$$;
