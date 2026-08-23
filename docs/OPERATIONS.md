# Operacje i wdrożenia

## Macierz środowisk i domen

Stan potwierdzony 2026-08-23:

| Środowisko | Domena i rola | Gałąź | Supabase | Stan release |
| --- | --- | --- | --- | --- |
| Lokalne źródło | `http://127.0.0.1:3001` | bieżący checkout | cel z lokalnej konfiguracji | `2.0.0-alpha.38` |
| Staging | `https://staging.rysia.org` — jedyny bieżący endpoint stagingu; staging nie jest produkcją i nie jest dostępny dla użytkowników | `staging` | osobny projekt staging | ready, `2.0.0-alpha.39`, SHA `03b62e72308770f6d9cc591c4ef1f69016bc437e`, environment `staging` |
| Produkcja | `https://www.rysia.org` | `main` | osobny projekt produkcyjny | ready, `2.0.0-alpha.39`, SHA `cc06179bd9481a83c016a4447930ddc3e9f09cb2`, environment `production` |

Na stagingu i produkcji `/informacje-prawne` zwraca `200`, a anonimowe `/api/patterns` zwraca `401`. Staging służy wyłącznie do weryfikacji przed promocją i nie jest dostępny dla użytkowników.

Lokalne źródło, staging i produkcja mogą mieć różne wersje oraz SHA. Każdą decyzję operacyjną wiąże się z pełnym SHA, nie tylko numerem wersji.

## Przepływ wydania

```text
PR → CI → staging → regression:full → decyzja promocji → main
   → ręczny deploy produkcji → regression:smoke → obserwacja
```

- CI działa dla PR do `main` oraz pushy do `main` i `staging`.
- Railway staging śledzi `staging` i wdraża automatycznie.
- Railway production śledzi `main`, ale auto-deploy jest wyłączony; publikację uruchamia operator.
- Workflow po wdrożeniu pobiera dokładne SHA ze zdarzenia deploymentu. Staging uruchamia pełną regresję z kontem QA, produkcja tylko niedestrukcyjny smoke test.
- `railway.json` buduje `deploy/railway/Dockerfile`, startuje `node server.js`, sprawdza `/health/ready` przez maksymalnie 300 sekund i restartuje proces po błędzie.

Zielony staging, gotowy endpoint, zweryfikowany manifest prawny lub istniejący deployment nie są zgodą na zewnętrzny zapis.

## Preflight i kryteria STOP

Przed migracją, importem z zapisem lub deployem należy potwierdzić:

1. właściwe środowisko, branch, pełne SHA i wersję;
2. zielone CI, lint, format, pokrycie, testy aplikacji i pgTAP;
3. `LEGAL_PUBLICATION=ready` oraz odpowiedź `200` strony prawa;
4. zgodność lokalnych migracji z ledgerem docelowego Supabase, w tym nazwy, kolejność, definicje RPC, ACL i RLS;
5. pełny, świeży backup bazy, Auth i Storage oraz udany restore do izolowanego celu;
6. osobne sekrety, Supabase i polityki domen dla stagingu i produkcji;
7. gotową procedurę rollbacku kompatybilną z planowaną deltą bazy;
8. osobną, jawną zgodę operatora na każdy zapis zewnętrzny.

Natychmiastowy `STOP` obowiązuje przy:

- innym SHA, branchu albo środowisku niż zatwierdzone;
- nieuzgodnionym ledgerze migracji lub nieznanym efekcie SQL;
- nieświeżym, niepełnym albo nieodtwarzalnym backupie;
- braku osobnej zgody na migrację, import, zmianę infrastruktury lub deploy;
- readiness innym niż `200`, błędzie regresji, odpowiedziach `5xx` albo anonimowym dostępie do prywatnego API;
- błędzie RLS/ACL/RPC, wspólnym Supabase dla stagingu i produkcji albo sekrecie w logach;
- braku kompatybilnego rollbacku aplikacji;
- niepewnym sprzątaniu danych testowych.

## Backup i izolowany restore

Backup przed zmianą produkcji obejmuje osobno:

- schemat i dane `public` oraz `private`;
- Auth, w tym użytkowników, identities i sesje;
- schemat, metadane i obiekty Storage;
- wersje migracji, rozszerzenia, funkcje, RLS, ACL i konfigurację potrzebną do odtworzenia.

