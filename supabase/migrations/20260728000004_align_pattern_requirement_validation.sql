-- Ujednolica limity matching_requirements z importerem i backendem.
-- Walidacja działa także dla zapisów wykonywanych przez service_role.

create or replace function public.validate_pattern_matching_requirements()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  variant jsonb;
  requirement jsonb;
begin
  if jsonb_typeof(new.matching_requirements) <> 'object'
     or not (new.matching_requirements ? 'variants')
     or jsonb_typeof(new.matching_requirements->'variants') <> 'array' then
    raise exception using errcode = 'P0001', message = 'matching_requirements musi zawierać tablicę variants.';
  end if;

  if jsonb_array_length(new.matching_requirements->'variants') > 250 then
    raise exception using errcode = 'P0001', message = 'matching_requirements może zawierać maksymalnie 250 wariantów.';
  end if;

  for variant in select value from jsonb_array_elements(new.matching_requirements->'variants') loop
    if jsonb_typeof(variant) <> 'object' then
      raise exception using errcode = 'P0001', message = 'Wariant matching_requirements musi być obiektem.';
    end if;

    if (variant ? 'id') and (jsonb_typeof(variant->'id') <> 'string' or length(variant->>'id') > 100) then
      raise exception using errcode = 'P0001', message = 'Identyfikator wariantu ma niepoprawną długość.';
    end if;
    if (variant ? 'label') and (jsonb_typeof(variant->'label') <> 'string' or length(variant->>'label') > 100) then
      raise exception using errcode = 'P0001', message = 'Etykieta wariantu ma niepoprawną długość.';
    end if;

    if jsonb_typeof(variant->'yarns_needed') <> 'number'
       or jsonb_typeof(variant->'meters_needed') <> 'number'
       or jsonb_typeof(variant->'grams_needed') <> 'number' then
      raise exception using errcode = 'P0001', message = 'Wariant matching_requirements ma niepoprawne pola liczbowe.';
    end if;
    if (variant->>'yarns_needed')::numeric < 1 or (variant->>'yarns_needed')::numeric % 1 <> 0
       or (variant->>'meters_needed')::numeric < 1 or (variant->>'meters_needed')::numeric % 1 <> 0
       or (variant->>'grams_needed')::numeric < 1 or (variant->>'grams_needed')::numeric % 1 <> 0 then
      raise exception using errcode = 'P0001', message = 'Wariant matching_requirements ma niepoprawne wartości liczbowe.';
    end if;

    if jsonb_typeof(variant->'materials') <> 'array'
       or jsonb_array_length(variant->'materials') = 0
       or exists (select 1 from jsonb_array_elements(variant->'materials') as item(value)
                  where jsonb_typeof(item.value) <> 'string' or btrim(item.value #>> '{}') = '' or length(item.value #>> '{}') > 100) then
      raise exception using errcode = 'P0001', message = 'Wariant matching_requirements ma niepoprawne materiały.';
    end if;
    if jsonb_typeof(variant->'weight_classes') <> 'array'
       or jsonb_array_length(variant->'weight_classes') = 0
       or exists (select 1 from jsonb_array_elements(variant->'weight_classes') as item(value)
                  where jsonb_typeof(item.value) <> 'string' or btrim(item.value #>> '{}') = '' or length(item.value #>> '{}') > 100) then
      raise exception using errcode = 'P0001', message = 'Wariant matching_requirements ma niepoprawne grubości.';
    end if;

    if (variant ? 'yarn_requirements') then
      if jsonb_typeof(variant->'yarn_requirements') <> 'array' or jsonb_array_length(variant->'yarn_requirements') > 8 then
        raise exception using errcode = 'P0001', message = 'yarn_requirements musi zawierać od 0 do 8 elementów.';
      end if;
      for requirement in select value from jsonb_array_elements(variant->'yarn_requirements') loop
        if jsonb_typeof(requirement) <> 'object' then
          raise exception using errcode = 'P0001', message = 'Rola yarn_requirements musi być obiektem.';
        end if;
        if (requirement ? 'role') and (jsonb_typeof(requirement->'role') <> 'string' or length(requirement->>'role') > 100) then
          raise exception using errcode = 'P0001', message = 'Rola yarn_requirements ma niepoprawną długość.';
        end if;
        if jsonb_typeof(requirement->'yarns_needed') <> 'number'
           or jsonb_typeof(requirement->'meters_needed') <> 'number'
           or jsonb_typeof(requirement->'grams_needed') <> 'number' then
          raise exception using errcode = 'P0001', message = 'Rola yarn_requirements ma niepoprawne pola liczbowe.';
        end if;
        if (requirement->>'yarns_needed')::numeric < 1 or (requirement->>'yarns_needed')::numeric % 1 <> 0
           or (requirement->>'meters_needed')::numeric < 1 or (requirement->>'meters_needed')::numeric % 1 <> 0
           or (requirement->>'grams_needed')::numeric < 1 or (requirement->>'grams_needed')::numeric % 1 <> 0 then
          raise exception using errcode = 'P0001', message = 'Rola yarn_requirements ma niepoprawne wartości liczbowe.';
        end if;
        if jsonb_typeof(requirement->'materials') <> 'array'
           or jsonb_array_length(requirement->'materials') = 0
           or exists (select 1 from jsonb_array_elements(requirement->'materials') as item(value)
                      where jsonb_typeof(item.value) <> 'string' or btrim(item.value #>> '{}') = '' or length(item.value #>> '{}') > 100) then
          raise exception using errcode = 'P0001', message = 'Rola yarn_requirements ma niepoprawne materiały.';
        end if;
        if jsonb_typeof(requirement->'weight_classes') <> 'array'
           or jsonb_array_length(requirement->'weight_classes') = 0
           or exists (select 1 from jsonb_array_elements(requirement->'weight_classes') as item(value)
                      where jsonb_typeof(item.value) <> 'string' or btrim(item.value #>> '{}') = '' or length(item.value #>> '{}') > 100) then
          raise exception using errcode = 'P0001', message = 'Rola yarn_requirements ma niepoprawne grubości.';
        end if;
      end loop;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists patterns_matching_requirements_validation on public.patterns;
create trigger patterns_matching_requirements_validation
  before insert or update of matching_requirements on public.patterns
  for each row execute function public.validate_pattern_matching_requirements();
