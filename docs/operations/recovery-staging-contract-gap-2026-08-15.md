# Recovery stagingu — luka kontraktu RPC — 2026-08-15

## Odczyt zdalny

Read-only odczyt katalogu funkcji Supabase wykazał różnicę między kontraktem
oczekiwanym przez aplikację a faktycznym stagingiem.

Backend rozpoczyna recovery wywołaniem:

```js
authenticatedClient.rpc("create_auth_recovery_grant", {})
```

Staging `rprhbmtabwjsenvfgicg` nie ma funkcji
`public.create_auth_recovery_grant()` bez argumentów. Ma:

- `create_auth_recovery_grant(uuid, text, timestamptz)` — overload
  administracyjny, tylko dla `service_role`,
- `claim_auth_recovery_grant(text)` — `authenticated`,
- `release_auth_recovery_grant(text)` — `authenticated`,
- `consume_auth_recovery_grant(text)` — `authenticated`,
- historyczny `consume_auth_recovery_grant(uuid, text)` — bez wykonania dla
  `authenticated`.

Production ma dodatkowo `create_auth_recovery_grant()` bez argumentów oraz
ten sam lifecycle `claim/release/consume(text)`, ale nadal ma legacy overloady
magazynu włóczek.

Listy migracji potwierdzają, że staging zakończył się na:

`20260813103831 harden_recovery_grant_release`

natomiast produkcja ma dodatkowo:

`20260815115028 production_legal_versioned_recovery_delta`.

## Skutek praktyczny

Stagingowy przepływ zmiany hasła z linku recovery nie może rozpocząć się
poprawnie, ponieważ pierwsze wywołanie RPC nie ma odpowiadającej funkcji.
Późniejsze funkcje claim/release/consume nie naprawiają braku funkcji
tworzącej grant.

To nie jest zgoda na ręczne dodanie funkcji ani na uruchomienie migracji.
Macierz migracji pozostaje `UNRESOLVED`, ponieważ trzeba najpierw ustalić,
czy brak overloadu jest przypadkową deltą stagingu, czy efektem historycznego
scalenia migracji.

## Wykonana naprawa stagingu

Po osobnej zgodzie operatora zastosowano na stagingu migrację
`20260815152553 restore_recovery_grant_creator`. Odczyt kontrolny potwierdził:

- funkcję `public.create_auth_recovery_grant()`;
- `SECURITY DEFINER` i `search_path = ''`;
- brak wykonania dla `public` i `anon` oraz wykonanie dla `authenticated`;
- `private.auth_recovery_grants` nadal ma 0 rekordów.

Nie wykonywano jeszcze pełnego przepływu recovery z kontem QA.

## Następny bezpieczny krok

1. Porównać definicję lokalną funkcji z oczekiwanym kontraktem i ustalić
   właściwą migrację forward-only.
2. Dodać test read-only/replay, który wykryje brak funkcji bez wykonywania
   zmian na zdalnej bazie.
3. Dopiero po osobnej zgodzie wykonać migrację stagingu i przeprowadzić
   niedestrukcyjny test recovery na koncie QA.

Nie wykonano deployu produkcyjnego ani zmian w produkcyjnej bazie danych.
