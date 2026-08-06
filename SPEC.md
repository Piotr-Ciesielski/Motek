# Motek — aktualna specyfikacja produktu

## 1. Status projektu

- bieżąca wersja rozwojowa: `2.0.0-alpha.38`
- ostatnia wersja wydana: `1.0.2`
- aktualne źródło danych: Supabase
- lokalny SQLite: usunięty z aplikacji
- następny zakres: zewnętrzna konfiguracja Railway, Cloudflare, GitHub Environments i dwóch projektów Supabase, a następnie kontrolowany test stagingu

Migracja e-mailowego loginu znajduje się w repozytorium; jej zastosowanie i
kontrola na zdalnym Supabase są osobnym krokiem operacyjnym.

Staging uruchamia aplikację wyłącznie za HTTPS reverse proxy z ModSecurity i
OWASP CRS. Logowanie i rejestracja wymagają Turnstile, a błędna konfiguracja
stagingu zatrzymuje start. Liveness nie zależy od Supabase; readiness potwierdza
połączenie. Metryki Prometheus są dostępne tylko w prywatnej sieci kontenerów.
Negatywny readiness blokuje zwykły ruch, zachowując endpointy diagnostyczne.
- limit magazynu: 500 włóczek na użytkownika
- limit katalogu: 300 wzorów

Motek jest aplikacją webową dla osób robiących na drutach i szydełku. Pomaga
odpowiedzieć na pytanie: który wzór można wykonać z włóczek znajdujących się w
prywatnym magazynie użytkownika.

## 2. Aktualny cel produktu

Użytkownik może:

- założyć konto i zalogować się,
- prowadzić prywatny magazyn motków,
- przeglądać katalog wzorów,
- wyszukiwać wzory i łączyć filtry statusu, języka, typu projektu oraz materiału,
- sprawdzać dopasowania wyłącznie dla wzorów z kompletnymi wymaganiami.

Filtry katalogu działają jako wspólne kryteria „i”. Liczniki typów i materiałów
są wyliczane dynamicznie względem pozostałych aktywnych filtrów; niemożliwe opcje
są nieaktywne, a aktualnie wybrana wartość pozostaje dostępna do wyczyszczenia.

Motek nie jest sklepem ani pełnym programem do projektowania dzianin. Jego
główną funkcją jest świadome wykorzystanie posiadanego zapasu włóczek.

## 3. Aktualny przepływ użytkownika

1. Użytkownik zakłada konto albo się loguje.
2. Dodaje motki, podając nazwę, kolor, jeden lub kilka materiałów, klasę
   grubości, długość i wagę.
3. Aplikacja zapisuje magazyn prywatnie w Supabase.
4. Użytkownik przegląda katalog wzorów.
5. Uruchamia dopasowanie.
6. Backend zwraca tylko potwierdzone warianty, które spełniają wymagania.

Niepełne dane wzoru są widoczne w katalogu, ale nie są używane jako
potwierdzone rekomendacje. System nie zgaduje brakujących metrów ani gramów.

## 4. Architektura

### Frontend

Frontend jest statyczną aplikacją HTML/CSS/JavaScript:

- `index.html` — widok aplikacji,
- `styles.css` — style,
- `app.js` — logika interfejsu.

Frontend obsługuje formularze Auth, magazyn włóczek, katalog, wyszukiwanie,
filtrowanie i prezentację wyników. Nie otrzymuje sekretnego klucza Supabase.
W Magazynie pokazuje pionową grafikę włóczek i kota po prawej, a w Dopasowaniu
szeroki hero z tym samym kierunkiem wizualnym. Oba miejsca korzystają z
wersjonowanego obrazu WebP zgodnego z aktywnym motywem:
`assets/color-yarn-cat.v1.webp` dla Koloroterapii oraz
`assets/night-yarn-cat.v1.webp` dla Nocnego Motka. Źródłowe PNG pozostają
w repozytorium jako materiał bazowy, a pliki WebP są cache'owane przez rok.

### Backend

`server.js` jest lekkim serwerem HTTP Node.js bez dodatkowego frameworka.
Odpowiada za:

- serwowanie plików aplikacji,
- walidację danych wejściowych,
- rejestrację, logowanie, sesję i wylogowanie,
- operacje na magazynie włóczek,
- pobieranie katalogu wzorów,
- ranking dopasowania,
- nagłówki bezpieczeństwa i obsługę błędów.

### Supabase

Supabase jest jedynym źródłem danych aplikacji:

- `auth.users` — konta użytkowników,
- `profiles` — dane aplikacyjne profilu,
- `yarns` — prywatny magazyn włóczek,
- `patterns` — wspólny katalog wzorów.

