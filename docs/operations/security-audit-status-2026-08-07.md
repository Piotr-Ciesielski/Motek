# Status audytu bezpieczeństwa — 2026-08-07

## Zakres

Audyt restrykcyjny wykonano bez upgrade'u Supabase do planu Pro. Nie uruchamiano zdalnych migracji ani wdrożenia produkcyjnego.

## Wdrożone lokalnie

- odtwarzalna migracja ACL prywatnego licznika włóczek i odebranie bezpośrednich mutacji `yarns`;
- wymagane, podpisane cookie aktywności sesji;
- dodatkowa ochrona endpointu zmiany hasła po przepływie recovery;
- bezpieczne zachowanie przy awarii profilu, logout i timeout body;
- limity żądań dla katalogu, dopasowań i recovery oraz ograniczenie kosztu dopasowań;
- przypięcie `supabase/setup-cli` do pełnego SHA i semantyczny test konfiguracji stagingu.

## Ograniczenia i prace otwarte

- Leaked Password Protection pozostaje niedostępna na Supabase Free.
- Pełny jednorazowy grant recovery wymaga trwałego magazynu/zużycia po stronie bazy; obecne cookie jest krótkotrwałe i podpisane.
- Pełne testy pgTAP wymagają lokalnego Postgresa/Dockera.
- Produkcyjna konfiguracja proxy i migracje wymagają osobnej zgody przed wykonaniem.
- `client/auth-controller.js` pozostaje niepodłączonym modułem pomocniczym; produkcyjny przepływ nadal obsługuje `app.js`.

## Weryfikacja

Przeszły testy migracji, tras wzorców i testy regresji Auth uruchomione selektywnie. Pełny `npm run check` wymaga osobnej diagnostyki, ponieważ istniejący harness testów serwera pozostawia procesy i nie kończy się deterministycznie.
