# Motek

Motek to aplikacja webowa dla osób robiących na drutach i szydełku. Pomaga
odpowiedzieć na praktyczne pytanie: **który wzór mogę wykonać z włóczek, które
mam?**

Użytkownik zapisuje swój magazyn motków, a aplikacja porównuje ich parametry z
wymaganiami wzorów. Wyniki są filtrowane do projektów możliwych do wykonania i
porządkowane według stopnia dopasowania.

## Po co powstał Motek

Biznesowo Motek zmniejsza tarcie między kolekcjonowaniem włóczek a wyborem
projektu. Zamiast pamiętać, ile metrów, gramów i jakiego rodzaju włóczki jest w
domu, użytkownik może zbudować własny magazyn i szybko odkryć wykonalne wzory.

Docelowa wartość produktu to:

- lepsze wykorzystanie posiadanych zapasów,
- mniej przypadkowych zakupów włóczki,
- szybsze przechodzenie od pomysłu do konkretnego projektu,
- prywatny, osobisty katalog motków i dopasowań.

Motek nie jest sklepem ani pełnym programem do projektowania dzianin. Jego
główną funkcją jest świadome dopasowanie zapasu włóczek do wymagań wzoru.

## Jak działa aplikacja

1. Użytkownik zakłada konto lub loguje się.
2. Dodaje motki, podając nazwę, kolor, materiał, klasę grubości, długość i wagę.
3. Przegląda katalog wzorów, wyszukuje je i filtruje według statusu danych.
4. Uruchamia dopasowanie.
5. Backend pobiera prywatny magazyn użytkownika oraz katalog wzorów i zwraca
   tylko potwierdzone warianty, które spełniają wymagania.

Wymagania wzoru mogą opisywać rozmiary lub inne warianty. Mogą też rozdzielać
włóczkę główną, dodatkową i kontrastową. Jeden motek nie może zostać użyty
jednocześnie do dwóch różnych ról.

Jeżeli źródło nie podaje wystarczających danych, rekord otrzymuje
`needs_review=true` albo pusty zestaw wymagań do rankingu. System nie zgaduje
zużycia na podstawie samej nazwy wzoru, materiału ani przybliżenia.

## Główne komponenty

### Frontend

Statyczny interfejs HTML, CSS i JavaScript znajduje się w `index.html`,
`styles.css` i `app.js`. Odpowiada za:

- konto użytkownika i sesję,
- formularz magazynu włóczek,
- katalog wzorów,
- wyszukiwanie i filtrowanie,
- prezentację wyników dopasowania.

Frontend nie otrzymuje sekretnego klucza Supabase. Komunikuje się z backendem
przez API Motka.

### Backend

`server.js` to lekki serwer HTTP Node.js bez dodatkowego frameworka. Odpowiada
za:

- serwowanie aplikacji webowej,
- walidację danych wejściowych,
- rejestrację, logowanie, sesję i wylogowanie,
- endpointy magazynu włóczek,
- katalog wzorów,
- ranking dopasowania,
- nagłówki bezpieczeństwa i obsługę błędów.

### Supabase

Supabase jest obecnie jedynym źródłem danych aplikacji:

- `auth.users` przechowuje konta,
- `profiles` przechowuje profil użytkownika,
- `yarns` przechowuje prywatny magazyn włóczek,
- `patterns` przechowuje wspólny katalog wzorów.

Obowiązujące limity produktu to maksymalnie 500 włóczek na użytkownika oraz
300 rekordów w katalogu wzorów.

Dostęp do magazynu włóczek ogranicza Row Level Security (RLS): użytkownik może
czytać i zmieniać wyłącznie rekordy należące do niego. Backend przekazuje token
sesji do klienta Supabase, a właściciel rekordu jest ustalany na podstawie
uwierzytelnionej sesji, nie danych z formularza.

### Supabase jako jedyne źródło danych

