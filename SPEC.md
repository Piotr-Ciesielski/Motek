# Motek — specyfikacja bieżącego produktu

## Status

Motek używa Supabase jako jedynego źródła danych. Aplikacja nie ma trybu SQLite ani lokalnego fallbacku danych.

- źródło lokalne: `2.0.0-alpha.38`;
- staging: `https://staging.rysia.org`, release `2.0.0-alpha.39`, SHA `d7409a408351dc0a8f78f53eb5861c3db6eca627`; staging nie jest produkcją i nie jest dostępny dla użytkowników;
- produkcja: `https://www.rysia.org`, release `2.0.0-alpha.39`, SHA `a625bccbec827fd07965f476259f39836fc84b90`;
- limit magazynu: 500 włóczek na użytkownika;
- limit katalogu: 300 wzorów.

## Cel i przepływ użytkownika

Motek pomaga znaleźć wzory możliwe do wykonania z prywatnego zapasu włóczek. Nie jest sklepem ani programem do projektowania dzianin.

1. Operator tworzy jednorazowe zaproszenie dla znormalizowanego adresu e-mail.
2. Użytkownik rejestruje konto, akceptuje bieżący regulamin i otrzymuje osobną informację o prywatności.
3. Po zalogowaniu dodaje, zmienia i usuwa własne włóczki.
4. Przegląda wspólny katalog wzorów i łączy wyszukiwanie z filtrami statusu, języka, typu projektu i materiału.
5. Uruchamia dopasowanie. Backend zwraca wyłącznie warianty z kompletnymi, zweryfikowanymi wymaganiami.

Filtry katalogu łączą się regułą „i”. Liczniki typów i materiałów są wyliczane względem pozostałych aktywnych filtrów. Niedostępne opcje są wyłączone, a wybrana wartość pozostaje dostępna do usunięcia.

Wzory z niepełnymi wymaganiami mogą być widoczne w katalogu, ale nie są prezentowane jako potwierdzone rekomendacje. Brak metrów, gramów albo parametrów roli oznacza brak potwierdzenia, a nie zgodę na przybliżenie.

## Podział odpowiedzialności

### Frontend

`index.html`, `styles.css`, `app.js` i moduły `client/` tworzą statyczny interfejs. Frontend obsługuje cztery widoki: Konto, Magazyn, Dopasowanie i Katalog. Zarządza formularzami, lokalnym stanem, filtrowaniem, paginowanym pobieraniem katalogu i prezentacją wyników. Nie otrzymuje sekretnego klucza Supabase.

### Backend

`server.js` i moduły `server/` tworzą serwer HTTP Node.js bez frameworka. Backend jest granicą zaufania dla sesji, walidacji, limitów, legal gate, dostępu do danych, rankingu, nagłówków bezpieczeństwa i błędów API.

### Supabase

Supabase odpowiada za Auth, trwałe dane, RLS, ACL i uprzywilejowane RPC. Migracje w `supabase/migrations/` są źródłem prawdy dla schematu. Backend używa tokenu użytkownika tam, gdzie RLS ma egzekwować własność, a klucza sekretnego tylko w kontrolowanych operacjach serwerowych.

## Model danych

### `public.profiles`

Profil jest powiązany 1:1 z `auth.users`. `login` i `email` zawierają ten sam znormalizowany adres e-mail. Profil nie przechowuje imienia ani nazwiska.

### `public.yarns`

Prywatna włóczka zawiera `id`, `user_id`, nazwę, kolor, listę materiałów, klasę grubości, długość, wagę oraz znaczniki czasu. `materials` korzysta ze wspólnej kontrolowanej listy. Wartość „mieszanka” oznacza nieokreślony skład i nie jest automatycznie zgodna z konkretnym materiałem. Klasy grubości to `lace`, `fingering`, `sport`, `dk`, `worsted` i `bulky`.

### `public.patterns`

Wspólny wzór zawiera opis katalogowy, materiały, parametry włóczki, źródło, język, stan weryfikacji oraz `matching_requirements`. Wersja 2 wymaga jawnych wariantów, ról włóczek, zużycia, rozmiarów, reguł kolorów i liczby nitek.

### Dane prywatne i operacyjne

Prywatne tabele przechowują wersję magazynu, granty recovery, wersje dokumentów prawnych, zaproszenia i próby rejestracji. Bezpośredni dostęp ról `anon` i `authenticated` jest odbierany; dostęp odbywa się przez RLS lub RPC o ograniczonych grantach.

## Dopasowanie

Wariant może trafić do wyników tylko wtedy, gdy:

- wzór nie wymaga dodatkowej weryfikacji;
- wariant ma kompletne wymagania;
- dostępne włóczki spełniają zużycie, materiały, klasę grubości, role, kolory i liczbę nitek;
- jeden motek nie zostaje przypisany do dwóch różnych ról.

Jedna rola może używać kilku zgodnych motków. Wzór wielomateriałowy jest wyszukiwalny pod każdym swoim materiałem, ale pojawia się raz w wynikach. Alternatywne włóczki i elastyczne warianty pozostają rozdzielone zamiast jednej uśrednionej wartości.

Ranking ma bezpieczne limity złożoności: do 250 wariantów na wzór, 8 ról w wariancie i 25 000 odwiedzonych węzłów wyszukiwania. Gdy kombinacji jest więcej, algorytm wybiera najlepszy dostępny podzbiór bez zwiększania limitu 500 zapisanych włóczek.

