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

## Sprawdzenie

- `npm run check` przechodzi: 29/29 testów;
- start redesignu frontu zapisano w commicie `2a0c94c` na branchu
  `feat/frontend-design-refresh`, a branch został wypchnięty na GitHub;
- import katalogu demo został sprawdzony w trybie kontrolnym;
- Supabase zawiera 119 rekordów, w tym 3 wzory demo;
- interaktywny test wbudowaną przeglądarką nie był dostępny w środowisku Codex.

## Następne zadania UX/UI

1. **Dokończenie redesignu frontu**
   - ujednolicenie języka wizualnego ekranów aplikacji;
   - dopracowanie widoku logowania i rejestracji;
   - sprawdzenie stanów pustych, onboardingu i magazynu po zmianie layoutu;
   - test ręczny na desktopie i urządzeniach mobilnych.

2. **Responsywność i długie dane**
   - testy 375, 768 i 1440 px;
   - zoom 200% i 400%;
   - długie imiona, e-maile, Unicode, emoji i tekst RTL;
   - bezpieczne zawijanie oraz formatowanie liczb.

3. **Model stanów interfejsu**
   - dokończenie stanów częściowego sukcesu dla złożonych operacji;
   - przyciski ponowienia w najważniejszych komunikatach błędów;
   - ręczny test czytnikiem ekranu.

4. **Sieć i autosave**
   - kontrolowany retry z opóźnieniem po błędzie sieci;
   - zachowanie formularza przy wygasłej sesji;
   - ostrzeżenie przed zamknięciem przy niezapisanych danych;
   - pełna obsługa konfliktu wersji.

5. **Katalog wzorów**
   - serwerowe filtrowanie i paginacja przed zwiększeniem katalogu;
   - dalsza ręczna weryfikacja rzeczywistych wzorów jest wstrzymana.

## Uwaga procesowa

Po zakończeniu każdego większego pakietu należy wykonać test ręczny w
przeglądarce, a następnie zapisać osobny commit. Push na GitHub wykonuje
użytkownik skryptem z katalogu `tmp/` na aktualnym branchu zadaniowym.