Supabase jest wymagane do uruchomienia aplikacji. Backend sprawdza konfigurację
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` i `SUPABASE_SECRET_KEY` przy starcie.
Lokalny fallback SQLite oraz zależność `sql.js` zostały usunięte.

## API

Najważniejsze endpointy backendu:

| Endpoint | Znaczenie |
| --- | --- |
| `GET /api/auth/session` | Sprawdzenie aktywnej sesji |
| `POST /api/auth/register` | Rejestracja użytkownika |
| `POST /api/auth/login` | Logowanie |
| `POST /api/auth/logout` | Wylogowanie |
| `GET /api/yarns` | Pobranie własnego magazynu |
| `POST /api/yarns` | Dodanie motka |
| `DELETE /api/yarns/:id` | Usunięcie własnego motka |
| `GET /api/patterns` | Pobranie katalogu wzorów |
| `GET /api/matches` | Pobranie wykonalnych dopasowań |
| `GET /health` | Kontrola stanu serwera |

`GET /api/matches` wymaga zalogowania w trybie Supabase. Nie zwraca wyników na
podstawie magazynu innego użytkownika. Przy większym magazynie bieżąca wersja
analizuje ograniczony, najlepiej pasujący podzbiór motków; nie ogranicza to
zapisu danych.

## Model danych dopasowania

Katalog `patterns` przechowuje zarówno dane opisowe, jak i dane wymagane do
bezpiecznego rankingu:

- `materials` — rozpoznane materiały,
- `meters_per_100g` — parametr włóczki, jeśli został jednoznacznie ustalony,
- `yarn_requirements` — włóczki główne, dodatkowe, kontrastowe lub alternatywne,
- `matching_requirements` — kompletne zużycie dla wariantów i rozmiarów,
- `needs_review` — informacja o konieczności dalszej weryfikacji.

`matching_requirements` zawiera między innymi liczbę motków, wymagane metry i
gramy, materiały, klasy grubości oraz opcjonalne role włóczek. Dzięki temu
opisowa informacja o wzorze jest oddzielona od danych, na których można oprzeć
decyzję „da się wykonać”.

## Źródła katalogu wzorów

Katalog został przygotowany z 116 lokalnych dokumentów PDF znajdujących się w
roboczym folderze `Wzory`. Pliki źródłowe są ignorowane przez Git i nie są
serwowane publicznie przez aplikację.

Proces przygotowania danych obejmuje:

1. audyt plików PDF,
2. automatyczne przygotowanie kandydatów,
3. ręczne poprawki dla skanów i przypadków niejednoznacznych,
4. walidację rekordu,
5. kontrolę importu,
6. selektywny import do Supabase.

W projekcie służą do tego między innymi `scripts/build-pattern-import.py` oraz
`scripts/import-patterns.js`.

## Dlaczego architektura jest przejściowa

Projekt został podzielony na etapy, żeby nie łączyć kilku ryzykownych zmian w
jednym kroku:

- najpierw powstał katalog wzorów w Supabase,
- następnie dodano konta, profile i bezpieczne sesje,
- potem przeniesiono magazyn włóczek do Supabase z izolacją użytkowników,
- na końcu przygotowano bezpieczną ścieżkę rankingu.

Takie podejście pozwoliło testować każdą granicę osobno: katalog, autoryzację,
własność danych i dopasowanie. Obecnie wszystkie dane aplikacji przechodzą przez
Supabase, a lokalnie pozostają wyłącznie narzędzia importu i testowe dane
syntetyczne.

Najważniejsza zasada projektowa brzmi: **brak danych nie może udawać dokładnego
wyniku**. Dlatego rekord wymagający weryfikacji jest widoczny w katalogu, ale
nie trafia do automatycznego dopasowania jako potwierdzona rekomendacja.

## Bezpieczeństwo

- sekretny klucz Supabase znajduje się wyłącznie po stronie backendu,
- dane sesji są przechowywane w ciasteczkach HttpOnly,
- magazyn włóczek jest izolowany przez `user_id` i RLS,
- backend jawnie wybiera dane zwracane przez API,
- dane wejściowe są walidowane i ograniczane rozmiarem,
- logowanie i rejestracja mają limit nieudanych prób per adres klienta i e-mail,
- błędy nie ujawniają sekretów ani tokenów,
- folder `Wzory` i plik `.env` nie trafiają do repozytorium.

## Uruchomienie lokalne

Wymagania: Node.js z obsługą `--env-file-if-exists` oraz npm.

```bash
npm install
npm start
```

Następnie otwórz adres wyświetlony przez serwer, domyślnie:

```text
http://localhost:3000
```

Tryb Supabase wymaga lokalnego pliku `.env` z wartościami:

```text
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
COOKIE_SECURE=false
```

Sekretnego klucza nie należy umieszczać w frontendzie, commitach ani logach.
W produkcji ustaw `COOKIE_SECURE=true` i używaj wyłącznie HTTPS.

## Sprawdzanie projektu

```bash
npm run check
```

Polecenie sprawdza składnię backendu i frontendu oraz uruchamia testy
automatyczne. Aktualny zestaw obejmuje między innymi sesje Auth, izolację
magazynów dwóch użytkowników, katalog Supabase i walidację danych.

Kontrola importu wzorów:

```bash
npm run patterns:check
```

Import wykonawczy do Supabase powinien być uruchamiany dopiero po sprawdzeniu
podsumowania i potwierdzeniu danych:

```bash
npm run patterns:import
```

## Stan projektu i wersjonowanie

Aktualna wersja rozwojowa: **2.0.0-alpha.11**.

Najważniejsze etapy zapisane w `CHANGELOG.txt`:

- `1.0.x` — lokalna aplikacja z SQLite, magazynem włóczek i podstawowym rankingiem,
- `2.0.0` — katalog wzorów w Supabase i powtarzalny proces importu,
- `2.0.0-alpha.1–alpha.3` — profile, rejestracja, logowanie i sesje,
- `2.0.0-alpha.4–alpha.5` — tabela `yarns` i magazyn per użytkownik,
- `2.0.0-alpha.6` — ranking z prywatnego magazynu Supabase,
- `2.0.0-alpha.7` — osobne role włóczek i walidowany lokalny format wymagań,
- `2.0.0-alpha.8` — Supabase jako jedyne źródło danych i usunięcie SQLite.
- `2.0.0-alpha.9` — bezpieczny autosave, zabezpieczenia Auth, limity produktu i ograniczenie kosztu rankingu.
- `2.0.0-alpha.10` — naprawa nagłówków żądań magazynu i synchronizacja wymaganych migracji zdalnego Supabase.
- `2.0.0-alpha.11` — stabilizacja audytu, obsługi autosave, limitów wymagań, importu i kosztu rankingu.

## Najbliższy etap rozwoju

Następnym krokiem jest ręczne uzupełnienie kompletnych, potwierdzonych danych
zużycia dla rozmiarów i wariantów wybranych wzorów oraz ich selektywny import do
Supabase. Ranking automatycznie pomija rekordy bez pełnych, zweryfikowanych
wymagań.

Skalowanie ponad obecne limity 500 włóczek na użytkownika i 300 wzorów jest
opcjonalne. Wrócimy do paginacji, dalszej optymalizacji lub workera dopiero po
benchmarku wskazującym realny problem albo po zmianie wymagań produktu.

Najbliższym etapem operacyjnym jest przygotowanie stagingu z reverse proxy/WAF,
limitami połączeń, monitoringiem i automatyczną kontrolą zgodności migracji.
Przed wdrożeniem produkcyjnym pozostają także retry i obsługa konfliktów
autosave oraz test pełnego importu katalogu z możliwością wycofania.

### Kolejny etap ochrony infrastruktury

Przed wdrożeniem produkcyjnym trzeba uzupełnić ochronę przed rozproszonymi
atakami DDoS poza aplikacją: skonfigurować CDN/WAF lub reverse proxy, limity
ruchu na brzegu, ukryć bezpośredni adres originu, dodać monitoring i procedurę
reakcji na incydenty. Limity aplikacyjne w Node.js są tylko dodatkową warstwą.

## Struktura projektu

```text
Motek/
├── app.js                         # logika interfejsu
├── index.html                     # widok aplikacji
├── styles.css                     # style
├── server.js                      # backend HTTP i API
├── supabase.js                    # konfiguracja połączenia Supabase
├── supabase/migrations/           # migracje schematu bazy
├── scripts/                       # audyt, budowa i import danych wzorów
├── data/                          # lokalne dane robocze i importowe
├── test/                          # testy automatyczne
├── SPEC.md                       # pełniejsza specyfikacja produktu
├── CHANGELOG.txt                 # historia wersji
└── VERSION                       # bieżąca wersja projektu
```
