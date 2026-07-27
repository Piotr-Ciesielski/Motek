# Motek — specyfikacja produktu

## Status wersji

- bieżąca wydana wersja aplikacji: `1.0.2`
- rozwijana wersja: `2.0.0-alpha.8`
- zrealizowany zakres: katalog wzorów, Supabase Auth, prywatny magazyn włóczek oraz bezpieczna ścieżka rankingu
- następny zakres: uzupełnienie kompletnych wymagań dopasowania dla wzorów

## 1. Cel produktu
Motek to prosta aplikacja webowa dla dziewiarzy i dziewiarek, która pomaga dopasować dostępny zapas włóczek do wzorów udziergów.

System przyjmuje dane o włóczkach, przechowuje je lokalnie w bazie SQLite i porównuje z bazą wzorów. Na tej podstawie zwraca wzory, które można wykonać z posiadanego materiału.

## 2. Zakres wersji 1.0.0
Wersja 1.0.0 obejmuje:
- interfejs webowy do przeglądania i wprowadzania włóczek
- lokalny backend HTTP w Node.js
- trwały magazyn danych w pliku SQLite
- bazę wzorów przechowywaną w SQLite
- mechanizm dopasowania wzorów do włóczek

Poza zakresem tej wersji:
- logowanie użytkowników
- synchronizacja z chmurą
- wielu użytkowników jednocześnie
- edycja wzorów przez panel administracyjny
- import zewnętrznych katalogów włóczek lub gotowych baz wzorów

## 3. Użytkownik docelowy
Użytkownikiem jest osoba zajmująca się robótkami ręcznymi, która:
- ma zapas różnych motków
- zna podstawowe parametry włóczki
- chce szybko sprawdzić, jaki wzór jest wykonalny

## 4. Główne przypadki użycia
### 4.1 Przeglądanie magazynu włóczek
Użytkownik otwiera aplikację i widzi aktualną listę włóczek zapisanych w bazie.

### 4.2 Dodanie włóczki
Użytkownik może dopisać nowy motek przez formularz z polami:
- nazwa
- kolor
- materiał
- klasa grubości
- długość w metrach
- waga w gramach

### 4.3 Usunięcie włóczki
Użytkownik może usunąć wybrany motek z magazynu.

### 4.4 Wyszukanie pasujących wzorów
Użytkownik uruchamia dopasowanie, a system zwraca tylko te wzory, które spełniają minimalne wymagania.

## 5. Model danych
### 5.1 Włóczka
Reprezentuje pojedynczy motek lub pozycję magazynową.

Pola:
- `id`
- `name`
- `color`
- `material`
- `weightClass`
- `length`
- `weight`

### 5.2 Wzór
Reprezentuje jeden udzierg możliwy do wykonania z odpowiednich włóczek.

Pola:
- `id`
- `name`
- `description`
- `yarnsNeeded`
- `metersNeeded`
- `gramsNeeded`
- `materials`
- `weightClasses`
- `colors`

## 6. Zasada dopasowania
Wzór jest uznany za wykonalny, jeśli:
- suma długości wszystkich włóczek jest co najmniej równa wymaganej długości
- suma wag wszystkich włóczek jest co najmniej równa wymaganej wadze
- liczba włóczek zgodnych materiałowo i wagowo jest co najmniej równa liczbie wymaganych motków

System nadaje także prosty wynik procentowy dopasowania, który porządkuje listę wyników.

### 6.1 Cechy oceniane
Do oceny używane są:
- długość całkowita
- waga całkowita
- zgodność materiału
- zgodność klasy grubości
- uproszczona zgodność kolorystyczna

## 7. API
### 7.1 `GET /api/yarns`
Zwraca listę zapisanych włóczek.

### 7.2 `POST /api/yarns`
Dodaje nową włóczkę do bazy.

### 7.3 `DELETE /api/yarns/:id`
Usuwa wskazaną włóczkę.

### 7.4 `GET /api/patterns`
Zwraca listę wzorów.

