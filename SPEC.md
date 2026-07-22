# Motek Specyfikacja v1.0.0

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
