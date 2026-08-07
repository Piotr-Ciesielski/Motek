# Status audytu bezpieczeństwa — 2026-08-07

## Zakres

Audyt restrykcyjny wykonano bez upgrade'u Supabase do planu Pro. Nie uruchamiano zdalnych migracji ani wdrożenia produkcyjnego.

## Wdrożone lokalnie

- odtwarzalna migracja ACL prywatnego licznika włóczek i odebranie bezpośrednich mutacji `yarns`;
- wymagane, podpisane cookie aktywności sesji;
- dodatkowa ochrona endpointu zmiany hasła po przepływie recovery;
- trwały, jednorazowy grant recovery w prywatnej tabeli Supabase;
- atomowa rezerwacja grantu przed zmianą hasła, zwolnienie po błędzie i globalne
  unieważnienie sesji po sukcesie;
- bezpieczne zachowanie przy awarii profilu, logout i timeout body;
- limity żądań dla katalogu, dopasowań i recovery oraz ograniczenie kosztu dopasowań;
- przypięcie `supabase/setup-cli` do pełnego SHA i semantyczny test konfiguracji stagingu.

## Ograniczenia i prace otwarte

- Leaked Password Protection pozostaje niedostępna na Supabase Free.
- Grant recovery jest zaimplementowany w migracji i backendzie stagingu; test
  pgTAP pozostaje do uruchomienia w środowisku z lokalnym Postgres/Dockerem.
- Pełne testy pgTAP wymagają lokalnego Postgresa/Dockera.
- Produkcyjna konfiguracja proxy i migracje wymagają osobnej zgody przed wykonaniem.
- `client/auth-controller.js` pozostaje niepodłączonym modułem pomocniczym; produkcyjny przepływ nadal obsługuje `app.js`.

## Weryfikacja

Przeszły testy serwera Auth 30/30, testy migracji i tras wzorców oraz bramka
stagingu. Lint, formatowanie i `npm audit` są zielone. Testy pgTAP wymagają
środowiska bazodanowego; pełny `npm run check` pozostaje osobną bramką.