### 7.5 `GET /api/matches`
Zwraca uporządkowaną listę wzorów możliwych do wykonania z aktualnego stanu magazynu.

## 8. Architektura
### 8.1 Frontend
Frontend to statyczna aplikacja HTML/CSS/JavaScript.

Odpowiada za:
- prezentację danych
- formularz włóczek
- wywołania API
- renderowanie wyników dopasowania

### 8.2 Backend
Backend to prosty serwer HTTP w Node.js.

Odpowiada za:
- serwowanie plików statycznych
- obsługę REST API
- odczyt i zapis bazy SQLite
- seedowanie danych startowych

### 8.3 Baza danych
Wersja 1.0.0 używa SQLite utrzymywanego w pliku `data/motek.sqlite`.

## 9. Dane startowe
Po pierwszym uruchomieniu system tworzy bazę i wypełnia ją przykładowymi danymi:
- kilka włóczek
- kilka podstawowych wzorów

## 10. Uruchomienie
Projekt uruchamia się poleceniem:

```bash
npm start
```

Domyślny adres:

```text
http://localhost:3000
```

## 11. Ograniczenia znane w wersji 1.0.0
- baza wzorów jest niewielka i przykładowa
- logika dopasowania jest heurystyczna, nie dekonstrukcyjna
- kolor jest oceniany uproszczone
- brak panelu administracyjnego
- brak walidacji biznesowej dla bardziej złożonych przypadków dziewiarskich

## 12. Kryterium zgodności wersji
Wersję 1.0.0 uznaje się za zgodną, jeśli:
- aplikacja startuje lokalnie
- działa zapis i odczyt włóczek z SQLite
- działa pobranie wzorów i wyników dopasowania
- dane przetrwają ponowne uruchomienie serwera

---

# Plan rozwoju Motek v2.0.0

## 13. Cel wersji 2.0.0
Wersja 2.0.0 przenosi trwałe dane Motka z lokalnego pliku SQLite do
zewnętrznej bazy Supabase. Dzięki temu dane nie będą zależne od jednego
komputera i aplikacja będzie przygotowana do dalszego rozwoju w chmurze.

## 14. Etapy migracji

### 14.1 Etap pierwszy — tabela wzorów
- backend łączy się z Supabase przez bezpieczną konfigurację środowiskową
- tabela `patterns` w Supabase staje się docelowym źródłem danych o wzorach
- rekordy wzorów powstają na podstawie plików roboczych z lokalnego folderu `Wzory`
- pliki źródłowe PDF nie trafiają do Git ani do publicznej części aplikacji
- magazyn włóczek pozostaje tymczasowo w SQLite

### 14.2 Etap drugi — tabela włóczek
- tabela `yarns` zostaje przeniesiona do Supabase
- po sprawdzeniu kompletności danych SQLite przestaje być magazynem aplikacji
- mechanizm dopasowania korzysta z obu tabel w Supabase

## 15. Bezpieczeństwo integracji
- połączenie z Supabase obsługuje wyłącznie backend
- adres projektu jest przechowywany w `SUPABASE_URL`
- klucz typu `secret` jest przechowywany w `SUPABASE_SECRET_KEY`
- klucz `secret` nie może znaleźć się w kodzie frontendu, repozytorium Git ani logach
- aplikacja weryfikuje konfigurację i połączenie podczas uruchamiania

## 16. Stan przejściowy
Tabela `patterns` jest podłączona do backendu i służy jako źródło katalogu
wzorów widocznego na froncie. Katalog pozwala wyszukiwać rekordy i filtrować je
według statusu weryfikacji.

Dotychczasowy mechanizm dopasowania pozostaje tymczasowo w SQLite. Nowe rekordy
wzorów nie zawierają jeszcze całkowitego zużycia włóczki
dla konkretnego rozmiaru, dlatego nie są jeszcze używane przez ranking
dopasowania. Pozwala to niezależnie przetestować katalog przed drugim etapem
migracji.

## 17. Zrealizowany etap pierwszy — katalog wzorów w Supabase

