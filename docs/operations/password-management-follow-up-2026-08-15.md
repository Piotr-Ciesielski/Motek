# Pakiet: zarządzanie hasłem

Data zapisu: 2026-08-15
Status: implementacja zakończona lokalnie; ręczna weryfikacja stagingu oczekuje na zalogowaną sesję QA i wiadomość resetującą

## Obserwacja ze stagingu

Link „Reset password” z wiadomości kieruje użytkownika do karty „Konto”, ale
nie udostępnia mu formularza ustawienia nowego hasła. W zwykłej karcie „Konto”
nie ma również formularza ani akcji do zmiany już istniejącego hasła.

To jest brakująca funkcja produktowa, ale nie blokuje domknięcia bieżącego
etapu naprawy kontraktu recovery na stagingu. Nie zmieniamy jej w tym pakiecie.

## Stan implementacji

- `index.html` zawiera formularz żądania resetu, formularz „Ustaw nowe hasło”
  oraz zwijany panel „Zmień hasło” w karcie „Konto”.
- `app.js` obsługuje callback recovery z jednorazowym `code`, usuwa kod z URL
  przed żądaniem sieciowym i pokazuje formularz ustawienia nowego hasła.
- Zwykła zmiana hasła korzysta z osobnego `POST /api/auth/password/change`,
  wymaga dotychczasowego hasła, a po udanej zmianie unieważnia wszystkie sesje.
- Błąd niepewnego wyniku `updateUser` kończy się kontrolowanym 503, próbą
  globalnego wylogowania i wyczyszczeniem cookies.
- Każde wylogowanie czyści pola formularza zmiany hasła, a błąd 503 prowadzi
  użytkownika do logowania zamiast pozostawiać pozornie aktywne konto.
- Recovery nadal korzysta wyłącznie z `POST /api/auth/recovery` oraz
  `POST /api/auth/password`; kontrakty nie zostały połączone.

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

## Decyzje przyjęte

- Zmiana istniejącego hasła wymaga podania dotychczasowego hasła.
- Po zmianie hasła unieważniamy wszystkie sesje i wymagamy ponownego logowania.
- Interfejs to prosty zwijany panel w karcie „Konto”, bez nowej strony ani
  systemu modalnego.

Nie dodano nowej migracji ani RPC dla zwykłej zmiany hasła.

## Weryfikacja lokalna 2026-08-15

- `npm run check`: 389/389 testów zaliczonych.
- `npm run lint`: zaliczony.
- `npm run format:check`: zaliczony.
- `git diff --check`: zaliczony.
- Niezależna recenzja po poprawkach: `ACCEPT`, bez blokad wysokiego ani
  średniego priorytetu.

Pozostają niskopriorytetowe usprawnienia: bezpośredni test DOM całego handlera
formularza oraz osobny limiter prób weryfikacji dotychczasowego hasła.

## Stan weryfikacji stagingu

Staging jest dostępny, ale podczas ostatniej próby karta Edge była wylogowana.
Nie wpisywano danych uwierzytelniających ani nie wykonywano zmiany hasła.
Do zamknięcia pakietu pozostaje test z kontem QA:

1. zalogować się w stagingu i sprawdzić panel „Zmień hasło”, błędne hasło,
   poprawną zmianę, ponowne logowanie i brak działania starego hasła;
2. sprawdzić reset z prawdziwej wiadomości oraz link wykorzystany/wygasły;
3. potwierdzić zachowanie drugiej sesji i brak zmian w magazynie włóczek.

## Kryteria akceptacji

- Kliknięcie prawidłowego linku z wiadomości ma otwierać formularz ustawienia
  nowego hasła, niezależnie od tego, czy użytkownik był wcześniej zalogowany.
- Link jednorazowy, wygasły lub uszkodzony nie daje dostępu do formularza ani
  do konta i pokazuje zrozumiały komunikat.
- Po poprawnym resecie hasło zostaje zmienione, sesja recovery jest zamknięta,
  a użytkownik może zalogować się nowym hasłem.
- Zalogowany użytkownik może z karty „Konto” rozpocząć zmianę istniejącego
  hasła i otrzymuje jasny wynik sukcesu albo błąd bez ujawniania wrażliwych
  informacji — potwierdzone testami lokalnymi, staging oczekuje na test QA.
- Obie ścieżki mają test automatyczny oraz sprawdzenie na stagingu.
