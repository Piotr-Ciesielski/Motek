# QA wierności makiet — 2026-08-08

## Historyczny baseline staging (poprzedni etap)

Branch staging: `staging`
Commit: `cf60ce65`
Adres: `https://staging.rysia.org/`

## Lokalny kandydat `auth-header-account-ux`

Zmiany nagłówka i konta są lokalnym kandydatem do wydania. Nie są w tym dokumencie deklarowane jako wdrożone na stagingu ani produkcji; dotyczą ich wyłącznie lokalne sprawdzenia automatyczne poniżej.

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

- `node --test --test-isolation=none test/auth-controller.test.js test/design-layout.test.js test/design-regression.test.js` — 49/49. Obejmuje nagłówek „Zaloguj”/„Wyloguj”, fokus logowania, brak e-maila w nagłówku oraz zwijane usuwanie konta.
- `npm run check` — 297/297.
- `npm run lint` — 0 błędów, 4 wcześniejsze ostrzeżenia.
- `git diff --check` — bez błędów białych znaków (Git zgłosił tylko istniejące ostrzeżenia normalizacji LF/CRLF w zmienionych plikach).
- `npm run staging:check` — 15/15.
- CI staging — test i migracje bazy zakończone powodzeniem.
- Historyczny Browser QA poprzedniego etapu (niepowtarzany dla auth-header-account-ux): desktop oraz 390×844; `scrollWidth === clientWidth` dla Magazynu, Dopasowania, Katalogu i Konta.
- Parity QA po publikacji: staging i produkcja wskazują `styles.css`, `app.js` oraz `catalog-controller.js` w wersji `2.0.0-alpha.39`; oba środowiska mają aktualne reguły pełnej ekspozycji grafik bez overlayu.
- `npm run format:check` nadal zgłasza cztery niezmienione pliki konfiguracyjne (`eslint.config.js`, `.prettierrc.json`, `package.json`, `.github/workflows/ci.yml`).

