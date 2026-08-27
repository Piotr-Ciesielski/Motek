# Design QA — ds1 „Moje włóczki”

## Wynik

result: passed

## Źródło i stan

- Referencja: `Designs/ds1.png`, dwa panele o łącznej szerokości 1487 px i wysokości 1058 px.
- Zrzuty aplikacji: 744 × 1058 px, gęstość 1×.
- Browser został skalibrowany do 759 × 1079 px, aby zrzut obszaru treści miał dokładnie 744 × 1058 px.
- Stan: użytkownik zalogowany na realistycznych danych testowych, wybrany drugi motek, pełna lista schowka zwinięta.

## Dowody

- `Designs/verification/ds1-light-744x1058.png`
- `Designs/verification/ds1-dark-744x1058.png`
- `Designs/verification/ds1-light-comparison.png`
- `Designs/verification/ds1-dark-comparison.png`

## Iteracje

1. Pierwszy pomiar ujawnił zbyt nisko położony nagłówek, brak trasy włóczki i niewłaściwe proporcje mapy.
2. Korekta ustawiła nagłówek, kota, mapę, pozycje motków i kartę szczegółów zgodnie z siatką mockupu.
3. Ostatnia iteracja powiększyła zaznaczony motek i hankę, dopasowała poświatę oraz osobne palety jasną i ciemną.

## Sprawdzone zachowania

- wybór motka aktualizuje kartę szczegółów i stan `aria-pressed`;
- rozwinięcie pełnego schowka pokazuje 10 kart, a ponowne kliknięcie zwija listę;
- przyciski edycji, dopasowania i dodawania delegują do istniejących formularzy;
- przełącznik motywu zachowuje jasny i ciemny wariant;
- Browser nie zgłosił błędów ani ostrzeżeń w konsoli.

## Pozostałe różnice

- Treści liczbowe i nazwy pochodzą z istniejących danych aplikacji, więc różnią się od statycznej referencji.
- Czwarta karta pozostaje „Konto”, ponieważ aplikacja nie ma trasy „Projekt”.
- Węzeł dodawania oraz dolny stos włóczek są uproszczone względem mockupu; dodatkowa generacja assetów osiągnęła limit usługi.
- Wygenerowane motki i trasa nici nie są pikselowo identyczne z referencją.
- Na zrzucie aplikacji widoczny jest natywny pasek przewijania Browsera.

## Final

passed
