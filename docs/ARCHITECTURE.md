# Architektura Motka

## Mapa modułów

```text
index.html + styles.css
        └── app.js
             ├── client/api-client.js
             ├── client/dom-utils.js
             └── client/*-controller.js

server.js
  ├── server/static-files.js
  ├── server/yarn-routes.js
  ├── server/pattern-routes.js
  ├── server/matching-service.js
  ├── *-policy.js / *-service.js
  └── Supabase Data API / Auth / RPC

supabase/
  ├── migrations/
  └── tests/database/
```

`index.html` definiuje cztery widoki i stabilne uchwyty DOM. `styles.css` odpowiada za dwa motywy i układ responsywny. `app.js` składa kontrolery, a moduły `client/` izolują komunikację HTTP, komunikaty DOM, katalog i bramkę prawną.

Backend nie używa frameworka HTTP. `server.js` składa konfigurację, origin, sesję, limity, nagłówki bezpieczeństwa i główne trasy. Routery obsługują włóczki oraz katalog, a serwis dopasowania korzysta ze wspólnej polityki walidacji wymagań.

## Granice zaufania

- Przeglądarka zna publiczny origin i opcjonalny klucz witryny Turnstile, ale nie zna sekretnego klucza Supabase.
- Backend waliduje dane, sesję, bieżącą akceptację prawa, limity i uprawnienia przed wywołaniem Supabase.
- Supabase egzekwuje własność profilu i włóczek przez RLS. Bezpośrednie zapisy tabel przez rolę użytkownika są ograniczone na rzecz wersjonowanych RPC.
- Migracje są źródłem prawdy schematu, ACL, RLS i RPC. Testy pgTAP sprawdzają wykonany kontrakt bazy.

## Przepływ sesji

1. Frontend wysyła żądanie do API Motka z cookies `HttpOnly`.
2. Backend sprawdza origin dla zapisów, podpis aktywności, limit bezczynności i tokeny Supabase.
3. Backend pobiera profil oraz stan akceptacji regulaminu.
4. Token użytkownika trafia do Supabase dla operacji chronionych RLS.
5. Wylogowanie, wygaśnięcie albo niepewny wynik zmiany hasła czyszczą cookies. Odpowiedź `401` przywraca UI do stanu logowania.

## Rejestracja i legal gate

Rejestracja korzysta z Supabase Auth, CAPTCHA i bieżących wersji dokumentów prawnych. Supabase wysyła automatyczny e-mail potwierdzający adres, a backend tworzy profil dopiero dla prawidłowego, potwierdzonego przepływu. Operator nadal może tworzyć jednorazowe zaproszenia przez RPC dostępne tylko dla `service_role` w scenariuszach administracyjnych. Nieaktualny regulamin ogranicza sesję do informacji prawnych, ponownej akceptacji, wylogowania i usunięcia konta.

## Zapis włóczek i współbieżność

Magazyn używa wersji kolekcji oraz `ETag: "yarn-vN"`. Mutacje wysyłają `If-Match`. Wersjonowane RPC blokują wiersz wersji i zwracają `409`, gdy klient zapisuje na nieaktualnym stanie. Zapis nie jest automatycznie ponawiany, bo wynik operacji mógłby być niepewny.

Właściciel rekordu wynika z sesji, nie z danych formularza. Limit 500 włóczek jest egzekwowany wspólnie przez aplikację i bazę.

## Katalog i dopasowania

`GET /api/patterns` zwraca strony katalogu przez `limit` i `offset`; klient doładowuje je kontrolowanie. `GET /api/matches` pobiera prywatne włóczki, odrzuca niekompletne wymagania i uruchamia ograniczone wyszukiwanie przypisań. Gdy nie ma potwierdzonego wyniku, backend może zwrócić diagnostykę najbliższego wariantu. Materiał `mieszanka` jest w diagnostyce traktowany jako potencjalnie zgodny z nieznanym składem, ale nie podnosi takiego wariantu do statusu potwierdzonego dopasowania.

Wspólny katalog ma limit 300 wzorów. API nie zwraca prywatnych pól importu. Dopasowanie nie zgaduje brakujących danych i nie przypisuje jednego motka do kilku ról.

## Skalowanie

Przy kontrakcie 500 włóczek na użytkownika i 300 wzorów nie ma podstaw, aby wymagać workera, kolejki zadań ani dalszej paginacji. Bieżąca paginacja katalogu ogranicza rozmiar odpowiedzi, ale nie stanowi sygnału do rozbudowy infrastruktury.

Nowy mechanizm skalowania można dodać dopiero po benchmarku pokazującym realne opóźnienie lub po zmianie limitów produktu. Najpierw należy zmierzyć czas API, liczbę odwiedzonych węzłów rankingu i pamięć procesu; dopiero potem wybierać optymalizację, rozszerzoną paginację albo worker.

## Diagnostyka

- `/health/live` — proces działa;
- `/health/ready` — aplikacja i Supabase są gotowe;
- `/health/release` — wersja, SHA i środowisko;
- `/internal/metrics` — metryki tylko po włączeniu i w zaufanej sieci.
