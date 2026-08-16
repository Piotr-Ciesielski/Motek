# Pakiet: zarządzanie hasłem

Data zapisu: 2026-08-15; aktualizacja: 2026-08-16
Status: pakiet wdrożony i potwierdzony na stagingu; pełny pakiet haseł nie został
promowany na produkcję, która otrzymała wyłącznie osobny pakiet wizualny

## Finalizacja pakietu — 2026-08-15–16

Wczoraj domknięto interfejs i podstawowy backend zwykłej zmiany hasła.
Weryfikacja stagingu ujawniła następnie, że sama obecność `current_password`
w `updateUser` nie wystarcza: klient `@supabase/supabase-js` musi mieć przed
`updateUser` ustawioną pełną sesję użytkownika.

Wykonane poprawki:

- `597cf02` — backend przekazuje bieżące hasło jako `current_password`, zgodnie
  z polityką Supabase wymagającą ponownego uwierzytelnienia;
- `fc1650d` — backend odtwarza sesję przez `auth.setSession` z bieżącym
  access tokenem i refresh tokenem przed `updateUser`;
- błędy `AuthSessionMissingError` i chwilowe błędy transportowe nie są już
  przedstawiane jako „błędne bieżące hasło”; wynik niepewny kończy sesję i
  zwraca kontrolowany `503`;
- dodano osobny limiter żądań dla `POST /api/auth/password/change` oraz
  limit nieudanych prób weryfikacji hasła;
- frontend odświeża CAPTCHA po każdej próbie zmiany hasła.
- callback resetu obsługuje zarówno `?code=...`, jak i standardowy dla
  Supabase hash `#access_token=...&refresh_token=...&type=recovery`; tokeny są
  wymieniane na sesję recovery po stronie backendu i usuwane z adresu przed
  żądaniem sieciowym.

Wdrożenie:

- Railway deployment: `2157d2af-3380-450a-9274-07547512c4ab`;
- środowisko: staging, `https://staging.rysia.org`;
- źródło: branch `agent/staging-security-merge`, commit
  `fc1650d30dc85f9c7df99b6446bbfa885e5de6fb`;
- status deploymentu: `SUCCESS`;
- `/health/ready`: `200`, `{"status":"ready"}`;
- ręcznie potwierdzono poprawną zmianę hasła na stagingu.

## Obserwacja ze stagingu

Link „Reset password” z wiadomości kieruje użytkownika do karty „Konto” i po
ostatnich poprawkach poprawnie pokazuje formularz ustawienia nowego hasła.
W zwykłej karcie „Konto” dostępny jest również osobny panel zmiany istniejącego
hasła dla zalogowanego użytkownika.

Pozostaje pełny test zapisu nowego hasła po wejściu z wiadomości recovery.

## Stan implementacji

- `index.html` zawiera formularz żądania resetu, formularz „Ustaw nowe hasło”
  oraz zwijany panel „Zmień hasło” w karcie „Konto”.
- `app.js` obsługuje callback recovery z jednorazowym `code`, usuwa kod z URL
  przed żądaniem sieciowym i pokazuje formularz ustawienia nowego hasła.
- Zwykła zmiana hasła korzysta z osobnego `POST /api/auth/password/change`,
  wymaga dotychczasowego hasła, a po udanej zmianie unieważnia wszystkie sesje.
- Przed `updateUser` backend ustawia sesję klienta Supabase z access tokenem i
  refresh tokenem bieżącego użytkownika oraz przekazuje `current_password`.
- Błąd niepewnego wyniku `updateUser` kończy się kontrolowanym 503, próbą
  globalnego wylogowania i wyczyszczeniem cookies.
- Każde wylogowanie czyści pola formularza zmiany hasła, a błąd 503 prowadzi
  użytkownika do logowania zamiast pozostawiać pozornie aktywne konto.
- Recovery nadal korzysta wyłącznie z `POST /api/auth/recovery` oraz
  `POST /api/auth/password`; kontrakty nie zostały połączone.

## Zakres pakietu — aktualny stan

1. Obsługa poprawnego linku recovery i widocznego formularza — wykonana;
   pozostaje pełny test zapisu nowego hasła.
