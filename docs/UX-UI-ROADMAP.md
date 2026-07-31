# UX/UI — stan prac i dalszy plan

## Zrealizowane

### Konto i pierwszy start

- wdrożono odzyskiwanie hasła;
- usunięto tekstowy przycisk „Pokaż”; ikona oka pokazuje hasło tylko podczas
  przytrzymania i po puszczeniu ponownie je maskuje;
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
- wielokrotne kliknięcie `Dodaj motek` utrzymuje jeden formularz i przenosi do
  niego fokus;
- motek może mieć kilka materiałów wybranych z tej samej listy co filtr
  katalogu;
- „Mieszanka — skład nieokreślony” nie łączy się z konkretnymi materiałami.

### Dokładne dopasowanie wzorów

- przycisk zmieniono na `Dobierz wzór`;
- wdrożono walidowany format wymagań v2 z rozmiarami, alternatywnymi włóczkami,
  rolami, kolorami, liczbą nitek oraz niezależnymi wymaganiami metrów i gramów;
- dodano 21 potwierdzonych wariantów rzeczywistych wzorów Holly, Na Pole i
  Oslo Hat;
- wzory bez kompletnych wymagań pozostają opisowe i nie są używane przez ranking;
- wynik pokazuje wymagania każdej roli i konkretne przydzielone motki, bez
  sztucznych wartości `0 m` lub `0 g`;
- zasady bezpiecznego publikowania opisów wzorów opisano w
  `docs/PATTERN-CATALOG.md`;
- wynik dopasowania prowadzi do pełnej karty wybranego wzoru w katalogu;
- przejście automatycznie ustawia filtry tak, aby właściwy wzór był widoczny.

### Dostępność i klawiatura

- dodano skip link do głównej treści;
- dodano wyraźny styl `:focus-visible`;
- przełącznik logowania i rejestracji obsługuje strzałki, Home i End;
- pola formularzy mają stabilne identyfikatory i powiązane etykiety;
- pola Auth są powiązane z regionem komunikatów przez `aria-describedby`;
- błędy Auth są oznaczane jako `alert` i otrzymują fokus;
- dynamiczne pola włóczek również dostają identyfikatory i etykiety;
- główne widoki mają własne nazwy w drzewie dostępności;
- po zmianie widoku fokus klawiatury przechodzi na jego widoczny nagłówek.

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

### Przerwany zapis i bezpieczne ponawianie

- odczyt jest jednokrotnie ponawiany po przejściowym błędzie sieci;
- zapis nie jest automatycznie powtarzany, jeśli odpowiedź mogła zaginąć;
- użytkownik może sprawdzić faktyczny stan magazynu przed kolejną próbą;
- aplikacja rozpoznaje operację wykonaną mimo utraconego potwierdzenia;
- niezapisany lub niepotwierdzony formularz pozostaje na ekranie;
- scenariusze nowego motka, modyfikacji i usunięcia są objęte testami.

### Częściowy sukces operacji wieloetapowych

- katalog zachowuje strony pobrane przed chwilowym błędem;
- dostępna część katalogu pozostaje widoczna i możliwa do filtrowania;
- komunikat podaje liczbę pobranych wzorów oraz pozwala wznowić operację;
- wznowienie zaczyna się od miejsca błędu i nie tworzy duplikatów;
- błąd pierwszej strony nadal jest pełnym błędem, a nie częściowym sukcesem;
- potwierdzony zapis motka pozostaje sukcesem, nawet jeśli nie odświeży się podsumowanie.

### Stopniowe ładowanie katalogu

- szkielety kart znikają po pobraniu pierwszej strony danych;
- pierwsze wzory są dostępne bez czekania na pozostałe strony;
- kolejne strony aktualizują listę i filtry w tle;
- podsumowanie pokazuje docelowy rozmiar katalogu oraz stan dalszego pobierania.

### Powrót do domyślnego katalogu

- wyszukiwanie, filtry i sortowanie można wyczyścić jedną akcją;
- akcja jest dostępna tylko po zmianie domyślnych kryteriów;
- po wyczyszczeniu fokus wraca do wyszukiwarki, a podsumowanie podaje nowy wynik.

### Dynamiczne filtry i zweryfikowane dane katalogu

- katalog zawiera 106 sprawdzonych rekordów bez pozycji „Do sprawdzenia”;
- wyszukiwanie, status, język, typ projektu i materiał działają łącznie;
- typy i materiały pokazują dynamiczne liczby pasujących wzorów;
- niemożliwe opcje są wyszarzone bez usuwania aktywnego wyboru;
- wzór wielomateriałowy jest dostępny pod każdym materiałem bez duplikowania;
- dopasowanie do prywatnego magazynu pozostaje osobnym widokiem, a nie
  powielonym filtrem publicznego katalogu.

## Sprawdzenie

- `npm run check` przechodzi: 66/66 testów;
- start redesignu frontu zapisano w commicie `2a0c94c` na branchu
  `feat/frontend-design-refresh`, a branch został wypchnięty na GitHub;
- migracje materiałów i wymagań v2 zostały zastosowane w Supabase;
- import zaktualizował 106 rekordów bez dodawania duplikatów;
- Supabase zawiera 106 sprawdzonych rekordów i 21 dokładnych wariantów;
- wszystkie 10 istniejących włóczek zachowało dane i otrzymało nową listę
  materiałów;
- kolejne pakiety są sprawdzane interaktywnie w przeglądarce na desktopie i mobile.
- techniczny test klawiatury potwierdził działanie skip linku i przejścia fokusu
  między głównymi ekranami; pełny odsłuch pozostaje do wykonania w NVDA lub VoiceOver.
- test przeglądarkowy potwierdził widoczne karty już podczas pobierania,
  łączenie typu projektu i materiału, dynamiczne liczniki oraz
  zdjęcie stanu `aria-busy` po załadowaniu wszystkich 106 rekordów.

## Następne zadania UX/UI

1. **Wzbogacenie danych katalogu**
   - dodać zweryfikowane adresy źródeł;
   - rozszerzać potwierdzone warianty `matching_requirements` na kolejne wzory;
   - każdą partię sprawdzać na przykładowych magazynach przed importem.

2. **Skalowanie katalogu dopiero przed zwiększeniem limitu**
   - przenieść wyszukiwanie i filtrowanie na serwer;
   - zastosować paginację sterowaną przez użytkownika lub kursor;
   - wykonać test wydajności po przekroczeniu obecnego limitu 300 rekordów.

## Możliwy późniejszy krok rozwoju

Test z prawdziwym czytnikiem ekranu został świadomie odłożony i nie blokuje
obecnych prac nad katalogiem:

- na Windows można użyć bezpłatnego NVDA;
- na urządzeniach Apple można użyć wbudowanego VoiceOver;
- przyszły test powinien objąć logowanie, komunikaty błędów, nawigację między
  ekranami, formularz włóczki, dopasowanie i filtry katalogu;
- celem będzie potwierdzenie kolejności oraz zrozumiałości komunikatów
  odczytywanych na głos.

## Uwaga procesowa

Po zakończeniu każdego większego pakietu należy wykonać test ręczny w
przeglądarce, a następnie zapisać osobny commit. Push na GitHub wykonuje
użytkownik skryptem z katalogu `tmp/` na aktualnym branchu zadaniowym.
