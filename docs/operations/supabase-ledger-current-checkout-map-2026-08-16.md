# Supabase: aktualny ledger zdalny → bieżący checkout — 2026-08-16

## Cel i zakres

Ten dokument dotyczy wyłącznie bieżącego checkoutu Motka:

- branch: `agent/staging-security-merge`;
- HEAD: `fa3c4b0`;
- lokalnie: 26 plików `supabase/migrations/*.sql`;
- Production: 24 zdalne wpisy migracji;
- Staging: 28 zdalnych wpisów migracji.

Nie należy mieszać tej mapy z historycznym drzewem RC opisanym w starszych
dokumentach. Wpis zdalny może obejmować kilka lokalnych plików albo kilka
lokalnych efektów może być scalonych w jeden zdalny wpis.

## Oznaczenia

- `DIRECT_OR_EFFECT_CONFIRMED` — nazwa, fingerprint albo efekt obiektu
  potwierdza mapowanie do bieżącego checkoutu;
- `GROUP_UNRESOLVED` — zdalny wpis obejmuje grupę lokalnych plików lub nie ma
  jeszcze dowodu kolejności i kompletności efektu;
- `HISTORICAL_RC_ONLY` — wskazany odpowiednik występuje wyłącznie w starym
  drzewie RC, którego nie ma w bieżącym checkoutcie;
- `ACCEPTED_COMPATIBILITY` — różnica jest świadomie zachowana ze względu na
  istniejące dane, ale wymaga preflightu;
- `OPEN` — status blokujący promocję produkcji.

## Mapa bieżących plików lokalnych według grup

| Grupa efektu | Bieżące pliki lokalne | Status |
|---|---|---|
| Bazowy katalog wzorów | `20260723000000_create_patterns.sql` | `DIRECT_OR_EFFECT_CONFIRMED` |
| Profile/Auth | `20260724000000_create_profiles_auth.sql`, `20260724000001_harden_profiles_trigger_functions.sql` | `DIRECT_OR_EFFECT_CONFIRMED` |
| Bazowa tabela włóczek | `20260727000000_create_yarns.sql`, `20260727000001_harden_yarns_trigger.sql` | `DIRECT_OR_EFFECT_CONFIRMED` |
| Wymagania dopasowania i limity | `20260727000002_add_pattern_matching_requirements.sql`, `20260728000000_add_atomic_yarn_insert_limit.sql`, `20260728000001_enforce_pattern_catalog_limit.sql`, `20260728000002_validate_pattern_matching_requirements.sql`, `20260728000003_harden_rls_auto_enable_permissions.sql`, `20260728000004_align_pattern_requirement_validation.sql` | `GROUP_UNRESOLVED` |
| Typ projektu i materiały | `20260730000000_add_pattern_project_type.sql`, `20260730211136_expand_yarn_materials.sql` | `GROUP_UNRESOLVED` |
| Walidacja dopasowania v2 | `20260730213157_validate_pattern_matching_v2.sql`, `20260803113832_harden_matching_requirements_validation.sql`, `20260803150000_remove_unsupported_matching_groups.sql` | `GROUP_UNRESOLVED` |
| Logowanie e-mail | `20260731104741_email_login_and_remove_full_name.sql` | `DIRECT_OR_EFFECT_CONFIRMED` |
| Versioned yarn store | `20260803125010_add_atomic_yarn_store_versions.sql`, `20260803200000_fix_yarn_version_conflict_retry.sql`, `20260807150000_reconcile_yarn_acl_and_recovery.sql` | `GROUP_UNRESOLVED` |
| Publikacja wzorów | `20260809165750_add_pattern_publication_audit.sql` | `DIRECT_OR_EFFECT_CONFIRMED` |
| Legal i rejestracja | `20260809185511_add_invited_registration_and_legal_acceptance.sql`, `20260810120111_enforce_current_terms_for_private_data.sql`, `20260810123000_revoke_registration_invitation.sql` | `DIRECT_OR_EFFECT_CONFIRMED` |
| Recovery claim/release | `20260812122131_add_recovery_grant_claim.sql`, `20260815152553_restore_recovery_grant_creator.sql` | `GROUP_UNRESOLVED` |

## Mapowanie zdalnych grup — Staging

