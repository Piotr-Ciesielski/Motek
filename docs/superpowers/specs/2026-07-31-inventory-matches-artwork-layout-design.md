# Układ grafik Magazynu i Dopasowania — opis projektu

## Cel

Przywrócić rozdzielenie dwóch prezentacji grafik zatwierdzonych dla designów
04 „Koloroterapia” i 05 „Nocny Motek”: szeroki hero ma być widoczny w zakładce
„Dopasowanie”, a pionowa prezentacja po prawej w zakładce „Magazyn”.

## Projekt

### Korekta względem pierwszej implementacji

Źródłem prawdy dla kompozycji są zaakceptowane warianty `?variant=color` i
`?variant=night` z PR #8. Oznacza to układ asymetryczny: nagłówek, cztery
moduły statystyk i lista zapasu pozostają w lewej kolumnie, a pionowa fotografia
rozciąga się po prawej przez wysokość całego widoku. Dopasowanie zachowuje
osobną kartę z grafiką z magazynu.

- „Magazyn” otrzymuje dwukolumnowy układ: główna treść po lewej oraz pionowy
  panel graficzny po prawej, obejmujący wizualnie nagłówek i listę zapasu.
- „Dopasowanie” otrzymuje kartę hero z tekstem i szeroką grafiką po prawej,
  wykorzystującą wersjonowane assety `color-yarn-cat.v1.webp` i
  `night-yarn-cat.v1.webp`.
- W jasnym motywie oba miejsca używają `color-yarn-cat.v1.webp`, a w ciemnym
  `night-yarn-cat.v1.webp`. Opisy alternatywne i podpisy są aktualizowane
  razem z motywem.
- Grafiki produkcyjne są dostarczane jako wersjonowane pliki WebP, a źródłowe
  PNG pozostają w repozytorium jako materiał bazowy. Serwer cache'uje WebP
  przez rok z `immutable`, dzięki czemu zmiana motywu nie pobiera ponownie
  obrazu już zapisanego w pamięci przeglądarki.
- Grafika w panelu Magazynu zachowuje pionową kompozycję prototypów: używa
  `object-fit: cover` i `object-position: right center`. Nie zmienia to rozmiaru
  ani zasad cache'owania WebP. Magazyn i Dopasowanie nie pokazują tekstowych
  nakładek ani ramek.
- Na ekranach do 960 px układ przechodzi do jednej kolumny; obraz pozostaje
  widoczny i pojawia się pod treścią.

## Zakres techniczny

- `index.html`: rozdzielenie hero Magazynu i Dopasowania oraz dodanie
  pionowego panelu obrazu.
- `app.js`: dwa niezależne elementy obrazu sterowane przez istniejący
  `renderThemeToggle()`.
- `styles.css`: układy desktop/mobile, kadrowanie `object-fit: cover`,
  tokeny istniejących motywów i dostępne podpisy.
- `server.js`: osobne cachowanie wersjonowanych grafik WebP i ich serwowanie.
- `test/server.test.js`, `test/design-layout.test.js`: zachowanie dostępności
  assetów oraz gwarancja użycia lżejszych, cache'owalnych grafik.
- `README.md`, `SPEC.md`, `CHANGELOG.txt`: opis rozdzielenia grafik.

## Kryteria akceptacji

1. W Magazynie obraz znajduje się po prawej stronie i zachowuje pionowe kadrowanie
   oraz ognisko po prawej, jak w zatwierdzonych prototypach, bez nakładki tekstowej
   i ramki.
2. W Dopasowaniu widoczna jest osobna karta hero z grafiką po prawej, bez nakładki
   tekstowej i ramki.
3. Przełączenie motywu aktualizuje oba obrazy i tekst alternatywny,
   ale po pierwszym pobraniu nie transferuje ponownie tego samego pliku.
4. Oba widoki zachowują istniejące przyciski, formularze i wyniki dopasowania.
5. Układ mobilny nie powoduje poziomego przewijania.
6. Testy aplikacji i kontrola diffu przechodzą bez błędów.
