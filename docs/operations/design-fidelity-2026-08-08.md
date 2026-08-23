# QA wierności makiet — 2026-08-08

## Historyczny baseline staging (poprzedni etap)

Branch staging: `staging`
Commit: `cf60ce65`
Adres: `https://staging.rysia.org/`

## Finalne wdrożenie `auth-header-account-ux`

| Element | Stan potwierdzony dla finalnego wdrożenia |
| --- | --- |
| Commit | `c4b777a5f8a96277c0e7fb7ca6ec52d425a0900b` (`ui: align auth action typography`) |
| Staging | `https://staging.rysia.org/` — wdrożony finalny commit |
| Produkcja | `https://www.rysia.org/` — wdrożony finalny commit |
| Gotowość | `/health/ready` oraz `/health/release` — ready |
| CI i regresja | potwierdzone jako zielone dla finalnego wdrożenia |

Finalny commit dopasowuje typografię przycisku `Zaloguj`/`Wyloguj` do nagłówka: używa koloru pomocniczego, rozmiaru `0.9rem` i grubości `650`, przy zachowaniu kontraktu 44 px obszaru interakcji.

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
- Historyczny Browser QA poprzedniego etapu (niepowtarzany dla auth-header-account-ux ani finalnego commitu `c4b777a`): desktop oraz 390×844; `scrollWidth === clientWidth` dla Magazynu, Dopasowania, Katalogu i Konta.
- Parity QA po publikacji: staging i produkcja wskazują `styles.css`, `app.js` oraz `catalog-controller.js` w wersji `2.0.0-alpha.39`; oba środowiska mają aktualne reguły pełnej ekspozycji grafik bez overlayu.
- `npm run format:check` nadal zgłasza cztery niezmienione pliki konfiguracyjne (`eslint.config.js`, `.prettierrc.json`, `package.json`, `.github/workflows/ci.yml`).

