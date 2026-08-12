# Zweryfikowany stan stagingu — 2026-08-07

Ten dokument jest krótkim raportem operacyjnym, a nie deklaracją wydania
produkcyjnego.

## Najnowszy zweryfikowany snapshot — 2026-08-12

- domena: `https://staging.rysia.org`;
- branch: `staging`;
- commit: `301469dfb19e576ac38034c269bdc1089b7690fd`;
- wersja aplikacji: `2.0.0-alpha.39`;
- środowisko: `staging`;
- produkcja pozostała nietknięta.

CI `31605847868` zakończyło sukcesem testy kodu oraz replay wszystkich
migracji i testów bazy. Po wdrożeniu Railway pełna regresja stagingu
`31605875935` również zakończyła się sukcesem. Endpointy zweryfikowano jako:

- `/health/live` → `200`, `status: ok`;
- `/health/ready` → `200`, `status: ready`;
- `/health/release` → `200`, `status: ready`, SHA powyżej,
  `environment: staging`.

Na Supabase Staging zastosowano migrację `add_recovery_grant_claim`.
Zdalny numer migracji to `20260812135011`, a numer pliku repozytorium to
`20260812122131`; jest to różnica numeracji nadana przez narzędzie zdalne,
nie różnica treści migracji.

## Aktualny snapshot

- domena: `https://staging.rysia.org`;
- branch: `staging`;
- commit: `62d0b84eedda8717505ef389d0a40c2858e46e45`;
- wersja aplikacji: `2.0.0-alpha.39`;
- środowisko: `staging`;
- produkcja pozostaje na osobnym branchu `main`.

Endpoint `/health/release` zwraca `status: ready`, powyższy commit i
`environment: staging`. Endpoint `/health/live` zwraca `status: ok`.

## Weryfikacja

- CI GitHub dla `staging`: testy aplikacji, lint, formatowanie, audyt npm,
  coverage i testy bazy zakończone sukcesem;
- pgTAP: 4 pliki, 135 testów, `PASS`;
- regresja po wdrożeniu stagingu: zakończona sukcesem;
- Railway staging: deployment commitu `62d0b84e` zakończony sukcesem;
- Supabase staging: migracja `revoke_yarns_sequence_acl` zastosowana;
  role `anon` i `authenticated` nie mają `USAGE`, `SELECT` ani `UPDATE` do
  `public.yarns_id_seq`.

## Granica produkcji

Weryfikacja Railway potwierdziła, że produkcja nadal działa z wcześniejszego
commitu `9c96cb8b3c2013376bc03d7430b8f572ce9556b9`. Zmiany z tego snapshotu
nie zostały wdrożone na produkcję.

## Wersja lokalna

Główny checkout repozytorium może wskazywać inną wersję i zawierać lokalne,
niezapisane zmiany. Nie należy ich nadpisywać podczas synchronizacji ze
stagingiem; najpierw trzeba osobno uzgodnić zakres scalania.