Backend wymaga przy uruchomieniu kompletnej konfiguracji Supabase. Aplikacja
nie ma lokalnego trybu SQLite ani fallbacku do pliku lokalnego.

## 5. Bezpieczeństwo i własność danych

- sekret Supabase pozostaje wyłącznie po stronie backendu,
- klucz publishable jest używany tylko przez backendowy klient Auth,
- tokeny sesji są przechowywane w ciasteczkach HttpOnly,
- produkcja wymaga jawnego `COOKIE_SECURE=true` dla atrybutu `Secure`,
- magazyn włóczek jest izolowany przez `user_id` i RLS,
- właściciel nowej włóczki wynika z uwierzytelnionej sesji, nie z formularza,
- dane wejściowe mają limity długości i wartości,
- logowanie i rejestracja ograniczają serię nieudanych prób per adres klienta i e-mail,
- odpowiedzi API nie zawierają sekretów ani tokenów,
- `.env` i lokalny folder `Wzory` nie trafiają do Git.

Szczegółowe ryzyka przed wdrożeniem produkcyjnym opisuje `AUDYT.md`.

## 6. Model danych

### 6.1 Profil użytkownika — `public.profiles`

Profil jest powiązany 1:1 z `auth.users`. Kolumny `login` i `email` przechowują
ten sam znormalizowany adres e-mail; login nie jest niezależnym pseudonimem.
Rejestracja przyjmuje `login` jako adres e-mail oraz hasło. Profil nie przechowuje
imienia i nazwiska.

### 6.2 Włóczka — `public.yarns`

Pola aplikacyjne:

- `id`, `user_id`,
- `name`, `color`, `materials`, `weight_class`,
- `length_meters`, `weight_grams`,
- `created_at`, `updated_at`.

Pole `materials` przechowuje jeden lub kilka materiałów ze wspólnej,
kontrolowanej listy używanej również przez katalog wzorów. Wartość „mieszanka”
oznacza nieokreślony skład i nie łączy się z konkretnymi materiałami. Stare
pole `material` pozostaje zgodnościowo synchronizowane w bazie. Klasa grubości
korzysta z wartości `lace`, `fingering`, `sport`, `dk`, `worsted` i `bulky`.

### 6.3 Wzór — `public.patterns`

Rekord zawiera między innymi:

- `name`, `description`, `materials`,
- `meters_per_100g`,
- `yarn_requirements`,
- `matching_requirements`,
- `source_filename`, `source_language`, `needs_review`.

`yarn_requirements` opisuje włóczki występujące we wzorze, w tym role główne,
dodatkowe, kontrastowe lub alternatywne. `matching_requirements` w wersji 2
zawiera potwierdzone zużycie, rozmiary, warianty włóczek, role, reguły kolorów
i liczbę nitek używane przez ranking.

## 7. Zasada dopasowania

Wzór może pojawić się w wynikach tylko wtedy, gdy:

- rekord nie wymaga dodatkowej weryfikacji,
- wariant ma kompletne wymagania,
- liczba i parametry dostępnych włóczek spełniają wymagania wariantu,
- jeden motek nie jest używany jednocześnie do dwóch różnych ról.

Ranking uwzględnia wymagane metry lub gramy, materiały, klasy grubości, role,
kolory i liczbę nitek. Jedna rola może użyć kilku kompatybilnych motków, ale
jeden motek nie może zostać przydzielony do dwóch ról. Brak danych oznacza brak
możliwości potwierdzenia wykonalności, a nie zgodę na użycie przybliżenia.

Wzór wielomateriałowy może być znaleziony pod każdym użytym materiałem, ale jest
liczony tylko raz w wynikach. Alternatywne włóczki i elastyczne wymagania są
przechowywane osobno, bez zastępowania ich jedną uśrednioną wartością.

Dokładne wymagania wdrożono dla 21 wariantów trzech rzeczywistych wzorów:
Holly, Na Pole i Oslo Hat. Pozostałe rekordy pozostają dostępne opisowo i nie
są prezentowane jako potwierdzone wyniki, dopóki ich wymagania nie zostaną
uzupełnione i zweryfikowane.

Jeśli magazyn użytkownika jest większy niż bieżący limit obliczeń, ranking
wybiera najlepiej pasujący podzbiór dla konkretnego wariantu. Limit dotyczy
obliczenia, a nie liczby motków, które użytkownik może zapisać.

Niezależnie od limitu obliczeń aplikacja pozwala zapisać do 500 włóczek na
użytkownika. Katalog aplikacji może zawierać do 300 wzorów.

## 8. API