### 17.1 Źródło danych

Katalog został przygotowany na podstawie 116 lokalnych dokumentów PDF z folderu
`Wzory`. Folder jest roboczy, nie trafia do Git i nie jest udostępniany przez
aplikację.

Każdy plik PDF odpowiada jednemu rekordowi w tabeli `patterns`. Zasada ta
obowiązuje również dla identycznych kopii plików, ponieważ każdy dokument jest
traktowany jako osobna pozycja źródłowa.

### 17.2 Model rekordu `patterns`

Rekord katalogu zawiera:

- `id` — identyfikator nadawany przez bazę
- `name` — nazwa wzoru lub instrukcji
- `description` — krótki opis w języku polskim
- `materials` — lista rozpoznanych materiałów
- `meters_per_100g` — parametr głównej włóczki, jeśli można go jednoznacznie ustalić
- `yarn_requirements` — lista wszystkich wymaganych lub alternatywnych włóczek
- `matching_requirements` — kompletne wymagania wariantów lub rozmiarów używane przez ranking
- `source_filename` — unikalna nazwa źródłowego pliku PDF
- `source_language` — język dokumentu źródłowego
- `needs_review` — informacja, czy dane wymagają dodatkowej weryfikacji
- `created_at` — data utworzenia rekordu

Pole `yarn_requirements` może przechowywać oddzielne parametry włóczki głównej,
dodatkowej, kontrastowej albo alternatywnych wariantów. Dzięki temu wzory
wykorzystujące kilka nitek nie są upraszczane do jednego parametru.

### 17.3 Zasada jakości danych

System nie uzupełnia brakujących informacji na podstawie przypuszczeń. Jeżeli
dokument nie podaje składu lub nie pozwala obliczyć metrów na 100 gramów,
wartość pozostaje pusta, a rekord otrzymuje `needs_review=true`.

Aktualny zestaw zawiera:

- 116 rekordów
- 77 rekordów z rozpoznanym materiałem
- 46 rekordów z pojedynczym parametrem głównej włóczki
- 110 rekordów oznaczonych do przeglądu
- 18 rekordów z ręcznie sprawdzonymi poprawkami po analizie wizualnej

Flaga `needs_review` nie oznacza, że cały rekord jest błędny. Informuje, że co
najmniej jeden element powinien zostać potwierdzony przed wykorzystaniem go w
automatycznym dopasowaniu.

### 17.4 Proces przygotowania i importu

Proces jest powtarzalny i składa się z:

1. audytu dokumentów PDF,
2. automatycznego odczytu kandydatów,
3. ręcznych poprawek dla skanów i przypadków niejednoznacznych,
4. walidacji kompletnego zestawu,
5. kontrolnego podglądu zmian w Supabase,
6. importu lub selektywnej aktualizacji rekordów.

Importer wykorzystuje `source_filename` jako stabilny klucz konfliktu. Ponowne
uruchomienie aktualizuje istniejący rekord zamiast tworzyć duplikat tej samej
pozycji źródłowej.

## 18. Katalog wzorów na froncie

Frontend zawiera sekcję „Baza wzorów”, która:

- pobiera dane przez backendowy endpoint `GET /api/patterns`
- nie otrzymuje sekretnego klucza Supabase
- prezentuje nazwę i opis wzoru
- pokazuje materiały i parametr m/100 g
- pokazuje wiele wymaganych włóczek, jeśli występują
- odróżnia rekordy zweryfikowane od wymagających sprawdzenia
- umożliwia wyszukiwanie po nazwie, opisie i materiale
- umożliwia filtrowanie według statusu weryfikacji

Katalog jest funkcją informacyjną. Na obecnym etapie nie zastępuje jeszcze
wyników dopasowania do magazynu użytkownika.

## 19. Aktualna architektura przejściowa

