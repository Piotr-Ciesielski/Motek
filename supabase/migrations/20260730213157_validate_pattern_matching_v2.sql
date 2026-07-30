-- Waliduje dokładny, wersjonowany format wymagań dopasowania wzorów.

create or replace function public.validate_pattern_matching_requirements()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  variant jsonb;
  requirement jsonb;
  variant_id text;
  variant_ids text[] := '{}';
  measurement_basis text;
  material_match text;
  quantity_field text;
begin
  if jsonb_typeof(new.matching_requirements) <> 'object'
     or jsonb_typeof(new.matching_requirements->'version') <> 'number'
     or new.matching_requirements->>'version' <> '2'
     or jsonb_typeof(new.matching_requirements->'variants') <> 'array' then
    raise exception using
      errcode = 'P0001',
      message = 'matching_requirements musi być dokumentem wersji 2 z tablicą variants.';
  end if;

  if jsonb_array_length(new.matching_requirements->'variants') > 250 then
    raise exception using
      errcode = 'P0001',
      message = 'matching_requirements może zawierać maksymalnie 250 wariantów.';
  end if;

  for variant in
    select value
    from jsonb_array_elements(new.matching_requirements->'variants')
  loop
    if jsonb_typeof(variant) <> 'object' then
      raise exception using errcode = 'P0001', message = 'Wariant musi być obiektem.';
    end if;

    if jsonb_typeof(variant->'id') <> 'string'
       or btrim(variant->>'id') = ''
       or length(btrim(variant->>'id')) > 100 then
      raise exception using errcode = 'P0001', message = 'Wariant ma nieprawidłowe id.';
    end if;
    variant_id := btrim(variant->>'id');
    if variant_id = any(variant_ids) then
      raise exception using errcode = 'P0001', message = 'Id wariantu musi być unikalne.';
    end if;
    variant_ids := array_append(variant_ids, variant_id);

    if jsonb_typeof(variant->'label') <> 'string'
       or btrim(variant->>'label') = ''
       or length(btrim(variant->>'label')) > 100 then
      raise exception using errcode = 'P0001', message = 'Wariant ma nieprawidłową etykietę.';
    end if;

    if (variant ? 'size') and (
      jsonb_typeof(variant->'size') <> 'string'
      or btrim(variant->>'size') = ''
      or length(btrim(variant->>'size')) > 100
    ) then
      raise exception using errcode = 'P0001', message = 'Wariant ma nieprawidłowy rozmiar.';
    end if;
    if (variant ? 'yarn_option') and (
      jsonb_typeof(variant->'yarn_option') <> 'string'
      or btrim(variant->>'yarn_option') = ''
      or length(btrim(variant->>'yarn_option')) > 100
    ) then
      raise exception using errcode = 'P0001', message = 'Wariant ma nieprawidłową opcję włóczki.';
    end if;

    if jsonb_typeof(variant->'requirements') <> 'array'
       or jsonb_array_length(variant->'requirements') < 1
       or jsonb_array_length(variant->'requirements') > 8 then
      raise exception using
        errcode = 'P0001',
        message = 'Wariant musi zawierać od 1 do 8 ról.';
    end if;

    for requirement in
      select value
      from jsonb_array_elements(variant->'requirements')
    loop
      if jsonb_typeof(requirement) <> 'object' then
        raise exception using errcode = 'P0001', message = 'Rola musi być obiektem.';
      end if;
      if jsonb_typeof(requirement->'role') <> 'string'
         or btrim(requirement->>'role') = ''
         or length(btrim(requirement->>'role')) > 100 then
        raise exception using errcode = 'P0001', message = 'Rola ma nieprawidłową nazwę.';
      end if;

      measurement_basis := requirement->>'measurement_basis';
      if measurement_basis not in ('meters', 'grams') then
        raise exception using errcode = 'P0001', message = 'Rola ma nieprawidłową podstawę pomiaru.';
      end if;

      foreach quantity_field in array array[
        'meters_min',
        'meters_max',
        'grams_min',
        'grams_max',
        'skeins_min',
        'skeins_max',
        'strand_count'
      ]
      loop
        if (requirement ? quantity_field) and (
          jsonb_typeof(requirement->quantity_field) <> 'number'
          or (requirement->>quantity_field)::numeric < 1
          or (requirement->>quantity_field)::numeric > 1000000
          or (requirement->>quantity_field)::numeric % 1 <> 0
        ) then
          raise exception using errcode = 'P0001', message = 'Rola ma nieprawidłową wartość liczbową.';
        end if;
      end loop;

      if not (requirement ? (measurement_basis || '_min')) then
        raise exception using errcode = 'P0001', message = 'Rola nie ma wartości podstawowej.';
      end if;
      foreach quantity_field in array array['meters', 'grams', 'skeins']
      loop
        if (requirement ? (quantity_field || '_max')) and (
          not (requirement ? (quantity_field || '_min'))
          or (requirement->>(quantity_field || '_max'))::numeric
             < (requirement->>(quantity_field || '_min'))::numeric
        ) then
          raise exception using errcode = 'P0001', message = 'Rola ma nieprawidłowy zakres ilości.';
        end if;
      end loop;

      material_match := requirement->>'material_match';
      if material_match not in ('all', 'any', 'any_material') then
        raise exception using errcode = 'P0001', message = 'Rola ma nieprawidłowy tryb materiału.';
      end if;
      if jsonb_typeof(requirement->'materials') <> 'array' then
        raise exception using errcode = 'P0001', message = 'Materiały roli muszą być tablicą.';
      end if;
      if exists (
        select 1
        from jsonb_array_elements(requirement->'materials') as item(value)
        where jsonb_typeof(item.value) <> 'string'
      ) then
        raise exception using errcode = 'P0001', message = 'Materiał roli musi być tekstem.';
      end if;
      if material_match = 'any_material'
         and jsonb_array_length(requirement->'materials') <> 0 then
        raise exception using errcode = 'P0001', message = 'any_material wymaga pustej tablicy materiałów.';
      end if;
      if material_match <> 'any_material' and (
        jsonb_array_length(requirement->'materials') = 0
        or exists (
          select 1
          from jsonb_array_elements_text(requirement->'materials') as material(value)
          where material.value not in (
            'wełna', 'alpaka', 'moher', 'kaszmir', 'angora', 'jak',
            'bawełna', 'len', 'bambus', 'wiskoza', 'jedwab',
            'poliamid', 'poliester', 'akryl', 'mieszanka'
          )
        )
        or (
          requirement->'materials' ? 'mieszanka'
          and jsonb_array_length(requirement->'materials') > 1
        )
        or jsonb_array_length(requirement->'materials') <> (
          select count(distinct material.value)
          from jsonb_array_elements_text(requirement->'materials') as material(value)
        )
      ) then
        raise exception using errcode = 'P0001', message = 'Rola zawiera nieprawidłowy materiał.';
      end if;

      if requirement->>'color_mode' not in ('same', 'any') then
        raise exception using errcode = 'P0001', message = 'Rola ma nieprawidłowy tryb koloru.';
      end if;

      if jsonb_typeof(requirement->'weight_classes') <> 'array'
         or jsonb_array_length(requirement->'weight_classes') = 0 then
        raise exception using errcode = 'P0001', message = 'Rola musi mieć grubość włóczki.';
      end if;
      if exists (
        select 1
        from jsonb_array_elements(requirement->'weight_classes') as item(value)
        where jsonb_typeof(item.value) <> 'string'
      ) then
        raise exception using errcode = 'P0001', message = 'Grubość roli musi być tekstem.';
      end if;
      if exists (
        select 1
        from jsonb_array_elements_text(requirement->'weight_classes') as weight_class(value)
        where weight_class.value not in ('lace', 'fingering', 'sport', 'dk', 'worsted', 'bulky')
      ) then
        raise exception using errcode = 'P0001', message = 'Rola ma nieobsługiwaną grubość.';
      end if;

      foreach quantity_field in array array['held_together_group', 'distinct_color_group']
      loop
        if (requirement ? quantity_field) and (
          jsonb_typeof(requirement->quantity_field) <> 'string'
          or btrim(requirement->>quantity_field) = ''
          or length(btrim(requirement->>quantity_field)) > 100
        ) then
          raise exception using errcode = 'P0001', message = 'Rola ma nieprawidłową nazwę grupy.';
        end if;
      end loop;
    end loop;
  end loop;

  return new;
end;
$$;

revoke execute on function public.validate_pattern_matching_requirements()
  from public, anon, authenticated;
grant execute on function public.validate_pattern_matching_requirements()
  to service_role;

drop trigger if exists patterns_matching_requirements_validation on public.patterns;
create trigger patterns_matching_requirements_validation
  before insert or update of matching_requirements on public.patterns
  for each row execute function public.validate_pattern_matching_requirements();
