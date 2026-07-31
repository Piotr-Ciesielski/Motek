# Układ grafik Magazynu i Dopasowania — opis projektu

## Cel

Przywrócić rozdzielenie dwóch prezentacji grafik zatwierdzonych dla designów
04 „Koloroterapia” i 05 „Nocny Motek”: szeroki hero ma być widoczny w zakładce
„Dopasowanie”, a pionowa prezentacja po prawej w zakładce „Magazyn”.

## Projekt

- „Magazyn” otrzymuje dwukolumnowy układ: główna treść po lewej oraz pionowy
  panel graficzny po prawej, obejmujący wizualnie nagłówek i listę zapasu.
- „Dopasowanie” otrzymuje kartę hero z tekstem i szeroką grafiką po prawej,
  wykorzystującą obecne assety `color-yarn-cat.png` i `night-yarn-cat.png`.
- W jasnym motywie oba miejsca używają `color-yarn-cat.png`, a w ciemnym
  `night-yarn-cat.png`. Opisy alternatywne i podpisy są aktualizowane razem
  z motywem.
- Na ekranach do 960 px układ przechodzi do jednej kolumny; obraz pozostaje
  widoczny i pojawia się pod treścią.

## Zakres techniczny

- `index.html`: rozdzielenie hero Magazynu i Dopasowania oraz dodanie
  pionowego panelu obrazu.
- `app.js`: dwa niezależne elementy obrazu sterowane przez istniejący
  `renderThemeToggle()`.
- `styles.css`: układy desktop/mobile, kadrowanie `object-fit: cover`,
  tokeny istniejących motywów i dostępne podpisy.
- `test/server.test.js`: zachowanie testu dostępności obu assetów PNG.
- `README.md`, `SPEC.md`, `CHANGELOG.txt`: opis rozdzielenia grafik.

## Kryteria akceptacji

1. W Magazynie obraz znajduje się po prawej stronie i jest pionowo kadrowany.
2. W Dopasowaniu widoczna jest osobna karta hero z grafiką po prawej.
3. Przełączenie motywu aktualizuje oba obrazy, podpisy i tekst alternatywny.
4. Oba widoki zachowują istniejące przyciski, formularze i wyniki dopasowania.
5. Układ mobilny nie powoduje poziomego przewijania.
6. Testy aplikacji i kontrola diffu przechodzą bez błędów.
