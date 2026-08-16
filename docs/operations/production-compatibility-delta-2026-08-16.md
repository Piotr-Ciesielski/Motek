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

### 4. Legal i rejestracja

Promocja musi obejmować brakujące efekty legal/publication z kandydata, ale
każdy efekt trzeba przypisać do istniejącego wpisu Production albo do nowej,
kompatybilnej migracji. Nie wolno ponownie stosować całego łańcucha lokalnych
migracji na produkcji.

## Bramy przed napisaniem migracji wykonawczej

- [ ] każdy obiekt SQL ma przypisany efekt, precondition i sposób rollbacku;
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
