# Motek — zarządzanie hasłem

Status: projekt zaakceptowany do przygotowania planu implementacji
Data: 2026-08-15

## Cel

Zapewnić dwa czytelne i rozdzielone przepływy:

1. ustawienie nowego hasła po wejściu z jednorazowego linku e-mail;
2. zmiana istniejącego hasła przez zalogowanego użytkownika w karcie
   „Konto”.

Oba przepływy mają pozostać proste architektonicznie, korzystać z istniejącej
warstwy backendowej Motka i nie ujawniać sekretów Supabase w przeglądarce.

## Ustalone decyzje produktowe i bezpieczeństwa

- Zmiana istniejącego hasła wymaga podania dotychczasowego hasła.
- Formularz zmiany hasła będzie prostym rozwijanym panelem w karcie „Konto”,
  a nie osobną rozbudowaną stroną.
- Po udanej zmianie hasła wszystkie aktywne sesje użytkownika zostaną
  unieważnione. Użytkownik zobaczy komunikat i zaloguje się ponownie.
- Reset hasła pozostaje osobnym przepływem recovery z jednorazowym grantem.
- Nie dodajemy nowego RPC ani drugiej migracji recovery, jeśli nie okaże się
  to konieczne po implementacji i testach.

## Proponowana architektura

### 1. Reset hasła z e-maila

Pozostają istniejące endpointy:

- `POST /api/auth/password-reset-request` — wysłanie instrukcji;
- `POST /api/auth/recovery` — wymiana kodu z e-maila na sesję recovery i
  jednorazowy grant;
- `POST /api/auth/password` — ustawienie nowego hasła w sesji recovery.

Frontend powinien rozpoznawać rzeczywisty callback dostarczany przez link
resetujący. Gdy obecny marker `recovery=1` nie jest obecny, ale callback
zawiera jednorazowy `code` i nie jest potwierdzeniem rejestracji, kod nadal
powinien zostać obsłużony jako recovery. Kod musi zostać usunięty z adresu
przed żądaniem sieciowym i nie może trafić do logów.

Po poprawnej wymianie kodu formularz „Ustaw nowe hasło” ma być widoczny,
otrzymać fokus i pozostać w widoku „Konto”. Link błędny, wykorzystany lub
wygasły ma pokazać zrozumiały komunikat i nie może otworzyć konta.

### 2. Zmiana istniejącego hasła

Dodajemy osobny endpoint:

`POST /api/auth/password/change`

Przyjmuje:

```json
{
  "currentPassword": "...",
  "password": "..."
}
```

Backend:

1. wymaga ważnej zwykłej sesji użytkownika;
2. waliduje nowe hasło tym samym `validateAuthPassword`, którego używa
   recovery;
3. weryfikuje dotychczasowe hasło przez `signInWithPassword` w izolowanym
   kliencie serwerowym, bez zapisywania ani zwracania powstałej sesji;
4. ustawia nowe hasło przez klienta związany z bieżącą sesją użytkownika;
5. po udanej zmianie wywołuje globalne wylogowanie;
6. po udanej zmianie czyści cookies sesji Motka, także wtedy, gdy próba
   globalnego wylogowania zwróci błąd.

Nie używamy `service_role` do sprawdzania hasła ani do udawania sesji
użytkownika. Błędy starego hasła, sesji i dostawcy Auth zwracają kontrolowany,
ogólny komunikat bez ujawniania, który szczegół weryfikacji się nie powiódł.

Jeżeli zmiana hasła się powiedzie, ale globalne wylogowanie zwróci błąd,
backend nie próbuje cofać hasła. Czyści bieżące cookies i zwraca komunikat,
że hasło zostało zmienione, ale należy ponownie się zalogować; zdarzenie jest
logowane bez haseł, tokenów i pełnych danych użytkownika.

### 3. Interfejs

W istniejącym `#authLoggedIn` dodajemy sekcję „Zmień hasło”:

- przycisk otwierający i zamykający panel;
- pole dotychczasowego hasła;
- pole nowego hasła;
- pole powtórzenia nowego hasła;
- istniejący opis wymagań hasła;
- komunikat sukcesu lub błędu z obecnego mechanizmu `authMessage`;
- blokadę formularza podczas wysyłania;
- wyczyszczenie wszystkich pól po sukcesie lub opuszczeniu panelu.

Po sukcesie interfejs przełącza się do logowania i jasno informuje o
konieczności ponownego logowania. Błąd nie wylogowuje użytkownika, jeśli
hasło nie zostało zmienione.

## Obsługa błędów i bezpieczeństwo

- Zachować istniejące limity żądań Auth i CAPTCHA dla żądania resetu.
- Nie logować haseł, kodów, access tokenów, refresh tokenów ani cookies.
- Nie umieszczać sekretu Supabase w HTML, JavaScript ani odpowiedzi API.
- Nie ujawniać, czy dotychczasowe hasło było poprawne w sposób umożliwiający
  rozróżnianie kont lub szczegółów dostawcy Auth.
- Po błędzie `updateUser` nie wykonywać globalnego wylogowania.
- Po sukcesie `updateUser` zawsze próbować unieważnić wszystkie sesje i
  zawsze czyścić bieżące cookies.
- Obsłużyć ponowienie resetu po błędzie CAPTCHA przez odświeżenie tokenu
  formularza.

## Testy akceptacyjne

### Backend

- prawidłowa zwykła sesja i prawidłowe dotychczasowe hasło prowadzą do
  `signInWithPassword`, `updateUser` i globalnego `signOut`;
- brak sesji, brak dotychczasowego hasła i niepoprawne nowe hasło są odrzucane;
- błędne dotychczasowe hasło nie wywołuje `updateUser` ani globalnego
  wylogowania;
- błąd `updateUser` nie unieważnia sesji przedwcześnie;
- po sukcesie czyszczone są cookies access, refresh i recovery;
- błędy nie zawierają haseł, tokenów ani sekretów;
- istniejący przepływ recovery nadal wymaga grantu i pozostaje jednorazowy.

### Frontend

- panel zmiany hasła istnieje tylko w stanie zalogowanym;
- formularz wysyła `currentPassword` i `password` do nowego endpointu;
- pola są walidowane, blokowane podczas wysyłania i czyszczone po sukcesie;
- sukces wraca do logowania z komunikatem;
- błędy trafiają do istniejącego komunikatu i zachowują dostępność fokusów;
- callback resetu z `recovery=1&code=...` pokazuje formularz ustawienia hasła;
- callback z kodem bez markera również nie kończy się cichym przejściem do
  zwykłej karty „Konto”;
- kod jest usuwany z adresu przed żądaniem sieciowym.

### Staging

- zarejestrowany użytkownik może zmienić hasło po podaniu starego hasła;
- po sukcesie zostaje wylogowany i może zalogować się nowym hasłem;
- druga aktywna sesja tego samego użytkownika przestaje działać;
- link resetujący otwiera widoczny formularz, a link wygasły pokazuje błąd;
- reset i zwykła zmiana hasła nie wpływają na dane magazynu.

## Poza zakresem

- zmiana adresu e-mail;
- historia haseł i polityka ponownego użycia haseł;
- dodatkowy system MFA;
- przebudowa całego modułu Auth lub usuwanie nieużywanego kontrolera w
  `client/auth-controller.js`;
- zmiany produkcyjne, zdalne migracje i wdrożenie bez osobnej zgody.
