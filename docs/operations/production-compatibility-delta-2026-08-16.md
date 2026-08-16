# Production compatibility delta — 2026-08-16

## Cel

Przygotować bezpieczny zakres wyrównania Production do efektu Stagingu bez
mechanicznego odtwarzania numerów migracji i bez usuwania danych.

To jest dokument projektowy. Nie jest instrukcją wykonawczą i nie daje zgody
na `db push`, `migration repair`, ręczne SQL ani deploy.

## Świeży odczyt zdalny

Read-only snapshot z 2026-08-16 potwierdził 24 wpisy migracji w Production i
28 w Stagingu. Nie są to mapowania 1:1 plików lokalnych; o promocji decyduje
efekt SQL, nie zgodność numerów.

## Zakres promowany

### 1. Katalog publikowany

Production nie ma obecnie efektu publikacji/audytu katalogu. Kandydat powinien
promować:

- `publication_status` z bezpieczną wartością początkową `pending_review`;
- `content_audit_version`;
- `content_audited_at`;
- `official_source_url`;
- constraint publikacji wymagający dowodu audytu dla statusu `published`.

Istniejące rekordy muszą pozostać nieopublikowane do czasu potwierdzenia ich
audytu. Nie zmieniamy `description NOT NULL` w Production.

Staging ma dodatkowo `description NULL`, `publication_status`,
`content_audit_version`, `content_audited_at` i `official_source_url`.
Production zachowuje `description NOT NULL`; tę różnicę trzeba uwzględnić w
precondition migracji.

Aktualny odczyt danych potwierdził `0/15` rekordów z pustym opisem w Production
oraz `103/111` rekordów z pustym opisem w Stagingu. Z tego powodu pakiet
promocyjny katalogu jest produkcyjny i celowo zatrzymuje się przed zmianą, gdy
wykryje `NULL` w `description`; nie może być automatycznie wykonywany na
Stagingu.

Przygotowany pakiet wykonawczy znajduje się w
`supabase/production-deltas/20260816_add_pattern_publication_audit_compatible.sql`.
Jest celowo poza `supabase/migrations`: nie może zostać przypadkowo uruchomiony
przez zwykły replay stagingu. Ma precondition istnienia tabeli, blokadę na
`NULL`, idempotentne dodawanie kolumn i constraintów oraz transakcję.

Weryfikacja lokalna pakietu:

- produkcyjny kształt: pola dodane, 15 rekordów otrzymało `pending_review`,
  `description` pozostał `NOT NULL`;
- stagingowy kształt: pakiet zatrzymał się przed zmianą i nie zostawił kolumn;
- kontrakt migracji: `PASS`;
- pełny zestaw aplikacji: `394/394`, lint, check i `git diff --check`: `PASS`.

### 2. Recovery

Oba zdalne projekty mają już zgodny aktywny efekt recovery: `jti_hash` jako
klucz, `claimed_at` i funkcje claim/release/consume. Nie dodajemy `grant_id`
i nie wykonujemy migracji z lokalnego wariantu, który tworzy inną strukturę.

Świeży odczyt funkcji wykazał w obu projektach zgodne stare overloady:

- `create_auth_recovery_grant(uuid, text, timestamptz)`;
- `consume_auth_recovery_grant(uuid, text)`.

Nie wykazano świeżym zapytaniem dodatkowych overloadów claim/release. Każdy
cleanup wymaga osobnego audytu konsumentów i nie jest częścią wyrównania
katalogu.

### 3. Versioned yarn store

Production ma `private.yarn_store_versions.updated_at NOT NULL DEFAULT now()`;
Staging tej kolumny nie ma. Zachowujemy produkcyjne `updated_at`. Nie
wykonujemy destrukcyjnego usuwania kolumny tylko dla zgodności ze stagingiem.
RPC versioned store są w obu projektach `SECURITY DEFINER`, z pustym
`search_path` i grantem dla `authenticated`/`service_role`.

Production nadal ma dwa overloady `insert_yarn_with_limit`, których Staging
nie ma. Przed ewentualnym cleanupem trzeba potwierdzić brak konsumentów;
automatyczne usuwanie nie jest bezpiecznym sposobem zamykania ledgera.

Read-only audyt repozytorium Motka nie znalazł wywołań `insert_yarn_with_limit`.
Backend używa wyłącznie aktywnych, jednoargumentowych RPC recovery:
`create_auth_recovery_grant()`, `claim_auth_recovery_grant(text)`,
`release_auth_recovery_grant(text)` i `consume_auth_recovery_grant(text)`.
Status audytu: **brak konsumenta w aplikacji potwierdzony; konsumenci zewnętrzni
nieznani**. Legacy RPC pozostają bez zmian do osobnej decyzji operacyjnej.

### 4. Legal i rejestracja

Promocja musi obejmować brakujące efekty legal/publication z kandydata, ale
każdy efekt trzeba przypisać do istniejącego wpisu Production albo do nowej,
kompatybilnej migracji. Nie wolno ponownie stosować całego łańcucha lokalnych
migracji na produkcji.

## Bramy przed napisaniem migracji wykonawczej

- [ ] każdy obiekt SQL ma przypisany efekt, precondition i sposób rollbacku;
- [x] pakiet katalogu ma osobny precondition i nie usuwa `description NOT NULL`;
- [ ] istniejące dane katalogu przechodzą preflight bez publikowania rekordów;
- [ ] aktywny recovery nie wymaga zmiany tabeli ani klucza;
- [ ] legacy overloady mają potwierdzony brak konsumentów albo osobny plan;
- [ ] backup produkcji jest świeży i odtwarzalny;
- [ ] migracja przechodzi na izolowanym celu z kopią produkcyjnych danych;
- [ ] osobna zgoda obejmuje dopiero wykonanie migracji i deploy.

## Kryterium gotowości

Dopiero po zamknięciu wszystkich bram można wygenerować jeden, idempotentny
pakiet migracyjny dla Production i poddać go testowi `pgTAP` oraz kontroli
rollbacku. Do tego czasu produkcja pozostaje `NO-GO`.