| Endpoint | Znaczenie |
| --- | --- |
| `GET /health` | Kontrola stanu serwera |
| `GET /api/auth/session` | Sprawdzenie aktywnej sesji |
| `POST /api/auth/register` | Rejestracja użytkownika |
| `POST /api/auth/login` | Logowanie |
| `POST /api/auth/confirmation` | Potwierdzenie adresu e-mail tokenami z fragmentu URL |
| `POST /api/auth/password-reset-request` | Wysłanie instrukcji odzyskania hasła |
| `POST /api/auth/recovery` | Ustanowienie sesji z tokenów linku recovery |
| `POST /api/auth/password` | Ustawienie nowego hasła |
| `POST /api/auth/logout` | Wylogowanie |
| `POST /api/auth/activity` | Odświeżenie aktywności bieżącej sesji |
| `DELETE /api/account` | Bezpowrotne usunięcie konta, profilu i własnych włóczek |
| `GET /api/yarns` | Pobranie własnego magazynu |
| `POST /api/yarns` | Dodanie włóczki |
| `PATCH /api/yarns/:id` | Wersjonowana aktualizacja własnej włóczki (`If-Match`) |
| `DELETE /api/yarns/:id` | Usunięcie własnej włóczki |
| `GET /api/patterns` | Pobranie katalogu wzorów |
| `GET /api/matches` | Pobranie wykonalnych dopasowań |

Endpointy magazynu i rankingu wymagają zalogowanej sesji. `GET /api/patterns`
jest publicznym odczytem katalogu, ale sekret Supabase nigdy nie trafia do
frontendu.

## 9. Katalog wzorów i import

Katalog powstał na podstawie audytu 116 lokalnych dokumentów PDF w folderze
`Wzory`. Zawiera 103 samodzielne wzory z tych plików oraz 3 rekordy
demonstracyjne. Trzynaście plików wykluczono jako duplikaty, kupony dostępu,
instrukcję techniczną albo materiały pomocnicze do innego wzoru. Folder jest
roboczy, ignorowany przez Git i nie jest serwowany przez aplikację.

Proces przygotowania danych obejmuje:

1. audyt dokumentów,
2. przygotowanie kandydatów,
3. ręczne poprawki przypadków niejednoznacznych,
4. walidację danych,
5. kontrolę podsumowania importu,
6. selektywny import do Supabase.

Narzędzia importowe znajdują się w `scripts/`. Import powinien być wykonywany
dopiero po sprawdzeniu podsumowania zmian.

Audyt odróżnia:

- włóczkę o jednym jednoznacznym przeliczeniu,
- kilka poprawnych włóczek alternatywnych,
- elastyczny dobór włóczki określony przez autora wzoru.

Brak jednej wartości `meters_per_100g` nie oznacza braku danych, jeżeli wzór
zawiera kilka alternatyw lub świadomie dopuszcza dowolną włóczkę. Szczegółowy
wynik i lista wykluczeń znajdują się w `WZORY_AUDYT_DANYCH.md`.

## 10. Uruchomienie i sprawdzanie

Wymagane są Node.js z obsługą `--env-file-if-exists` oraz npm.

```bash
npm install
npm start
```

Domyślny adres to `http://127.0.0.1:3001`.

Konfiguracja Supabase jest przekazywana przez lokalny `.env`:

```text
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
```

Podstawowe sprawdzenie projektu:

```bash
npm run check
```

Konfigurację Railway sprawdza `npm run railway:check`. Po wdrożeniu workflow
uruchamia `npm run regression:full` tylko dla `staging` z gałęzi `staging` i
`npm run regression:smoke` dla `production` z `main`. Profile weryfikują SHA
z `/health/release`; produkcja nie otrzymuje sekretów konta QA.

Lokalnie przygotowano `railway.json`, `deploy/railway/Dockerfile`, endpointy
gotowości i wydania, runner regresji oraz workflow GitHub Actions. Konfiguracja
usług zewnętrznych, DNS/WAF/TLS, osobnych Supabase, migracje i wdrożenia nadal
wymagają operatora według `docs/operations/post-deploy-regression.md`.

### 10.1 Odzyskiwanie hasła

