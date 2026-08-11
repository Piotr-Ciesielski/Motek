# Motek — aktualna specyfikacja produktu

## 1. Status projektu

- wersja źródła w głównym checkoutcie: `2.0.0-alpha.38`
- zweryfikowany staging: `2.0.0-alpha.39`, commit `62d0b84e`
- ostatnia wersja wydana: `1.0.2`
- aktualne źródło danych: Supabase
- lokalny SQLite: usunięty z aplikacji
- następny zakres: domknięcie U-16, U-17, U-19 oraz pełne uporządkowanie U-22; produkcja pozostaje bez zmian
- aktualny stan gotowości prawnej i lista braków: `docs/operations/legal-readiness-status-2026-08-11.md`

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

- ukończyć rejestrację wyłącznie na podstawie jednorazowego zaproszenia,
- zaakceptować aktualną wersję regulaminu i otrzymać osobno informację o prywatności,
- zalogować się i korzystać z konta,
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

1. Operator tworzy jednorazowe zaproszenie dla znormalizowanego adresu e-mail.
2. Użytkownik rejestruje konto z linku zaproszenia i akceptuje aktualny regulamin.
3. Użytkownik dodaje motki, podając nazwę, kolor, jeden lub kilka materiałów, klasę
   grubości, długość i wagę.
4. Aplikacja zapisuje magazyn prywatnie w Supabase.
5. Użytkownik przegląda katalog wzorów.
6. Uruchamia dopasowanie.
7. Backend zwraca tylko potwierdzone warianty, które spełniają wymagania.

Niepełne dane wzoru są widoczne w katalogu, ale nie są używane jako
potwierdzone rekomendacje. System nie zgaduje brakujących metrów ani gramów.
Konto bez aktualnej akceptacji zachowuje dostęp do sesji, wylogowania i usunięcia
konta oraz ekranu ponownej akceptacji, ale nie może czytać ani zmieniać
prywatnego magazynu, dopasowań ani katalogu wzorów.

Aktualny dokument prawny jest dostępny bez logowania pod ścieżką
`/informacje-prawne`. Zawiera wersję regulaminu, osobną informację o
prywatności, sekcję praw autorskich i notę copyright.

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
- zaproszenia są jednorazowe, wygasające i odwoływalne, a baza przechowuje wyłącznie
  SHA-256 tokenu,
- aktualna akceptacja regulaminu jest wersjonowana i egzekwowana przez backend, RLS
  oraz uprzywilejowane RPC,
- usunięcie konta kaskadowo usuwa profil, akceptacje i dane prywatne, ale zachowuje
  zużyte zaproszenie oraz ograniczony log rejestracyjny bez identyfikatora użytkownika,
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

### 6.4 Rejestracja na zaproszenie i akceptacja dokumentów prawnych

Rejestracja wymaga ważnego zaproszenia przypisanego do znormalizowanego adresu
e-mail. System przechowuje w Supabase wyłącznie skrót tokenu zaproszenia;
rezerwacja i finalizacja tworzą próbę rejestracji, a finalizacja oznacza
zaproszenie jako zużyte i zapisuje akceptację aktualnego regulaminu oraz
przekazanie informacji o prywatności.

Sesja bez aktualnej akceptacji regulaminu pozostaje uwierzytelniona, ale dostęp
do prywatnego profilu, magazynu włóczek, dopasowań i katalogu wzorów jest
zablokowany do czasu zaakceptowania bieżącej wersji. Publiczna pozostaje tylko
strona informacji prawnych. Wyjątkiem są `POST /api/auth/logout` i
`DELETE /api/account`: użytkownik może zawsze zakończyć sesję albo usunąć konto;
usunięcie wymaga aktywnej sesji, poprawnego hasła i frazy `USUŃ KONTO`.

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
| `GET /informacje-prawne` | Publiczna strona bieżących dokumentów prawnych |
| `GET /health` | Kontrola stanu serwera |
| `GET /api/auth/session` | Sprawdzenie aktywnej sesji |
| `POST /api/auth/register` | Rejestracja użytkownika |
| `POST /api/auth/login` | Logowanie |
| `POST /api/auth/password-reset-request` | Wysłanie instrukcji odzyskania hasła |
| `POST /api/auth/recovery` | Ustanowienie sesji z tokenów linku recovery |
| `POST /api/auth/password` | Ustawienie nowego hasła |
| `POST /api/auth/logout` | Wylogowanie |
| `POST /api/legal/acceptance` | Zapis akceptacji bieżącej wersji regulaminu |
| `DELETE /api/account` | Bezpowrotne usunięcie konta, profilu i własnych włóczek |
| `GET /api/yarns` | Pobranie własnego magazynu |
| `POST /api/yarns` | Dodanie włóczki |
| `DELETE /api/yarns/:id` | Usunięcie własnej włóczki |
| `GET /api/patterns` | Pobranie katalogu wzorów |
| `GET /api/matches` | Pobranie wykonalnych dopasowań |

Endpointy magazynu, katalogu i rankingu wymagają zalogowanej sesji z aktualną
akceptacją regulaminu. `POST /api/legal/acceptance` wymaga zalogowanej sesji,
przyjmuje bieżącą wersję regulaminu i zapisuje również przekazanie bieżącej
wersji informacji o prywatności. Sekret Supabase nigdy nie trafia do frontendu.

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
Po wymianie kodu recovery backend tworzy w prywatnym Supabase jednorazowy grant,
którego cookie zawiera podpisany identyfikator JTI. Po udanym `updateUser` grant
jest atomowo zużywany, wszystkie pozostałe sesje są unieważniane, a cookies są
czyszczone. Błąd zużycia grantu nie kasuje dowodu recovery, dzięki czemu można
bezpiecznie ponowić próbę.

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
- autosave zapisujący różnice per motek przez `POST`, `PATCH` i `DELETE`,
- usunięcie SQLite z aplikacji.

Do wykonania pozostają przede wszystkim:

- potwierdzenie produkcyjnych ustawień Supabase, Railway i Cloudflare oraz
  uzupełnienie transferów, retencji i dowodów w manifeście dostawców;
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
# Kontrole bezpieczeństwa i ograniczenia planu Free

Backend jest źródłem prawdy dla sesji, recovery, limitów i autoryzacji. Bezpośrednie mutacje tabeli `yarns` są odbierane użytkownikom, a zapis odbywa się przez kontrolowane RPC. Obrazy WAF i Prometheusa w stagingu są przypięte digestami SHA-256. Brak funkcji Supabase „Leaked Password Protection” jest znanym ograniczeniem planu Free; nie wykonujemy upgrade'u Pro.

Po każdej zmianie bezpieczeństwa należy uruchomić `npm run lint`, `npm run format:check`, `npm run check`, `npm audit --json` oraz dostępne testy pgTAP. Aktualny status audytu znajduje się w `docs/operations/security-audit-status-2026-08-07.md`, a plan prac w `docs/superpowers/plans/2026-08-07-security-hardening-free-plan.md`.