## API

| Metoda i ścieżka | Zachowanie |
| --- | --- |
| `GET /informacje-prawne` | Publiczna strona regulaminu, prywatności i praw autorskich |
| `GET /health`, `GET /health/live` | Stan procesu |
| `GET /health/ready` | Gotowość aplikacji i zależności |
| `GET /health/release` | Wersja, SHA i środowisko |
| `GET /api/config` | Publiczna konfiguracja klienta, bez sekretów |
| `GET /api/auth/session` | Stan sesji i dostępu prawnego |
| `POST /api/auth/register` | Rejestracja na ważne zaproszenie |
| `POST /api/auth/login` | Logowanie |
| `POST /api/auth/activity` | Odświeżenie podpisanej aktywności sesji |
| `POST /api/auth/password-reset-request` | Żądanie wiadomości recovery bez ujawniania istnienia konta |
| `POST /api/auth/recovery` | Wymiana jednorazowego kodu lub tokenów na grant recovery |
| `POST /api/auth/password` | Ustawienie hasła z aktywnym grantem recovery |
| `POST /api/auth/password/change` | Zmiana hasła po podaniu bieżącego hasła |
| `POST /api/auth/logout` | Wylogowanie i usunięcie cookies |
| `POST /api/legal/acceptance` | Akceptacja bieżącej wersji regulaminu |
| `DELETE /api/account` | Usunięcie konta po haśle i dokładnej frazie potwierdzającej |
| `GET /api/yarns` | Własny magazyn |
| `POST /api/yarns` | Dodanie włóczki |
| `PATCH /api/yarns/:id` | Zmiana własnej włóczki z kontrolą wersji |
| `DELETE /api/yarns/:id` | Usunięcie własnej włóczki z kontrolą wersji |
| `GET /api/patterns` | Uwierzytelniona, stronicowana lista katalogu |
| `GET /api/matches` | Potwierdzone dopasowania dla własnego magazynu |

Odpowiedzi błędów mają stabilny kształt `{ "error": "komunikat" }`. Prywatne endpointy wymagają aktywnej sesji i bieżącej akceptacji regulaminu. Wyjątkiem są wylogowanie i usunięcie konta, aby użytkownik zawsze miał drogę wyjścia.

## Katalog i import

Źródłowy katalog przechodzi walidację pól, limitu 300 rekordów, dozwolonych materiałów, bezpiecznych adresów HTTPS i kompletności wymagań dopasowania. Publiczne DTO nie ujawnia nazw plików źródłowych ani notatek audytowych.

### Kontrakt publikacji treści katalogu

Każdy publikowany rekord musi mieć wiarygodne źródło. Katalog zawiera wyłącznie krótki, własny opis faktograficzny. Nie publikujemy instrukcji, tłumaczeń, diagramów, zdjęć PDF ani długich cytatów. Braków nie uzupełniamy domysłami; niepewne rekordy pozostają ukryte.

`npm run patterns:check` sprawdza dane bez importu. `npm run patterns:import -- --execute` zapisuje do Supabase wskazanego przez lokalną konfigurację, dlatego wymaga jawnego wyboru środowiska, kopii bezpieczeństwa i osobnej zgody na zewnętrzny zapis.

## Konto, sesja i prawo

Rejestracja wymaga zaproszenia przypisanego do e-maila. Baza przechowuje SHA-256 tokenu, a pełny link jest dostępny operatorowi tylko przy tworzeniu. Zaproszenie jest jednorazowe, wygasające i odwoływalne.

Sesja używa cookies `HttpOnly`, `SameSite=Lax`; środowiska publiczne wymagają `Secure`. Podpisana aktywność wygasa domyślnie po 2 godzinach bezczynności. Nieaktualna akceptacja regulaminu blokuje profil, magazyn, dopasowania i katalog, ale pozostawia stronę prawa, ponowną akceptację, wylogowanie i usunięcie konta.

Hasło ma od 8 do 256 znaków i wymaga małej litery, wielkiej litery, cyfry oraz znaku specjalnego. Recovery używa krótkotrwałego, podpisanego i jednorazowego grantu. Po zmianie hasła pozostałe sesje są unieważniane, a użytkownik loguje się ponownie.

Usunięcie konta wymaga aktywnej sesji, poprawnego hasła i dokładnej frazy `USUŃ KONTO`. Usuwa konto Auth, profil, akceptacje i dane prywatne. Ograniczone logi bezpieczeństwa oraz wykorzystane zaproszenie mogą pozostać bez identyfikatora użytkownika zgodnie z polityką retencji.

## Bieżąca praca produktowa

- wyrównanie lokalnego kandydata i wdrożonych SHA przed kolejną promocją;
- domknięcie callbacku potwierdzenia e-mailu między frontendem i backendem;
- rozszerzanie kompletnych, zweryfikowanych wymagań na kolejne wzory;
- benchmark przed decyzją o dalszej paginacji, workerze lub kolejce;
- każdorazowe uzgodnienie ledgera migracji, pełny backup i izolowany restore przed zmianą produkcyjnego Supabase;
- utrzymanie jawnej zgody operatora jako warunku migracji, importu z zapisem i deployu produkcji.