| Obszar | Źródło danych | Stan |
| --- | --- | --- |
| katalog wzorów na froncie | Supabase `patterns` | aktywny |
| magazyn włóczek | Supabase `yarns` z RLS per użytkownik | aktywny |
| ranking dopasowania | Supabase `patterns` + prywatne `yarns`, tylko dla kompletnych wymagań | aktywny przejściowo |
| dokumenty PDF | lokalny ignorowany folder `Wzory` | tylko źródło importu |
| konta użytkowników | Supabase Auth i `profiles` | aktywny |
| sesje użytkowników | Supabase Auth i ciasteczka HttpOnly | aktywny |

Backend weryfikuje połączenie z Supabase przy starcie. Kompletna konfiguracja
Supabase jest wymagana — aplikacja nie uruchamia już lokalnego trybu SQLite.

## 20. Bezpieczeństwo wdrożonego etapu

- sekret Supabase jest przechowywany wyłącznie w lokalnym pliku `.env`
- `.env` i folder `Wzory` są ignorowane przez Git
- frontend komunikuje się wyłącznie z backendem Motka
- klucz publishable służy wyłącznie do operacji Auth wykonywanych przez backend
- backend wybiera jawnie pola zwracane przez API
- błędy połączenia nie ujawniają wartości sekretnego klucza
- tokeny sesji nie są dostępne dla JavaScriptu i pozostają w ciasteczkach HttpOnly
- ciasteczka sesji używają `SameSite=Lax`, a w środowisku produkcyjnym także `Secure`
- tabela ma włączone RLS, a operacje importu używają roli serwerowej
- przed importem można sprawdzić liczbę nowych i aktualizowanych rekordów

## 21. Kryteria odbioru etapu pierwszego

Etap pierwszy uznaje się za ukończony, jeżeli:

- aplikacja uruchamia się z prawidłową konfiguracją Supabase
- tabela `patterns` zawiera 116 rekordów
- `GET /api/patterns` pobiera katalog z Supabase
- frontend pokazuje 116 wzorów
- wyszukiwanie i filtrowanie działają bez przeładowania strony
- rekordy niepełne są widocznie oznaczone
- klucz secret nie znajduje się w kodzie, odpowiedzi API ani repozytorium
- testy backendu, API i zabezpieczeń przechodzą poprawnie
- dotychczasowa obsługa włóczek w SQLite nadal działa

## 22. Zrealizowany etap — konta użytkowników i sesje

### 22.1 Przepływ użytkownika

Frontend udostępnia formularze rejestracji, logowania i wylogowania. Backend
korzysta z Supabase Auth i nie zapisuje haseł w bazie Motka ani w logach.

Po rejestracji:

1. Supabase Auth tworzy użytkownika w `auth.users`,
2. trigger tworzy powiązany rekord w `public.profiles`,
3. po udanym uwierzytelnieniu backend zapisuje tokeny w ciasteczkach HttpOnly,
4. endpoint `GET /api/auth/session` zwraca bezpieczne dane użytkownika i jego profil.

### 22.2 Konfiguracja e-mail

Provider e-mail musi być włączony w ustawieniach Supabase Auth. W środowisku
testowym można wyłączyć obowiązek potwierdzania adresu, aby użytkownik otrzymał
sesję bezpośrednio po rejestracji. W środowisku produkcyjnym rekomendowane jest
ponowne włączenie potwierdzania adresu oraz skonfigurowanie własnego SMTP.

Wyłączenie całego providera e-mail blokuje zarówno rejestrację, jak i logowanie.
Wbudowana usługa wysyłki Supabase ma limity, dlatego testy wymagające wielu
wiadomości powinny korzystać z własnego SMTP albo trybu bez potwierdzania.

### 22.3 Bezpieczna diagnostyka

Stan sesji można sprawdzić przez:

- komunikat zalogowanego użytkownika na froncie,
- odpowiedź `GET /api/auth/session` z `authenticated=true`,
- pole ostatniego logowania i logi Auth w panelu Supabase.

Do zgłoszeń błędów nie należy dołączać pełnego pliku HAR, nagłówka `Cookie`,
tokenów dostępu ani tokenów odświeżających. Ujawnioną sesję należy unieważnić,
a następnie zalogować się ponownie.

