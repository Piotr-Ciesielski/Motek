# Zamykanie dropdownu „Materiały” i ręczna produkcja

## Cel

Ułatwić wpisywanie danych nowej włóczki: rozwinięty dropdown „Materiały” ma
zamykać się po kliknięciu dowolnego pola formularza poza dropdownem. Kliknięcie
checkboxu materiału pozostaje wewnątrz dropdownu i nie zamyka go.

Drugim celem jest potwierdzenie, dlaczego produkcja Railway wdraża zmiany z
gałęzi `main`, oraz ustalenie bezpiecznego sposobu wymagania ręcznej akceptacji
deployu produkcyjnego. Ta część nie obejmuje wdrożenia na produkcję.

## Zakres implementacji UI

- Formularz włóczki używa natywnego `<details data-material-picker>`.
- Obsługa kliknięcia zostanie dodana na poziomie formularza/listy włóczek,
  aby działała także dla dynamicznie utworzonych kart.
- Po kliknięciu celu poza `[data-material-picker]` otwarte dropdowny w tej
  karcie zostaną zamknięte.
- Kliknięcia w summary dropdownu i checkboxy materiałów nie będą zamykały
  dropdownu.
- Zostanie dodany test DOM odtwarzający: otwarcie dropdownu, kliknięcie pola
  nazwy i sprawdzenie `open === false`.

## Railway i środowiska

- Staging pozostaje na gałęzi `staging`; zmiana zostanie wdrożona wyłącznie tam.
- Produkcja pozostaje na gałęzi `main` i nie otrzyma tej zmiany.
- Najpierw zostanie sprawdzone, czy projekt ma natywną opcję manualnego
  approval/deploy gate. Jeśli nie, zostanie przedstawiona alternatywa oparta
  o ręcznie uruchamiany deploy z GitHub Actions lub Railway.
- Zmiana ustawień produkcji wymaga osobnej zgody, ponieważ wpływa na przyszłe
  wdrożenia całej aplikacji.

## Weryfikacja

- test regresyjny DOM dla zamykania dropdownu;
- pełne `npm run check`;
- kontrola diffu i statusu Git, z zachowaniem istniejącego nieśledzonego
  katalogu `audits/`;
- wdrożenie na staging i sprawdzenie `/health/ready`;
- potwierdzenie, że produkcja nadal wskazuje na dotychczasowy commit.