| Zdalne wpisy | Bieżący lokalny plik/grupa | Status | Uwagi |
|---|---|---|---|
| `create_patterns`, `create_profiles_auth`, `harden_profiles_trigger_functions`, `create_yarns`, `harden_yarns_trigger` | pliki bazowe z sekcji powyżej | `DIRECT_OR_EFFECT_CONFIRMED` | zgodne efekty i/lub fingerprinty; timestampy są inne |
| `add_pattern_matching_requirements` do `email_login_and_remove_full_name` | grupa walidacji, limitów, materiałów i logowania | `GROUP_UNRESOLVED` | część fingerprintów jest zgodna, ale nie zamyka wszystkich lokalnych dodatkowych efektów |
| `add_versioned_yarn_inventory` | `20260803125010_add_atomic_yarn_store_versions.sql` + `20260803200000_fix_yarn_version_conflict_retry.sql` | `GROUP_UNRESOLVED` | zdalny wpis jest podzielony na kilka kolejnych wpisów |
| `fix_yarn_version_conflict_code`, `restore_atomic_yarn_store_versions_contract`, `fix_yarn_version_conflict_retry` | rodzina versioned yarn store | `GROUP_UNRESOLVED` | fingerprinty i kolejność nie są 1:1 z bieżącym checkoutem |
| `restrict_yarn_mutations` | `20260807150000_reconcile_yarn_acl_and_recovery.sql` | `GROUP_UNRESOLVED` | historyczny kandydat `20260806120000` nie istnieje w bieżącym checkoutcie |
| `add_recovery_grants`, `add_recovery_grant_claim`, `harden_recovery_grant_release`, `restore_recovery_grant_creator` | `20260807150000_reconcile_yarn_acl_and_recovery.sql`, `20260812122131_add_recovery_grant_claim.sql`, `20260815152553_restore_recovery_grant_creator.sql` | `GROUP_UNRESOLVED` | lifecycle jest funkcjonalnie zgodny, ale podział migracji wymaga dowodu efektów |
| `add_pattern_publication_audit`, `add_invited_registration_and_legal_acceptance`, `enforce_current_terms_for_private_data`, `revoke_registration_invitation` | odpowiednie pliki legal/publication | `DIRECT_OR_EFFECT_CONFIRMED` | potwierdzone fingerprintem zdalnym dla Staging |
| `revoke_yarns_sequence_acl` | efekt w `20260807150000_reconcile_yarn_acl_and_recovery.sql` | `GROUP_UNRESOLVED` | historyczny plik RC `20260807090000` nie istnieje lokalnie |

## Mapowanie zdalnych grup — Production

| Zdalne wpisy | Bieżący lokalny plik/grupa | Status | Uwagi |
|---|---|---|---|
| wpisy bazowe katalogu, profili, włóczek i walidacji | odpowiednie pliki bazowe i walidacyjne | `GROUP_UNRESOLVED` | zgodność efektu nie zastępuje mapy treści migracji |
| `add_versioned_yarn_inventory`, `move_yarn_store_versions_private` | rodzina `20260803125010`, `20260803200000`, `20260807150000` | `GROUP_UNRESOLVED` | Production ma inną agregację niż Staging |
| `add_recovery_grants`, `revoke_yarns_sequence_acl`, `harden_profile_avatar_url` | efekty w `20260807150000` oraz `20260815152553` | `GROUP_UNRESOLVED` | brak dowodu 1:1 dla całej zdalnej grupy |
| `restrict_yarn_mutations_acl`, wpisy dokumentacyjne ACL | `20260807150000_reconcile_yarn_acl_and_recovery.sql` | `GROUP_UNRESOLVED` | trzeba porównać wszystkie granty, RLS i sekwencje |
| `production_legal_versioned_recovery_delta` | brak bezpośredniego odpowiednika 1:1; efekty rozłożone na versioned/legal/recovery | `GROUP_UNRESOLVED` | zdalna instrukcja ma 37364 bajty i wymaga mapy efektów |

## Różnice zaakceptowane, ale wymagające preflightu

- `private.yarn_store_versions.updated_at` pozostaje w Production, ponieważ
  istnieją tam dane; nie wolno usuwać kolumny tylko dla wyrównania ze
  Stagingiem.
- Bieżący kontrakt recovery w obu środowiskach ma `claimed_at` i 64-znakowy
  `jti_hash`, ale historyczne overloady nadal wymagają osobnego cleanupu.
- Staging i Production mają różne podziały migracji; zgodność sygnatur RPC nie
  jest dowodem zgodności definicji funkcji.

## Warunki zamknięcia mapy

Ledger można oznaczyć jako zamknięty dopiero po:

