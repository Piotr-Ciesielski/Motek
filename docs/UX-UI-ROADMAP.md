# UX/UI — stan prac i dalszy plan

## Zrealizowane

### Konto i pierwszy start

- wdrożono odzyskiwanie hasła;
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
- pola formularzy mają stabilne identyfikatory i powiązane etykiety;
- pola Auth są powiązane z regionem komunikatów przez `aria-describedby`;
- błędy Auth są oznaczane jako `alert` i otrzymują fokus;
- dynamiczne pola włóczek również dostają identyfikatory i etykiety.

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

2. **Kontrast i touch targety**
   - pomiary WCAG na rzeczywistych tłach;
   - poprawa kontrastu tekstów pomocniczych, statusów i ghost buttons;
   - minimum 44×44 px dla przycisków i odstępy między akcjami.

3. **Responsywność i długie dane**
   - testy 375, 768 i 1440 px;
   - zoom 200% i 400%;
   - długie imiona, e-maile, Unicode, emoji i tekst RTL;
   - bezpieczne zawijanie oraz formatowanie liczb.

4. **Model stanów interfejsu**
   - loading, sukces, błąd, częściowy sukces i offline;
   - `aria-live`, `aria-busy` i `role="alert"` tam, gdzie potrzebne;
   - komunikaty wskazujące następny możliwy krok.

5. **Sieć i autosave**
   - timeout, retry i powrót po offline;
   - zachowanie formularza przy wygasłej sesji;
   - ostrzeżenie przed zamknięciem przy niezapisanych danych;
   - pełna obsługa konfliktu wersji.

6. **Katalog wzorów**
   - serwerowe filtrowanie i paginacja przed zwiększeniem katalogu;
   - dalsza ręczna weryfikacja rzeczywistych wzorów jest wstrzymana.

## Uwaga procesowa

Po zakończeniu każdego większego pakietu należy wykonać test ręczny w
przeglądarce, a następnie zapisać osobny commit. Push na GitHub wykonuje
użytkownik skryptem z katalogu `tmp/` na aktualnym branchu zadaniowym.
