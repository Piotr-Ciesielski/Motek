# Pakiet odłożony: zarządzanie hasłem

Data zapisu: 2026-08-15
Status: odłożone do wykonania po zakończeniu bieżącego etapu recovery/staging

## Obserwacja ze stagingu

Link „Reset password” z wiadomości kieruje użytkownika do karty „Konto”, ale
nie udostępnia mu formularza ustawienia nowego hasła. W zwykłej karcie „Konto”
nie ma również formularza ani akcji do zmiany już istniejącego hasła.

To jest brakująca funkcja produktowa, ale nie blokuje domknięcia bieżącego
etapu naprawy kontraktu recovery na stagingu. Nie zmieniamy jej w tym pakiecie.

## Stan obecnej implementacji

- `index.html` zawiera ukryty formularz żądania resetu hasła oraz ukryty
  formularz „Ustaw nowe hasło”.
- `app.js` oczekuje powrotu z linku w formacie `/?recovery=1&code=...`.
- Po poprawnym `POST /api/auth/recovery` frontend pokazuje formularz nowego
  hasła w widoku „Konto”.
- Zapis nowego hasła korzysta z `POST /api/auth/password`; ten endpoint jest
  przeznaczony dla sesji recovery, a zwykła zalogowana sesja nie może użyć go
  jako zmiany istniejącego hasła.
- W zwykłym widoku „Konto” nie ma osobnej funkcji „Zmień hasło”.
- Obecne testy pokrywają kontrakt backendu i statyczną obecność formularzy, ale
  brakuje bezpośredniego testu przeglądarkowego całej ścieżki od kliknięcia
  linku z wiadomości do widocznego formularza.

## Zakres następnego pakietu

1. Ustalić i naprawić obsługę linku z wiadomości tak, aby poprawny link zawsze
   otwierał widoczny formularz ustawienia nowego hasła, a błędny lub wygasły
   link pokazywał jasny komunikat i bezpiecznie wracał do logowania.
2. Dodać w karcie „Konto” osobny formularz/okno „Zmień hasło” dla zalogowanego
   użytkownika.
3. Rozdzielić kontrakt resetu hasła od kontraktu zmiany istniejącego hasła;
   nie używać uprawnień recovery do zwykłej zmiany hasła.
4. Dodać testy backendowe, frontendowe oraz przeglądarką dla obu ścieżek,
   włącznie z błędami walidacji, wygaśnięciem linku, wylogowaniem po resecie
   i czytelnymi komunikatami dla użytkownika.

## Decyzje odłożone do rozpoczęcia pakietu

- Czy zmiana istniejącego hasła wymaga podania dotychczasowego hasła, czy
  wystarczy aktywna sesja oraz ewentualne ponowne uwierzytelnienie.
- Czy po zmianie hasła unieważniamy wszystkie pozostałe sesje, czy tylko
  bieżącą sesję.
- Ostateczny wygląd okna w karcie „Konto” i treść komunikatów.

Te decyzje mają wpływ na bezpieczeństwo i widoczne zachowanie produktu,
dlatego nie są podejmowane automatycznie w bieżącym etapie.

## Kryteria akceptacji

- Kliknięcie prawidłowego linku z wiadomości otwiera formularz ustawienia
  nowego hasła, niezależnie od tego, czy użytkownik był wcześniej zalogowany.
- Link jednorazowy, wygasły lub uszkodzony nie daje dostępu do formularza ani
  do konta i pokazuje zrozumiały komunikat.
- Po poprawnym resecie hasło zostaje zmienione, sesja recovery jest zamknięta,
  a użytkownik może zalogować się nowym hasłem.
- Zalogowany użytkownik może z karty „Konto” rozpocząć zmianę istniejącego
  hasła i otrzymuje jasny wynik sukcesu albo błąd bez ujawniania wrażliwych
  informacji.
- Obie ścieżki mają test automatyczny oraz sprawdzenie na stagingu.
