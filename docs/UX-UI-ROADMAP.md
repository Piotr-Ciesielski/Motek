# UX/UI — stan prac i dalszy plan

## Zrealizowane

### Konto i pierwszy start

- wdrożono odzyskiwanie hasła;
- dodano możliwość pokazania i ponownego ukrycia hasła;
- wymagania hasła są widoczne przy rejestracji i ustawianiu nowego hasła;
- dodano onboarding pustego magazynu;
- dodano checklistę pierwszych trzech kroków;
- dodano empty state dla gościa i pustego magazynu;
- akcje magazynu i dopasowania są blokowane dla niezalogowanego użytkownika;
- CTA prowadzą do logowania albo dodawania pierwszego motka.

### Zarządzanie włóczkami

- nowy motek nie zapisuje się automatycznie;
- przycisk `Zapisz` pojawia się po uzupełnieniu wymaganych danych;
- zapisane włóczki mają tryb `Modyfikuj`;
- po zmianie pojawiają się `Zapisz` i `Anuluj`;
- `Anuluj` przywraca poprzednie wartości;
- dopasowanie nie uruchamia się podczas niedokończonej edycji.

### Dopasowanie i dane demo

- przycisk zmieniono na `Dobierz wzór`;
- dodano trzy syntetyczne wzory demo z kompletnymi wymaganiami dopasowania;
- wzory demo są zaimportowane do Supabase i służą do testów end-to-end;
- rzeczywiste wzory bez kompletnych wymagań pozostają opisowe i nie są używane
  przez ranking;
- zasady bezpiecznego publikowania opisów wzorów opisano w
  `docs/PATTERN-CATALOG.md`.

### Dostępność i klawiatura

- dodano skip link do głównej treści;
- dodano wyraźny styl `:focus-visible`;
- przełącznik logowania i rejestracji obsługuje strzałki, Home i End;
- pola formularzy mają stabilne identyfikatory i powiązane etykiety;
- pola Auth są powiązane z regionem komunikatów przez `aria-describedby`;
- błędy Auth są oznaczane jako `alert` i otrzymują fokus;
- dynamiczne pola włóczek również dostają identyfikatory i etykiety.

### Drobne akcje i komunikaty

- nowy, niezapisany formularz można zamknąć akcją `Anuluj dodawanie`;
- anulowanie nowego formularza nie jest przedstawiane jako usunięcie danych ani zapis magazynu.

### Responsywność danych

- liczby w podsumowaniach i kartach korzystają z polskiego formatowania;
- długie dane profilu oraz nazwy wzorów bezpiecznie zawijają się lub są skracane z dostępem do pełnej treści;
- teksty Unicode i RTL zachowują własny kierunek pisma w kluczowych etykietach.

### Kontrast i pola dotykowe

- kluczowe pary tekstu i tła spełniają progi kontrastu WCAG AA;
- obrys fokusu ma wzmocniony kontrast na jasnym tle;
- interaktywne kontrolki mają co najmniej 44 px wysokości;
- małe kontrolki zachowują pole obsługi minimum 44×44 px.

### Stany interfejsu i sieci — etap 1

- żądania interfejsu mają 12-sekundowy limit oczekiwania;
- utrata i powrót połączenia są komunikowane na poziomie całej aplikacji;
- błędy korzystają z `role="alert"`, a ładowane regiony z `aria-busy`;
- błąd pobierania danych po sprawdzeniu sesji nie powoduje pozornego wylogowania;
- komunikaty błędów wskazują możliwość ponowienia operacji.

### Ponawianie i ochrona edycji

- błędy katalogu i dopasowania mają ręczną akcję `Spróbuj ponownie`;
- nowy lub zmieniony formularz uruchamia ostrzeżenie przed zamknięciem karty;
- ostrzeżenie obejmuje również trwające operacje zapisu;
- usunięto nieaktywny mechanizm autosave;
- uruchomienie dopasowania nie zapisuje ponownie całego magazynu.

### Powrót po wygaśnięciu sesji

- brak autoryzacji w magazynie jest odróżniany od błędu sieci;
- nowy i zmieniony formularz pozostaje w pamięci podczas ponownego logowania;
- po zalogowaniu aplikacja wraca do magazynu bez nadpisania zachowanych zmian;
- komunikat wskazuje następny krok: sprawdzenie formularza i użycie `Zapisz`;
- ręczne wylogowanie ostrzega o niezapisanych zmianach.

### Końcowa kontrola responsywności

- sprawdzono szerokości 375, 768 i 1440 px;
- katalog przechodzi odpowiednio między jedną, dwiema i trzema kolumnami;
- reflow dla efektywnych szerokości powiększenia 200% i 400% nie tworzy poziomego przewijania;
- długie nazwy, emoji, tekst arabski i chiński mieszczą się w formularzu;
- na sprawdzonych ekranach nie występują kontrolki mniejsze niż 44×44 px.

### Konflikty równoległych zmian

- nieaktualny zapis z innej karty lub urządzenia nie nadpisuje danych po cichu;
- lokalna wersja pozostaje w formularzu po odpowiedzi konfliktu;
- użytkownik może świadomie zapisać swoją wersję albo pobrać nowsze dane;
- pobranie nowszych danych wymaga potwierdzenia, jeśli zastąpi rozpoczętą edycję;
- obsługa obejmuje dodawanie, modyfikowanie i usuwanie włóczki.

## Sprawdzenie

- `npm run check` przechodzi: 29/29 testów;
- start redesignu frontu zapisano w commicie `2a0c94c` na branchu
  `feat/frontend-design-refresh`, a branch został wypchnięty na GitHub;
- import katalogu demo został sprawdzony w trybie kontrolnym;
- Supabase zawiera 119 rekordów, w tym 3 wzory demo;
- kolejne pakiety są sprawdzane interaktywnie w przeglądarce na desktopie i mobile.

## Następne zadania UX/UI

1. **Dokończenie redesignu frontu**
   - ujednolicenie języka wizualnego ekranów aplikacji;
   - dopracowanie widoku logowania i rejestracji;
   - sprawdzenie stanów pustych, onboardingu i magazynu po zmianie layoutu;
   - test ręczny na desktopie i urządzeniach mobilnych.

2. **Model stanów interfejsu**
   - dokończenie stanów częściowego sukcesu dla złożonych operacji;
   - ręczny test czytnikiem ekranu.

3. **Sieć i spójność zapisu**
   - kontrolowany retry z opóźnieniem po błędzie sieci;
   - test przerwania operacji zapisu w połowie.

4. **Katalog wzorów**
   - serwerowe filtrowanie i paginacja przed zwiększeniem katalogu;
   - dalsza ręczna weryfikacja rzeczywistych wzorów jest wstrzymana.

## Uwaga procesowa

Po zakończeniu każdego większego pakietu należy wykonać test ręczny w
przeglądarce, a następnie zapisać osobny commit. Push na GitHub wykonuje
użytkownik skryptem z katalogu `tmp/` na aktualnym branchu zadaniowym.