Eksport należy zaszyfrować, zapisać poza repozytorium i opisać hashami. Restore wykonuje się wyłącznie do świeżego, izolowanego celu bez połączenia zapisu z produkcją. Po odtworzeniu porównuje się liczności, hashe, funkcje, polityki i podstawowe przepływy Auth. Pusty Storage również trzeba jawnie potwierdzić; nie wolno zakładać, że brak eksportu oznacza brak danych.

Schema-only nie jest pełnym backupem. Udana próba z poprzedniego okna nie zastępuje świeżego backupu bezpośrednio przed nową migracją.

## Zasady migracji Supabase

- Źródłem prawdy są pliki `supabase/migrations/`; aplikacja nie stosuje migracji przy starcie.
- Najpierw wykonuje się lokalny replay na pustej bazie i testy pgTAP.
- Następnie mapuje się każdą lokalną zmianę do wpisów zdalnego ledgera i porównuje efekt schematu. Zgodna nazwa funkcji nie dowodzi zgodnej definicji.
- Migracje produkcyjne są forward-only. Nie przygotowuje się automatycznego `down SQL` dla zmian usuwających lub przekształcających dane bez osobnego planu odzyskania.
- Nie wolno używać `db push`, naprawiać ledgera, przyznawać grantów ani wykonywać SQL na zdalnym projekcie bez zatwierdzonego pakietu i osobnej zgody.
- Migracja bazy i deploy aplikacji są dwoma odrębnymi zapisami zewnętrznymi; zgoda na jeden nie obejmuje drugiego.

## Zaproszenia operatora

```powershell
npm run invite -- create --email osoba@example.com --expires-at 2030-01-01T00:00:00Z
npm run invite -- revoke --id <id-zaproszenia>
npm run invite -- purge
```

`create` zapisuje w bazie wyłącznie hash tokenu i wypisuje pełny, jednorazowy link tylko raz. Link nie jest wysyłany automatycznie e-mailem i nie można go później odzyskać. Narzędzie korzysta z `SUPABASE_URL`, `SUPABASE_SECRET_KEY` i `APP_ORIGIN` bieżącej konfiguracji, dlatego uruchomienie go wobec środowiska zdalnego wymaga świadomej decyzji operatora oraz sprawdzenia celu przed wykonaniem.

`revoke` odwołuje wskazane zaproszenie, a `purge` usuwa stare logi bezpieczeństwa zgodnie z polityką backendu. Każda z tych komend może zapisywać w Supabase wskazanym przez lokalną konfigurację.

## Deploy i kontrola po wdrożeniu

Przed publikacją:

```powershell
npm run railway:check
npm run check
npm run legal:check
```

Po stagingu:

```powershell
npm run regression:full
```

Pełna regresja sprawdza release, stronę prawa, sesję, katalog i kontrolowany cykl pojedynczej włóczki na koncie QA. Sprzątanie usuwa wyłącznie rekord utworzony przez dany przebieg. Nie wolno usuwać danych po prefiksie ani czyścić całego magazynu.

Po ręcznym deployu produkcji:

```powershell
npm run regression:smoke
```

Smoke sprawdza release, readiness, publiczną stronę prawa i brak anonimowego dostępu do chronionego API. Nie uruchamiać `regression:full` na produkcji.

Po testach należy obserwować błędy `5xx`, timeouty, logowania, blokady rate limitu i metryki przez zatwierdzone okno. Brak workflow post-deploy nie oznacza sukcesu.

## Rollback

Przy regresji aplikacji wybiera się poprzedni udany deployment tego samego środowiska i ponownie sprawdza pełne SHA, `/health/ready`, `/health/release` oraz właściwą regresję.

Rollback Railway nie cofa migracji Supabase. Jeśli starsza aplikacja nie jest zgodna z nowym schematem, należy zatrzymać ruch lub publikację i użyć wcześniej zatwierdzonej procedury naprawczej. Restore do produkcji jest osobną operacją wysokiego ryzyka i wymaga nowej decyzji, nawet gdy backup został już zweryfikowany.

## Zgody na operacje zewnętrzne

Osobnej, świadomej zgody wymagają co najmniej:

- migracja, SQL, `db push` lub naprawa ledgera Supabase;
- import wzorów z `--execute`;
- utworzenie lub usunięcie danych na zdalnym środowisku;
- zmiana Railway, Cloudflare, GitHub Environments, DNS, sekretów lub domen;
- deploy albo rollback stagingu i produkcji;
- odczyt lub eksport prywatnych danych produkcyjnych oraz restore.

Zgoda na dokumentację, testy, commit lub push kodu nie obejmuje żadnej z tych operacji.
