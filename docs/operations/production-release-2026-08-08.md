# Wydanie produkcji i parity stagingu — 2026-08-08

## Historyczny baseline produkcji alpha.39

To jest zapis wcześniejszego wydania wizualnego alpha.39 oraz kontroli, że produkcja dostarcza ten sam pakiet frontendu co staging. Kod aplikacji nie był zmieniany podczas końcowej naprawy rozjazdu — problem dotyczył artefaktu serwowanego przez produkcję.

## Źródła i wdrożenia

| Element | Wartość |
| --- | --- |
| Staging | `https://staging.rysia.org` |
| Staging SHA | `cf60ce65a02f7285977d6f6301345efbafc7936b` |
| Produkcja | `https://www.rysia.org` |
| Produkcja SHA | `1991f139ce219a98d711c596dd47cf6ec499897b` |
| Wersja | `2.0.0-alpha.39` |
| Railway production deployment | `7b0b1f56-6029-4e39-9eea-00542e67fe38` |
| Healthcheck | `/health/ready` — OK |

Drzewo plików stagingu i produkcji było identyczne (`git diff cf60ce65 1991f139` bez różnic). Pierwszy lokalny upload Railway zakończył się zdrowo, ale publiczna produkcja nadal zwracała odwołania `alpha.38`. Ponowne wdrożenie przez `railway redeploy --from-source --yes` przełączyło produkcję na właściwy artefakt z repozytorium `main`.

## Kontrola publicznego frontendu

Po wdrożeniu przeglądarka potwierdziła w obu domenach identyczne odwołania:

- `styles.css?v=2.0.0-alpha.39`;
- `app.js?v=2.0.0-alpha.39`;
- `client/catalog-controller.js?v=2.0.0-alpha.39&rev=855dd0b`.

W produkcyjnym CSS obecne są również kluczowe reguły końcowego treatmentu grafik:

- Magazyn i Dopasowanie: `opacity: 1` dla obrazów;
- brak dodatkowego gradientu w `::after`;
- wspólna kompozycja grafik z Katalogiem w jasnym i ciemnym motywie.

Różny ekran startowy użytkownika (np. zalogowany Magazyn na stagingu i formularz Konta na produkcji) wynika z sesji przeglądarki, a nie z różnicy kodu.

## Finalne wdrożenie auth-header-account-ux

| Element | Stan potwierdzony dla finalnego wdrożenia |
| --- | --- |
| Commit | `c4b777a5f8a96277c0e7fb7ca6ec52d425a0900b` (`ui: align auth action typography`) |
| Staging | `https://staging.rysia.org/` — wdrożony finalny commit |
| Produkcja | `https://www.rysia.org/` — wdrożony finalny commit |
| Health i release | `/health/ready` oraz `/health/release` — ready |
| CI i regresja | potwierdzone jako zielone dla finalnego wdrożenia |

Zmiana finalna dotyczy wyłącznie typografii przycisku `Zaloguj`/`Wyloguj`: kolor jest pomocniczy, rozmiar wynosi `0.9rem`, a grubość `650`. Nie zapisano nowego Browser QA dla tego commitu; wpisy wizualne i parity alpha.39 powyżej są historycznym baseline.

## Procedura na przyszłość

1. Sprawdź czysty worktree i zgodność `HEAD` z `origin/main`.
2. Uruchom `railway redeploy --from-source --yes --service Motek --environment production`.
3. Poczekaj na `Online` oraz pomyślny `/health/ready`.
4. Odczytaj z publicznego HTML wersje `styles.css`, `app.js` i kontrolera katalogu.
5. Jeśli produkcja wskazuje starszy cache-buster, nie zmieniaj CSS na ślepo — ponów wdrożenie ze źródła i sprawdź routing/cache przed publikacją.