1. przypisaniu każdego zdalnego wpisu do pliku lokalnego albo jawnie opisanej
   grupy scalonych efektów;
2. porównaniu fingerprintu instrukcji albo pełnych definicji obiektów SQL;
3. potwierdzeniu tabel, kolumn, constraintów, indeksów, triggerów, funkcji,
   RLS, polityk i ACL dla grup `GROUP_UNRESOLVED`;
4. osobnym mapowaniu `production_legal_versioned_recovery_delta`;
5. zachowaniu snapshotu danych Production i dowodu kompatybilnego preflightu.

Aktualny status całego ledgera: **`OPEN`**. Nie wykonywano `migration repair`,
ręcznych grantów, cleanupu legacy ani migracji produkcyjnej.

## Snapshot efektów SQL — odczyt 2026-08-16

Poniższe ustalenia pochodzą wyłącznie z zapytań `SELECT` wykonanych w obu
projektach Supabase. Nie zmieniano danych, ACL ani schematu.

### Recovery i versioned store

- `private.auth_recovery_grants` ma w obu środowiskach te same sześć kolumn:
  `jti_hash`, `user_id`, `expires_at`, `used_at`, `created_at`, `claimed_at`.
- W obu środowiskach są constrainty: `expires_at > created_at`, długość
  `jti_hash = 64`, klucz główny na `jti_hash` i kaskadowy klucz użytkownika.
- `private.yarn_store_versions` ma w obu środowiskach klucz główny na
  `user_id`, `version >= 0` i kaskadowy klucz użytkownika. Production zachowuje
  dodatkowo `updated_at NOT NULL DEFAULT now()`; Staging tej kolumny nie ma.
- Nazwa constraintu klucza obcego versioned store różni się (`user_id_fkey`
  w Production i `user_fk` w Staging), ale efekt referencyjny jest taki sam.

Wniosek: recovery lifecycle można oznaczyć jako `EFFECT_CONFIRMED` na poziomie
kolumn i constraintów. Versioned store pozostaje `GROUP_UNRESOLVED` z powodu
różnych historii migracji, definicji funkcji i zachowania `updated_at`.

### Katalog wzorów

Production i Staging różnią się efektem tabeli `public.patterns`:

- Production nie ma kolumn `publication_status`, `content_audit_version`,
  `content_audited_at` i `official_source_url`;
- Staging ma te cztery kolumny oraz constrainty publikacji/audytu;
- `description` jest `NOT NULL` w Production, ale nullable w Staging;
- wspólne constrainty nazwy, języka, wymagań JSON, typu projektu i metrów są
  obecne w obu środowiskach.

Wniosek: publikacja/audyt katalogu to potwierdzony `EFFECT_CONFLICT`, a nie
zwykła różnica numeracji migracji. Nie wolno promować katalogu do Production
bez osobnej decyzji, czy docelowym źródłem prawdy jest efekt Stagingu.

### RLS i polityki danych prywatnych

- RLS jest włączony dla `public.patterns`, `public.profiles`, `public.yarns`
  oraz `private.auth_recovery_grants` w obu środowiskach.
- Polityki `profiles_select_own`, `profiles_update_own` oraz cztery polityki
  włóczek mają w obu środowiskach tę samą bramkę:
  `auth.uid() = id/user_id AND has_current_terms_acceptance()`.
- `private.auth_recovery_grants` ma w Production dodatkową restrykcyjną
  politykę `auth_recovery_grants_no_client_access` z warunkiem `false`; w
  Staging nie odczytano odpowiadającej polityki w `pg_policies`. ACL tabeli i
  schematu są jednak w obu środowiskach ograniczone do właściciela
  `postgres` — nie ma wpisów dla ról API.
- `private.yarn_store_versions` ma RLS wyłączony w obu środowiskach, dlatego
  jego bezpieczeństwo zależy od prywatnego schematu, ACL i wywołań przez
  funkcje `SECURITY DEFINER`; wymaga to osobnego pełnego odczytu ACL.

Wniosek: polityki legalne profili i włóczek są obecnie zgodne funkcjonalnie.
Pozostaje porównanie definicji `has_current_terms_acceptance()` oraz pełnych
ACL prywatnego versioned store; nie oznaczam jeszcze całej bramki RLS jako
zamkniętej.

## Snapshot RPC, definicji i ACL — odczyt 2026-08-16

### Recovery — ścieżka aktywna

Poniższe funkcje mają w Production i Staging identyczne fingerprinty definicji,
`SECURITY DEFINER`, pusty `search_path` i wykonanie dla `authenticated`:

