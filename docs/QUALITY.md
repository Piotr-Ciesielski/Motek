# Jakość i testy

## Bramki CI

GitHub Actions uruchamia Node.js 24 i wykonuje:

1. `npm ci`;
2. `npm audit --omit=dev --audit-level=moderate`;
3. testy polityki publikacji prawnej;
4. `npm run lint`;
5. `npm run format:check`;
6. `npm run coverage`;
7. `npm run check`;
8. w osobnym jobie lokalny start Supabase, replay migracji i testy pgTAP.

Job bazy zależy od zielonego joba aplikacji. CI ma uprawnienie tylko do odczytu zawartości repozytorium i nie wykonuje zdalnych migracji ani deployu.

## Progi pokrycia

`npm run coverage` wymaga co najmniej:

| Miara | Próg |
| --- | ---: |
| Linie | 60% |
| Funkcje | 60% |
| Gałęzie | 50% |
| Instrukcje | 60% |

## Lokalne wejścia weryfikacji

```powershell
npm run check
npm run lint
npm run format:check
npm run coverage
npm run legal:check
npm run railway:check
npm run test:db
git diff --check
```

`npm run test:db` uruchamia lokalny stack Supabase, odtwarza migracje i wykonuje pgTAP. Wymaga działającego Docker Desktop lub Podman. Nie jest testem zdalnego środowiska.

Po wdrożeniu stagingu obowiązuje `npm run regression:full`, a po ręcznym wdrożeniu produkcji `npm run regression:smoke`. Pełnej regresji nie uruchamia się na produkcji, ponieważ wykonuje kontrolowany zapis testowy.

## Walidacja dokumentacji

Jedynym wejściem automatycznym jest:

```powershell
npm run docs:check
```

W ramach `npm run check` skrypt sprawdza:

- obecność `README.md`, `SPEC.md`, `docs/ARCHITECTURE.md`, `docs/QUALITY.md`, `docs/SECURITY.md`, `docs/OPERATIONS.md` i `docs/DESIGN-QA.md`;
- poprawność lokalnych linków Markdown;
- brak odwołań do usuwanych raportów, planów, audytów i materiałów projektowych;
- macierz domen, w tym różnicę między kanonicznym `www.staging.rysia.org` i osiągalnym `staging.rysia.org`;
- zgodność nazw kluczy środowiska z `.env.example` bez odczytu wartości `.env`.

Skrypt jest włączony do `npm run check`; pozostałe bramki działają niezależnie.

## Dobór testów do zmiany

- API i sesja: odpowiednie testy `server`, `auth`, routingu oraz polityk;
- Supabase: testy kontraktu migracji i pgTAP;
- katalog i dopasowania: walidacja danych, routing, matching policy i matching service;
- UI: testy DOM, layoutu, motywów i kontrolerów;
- prawo: manifest dostawców, polityka publikacji i `npm run legal:check`;
- dokumentacja: `npm run docs:check`.

Zmianę uznaje się za zweryfikowaną tylko na podstawie świeżego wyniku poleceń. Zielony test lokalny nie potwierdza stanu usług zewnętrznych ani nie daje zgody na zapis poza repozytorium.
