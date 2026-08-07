# Status audytu bezpieczeństwa — 2026-08-07

## Zakres

Audyt restrykcyjny wykonano bez upgrade'u Supabase do planu Pro. Nie uruchamiano zdalnych migracji ani wdrożenia produkcyjnego.

## Wdrożone lokalnie

- odtwarzalna migracja ACL prywatnego licznika włóczek i odebranie bezpośrednich mutacji `yarns`;
- wymagane, podpisane cookie aktywności sesji;
- dodatkowa ochrona endpointu zmiany hasła po przepływie recovery;
- trwały, jednorazowy grant recovery w prywatnej tabeli Supabase oraz globalne
  unieważnienie sesji po zmianie hasła;
- bezpieczne zachowanie przy awarii profilu, logout i timeout body;
- limity żądań dla katalogu, dopasowań i recovery oraz ograniczenie kosztu dopasowań;
- przypięcie `supabase/setup-cli` do pełnego SHA i semantyczny test konfiguracji stagingu.

## Ograniczenia i prace otwarte

- Leaked Password Protection pozostaje niedostępna na Supabase Free.
- Migracja trwałego grantu recovery jest zapisana lokalnie, ale nie została
  jeszcze zastosowana zdalnie ani potwierdzona testem pgTAP.
- Pełne testy pgTAP wymagają lokalnego Postgresa/Dockera.
- Obrazy zewnętrzne WAF i Prometheusa w głównym Compose są przypięte
  digestami `sha256`; obraz `app` jest budowany lokalnie z repozytorium.
- Produkcyjna konfiguracja proxy i migracje wymagają osobnej zgody przed wykonaniem.
- `client/auth-controller.js` pozostaje niepodłączonym modułem pomocniczym; produkcyjny przepływ nadal obsługuje `app.js`.

## Weryfikacja

Przeszły testy migracji, tras wzorców i testy regresji Auth uruchomione selektywnie,
a także bramka stagingu 17/17, lint i formatowanie. Pełny `npm run check` oraz
pełny `test/server.test.js` wymagają osobnej diagnostyki, ponieważ istniejący
harness testów serwera pozostawia procesy i nie kończy się deterministycznie.
