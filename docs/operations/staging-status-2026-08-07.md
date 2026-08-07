# Zweryfikowany stan stagingu — 2026-08-07

Ten dokument jest krótkim raportem operacyjnym, a nie deklaracją wydania
produkcyjnego.

## Aktualny snapshot

- domena: `https://staging.rysia.org`;
- branch: `staging`;
- commit: `6719138ebe98853ef6376416a025148cf415b789`;
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
- Railway staging: deployment commitu `6719138e` zakończony sukcesem;
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
