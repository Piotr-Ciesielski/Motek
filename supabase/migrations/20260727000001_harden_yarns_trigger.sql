-- Ogranicz search_path funkcji triggera, aby nazwy obiektów nie mogły
-- zostać podmienione przez obiekty z innego schematu.

alter function public.set_yarns_updated_at()
  set search_path = '';
