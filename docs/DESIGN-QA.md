# Design QA

## Obowiązujący interfejs

Motek ma dokładnie cztery routowalne widoki:

| Widok | Kontrakt DOM | Główne zadanie |
| --- | --- | --- |
| Konto | `#accountView[data-view="account"]` | logowanie, rejestracja, recovery, prawo, hasło i usunięcie konta |
| Magazyn | `#inventoryView[data-view="inventory"]` | statystyki oraz dodawanie, edycja i usuwanie włóczek |
| Dopasowanie | `#matchesView[data-view="matches"]` | kryteria i potwierdzone wyniki dopasowania, panel `#activeProjectPanel` aktywnego projektu z formularzem codziennego postępu (+1/−1, jednostka, notatka, drut, próbka) |
| Katalog | `#catalogView[data-view="catalog"]` | wyszukiwanie, filtry i stronicowane ładowanie wzorów |

Główna nawigacja używa tekstowych etykiet `Magazyn`, `Dopasowanie`, `Katalog`, `Konto` oraz odpowiadających im `data-view-target`. Bramka ponownej akceptacji prawa jest częścią Konta i nie tworzy piątego widoku.

## Motywy

- jasny `light` — „Koloroterapia”, domyślny;
- ciemny `dark` — „Nocny Motek”.

Przełącznik `#themeToggle` jest przyciskiem z `aria-label` i `aria-pressed`. Wybór jest zapisywany lokalnie pod kluczem `motek-theme-v1`, a `data-theme` i `color-scheme` są ustawiane na elemencie dokumentu.

Kolory akcji, tekstu, paneli, focusu i komunikatów muszą korzystać z tokenów właściwego motywu. Interfejs respektuje `prefers-reduced-motion: reduce`.

## Grafiki PNG i WebP

| Plik | Rola |
| --- | --- |
| `assets/color-yarn-cat.png` | źródłowy PNG jasnego motywu |
| `assets/night-yarn-cat.png` | źródłowy PNG ciemnego motywu |
| `assets/color-yarn-cat.v1.webp` | zoptymalizowany asset runtime jasnego motywu |
| `assets/night-yarn-cat.v1.webp` | zoptymalizowany asset runtime ciemnego motywu |

Każdy z czterech widoków ma obraz z `data-light-src` i `data-dark-src` wskazującymi wersjonowane WebP. Obrazy mają niepusty `alt`. Serwer podaje WebP z rocznym `Cache-Control: public, max-age=31536000, immutable`.

Magazyn zachowuje panoramiczny układ hero, `object-fit: cover` i punkt obrazu `72% center`. Dopasowanie pokazuje hero przed przestrzenią kryteriów i wyników. Magazyn i Dopasowanie nie mają tekstowych nakładek na grafice.

## Checkpointy responsywne

Każdy z czterech widoków należy sprawdzić w obu motywach przy dokładnych szerokościach:

| Szerokość | Oczekiwany kontrakt |
| ---: | --- |
| 1440 px | pełny desktop: czytelna nawigacja, panoramiczne hero, dwukolumnowy magazyn i widoczne przestrzenie robocze |
| 1024 px | zwężony desktop/tablet landscape: brak poziomego scrolla, zachowana hierarchia i pełne cele dotykowe |
| 768 px | tablet: półki magazynu przechodzą do jednej kolumny, kolejność treści pozostaje logiczna |
| 390 px | telefon: jedna kolumna, skrócone hero Konta, rozwijane filtry Katalogu, nawigacja nie zasłania logowania |

Macierz ręczna obejmuje 32 kombinacje: 4 widoki × 2 motywy × 4 szerokości. Dla każdej należy sprawdzić treść, focus, brak obcięcia, brak poziomego scrolla, czytelność komunikatów i zmianę grafiki razem z motywem.

## Dostępność i stabilne kontrakty DOM

- `main` jest celem linku pomijającego nawigację; `:focus-visible` ma widoczny kontrast.
- Tytuły sekcji są połączone przez `aria-labelledby`.
- Komunikaty zwykłe używają `role="status"` i `aria-live="polite"`; błędy używają `role="alert"` i `aria-live="assertive"`.
- Ostrzeżenie o bezczynności ma `role="alertdialog"`.
- Przełącznik trybu Konto zachowuje `tablist`, `tab`, `tabpanel`, `aria-selected`, `aria-controls` i kolejność klawiatury.
- Cele dotykowe ikon mają co najmniej 44 × 44 px.
- Przyciski pokazywania hasła ujawniają wartość tylko podczas przytrzymania i wracają do `type="password"` po puszczeniu, wyjściu kursora albo utracie focusu.
- Formularze Auth mają jawne `method="post"` i `action`; nie mogą wysyłać haseł w query stringu.
- Kolejność DOM na mobile to nagłówek/akcje → grafika → statystyki lub kryteria → dane robocze. CSS nie może odwracać znaczenia tej kolejności.
- Stabilne identyfikatory używane przez kontrolery, między innymi `#inventoryStats`, `#inventoryAddYarnBtn`, `#catalogFilters`, `#patternCatalog`, formularze Auth i bramka prawa, są częścią kontraktu.

## Testy pokrywające kontrakt

| Zakres | Dokładne testy |
| --- | --- |
| Cztery widoki, nawigacja, theme toggle, obrazy, DOM hooks, legal gate, 44 px, reduced motion | `test/design-regression.test.js` |
| Filtry techniki w Dopasowaniu i Katalogu oraz kolejność ładowania `technique-policy.js` | `test/design-regression.test.js`, `test/client-policy.test.js`, `test/technique-policy.test.js` |
| Kolejność mobile, układ Magazynu i Dopasowania, Konto, Auth forms, filtry, asset cache, crop | `test/design-layout.test.js` |
| Przełączanie, zapis i tokeny obu motywów | `test/theme-policy.test.js` |
| Role i poziomy `aria-live` komunikatów | `test/dom-utils.test.js` |
| Bezpieczne przytrzymanie przycisku hasła | `test/password-reveal-dom.test.js` |
| Dostępne podsumowanie stronicowanego katalogu | `test/catalog-pagination-dom.test.js` |
| Kontrolery Katalogu i Auth oraz obsługa focusu | `test/catalog-controller.test.js`, `test/auth-controller.test.js` |

Minimalne polecenie:

```powershell
node --test test/design-regression.test.js test/design-layout.test.js test/theme-policy.test.js test/dom-utils.test.js test/password-reveal-dom.test.js test/catalog-pagination-dom.test.js test/catalog-controller.test.js test/auth-controller.test.js
```

Testy DOM nie zastępują ręcznej kontroli 1440/1024/768/390 ani sprawdzenia kontrastu w przeglądarce.