### 22.4 Kryteria odbioru

Etap Supabase Auth jest ukończony, ponieważ:

- rejestracja tworzy użytkownika oraz odpowiadający profil,
- logowanie tworzy aktywną sesję,
- odczyt sesji zwraca własny profil zgodnie z RLS,
- wylogowanie usuwa lokalne ciasteczka sesji,
- interfejs pokazuje stan zalogowania bez błędów w konsoli,
- testy automatyczne przechodzą poprawnie.

## 23. Zakończenie migracji — tabela włóczek i ranking

Etap migracji wersji 2.0.0 obejmował:

1. zaprojektowanie tabeli `yarns` w Supabase,
2. migrację endpointów dodawania, odczytu i usuwania włóczek,
3. przygotowanie danych do rozróżniania użytkowników po wdrożeniu logowania,
4. rozszerzenie modelu wzorów o całkowite zużycie włóczki dla rozmiarów,
5. dostosowanie algorytmu dopasowania do danych Supabase,
6. usunięcie SQLite i zależności `sql.js` po zakończeniu migracji.

### 23.1 Zrealizowany podetap — schemat tabeli włóczek

Utworzono tabelę `public.yarns` w Supabase. Rekord zawiera:

- `id` — identyfikator generowany przez bazę,
- `user_id` — właściciela powiązanego z `auth.users`,
- `name`, `color`, `material`, `weight_class`,
- `length_meters` i `weight_grams`,
- `created_at` i `updated_at`.

Tabela ma włączone RLS oraz osobne polityki odczytu, dodawania, edycji i
usuwania. Każda polityka ogranicza dostęp do rekordów, dla których `user_id`
jest równe `auth.uid()`. Dostęp anonimowy jest wyłączony, a dostęp
administracyjny pozostaje po stronie `service_role`.

Tabela jest obecnie pusta produkcyjnie. Syntetyczne dane są używane wyłącznie
w testach, a endpointy magazynu działają już przez Supabase.

### 23.2 Zrealizowany podetap — endpointy magazynu w Supabase

Endpointy `GET /api/yarns`, `POST /api/yarns` i `DELETE /api/yarns/:id` używają
Supabase. Backend przekazuje
token sesji przez klienta Auth, a `user_id` nowego rekordu wyznacza na podstawie
zweryfikowanego użytkownika, nigdy na podstawie danych z formularza.

Brak konfiguracji Supabase zatrzymuje backend czytelnym błędem. Testy
syntetyczne sprawdzają, że niezalogowany użytkownik otrzymuje odmowę, a dwaj
użytkownicy nie widzą i nie usuwają wzajemnie swoich włóczek.

### 23.3 Zrealizowany podetap — bezpieczna ścieżka rankingu w Supabase

Tabela `patterns` zawiera teraz pole `matching_requirements` w formacie:

```json
{
  "variants": [
    {
      "id": "m",
      "label": "M",
      "yarns_needed": 1,
      "meters_needed": 1200,
      "grams_needed": 300,
      "materials": ["wełna"],
      "weight_classes": ["dk"],
      "colors": "dowolny",
      "yarn_requirements": [
        {
          "role": "główna",
          "yarns_needed": 1,
          "meters_needed": 1200,
          "grams_needed": 300,
          "materials": ["wełna"],
          "weight_classes": ["dk"]
        }
      ]
    }
  ]
}
```

`GET /api/matches` wymaga zalogowania, pobiera prywatny magazyn użytkownika
oraz wzory z Supabase i ocenia wyłącznie zweryfikowane warianty z kompletnymi
danymi. Wariant może dodatkowo przechowywać osobne wymagania dla włóczki
głównej, dodatkowej lub kontrastowej. Ranking przydziela motki do tych ról
bez ponownego użycia tego samego motka. Obecne 116 rekordów ma pustą listę
wariantów, dlatego nie są jeszcze prezentowane jako potwierdzone dopasowania.
System nie wylicza brakujących metrów ani gramów na podstawie przypuszczeń.
