# Production compatibility delta — 2026-08-16

## Cel

Przygotować bezpieczny zakres wyrównania Production do efektu Stagingu bez
mechanicznego odtwarzania numerów migracji i bez usuwania danych.

To jest dokument projektowy. Nie jest instrukcją wykonawczą i nie daje zgody
na `db push`, `migration repair`, ręczne SQL ani deploy.

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

### 2. Recovery

Oba zdalne projekty mają już zgodny aktywny efekt recovery: `jti_hash` jako
klucz, `claimed_at` i funkcje claim/release/consume. Nie dodajemy `grant_id`
i nie wykonujemy migracji z lokalnego wariantu, który tworzy inną strukturę.

Pozostają do osobnego audytu i ewentualnego cleanupu legacy overloady:

- `create_auth_recovery_grant(uuid, text, timestamptz)`;
- `claim_auth_recovery_grant(uuid, text)`;
- `release_auth_recovery_grant(uuid, text)`;
- `consume_auth_recovery_grant(uuid, text)`.

Cleanup wymaga potwierdzenia, że żaden zewnętrzny konsument ich nie używa.

### 3. Versioned yarn store

Zachowujemy produkcyjne `updated_at`. Nie wykonujemy destrukcyjnego usuwania
kolumny tylko dla zgodności ze stagingiem. Przed promocją należy potwierdzić
definicje RPC, RLS i ACL; ich zachowanie jest obecnie potwierdzone, ale historia
migracji jest różna.

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
