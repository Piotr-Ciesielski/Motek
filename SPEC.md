# Motek — aktualna specyfikacja produktu

## 1. Status projektu

- bieżąca wersja rozwojowa: `2.0.0-alpha.8`
- ostatnia wersja wydana: `1.0.2`
- aktualne źródło danych: Supabase
- lokalny SQLite: usunięty z aplikacji
- następny zakres: uzupełnienie i selektywny import kompletnych wymagań dopasowania dla wzorów

Motek jest aplikacją webową dla osób robiących na drutach i szydełku. Pomaga
odpowiedzieć na pytanie: który wzór można wykonać z włóczek znajdujących się w
prywatnym magazynie użytkownika.

## 2. Aktualny cel produktu

Użytkownik może:

- założyć konto i zalogować się,
- prowadzić prywatny magazyn motków,
- przeglądać katalog wzorów,
- wyszukiwać wzory i filtrować je według statusu weryfikacji,
- sprawdzać dopasowania wyłącznie dla wzorów z kompletnymi wymaganiami.

Motek nie jest sklepem ani pełnym programem do projektowania dzianin. Jego
główną funkcją jest świadome wykorzystanie posiadanego zapasu włóczek.

## 3. Aktualny przepływ użytkownika

1. Użytkownik zakłada konto albo się loguje.
2. Dodaje motki, podając nazwę, kolor, materiał, klasę grubości, długość i wagę.
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

### 6.1 Włóczka — `public.yarns`

Pola aplikacyjne:

- `id`, `user_id`,
- `name`, `color`, `material`, `weight_class`,
- `length_meters`, `weight_grams`,
- `created_at`, `updated_at`.

Dozwolone materiały to między innymi wełna, bawełna, akryl, alpaka i
mieszanka. Klasa grubości korzysta z wartości `lace`, `fingering`, `sport`,
`dk`, `worsted` i `bulky`.

### 6.2 Wzór — `public.patterns`

Rekord zawiera między innymi:

- `name`, `description`, `materials`,
- `meters_per_100g`,
- `yarn_requirements`,
- `matching_requirements`,
- `source_filename`, `source_language`, `needs_review`.

`yarn_requirements` opisuje włóczki występujące we wzorze, w tym role główne,
dodatkowe, kontrastowe lub alternatywne. `matching_requirements` zawiera
potwierdzone zużycie dla wariantów lub rozmiarów używane przez ranking.

## 7. Zasada dopasowania

Wzór może pojawić się w wynikach tylko wtedy, gdy:

- rekord nie wymaga dodatkowej weryfikacji,
- wariant ma kompletne wymagania,
- liczba i parametry dostępnych włóczek spełniają wymagania wariantu,
- jeden motek nie jest używany jednocześnie do dwóch różnych ról.

Ranking uwzględnia wymagane metry, gramy, materiały i klasy grubości. Wyniki
są sortowane według wyniku procentowego. Jedno wymaganie może użyć kilku
kompatybilnych motków, jeśli `yarns_needed` oznacza minimalną liczbę motków.
Brak danych oznacza brak możliwości potwierdzenia wykonalności, a nie zgodę
na użycie przybliżenia.

Obecne rekordy katalogu mają jeszcze pustą listę wariantów dopasowania, więc
nie są prezentowane jako potwierdzone wyniki, dopóki wymagania nie zostaną
uzupełnione i zweryfikowane.

## 8. API

| Endpoint | Znaczenie |
| --- | --- |
| `GET /health` | Kontrola stanu serwera |
| `GET /api/auth/session` | Sprawdzenie aktywnej sesji |
| `POST /api/auth/register` | Rejestracja użytkownika |
| `POST /api/auth/login` | Logowanie |
| `POST /api/auth/logout` | Wylogowanie |
| `GET /api/yarns` | Pobranie własnego magazynu |
| `POST /api/yarns` | Dodanie włóczki |
| `DELETE /api/yarns/:id` | Usunięcie własnej włóczki |
| `GET /api/patterns` | Pobranie katalogu wzorów |
| `GET /api/matches` | Pobranie wykonalnych dopasowań |

Endpointy magazynu i rankingu wymagają zalogowanej sesji. `GET /api/patterns`
jest publicznym odczytem katalogu, ale sekret Supabase nigdy nie trafia do
frontendu.

## 9. Katalog wzorów i import

Katalog powstał na podstawie 116 lokalnych dokumentów PDF w folderze `Wzory`.
Folder jest roboczy, ignorowany przez Git i nie jest serwowany przez aplikację.

Proces przygotowania danych obejmuje:

1. audyt dokumentów,
2. przygotowanie kandydatów,
3. ręczne poprawki przypadków niejednoznacznych,
4. walidację danych,
5. kontrolę podsumowania importu,
6. selektywny import do Supabase.

Narzędzia importowe znajdują się w `scripts/`. Import powinien być wykonywany
dopiero po sprawdzeniu podsumowania zmian.

## 10. Uruchomienie i sprawdzanie

Wymagane są Node.js z obsługą `--env-file-if-exists` oraz npm.

```bash
npm install
npm start
```

Domyślny adres to `http://localhost:3000`.

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

Kontrola danych wzorów bez wykonywania importu:

```bash
npm run patterns:check
```

## 11. Aktualny zakres i następne kroki

Zrealizowano:

- katalog wzorów w Supabase,
- Supabase Auth i profile użytkowników,
- prywatny magazyn włóczek z RLS,
- zapis i usuwanie włóczek przez aplikację,
- bezpieczną ścieżkę rankingu z wymaganiami wariantów,
- autosave zapisujący różnice per motek przez `POST`, `PATCH` i `DELETE`,
- usunięcie SQLite z aplikacji.

Do wykonania pozostają przede wszystkim:

- uzupełnienie kompletnych wymagań dopasowania dla wybranych wzorów,
- uzupełnienie rate limitingu na reverse proxy oraz monitoring prób Auth,
- wymuszenie HTTPS i HSTS na reverse proxy w produkcji,
- dalsze ograniczenie kosztu rankingu, testy obciążenia i ewentualny worker,
- uporządkowanie konfiguracji wdrożenia produkcyjnego.

## 12. Historia migracji

Wersja `1.0.x` była lokalną aplikacją z SQLite. W wersji `2.0.0` rozpoczęto
migrację katalogu wzorów do Supabase. Kolejne wersje alpha dodały Auth,
profile, prywatny magazyn włóczek, role włóczek w rankingu i ostatecznie
usunęły SQLite z aplikacji.

Szczegółową historię zmian zawiera `CHANGELOG.txt`, a uzasadnienie ryzyk
bezpieczeństwa i jakości — `AUDYT.md`.