2. Osobny panel „Zmień hasło” dla zalogowanego użytkownika — wykonany i
   potwierdzony ręcznie na stagingu.
3. Rozdzielenie kontraktu resetu od zwykłej zmiany hasła — wykonane.
4. Testy backendowe i frontendowe — wykonane; ręczny test recovery z
   poprawnym, innym hasłem pozostaje otwarty z powodu limitu prób.

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

Test DOM formularza oraz osobny limiter prób weryfikacji zostały uwzględnione
w pakiecie; pełny zestaw kontroli przechodzi.

## Stan weryfikacji stagingu

Pakiet został wdrożony na staging i ręcznie potwierdzono zwykłą zmianę hasła:
formularz działa, hasło jest zmieniane, a użytkownik może zalogować się nowym
hasłem. Pełny pakiet haseł nie był wdrażany na produkcję; produkcja otrzymała
wyłącznie osobny, bezpieczny pakiet wizualny.

Przepływ resetu z e-maila pozostaje osobnym kontraktem recovery. Rozszerzono go
o obsługę tokenów implicit w hash; ręczny test wejścia z nowego linku potwierdził
poprawne otwarcie formularza, ale pełny test zapisu hasła pozostaje otwarty.

Podczas kolejnej próby staging Supabase zwrócił `429 over_email_send_rate_limit`
po przekroczeniu limitu wysyłki wiadomości resetujących. Backend otrzymuje ten
konkretny przypadek jako HTTP 429 z generycznym komunikatem o konieczności
odczekania; pozostałe błędy wysyłki nadal pozostają kontrolowanym 503. Ostatnia
próba wysyłki objęta limitem wystąpiła o 10:18:19 UTC.

## Handoff — 2026-08-16

- Link recovery na stagingu otwiera formularz „Ustaw nowe hasło”.
- Próba zapisu dotarła do Supabase Auth, ale `PUT /user` zwrócił `422` z
  komunikatem `New password should be different from the old password.`
  Test należy powtórzyć z hasłem rzeczywiście różnym od poprzedniego.
- Próba została odłożona po ponownym wejściu w limit wysyłki wiadomości
  recovery. Nie wykonywać kolejnych prób przed kolejnym oknem testowym.
- Stagingowy pakiet wizualny pozostaje wdrożony z commitem
  `3b07f6c71c32a068e12412ea30481f667bfd140c`.
- Produkcja ma wyłącznie bezpieczny pakiet wizualny z commitem
  `0b3d43347d6b982eb86303db26650cc804ec8cd9`; pełny pakiet recovery i
  funkcja zmiany hasła nie zostały promowane na produkcję.

### Otwarte następne kroki

1. Po zwolnieniu limitu wykonać jeden test: link recovery → inne nowe hasło →
   logowanie nowym hasłem.
2. Jeśli nowe hasło będzie inne, a `PUT /user` nadal zwróci błąd, zebrać
   jednocześnie status żądania `POST /api/auth/password` i wpis Supabase Auth.
3. Dopiero po pozytywnym teście recovery rozważyć osobny pakiet promocji
   funkcji zarządzania hasłem na produkcję.

## Kryteria akceptacji

- Kliknięcie prawidłowego linku z wiadomości ma otwierać formularz ustawienia
  nowego hasła, niezależnie od tego, czy użytkownik był wcześniej zalogowany.
- Link jednorazowy, wygasły lub uszkodzony nie daje dostępu do formularza ani
  do konta i pokazuje zrozumiały komunikat.
- Po poprawnym resecie hasło zostaje zmienione, sesja recovery jest zamknięta,
  a użytkownik może zalogować się nowym hasłem.
- Zalogowany użytkownik może z karty „Konto” rozpocząć zmianę istniejącego
  hasła i otrzymuje jasny wynik sukcesu albo błąd bez ujawniania wrażliwych
  informacji — potwierdzone testami lokalnymi i ręcznie na stagingu.
- Zwykła zmiana hasła ma test automatyczny i ręczne potwierdzenie na stagingu;
  reset recovery pozostaje osobną ścieżką z własnym testem stagingowym do
  wykonania przy kolejnym sprawdzeniu.
