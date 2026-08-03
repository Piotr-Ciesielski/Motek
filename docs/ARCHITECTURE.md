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
  ├── server/*-routes.js
  ├── server/matching-service.js
  └── Supabase Data API / Auth
```

`index.html` opisuje strukturę interfejsu, `styles.css` jego wygląd, a `app.js` składa kontrolery i renderuje stan. Kontrolery klienta zarządzają pojedynczymi obszarami UI; API client centralizuje timeout, bezpieczny retry odczytów i reakcję na wygaśnięcie sesji.

Backend nie używa frameworka HTTP. `server.js` jest punktem składania: sprawdza origin, sesję i limity, a routery delegują szczegóły endpointów. `matching-policy.js` waliduje wymagania, `server/matching-service.js` liczy dopasowania, a `server/static-files.js` obsługuje wyłącznie jawnie dozwolone zasoby.

## Przepływ sesji

1. Frontend wysyła żądanie do API Motka; nie zna sekretnego klucza Supabase.
2. Backend odczytuje ciasteczka `HttpOnly`, odświeża sesję, pobiera profil i sprawdza status konta.
3. Token użytkownika jest przekazywany do Supabase, gdzie RLS egzekwuje własność danych.
4. Wylogowanie i błędna sesja czyszczą ciasteczka. Błąd `401` powoduje powrót UI do formularza logowania.

## Zapis włóczki i współbieżność

Magazyn używa wersji kolekcji oraz nagłówka `ETag: "yarn-vN"`. Zapis wysyła `If-Match`; wersjonowane RPC Supabase blokują wiersz wersji i zwracają `409`, gdy klient ma nieaktualną wersję. Zapis nie jest automatycznie ponawiany, ponieważ odpowiedź może być niepewna.

## Katalog i dopasowania

`/api/patterns` zwraca stronę katalogu (`limit`/`offset`), a klient pobiera kolejne strony dopiero na żądanie. `/api/matches` pobiera prywatne włóczki, waliduje limity złożoności i używa wspólnego serwisu dopasowania. Wzory z niepełnymi wymaganiami pozostają widoczne, ale nie są przedstawiane jako pewne dopasowania.

## Granica Supabase

Supabase przechowuje Auth, profile, prywatne włóczki i wspólny katalog. Migracje w `supabase/migrations/` są źródłem prawdy schematu, RLS, walidatorów i wersjonowanych RPC. Testy pgTAP w `supabase/tests/database/` sprawdzają kontrakty bazy; wymagają Docker/Podman.

## Weryfikacja

```bash
npm run check
npm run lint
npm run format:check
npm run coverage
git diff --check
```

Aplikacja lokalna działa na `http://127.0.0.1:3001`. Przed wdrożeniem należy dodatkowo uruchomić testy pgTAP, sprawdzić konfigurację stagingu i wykonać funkcjonalny smoke test bez usuwania prawdziwego konta.
