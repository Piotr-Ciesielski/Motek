# QA wierności makiet — 2026-08-08

Branch staging: `agent/motek-design-reference`  
Commit: `f0c531f`  
Adres: `https://staging.rysia.org/`

## Macierz wizualna

| Widok | Desktop | Mobile 390px | Wynik |
| --- | --- | --- | --- |
| Magazyn | szeroki hero, pełna ekspozycja nocnego WebP, brak overlayu/pasów | obraz i akcje mieszczą się w jednej kolumnie | OK |
| Dopasowanie | pełnoekranowa grafika nad workspace, kryteria i wyniki zachowane | brak poziomego overflow, czytelne CTA | OK |
| Katalog | hero i filtry mają wspólną szeroką hierarchię z makietą | filtr disclosure i jedna kolumna | OK |
| Konto | grafika pozostaje częścią panelu, strefa usuwania ma kontrast ostrzegawczy | auth/security składa się pionowo | OK |

## Różnice świadomie zachowane

Makieta Katalogu pokazuje bibliotekę włóczek i fotografie motków, a działający produkt jest katalogiem wzorów z filtrami, paginacją i stanami częściowego pobierania. Makieta Konta pokazuje projekty, powiadomienia i metryki, których obecny backend nie dostarcza; staging pokazuje prawdziwe logowanie, odzyskiwanie i usuwanie konta. Dopasowanie zachowuje realne kryteria i wyniki wzorów zamiast makietowych filtrów włóczek.

## Sprawdzenia

- `node --test test/design-regression.test.js test/design-layout.test.js` — 28/28.
- `npm run check` — 286/286.
- `npm run lint` — 0 błędów, 4 wcześniejsze ostrzeżenia.
- `npm run staging:check` — 15/15.
- CI staging — test i migracje bazy zakończone powodzeniem.
- Browser QA: desktop oraz 390×844; `scrollWidth === clientWidth` dla Magazynu, Dopasowania, Katalogu i Konta.
- `npm run format:check` nadal zgłasza cztery niezmienione pliki konfiguracyjne (`eslint.config.js`, `.prettierrc.json`, `package.json`, `.github/workflows/ci.yml`).

