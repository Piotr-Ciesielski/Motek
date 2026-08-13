# Backup i próba odtworzenia Motka — 2026-08-13

## Wynik

Backup schematu produkcyjnego i lokalna próba odtworzenia zakończyły się
powodzeniem. Produkcja i staging nie były modyfikowane.

## Zakres

- projekt: `Motek Production` (`vueotocjsgzosqzhcish`),
- narzędzie: lokalny Supabase CLI `2.111.0`,
- zakres: schematy `private` i `public`, bez danych użytkowników,
- pliki:
  - `tmp/motek-production-private-schema.sql` — 2475 bajtów,
  - `tmp/motek-production-public-schema.sql` — 43062 bajty.

SHA-256:

- private: `4CD0AA24571B41AEA9D3233E7F1941087D059DCA5B24FEB3E368A975155AFC12`,
- public: `640AB0EDC7BA8AFD05F9F2D335933E52FE3D412ECFB0CB3841FA053973451905`.

## Próba odtworzenia

Oba pliki odtworzono kolejno w świeżym, izolowanym kontenerze PostgreSQL
opartym o obraz Supabase `17.6.1.156`. Kontener usunięto po weryfikacji.

Wynik kontroli po odtworzeniu:

- schematy: 2 (`private`, `public`),
- tabele/widoki: 5,
- funkcje: 16,
- polityki RLS: 8.

## Napotkane ograniczenie CLI

Jednoczesny dump z parametrem `--schema private,public` przekroczył limit
czasu i nie utworzył pliku. Osobne zrzuty `private` i `public` zakończyły się
poprawnie i zostały użyte do próby odtworzenia.

## Bezpieczeństwo i granice

- Hasło bazy zostało zresetowane przed właściwym backupem.
- Żadne hasło, token ani dane logowania nie zostały zapisane w repozytorium
  ani w tym dokumencie.
- Jest to backup i rehearsal schematu, nie pełny backup danych.
- Nie wykonano `db push`, migracji, restore do produkcji ani wdrożenia.
- Status produkcji pozostaje `NO-GO` do czasu zamknięcia pozostałych bramek
  legal, infrastrukturalnych i promocyjnych.