| Funkcja | MD5 definicji |
|---|---|
| `create_auth_recovery_grant()` | `a50333328001fd2472e93e6ccea4bc91` |
| `claim_auth_recovery_grant(text)` | `fb645c611aa6ce0b7409be42c69c789f` |
| `release_auth_recovery_grant(text)` | `2fce926f58876053e8eba75947bca66e` |
| `consume_auth_recovery_grant(text)` | `a3a1019946e10e0cd23c518d619cef78` |

Wniosek: aktywny lifecycle recovery jest `EFFECT_CONFIRMED` między
Production i Staging. Nie oznacza to zgodności historycznych migracji ani
legacy overloadów.

### Versioned yarn RPC

Sygnatury i ACL są zgodne (`authenticated`, `service_role`, `SECURITY DEFINER`,
pusty `search_path`), ale fingerprinty definicji różnią się dla wszystkich
czterech funkcji:

| Funkcja | Production | Staging |
|---|---|---|
| `get_yarn_store_version()` | `78dcd2847267203edda39ab9fdff845c` | `0f1e6d155d48fe03da6c8e53ba47d08b` |
| `insert_yarn_versioned(...)` | `958cb63ffaef7e366618b55dfef373e3` | `b3b2b7d6f16c97e6eab5fd789ddb645f` |
| `update_yarn_versioned(...)` | `ea1b1355505955dda6bf4864d332261e` | `953dc226dc1c59b01d62d7695b9e3ad6` |
| `delete_yarn_versioned(...)` | `ef9a84d7362fc0073da8fd22750a6be0` | `206771c0a99621b5836bb71f9531e77f` |

Po usunięciu różnicy końców linii (`CRLF` vs `LF`) fingerprinty wszystkich
czterech funkcji są identyczne. Ich zachowanie obejmuje tę samą bramkę prawną,
kod konfliktu `P0003`, prywatny licznik i operacje na `public.yarns`.

Wniosek: versioned RPC można oznaczyć jako `BEHAVIOR_CONFIRMED`, z techniczną
różnicą formatu tekstu definicji. Nadal potrzebny jest test kontraktu na
aktualnym checkoutcie, ale nie ma dowodu na rozbieżność zachowania między
Production i Staging.

### Legal gate

`has_current_terms_acceptance()` ma zgodny podpis, ACL i bezpieczeństwo. Surowe
fingerprinty są różne wyłącznie przez końce linii:

- Production raw: `37f123959610eda8d079f06f58c8c6f8`;
- Staging raw: `7bdf62575ff6a9d21a1d9f57f160c434`;
- po normalizacji CRLF→LF w obu: `37f123959610eda8d079f06f58c8c6f8`.

Polityki profili i włóczek oraz definicja legal gate są więc zgodne
semantycznie. Pozostaje tylko potwierdzenie, że lokalny plik migracji użyty do
promocji zachowuje tę samą treść po normalizacji.

### Legacy recovery i legacy yarn

- `create_auth_recovery_grant(uuid,text,timestamptz)` oraz
  `consume_auth_recovery_grant(uuid,text)` istnieją w obu środowiskach, mają
  różne definicje i wykonanie wyłącznie dla `service_role`/właściciela;
- Production ma dwa overloady `insert_yarn_with_limit(...)`, oba z wykonaniem
  dla `authenticated` i `service_role`;
- Staging nie ma żadnego `insert_yarn_with_limit`;
- lokalny brak użycia nie dowodzi braku zewnętrznego klienta, dlatego cleanup
  legacy wymaga osobnego potwierdzenia operatora i postflightu.

Lokalny checkout zawiera jawne `DROP FUNCTION IF EXISTS` dla obu overloadów w
`20260803150000_remove_unsupported_matching_groups.sql` oraz ponownie w
`20260810120111_enforce_current_terms_for_private_data.sql`. Test
`test/migration.test.js` wymaga tych instrukcji i nie dopuszcza ich ponownego
tworzenia. Zdalny Production nadal ma oba overloady, więc zdalny ledger nie
zastosował tego efektu albo późniejsza delta go odtworzyła. Jest to konkretny
`LEGACY_EFFECT_CONFLICT`, a nie brak użycia w aplikacji.

Status końcowy RPC/ACL: **`BEHAVIOR_CONFIRMED`** dla aktywnego recovery,
versioned RPC i legal gate; **`OPEN`** dla legacy overloadów oraz pełnej mapy
migracji.