Użytkownik może rozpocząć odzyskiwanie hasła z formularza logowania. Backend
udostępnia `POST /api/auth/password-reset-request`, który wysyła wiadomość przez
Supabase Auth bez ujawniania, czy wskazany e-mail istnieje. Link recovery wraca
do aplikacji, a `POST /api/auth/recovery` ustanawia sesję z tokenów linku.
Frontend przewija ekran do formularza „Ustaw nowe hasło”, podświetla okno
odzyskiwania niebieską ramką i ustawia fokus w polu hasła. Nowe hasło zapisuje
`POST /api/auth/password`; po udanej zmianie backend usuwa
ciasteczka sesji, aby wymusić ponowne logowanie.
Wywołania backendu do Supabase Auth są przerywane po 10 sekundach i zwracają
kontrolowany błąd, jeśli usługa Auth nie odpowiada.
Przed `updateUser` backend odtwarza pełną sesję recovery z obu tokenów linku;
brak refresh tokenu lub nieważna sesja kończy się kontrolowanym błędem 400.

Kontrola danych wzorów bez wykonywania importu:

```bash
npm run patterns:check
```

## 11. Aktualny zakres i następne kroki

Zrealizowano:

- katalog wzorów w Supabase,
- zweryfikowane materiały oraz parametry motków dla 103 wzorów źródłowych,
- dynamiczne filtry katalogu: wszystkie aktywne kryteria muszą pasować, typy
  i materiały pokazują aktualne liczniki, a wzór wielomateriałowy jest dostępny
  pod każdym swoim materiałem,
- Supabase Auth i profile użytkowników,
- prywatny magazyn włóczek z RLS,
- zapis i usuwanie włóczek przez aplikację,
- wspólną listę materiałów i obsługę kilku materiałów jednego motka,
- bezpieczną ścieżkę rankingu z dokładnymi wymaganiami 21 wariantów,
- natychmiastowe usuwanie konta po ponownym podaniu hasła i potwierdzeniu,
- dwa motywy wizualne: jasna „Koloroterapia” i ciemny „Nocny Motek”,
  przełączane globalnie w nagłówku i zapamiętywane lokalnie,
- pionowa grafika włóczek i kota po prawej w Magazynie oraz hero graficzny w Dopasowaniu,
  przełączane razem z motywem,
- jawny zapis zmian włóczki przez `POST`/`PATCH`/`DELETE` z wersją `ETag`/`If-Match`,
- usunięcie SQLite z aplikacji.

Do wykonania pozostają przede wszystkim:

- rozszerzenie kompletnych wymagań zużycia na kolejne wzory,
- uzupełnienie rate limitingu na reverse proxy oraz monitoring prób Auth,
- wymuszenie HTTPS i HSTS na reverse proxy w produkcji,
- dalsze ograniczenie kosztu rankingu, testy obciążenia i ewentualny worker,
- pełna ochrona DDoS przed warstwą aplikacji: CDN/WAF lub reverse proxy,
  limity ruchu na brzegu, ukrycie originu, monitoring i procedura reakcji,
- uporządkowanie konfiguracji wdrożenia produkcyjnego.

### Opcjonalny plan skalowania

Przy obecnych limitach 500 włóczek na użytkownika i 300 wzorów worker ani
paginacja nie są wymagane. Skalowanie ponad te wartości pozostaje opcjonalne i
powinno zostać uruchomione dopiero, gdy benchmark pokaże realne opóźnienia albo
produkt będzie wymagał większych magazynów lub katalogu. Możliwe kierunki to:

- paginacja katalogu i magazynu,
- dalsza optymalizacja wyboru podzbioru włóczek,
- przeniesienie rankingu do workera lub kolejki zadań.

## 12. Historia migracji

Wersja `1.0.x` była lokalną aplikacją z SQLite. W wersji `2.0.0` rozpoczęto
migrację katalogu wzorów do Supabase. Kolejne wersje alpha dodały Auth,
profile, prywatny magazyn włóczek, role włóczek w rankingu i ostatecznie
usunęły SQLite z aplikacji.

Szczegółową historię zmian zawiera `CHANGELOG.txt`, a uzasadnienie ryzyk
bezpieczeństwa i jakości — `AUDYT.md`.
## Kompozycja wariantów wizualnych

Wariant jasny („Koloroterapia”) i ciemny („Nocny Motek”) używają tej samej
architektury widoków. Magazyn ma asymetryczne dwie kolumny: treść i statystyki
po lewej oraz pionową grafikę po prawej, rozciągniętą przez wysokość widoku.
Dopasowanie pokazuje szeroką kartę z grafiką wybranego motywu. Obrazy zmieniają
się razem z globalnym przełącznikiem jasny/ciemny, bez ponownego transferu pliku
już zapisanego w cache przeglądarki.
Grafika w Magazynie zachowuje pionową kompozycję prototypów przez
`object-fit: cover` i `object-position: right center`; Dopasowanie pozostaje
szerokim hero. Magazyn i Dopasowanie pokazują same grafiki, bez tekstowych
nakładek i ramek.
