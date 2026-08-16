# Supabase: snapshot ledgerów Production ↔ Staging — 2026-08-14

Dokument zawiera odczyt migracji wykonany bez zapisu przez Supabase API. Nie
wykonano `db push`, `migration repair`, resetu ani żadnej zmiany schematu.

## Projekty

| Środowisko | Projekt          | Ref                    | Region       | Status           |
| ---------- | ---------------- | ---------------------- | ------------ | ---------------- |
| Production | Motek Production | `vueotocjsgzosqzhcish` | `eu-north-1` | `ACTIVE_HEALTHY` |
| Staging    | Motek Staging    | `rprhbmtabwjsenvfgicg` | `eu-north-1` | `ACTIVE_HEALTHY` |

## Production — 23 migracje

```text
20260804123738 create_patterns
20260804123742 create_profiles_auth
20260804123744 harden_profiles_trigger_functions
20260804123747 create_yarns
20260804123749 harden_yarns_trigger
20260804123754 add_pattern_matching_requirements
20260804123756 add_atomic_yarn_insert_limit
20260804123807 enforce_pattern_catalog_limit
20260804123814 validate_pattern_matching_requirements
20260804123837 harden_rls_auto_enable_permissions
20260804123844 align_pattern_requirement_validation
20260804123846 add_pattern_project_type
20260804123850 expand_yarn_materials
20260804123854 validate_pattern_matching_v2
20260804123902 email_login_and_remove_full_name
20260804190613 add_versioned_yarn_inventory
20260807113952 add_recovery_grants
20260807113953 revoke_yarns_sequence_acl
20260807113955 harden_profile_avatar_url
20260807114103 move_yarn_store_versions_private
20260807114131 restrict_yarn_mutations_acl
20260807114716 document_patterns_service_role_policy
20260807114728 document_recovery_grants_no_client_policy
```

## Staging — 27 migracji

```text
20260803144824 create_patterns
20260803144850 create_profiles_auth
20260803144854 harden_profiles_trigger_functions
20260803144859 create_yarns
20260803144907 harden_yarns_trigger
20260803144911 add_pattern_matching_requirements
20260803144920 add_atomic_yarn_insert_limit
20260803144926 enforce_pattern_catalog_limit
20260803144931 validate_pattern_matching_requirements
20260803144942 align_pattern_requirement_validation
20260803145008 add_pattern_project_type
20260803145013 expand_yarn_materials
20260803145017 validate_pattern_matching_v2
20260803145021 email_login_and_remove_full_name
20260803192748 add_versioned_yarn_inventory
20260803193245 fix_yarn_version_conflict_code
20260803194324 restore_atomic_yarn_store_versions_contract
20260803194809 fix_yarn_version_conflict_retry
20260806223153 restrict_yarn_mutations
20260806223212 add_recovery_grants
20260806233940 revoke_yarns_sequence_acl
20260811115312 add_pattern_publication_audit
20260811115324 add_invited_registration_and_legal_acceptance
20260811115339 enforce_current_terms_for_private_data
20260811115351 revoke_registration_invitation
20260812135011 add_recovery_grant_claim
20260813103831 harden_recovery_grant_release
```

## Różnice, które blokują automatyczne zastosowanie

- Production ma `harden_rls_auto_enable_permissions`, którego nie ma w ledgerze
  Staging.
- Staging ma trzy migracje naprawiające wersjonowanie włóczek, których nie ma w
  ledgerze Production: `fix_yarn_version_conflict_code`,
  `restore_atomic_yarn_store_versions_contract` i
  `fix_yarn_version_conflict_retry`.
- Nazwa i numer migracji ACL różnią się: Production ma
  `restrict_yarn_mutations_acl`, a Staging `restrict_yarn_mutations`.
- Staging ma późniejsze migracje legal i recovery, których Production nie ma.
- Numery migracji są generowane niezależnie w środowiskach; sama zgodność nazwy
  nie dowodzi zgodności treści.

## Co zostało zamknięte

Zamknięto dokładny odczyt stanu zdalnego: projekty, regiony, statusy, liczbę
migracji, wersje i nazwy. Jest to lepsza podstawa do dalszej analizy niż sama
liczba migracji.

## Kanoniczny lokalny łańcuch kandydata

Poniższa tabela opisuje lokalny łańcuch z `origin/staging@e691af8` (30 plików),
który został odtworzony w pustym, izolowanym stacku Supabase i przeszedł testy
pgTAP. Hash jest hashem całego pliku migracji obliczonym lokalnie algorytmem
SHA-256. Jest to mapa plik → hash; nie jest jeszcze dowodem, że zdalny wpis o
tej samej nazwie ma identyczną treść.

Bieżący główny checkout jest brudny i ma inny, niekanoniczny zestaw migracji.
Do tej tabeli celowo użyto wyłącznie drzewa RC odpowiadającego `origin/staging`,
a nie plików z głównego checkoutu. Dla kluczowych migracji recovery dodatkową
tożsamość Git blob potwierdzono następująco:

| Lokalny plik                                         | Git blob SHA-1                             |
| ---------------------------------------------------- | ------------------------------------------ |
| `20260806120000_restrict_yarn_mutations.sql`         | `974ee956c860bd3f1b173d504574bf207d866f4e` |
| `20260806123000_add_recovery_grants.sql`             | `c8ca118ca78f66f9b48e0e17b1537228aebdaa8e` |
| `20260807090000_revoke_yarns_sequence_acl.sql`       | `2d16696ba3cdbd794fb6c151ee07fe399168e4bd` |
| `20260807093000_harden_profile_avatar_url.sql`       | `b288171e1217969e40f6e2d6292fdeee47852000` |
| `20260807150000_reconcile_yarn_acl_and_recovery.sql` | `9ce441f7a6824435668cb6d7e2db68a1459778b7` |
| `20260812122131_add_recovery_grant_claim.sql`        | `f8507e3dc725fffc5db06365fab188b47fc535c0` |
| `20260813100000_harden_recovery_grant_release.sql`   | `8e0405de10e7ee300873a6271bbc86ee05a93f1f` |

| Kolejność | Lokalny plik                                                       | SHA-256                                                            | Efekt deklarowany przez nazwę          |
| --------: | ------------------------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------- |
|         1 | `20260723000000_create_patterns.sql`                               | `078d9f9df615ebf1c2ed558e788e2d7d67af13c18760f5ade92607e62ca46868` | katalog wzorów                         |
|         2 | `20260724000000_create_profiles_auth.sql`                          | `95dff720d7442a3414b042811ed4e2fee790509cc5b6fd02e650ea4f3e3f7be2` | profile i Auth                         |
|         3 | `20260724000001_harden_profiles_trigger_functions.sql`             | `d10bae039b9fa5b521c46f1772b613c8c7594ba69e9c40aadee93e98397f43d8` | bezpieczeństwo triggerów profilu       |
|         4 | `20260727000000_create_yarns.sql`                                  | `7d8552bcbbc03b9f5d2a68b38d275abc68ae0a4c477fa148ae5210a6321f848a` | włóczki                                |
|         5 | `20260727000001_harden_yarns_trigger.sql`                          | `5cac159af20e25c62a330a812152fa4080038dd14c24c22a27071a1041a335ab` | bezpieczeństwo triggera włóczek        |
|         6 | `20260727000002_add_pattern_matching_requirements.sql`             | `3f97bd39a34257d1d4798c45d5ba675dc44984f7d16abc27b4fdb8d38aefc81b` | wymagania dopasowania                  |
|         7 | `20260728000000_add_atomic_yarn_insert_limit.sql`                  | `75bd5a13184c1ac87b790cd3e396693629cb4870479c49710fe2635da8a10b09` | limit atomowego zapisu włóczek         |
|         8 | `20260728000001_enforce_pattern_catalog_limit.sql`                 | `da78199c3893bbcb88e18da4fba3bbcd35cb3f73a5dc4c98c1d13d4fa5b6c965` | limit katalogu wzorów                  |
|         9 | `20260728000002_validate_pattern_matching_requirements.sql`        | `0c49321353b2ee77b17c01908038010f124e62bc83952a50fb6b6afd9aaac61f` | walidacja wymagań dopasowania          |
|        10 | `20260728000003_harden_rls_auto_enable_permissions.sql`            | `0cccf412a83a32a0aab3c58b0ad80f2afee0d005d70d327b63a4dd799b1693a8` | uprawnienia automatycznego RLS         |
|        11 | `20260728000004_align_pattern_requirement_validation.sql`          | `5d88091d19501b13ac1115f349ebd412f6fa3029a54f5a556f09094031f24abe` | ujednolicenie walidacji                |
|        12 | `20260730000000_add_pattern_project_type.sql`                      | `7648e0c976ae4c1efcf02c61d5c701eccbaff97edad0853991fe03ce07ebe52b` | typ projektu wzoru                     |
|        13 | `20260730211136_expand_yarn_materials.sql`                         | `0ff37163978a08485642c7c83265bc4adb9558fb4f11831b6d74e6b566264a2c` | materiały włóczek                      |
|        14 | `20260730213157_validate_pattern_matching_v2.sql`                  | `43b918f6ace05d46595aa9b0da2588c600461eb8deec107c27425cd012417b00` | walidacja dopasowania v2               |
|        15 | `20260731104741_email_login_and_remove_full_name.sql`              | `3000b96a22eb99293502c128a5a649752316b22aaf2a97cb560fe420dc91127d` | logowanie e-mail i profil              |
|        16 | `20260803113832_harden_matching_requirements_validation.sql`       | `34930af8871f618c350f10d62552fc48bce1e1fa2b32211e4c7c849c56d25599` | dodatkowe utwardzenie walidacji        |
|        17 | `20260803125010_add_atomic_yarn_store_versions.sql`                | `8c840a3ae2781fc5210f104b0cd69a50c8aafddf77cfbe379d1b8ffbf8f3aa97` | wersjonowany magazyn włóczek           |
|        18 | `20260803150000_remove_unsupported_matching_groups.sql`            | `7e6dc0b4bdbc7bc6532d1e73db3187e0064f5bb5cfc91fe96837e790c323a7ef` | usunięcie nieobsługiwanych grup        |
|        19 | `20260803200000_fix_yarn_version_conflict_retry.sql`               | `df988919f77ed37aa1e94329a2a05469d23a029d8195c9fd8d8875e0dd042496` | retry konfliktu wersji                 |
|        20 | `20260806120000_restrict_yarn_mutations.sql`                       | `434802aa583388f4f204857d25e7b7249289a004b8515d9853f9ad389e1b2160` | ograniczenie mutacji włóczek           |
|        21 | `20260806123000_add_recovery_grants.sql`                           | `ba6cb45fdf27a4bc501bef4216a6b3dfb3ef58117fe4a311e43af965f8265cf2` | granty recovery                        |
|        22 | `20260807090000_revoke_yarns_sequence_acl.sql`                     | `a4accfc2019bce026242a42011486763a22859a8d8e1750986bd589464c737c4` | odebranie ACL sekwencji                |
|        23 | `20260807093000_harden_profile_avatar_url.sql`                     | `74514dfafb9a09fe671b3871cd524ebc3ba5cb7ffe80aa474aa4ecb9bc2afa33` | utwardzenie avatar URL                 |
|        24 | `20260807150000_reconcile_yarn_acl_and_recovery.sql`               | `6cdb3b70615af0ee6cfdae0b003f3fdc8b809ce236acae2099e26ebc37105703` | uzgodnienie ACL i recovery             |
|        25 | `20260809165750_add_pattern_publication_audit.sql`                 | `08e2b7ae3a9ef54eb3412c9deb5d5e9581a890b640e1d2a938935fd4a9d768ec` | audyt publikacji wzorów                |
|        26 | `20260809185511_add_invited_registration_and_legal_acceptance.sql` | `9152707573b41d83c2d2763c38fc24d62a14c70154855dbb21527074cc33322d` | zaproszenia i akceptacja prawa         |
|        27 | `20260810120111_enforce_current_terms_for_private_data.sql`        | `637c84f07cab0e624adab4288a6945aecd896e6aaa633567c3048ffda909819d` | aktualne warunki dla danych prywatnych |
|        28 | `20260810123000_revoke_registration_invitation.sql`                | `1758093a1ad47589f8c0adc52556bb4533e84a1fd156f746cd05fdd64fc64bc1` | odebranie zaproszenia                  |
|        29 | `20260812122131_add_recovery_grant_claim.sql`                      | `a025a53ca7e12bc903aa484754f4d225b1378f4fbf18be269568252d24324829` | claim recovery                         |
|        30 | `20260813100000_harden_recovery_grant_release.sql`                 | `56f7f26cb73d4052f89bfe866282c21852f0bcf357b501457c1d11aff23dbd1a` | utwardzenie release recovery           |

## Mapa zdalny wpis → lokalny kandydat

Pełna robocza macierz dla Staging znajduje się w [supabase-staging-migration-matrix-2026-08-14.md](supabase-staging-migration-matrix-2026-08-14.md).

Na podstawie nazw i efektów można wskazać kandydatów do porównania, ale nie
można oznaczyć ich jako równoważne bez odczytu definicji zdalnych. Największe
obszary wymagające takiego porównania to:

- zdalne `add_versioned_yarn_inventory`, `fix_yarn_version_conflict_code`,
  `restore_atomic_yarn_store_versions_contract` i
  `fix_yarn_version_conflict_retry` względem lokalnych pozycji 16–19;
- zdalne `restrict_yarn_mutations`, `add_recovery_grants` i późniejszy wpis
  `document_recovery_grants_no_client_policy` względem lokalnych pozycji 20–24;
- zdalny `harden_rls_auto_enable_permissions` w Production względem lokalnej
  pozycji 10; bezpośredni odczyt potwierdził, że `public.rls_auto_enable()` nie
  istnieje ani w Production, ani w Staging. Lokalny krok jest warunkowy, więc
  efekt końcowy tej pozycji jest funkcjonalnie równoważnym no-op; nie jest to
  dowód identyczności historycznego pliku zdalnego;
- różne numery i nazwy migracji recovery: zdalne `20260812135011` /
  `20260813103831` względem lokalnych `20260812122131` /
  `20260813100000`.

Wniosek: lokalny łańcuch jest odtwarzalny i zweryfikowany jako kandydat
aplikacyjno-bazodanowy, ale nie ma jeszcze dowodu binarnej zgodności zdalnych
plików. Przed produkcją trzeba porównać efekt obiektów (funkcje, granty, RLS,
triggery, constrainty) albo uzyskać eksport definicji z obu środowisk. Nie
wykonywać `migration repair`, ręcznych grantów ani migracji częściowej.

## Minimalny pakiet zdalnego porównania

Następny odczyt, nadal bez zapisu, powinien zebrać dla Production i Staging
porównywalny snapshot:

- `pg_get_functiondef` oraz sygnatury RPC recovery i funkcji mutujących włóczki;
- kolumny, typy, wartości domyślne i constrainty tabel `private` oraz
  `public.yarns`;
- status RLS, komplet polityk i ich role/warunki;
- granty funkcji, tabel i sekwencji, w tym brak `EXECUTE` dla `anon`;
- `prosecdef`/`SECURITY DEFINER` i konfigurację `search_path` funkcji;
- triggery, indeksy oraz wymagane rozszerzenia.

Każdy obiekt należy oznaczyć jako `EQUIVALENT`, `MISSING`, `CONFLICT` albo
`UNRESOLVED`. Status `UNRESOLVED` dla któregokolwiek obiektu recovery, ACL,
RLS lub legalnego kontraktu blokuje migrację produkcji. Ten snapshot wymaga
wyłącznie odczytu definicji; nie należy używać go do automatycznego `GRANT`,
`migration repair` ani do zapisu danych.

## Stan po świeżym odczycie — 2026-08-14

Świeży odczyt Production/Staging pozwala rozdzielić różnice historyczne od
blokad funkcjonalnych. Nie naprawiamy zdalnego ledgera ręcznie i nie traktujemy
różnej nazwy lub numeru jako dowodu braku zgodności efektu.

### Funkcjonalnie zamknięte

- `harden_rls_auto_enable_permissions`: `public.rls_auto_enable()` nie istnieje
  w żadnym środowisku, więc warunkowy REVOKE jest równoważnym no-op;
- ograniczenie bezpośrednich mutacji `public.yarns` i użycia sekwencji:
  `public`, `anon` i `authenticated` są zablokowane, a `service_role` zachowuje
  dostęp;
- katalog i prywatna tabela recovery pozostają niedostępne klientowi; katalog
  działa przez backend/service role, zgodnie z decyzją produktu;
- `private.yarn_store_versions.updated_at` jest zachowany jako kompatybilność
  danych i nie może być usuwany w delcie.

Powyższe zamyka efekt funkcjonalny, ale nie dostarcza binarnego hashy dawnych
plików migracji. Historyczne nazwy i scalone wpisy pozostają informacyjne.

### Blokady przed migracją produkcji

- versioned RPC i RLS: Production nie wymaga aktualnej akceptacji warunków i
  używa kodu `40001`, podczas gdy Staging ma legal gate i `P0003`;
- recovery: Production ma kontrakt legacy 43-znakowy bez `claimed_at` oraz
  `claim/release`, a Staging ma SHA-256/64 i pełny lifecycle;
- legacy RPC: Production nadal udostępnia oba przeciążenia
  `insert_yarn_with_limit`, których nie ma na Stagingu;
- publiczny kontrakt aplikacji: Production działa na starym `c4b777a`, zwraca
  `404` dla strony prawnej i anonimowe `200` dla `/api/patterns`;
- legal/infrastructure readiness oraz osobne zgody wykonawcze pozostają
  otwarte.

## Świeże potwierdzenie obserwacyjne — 2026-08-15

- Odczyt list migracji potwierdził Production = 23 wpisy i Staging = 27
  wpisów.
- Drzewo migracji RC `release/motek-recovery-rc@8ea27c6` zawiera 32 lokalne
  pliki migracji; ich SHA-256 zostały ponownie policzone. Migracje nie mają
  lokalnych zmian, ale worktree zawiera niezwiązane zmiany dokumentacji i
  danych audytowych — nie traktować całego worktree jako artefaktu promocji.
- Część nazw ma wiarygodne odpowiedniki semantyczne, w tym recovery claim/
  release, ale brak zdalnych hashy treści i efektu dla wpisów scalonych lub
  przemianowanych. Nie oznaczam ich jako równoważne.
- Brak `pg_cron`, `pg_net`, `cron.job` i funkcji schematu `cron` w obu bazach
  zamyka wyłącznie zakres schedulerów PostgreSQL; nie zamyka zewnętrznych
  webhooków, cronów ani ręcznych klientów.
- Rejestr `supabase_migrations.schema_migrations` przechowuje `statements` i
  `rollback`, więc możliwe jest tworzenie fingerprintów treści bez odczytu
  sekretów. Pierwsze porównanie znormalizowanego fingerprintu zamknęło tylko
  Staging `create_patterns` względem lokalnego pliku; Production ma inny
  fingerprint. Nie rozszerzać tego wyniku na pozostałe migracje.

## Świeży snapshot efektu schematu — 2026-08-15

Read-only SQL porównał funkcje, ACL, kolumny, constrainty i polityki RLS w obu
projektach. Nie wykonano żadnego zapisu.

### Recovery i funkcje versioned

- Production ma wyłącznie legacy recovery `create/consume` z argumentami
  `p_user_id, p_jti_hash`; obie funkcje są `SECURITY DEFINER`, mają pusty
  `search_path` i ACL tylko dla `service_role`.
- Staging ma dodatkowo `claim/release` oraz nowy wariant `consume(grant_jti)`
  dla `authenticated`; funkcje lifecycle są `SECURITY DEFINER` z pustym
  `search_path`.
- Production ma dwa legacy overloady `insert_yarn_with_limit`, oba z
  `EXECUTE` dla `authenticated` i `service_role`; Staging nie ma żadnego.
- Versioned RPC są obecne w obu środowiskach, ale Production nie ma
  `has_current_terms_acceptance()`, a Staging ma tę funkcję i wymusza ją w
  politykach profili i włóczek.

### Recovery data i polityki

- `private.auth_recovery_grants`: Production wymaga długości `jti_hash = 43` i
  nie ma `claimed_at`; Staging wymaga długości `64` i ma `claimed_at`.
- `private.yarn_store_versions.updated_at` nadal istnieje w Production, a nie
  występuje w Stagingu. Nie wolno traktować tego jako zgody na usunięcie
  kolumny; delta musi zachować istniejące dane produkcyjne.
- Production ma polityki RLS dla profili i włóczek bez bramki aktualnych
  warunków; Staging ma ten sam zakres własności rozszerzony o
  `has_current_terms_acceptance()`.
- Production i Staging mają niedostępną dla klienta prywatną tabelę recovery;
  różnica dotyczy lifecycle i kontraktu funkcji, nie decyzji o udostępnieniu
  tabeli klientowi.

Wniosek: snapshot potwierdza funkcjonalny konflikt recovery/legal/RPC i
uzasadnia przygotowany forward-only pakiet RC. Nie jest to zgoda na migrację;
przed wykonaniem pozostają legal-readiness, bramka legacy oraz osobne zgody
operacyjne.

## Świeży agregowany snapshot danych recovery/versioning — 2026-08-15

Odczyt agregowany nie ujawniał tokenów, identyfikatorów ani danych użytkowników:

| Zakres | Production | Staging |
|---|---:|---:|
| Rekordy `private.auth_recovery_grants` | 0 | 0 |
| Długości hashy recovery | brak rekordów | brak rekordów |
| Rekordy `private.yarn_store_versions` | 2 | 6 |
| Najwyższa wersja | 4 | 142 |
| `claimed_at` | brak kolumny | obecna |
| `updated_at` w `yarn_store_versions` | obecna | brak kolumny |

To potwierdza brak aktywnych rekordów recovery w chwili odczytu, ale nie
zastępuje snapshotu wykonywanego bezpośrednio przed oknem produkcyjnym.
Różnica liczności i najwyższej wersji yarnów musi zostać zachowana w preflight;
nie wolno zakładać, że dane Production są identyczne ze Stagingiem.

## Co pozostaje otwarte

Przed migracją produkcji nadal trzeba przygotować mapę:

```text
zdalna wersja/nazwa → lokalny plik → hash treści → efekt schematu/RPC
```

Pozostają do rozstrzygnięcia pozostałe różnice historycznego ledgera, ale
`harden_rls_auto_enable_permissions` można oznaczyć jako zamknięty na poziomie
efektu: brak `public.rls_auto_enable()` w obu projektach oznacza, że lokalny
warunkowy REVOKE niczego nie zmienia. Nie wykonywać ręcznych grantów ani
migracji częściowych.

Produkcja pozostaje `NO-GO`.

## Świeży fingerprint zdalnych instrukcji migracji — 2026-08-15

Read-only SQL odczytał `md5(statements::text)` oraz długość zapisanych
instrukcji z tabeli `supabase_migrations.schema_migrations`. Fingerprinty są
tożsamością zdalnego zapisu instrukcji, a nie hashami lokalnych plików
migracji; nie wolno porównywać ich bezpośrednio z SHA-256 plików.

| Środowisko | Wersja / nazwa | MD5 instrukcji | Długość |
|---|---|---|---:|
| Production | `20260804190613 add_versioned_yarn_inventory` | `57d33bfb350f62b2d57cb36be357d28e` | 6951 |
| Production | `20260807113952 add_recovery_grants` | `cf26ea9958facdf1affe6c594e9ad3f1` | 2225 |
| Production | `20260807114131 restrict_yarn_mutations_acl` | `6e08bbc8893406acef84a33fbd38a42b` | 1027 |
| Production | `20260807114716 document_patterns_service_role_policy` | `0dbee86381808351d11f1bbceb017d94` | 200 |
| Production | `20260807114728 document_recovery_grants_no_client_policy` | `04a4967027fb6ba5610bdeb8b1799abf` | 247 |
| Staging | `20260803192748 add_versioned_yarn_inventory` | `621403595dc4c1f04cf3a9fc64f511c4` | 6954 |
| Staging | `20260803193245 fix_yarn_version_conflict_code` | `b848a5a15918c97d00e61682eb2ed436` | 6954 |
| Staging | `20260803194324 restore_atomic_yarn_store_versions_contract` | `13e9a8c870a383bdc7ca48dff73a21f2` | 6659 |
| Staging | `20260806223212 add_recovery_grants` | `cc315eff4fc16e62929f61a6b4c95773` | 2359 |
| Staging | `20260812135011 add_recovery_grant_claim` | `f87479d802e0f6c379c348f1457959da` | 2259 |
| Staging | `20260813103831 harden_recovery_grant_release` | `183119e910bdb6b805e24a2a66c25762` | 1784 |

Wynik wzmacnia status `UNRESOLVED` dla grup versioned/recovery/ACL: sama
zgodność nazwy nie wystarcza, a fingerprint zdalnej instrukcji nie jest
bezpośrednio porównywalny z lokalnym hashem pliku. Do zamknięcia pozostaje
porównanie efektu obiektów oraz jawna mapa grup scalonych. Nie wykonywano
`migration repair`, ręcznych grantów ani migracji.

## Świeży snapshot efektu funkcji, kolumn i RLS — 2026-08-15

Read-only SQL porównał definicje funkcji, ACL wykonania, kolumny i polityki RLS
w Production i Staging. Wszystkie odczytane funkcje `SECURITY DEFINER` mają
pusty `search_path`; różnice dotyczą kontraktu i uprawnień:

| Obszar | Production | Staging | Status |
|---|---|---|---|
| Recovery user-facing | brak `claim`/`release`, tylko legacy `consume(uuid,text)` dla `service_role` | `claim(text)`, `release(text)`, `consume(text)` dla `authenticated` oraz legacy overload | `EFFECT_CONFLICT` |
| Recovery hash/lifecycle | brak `claimed_at`, constraint 43 znaków | `claimed_at`, constraint 64 znaki | `EFFECT_CONFLICT` |
| Legal gate | brak `has_current_terms_acceptance()`; polityki profili/włóczek bez bramki | funkcja obecna; polityki wymagają aktualnej akceptacji | `EFFECT_CONFLICT` |
| Versioned RPC | obecne, bez legal gate; status konfliktu pozostaje legacy | obecne z legal gate i kontraktem stagingowym | `EFFECT_CONFLICT` |
| Legacy `insert_yarn_with_limit` | 2 overloady, `EXECUTE` dla `authenticated` i `service_role` | brak overloadów | `EFFECT_CONFLICT` |
| `private.yarn_store_versions` | `updated_at` zachowane | brak `updated_at` | `ACCEPTED_COMPATIBILITY`, wymaga ochrony danych |

W obu środowiskach `anon` nie ma wykonania odczytanych RPC recovery, a prywatna
tabela recovery pozostaje poza bezpośrednim dostępem klienta. To zamyka tylko
te granice dostępu; nie zmniejsza konfliktu kontraktu. Wynik jest dowodem efektu
schematu, nie zgodą na zastosowanie delty. Produkcja pozostaje `NO-GO`.
## Rewalidacja zdalna po delcie — 2026-08-16

Ten wpis aktualizuje wyłącznie stan odczytowy; wcześniejsze sekcje pozostają
historycznym snapshotem z 2026-08-14.

- Production ma obecnie 24 wpisy migracji i kończy się na
  `20260815115028 production_legal_versioned_recovery_delta`.
- Staging ma obecnie 28 wpisów migracji i kończy się na
  `20260815152553 restore_recovery_grant_creator`.
- W obu środowiskach `private.auth_recovery_grants` ma `claimed_at` oraz
  constraint `char_length(jti_hash) = 64`.
- Aktywne overloady używane przez aplikację — `create()`,
  `claim(text)`, `release(text)` i `consume(text)` — mają zgodne definicje
  oraz wykonanie dla roli `authenticated`.
- Historyczne overloady z parametrami użytkownika/hash nadal istnieją i
  wymagają osobnego porównania oraz decyzji o cleanupie.

Wniosek: historyczny konflikt recovery 43 znaki vs 64 i brak `claimed_at` nie
opisuje już bieżącego stanu zdalnego. Ledger pozostaje `OPEN`, ponieważ nadal
brakuje pełnej mapy: zdalna wersja → lokalny plik → hash treści → efekt
schematu/RPC, a historia Production i Staging ma różne podziały migracji.
Odczyt nie wykonywał migracji, `migration repair`, grantów ani zmian danych.

### Rewalidacja RPC i ACL — 2026-08-16

- `has_current_terms_acceptance()` istnieje w obu środowiskach i jest dostępna
  dla `authenticated`, ale jej definicja nie jest identyczna.
- `get_yarn_store_version()`, `insert_yarn_versioned()`,
  `update_yarn_versioned()` i `delete_yarn_versioned()` mają zgodne sygnatury
  oraz ACL (`anon = false`, `authenticated = true`), lecz różne fingerprinty
  definicji.
- Production nadal ma dwa overloady `insert_yarn_with_limit`, a Staging nie ma
  żadnego. Lokalny kod nie korzysta z tego legacy RPC, ale jego cleanup wymaga
  osobnej decyzji i postflightu.

Wniosek: recovery lifecycle jest funkcjonalnie wyrównany, natomiast legal gate,
versioned RPC i legacy cleanup pozostają otwartą częścią ledgera. Nie wolno
oznaczać pełnej zgodności produkcji ze stagingiem ani wykonywać cleanupu na
podstawie samego braku użycia w repozytorium.

### Pełna lista zdalnych wpisów migracji — rewalidacja 2026-08-16

Poniższa lista jest odczytem `supabase_migrations.schema_migrations` z obu
projektów. Nie jest próbą „naprawy” ledgera i nie oznacza, że wpis z jednego
środowiska można bezpośrednio odtworzyć w drugim.

| Środowisko | Liczba wpisów | Najstarszy wpis | Najnowszy wpis |
|---|---:|---|---|
| Production | 24 | `20260804123738 create_patterns` | `20260815115028 production_legal_versioned_recovery_delta` |
| Staging | 28 | `20260803144824 create_patterns` | `20260815152553 restore_recovery_grant_creator` |

Production ma następujące wpisy:

```text
20260804123738 create_patterns
20260804123742 create_profiles_auth
20260804123744 harden_profiles_trigger_functions
20260804123747 create_yarns
20260804123749 harden_yarns_trigger
20260804123754 add_pattern_matching_requirements
20260804123756 add_atomic_yarn_insert_limit
20260804123807 enforce_pattern_catalog_limit
20260804123814 validate_pattern_matching_requirements
20260804123837 harden_rls_auto_enable_permissions
20260804123844 align_pattern_requirement_validation
20260804123846 add_pattern_project_type
20260804123850 expand_yarn_materials
20260804123854 validate_pattern_matching_v2
20260804123902 email_login_and_remove_full_name
20260804190613 add_versioned_yarn_inventory
20260807113952 add_recovery_grants
20260807113953 revoke_yarns_sequence_acl
20260807113955 harden_profile_avatar_url
20260807114103 move_yarn_store_versions_private
20260807114131 restrict_yarn_mutations_acl
20260807114716 document_patterns_service_role_policy
20260807114728 document_recovery_grants_no_client_policy
20260815115028 production_legal_versioned_recovery_delta
```

Staging ma następujące wpisy:

```text
20260803144824 create_patterns
20260803144850 create_profiles_auth
20260803144854 harden_profiles_trigger_functions
20260803144859 create_yarns
20260803144907 harden_yarns_trigger
20260803144911 add_pattern_matching_requirements
20260803144920 add_atomic_yarn_insert_limit
20260803144926 enforce_pattern_catalog_limit
20260803144931 validate_pattern_matching_requirements
20260803144942 align_pattern_requirement_validation
20260803145008 add_pattern_project_type
20260803145013 expand_yarn_materials
20260803145017 validate_pattern_matching_v2
20260803145021 email_login_and_remove_full_name
20260803192748 add_versioned_yarn_inventory
20260803193245 fix_yarn_version_conflict_code
20260803194324 restore_atomic_yarn_store_versions_contract
20260803194809 fix_yarn_version_conflict_retry
20260806223153 restrict_yarn_mutations
20260806223212 add_recovery_grants
20260806233940 revoke_yarns_sequence_acl
20260811115312 add_pattern_publication_audit
20260811115324 add_invited_registration_and_legal_acceptance
20260811115339 enforce_current_terms_for_private_data
20260811115351 revoke_registration_invitation
20260812135011 add_recovery_grant_claim
20260813103831 harden_recovery_grant_release
20260815152553 restore_recovery_grant_creator
```

Wynik mapowania:

- wpisy bazowe katalogu, profili, włóczek i walidacji mają odpowiedniki
  funkcjonalne, ale różne timestampy i historyczne grupowanie;
- Staging ma dodatkowe grupy versioned-yarn, legal/publication i recovery,
  które w Production zostały częściowo scalone w późniejszą deltę;
- Production ma dodatkowe wpisy ACL/utrzymaniowe, których Staging nie ma jako
  osobnych wpisów;
- lokalny katalog ma 26 plików migracji, więc nie jest kopią 1:1 żadnego z
  dwóch zdalnych ledgerów;
- o zgodności można wnioskować dopiero z połączenia: nazwa i kolejność wpisu,
  fingerprint zdalnej instrukcji, lokalny plik oraz efekt obiektów SQL.

Status bramki pozostaje `OPEN`. Do zamknięcia brakuje tabeli mapującej każdy
zdalny wpis na lokalny plik albo jawnie udokumentowane scalone/produkcyjne
odstępstwo, wraz z hashem/fingerprintem i efektem schematu. Nie wykonano
`migration repair`, ręcznych grantów, cleanupu legacy ani kolejnej migracji.

### Pełny eksport fingerprintów zdalnych — 2026-08-16

Poniższy read-only eksport jest materiałem wejściowym do finalnej macierzy.
Format: `wersja nazwa md5(statements::text) bajty`.

Production:

```text
20260804123738 create_patterns 4ff571c7b94d8cad8ceeae7187ede62e 1562
20260804123742 create_profiles_auth eed7247c2cee9e98404331028817d8c2 4986
20260804123744 harden_profiles_trigger_functions cb7747ff8b8c65a0deb07ff9c8a770ca 554
20260804123747 create_yarns 4a1fcf09dcdd91db40d953b3801d610f 3594
20260804123749 harden_yarns_trigger 2d773e68af4de3da72df75c347a1e1ba 205
20260804123754 add_pattern_matching_requirements e52421dfb150b18aead4d6a7f5058d97 498
20260804123756 add_atomic_yarn_insert_limit 503b5ba0867d261b9fc85e4acff86d32 1799
20260804123807 enforce_pattern_catalog_limit 73cec74f968e18db37ed35d7e86db734 1383
20260804123814 validate_pattern_matching_requirements a8b8ed04e7a11423f962ac524687771f 3655
20260804123837 harden_rls_auto_enable_permissions 7fb381dd9e864782354455e79e415c0b 141
20260804123844 align_pattern_requirement_validation c73dcd2ad90b4a4e8438b988a13b637c 6314
20260804123846 add_pattern_project_type fc524b2466875cadacd8f220f6cf7114 499
20260804123850 expand_yarn_materials a81e29f5173d1841b7fed1fd1bd9ab8e 4570
20260804123854 validate_pattern_matching_v2 43b32a982f64b433a59ae6fbea22a600 9240
20260804123902 email_login_and_remove_full_name fd5c57fcbf518c5eb9d1563d7b520f26 3615
20260804190613 add_versioned_yarn_inventory 57d33bfb350f62b2d57cb36be357d28e 6951
20260807113952 add_recovery_grants cf26ea9958facdf1affe6c594e9ad3f1 2229
20260807113953 revoke_yarns_sequence_acl 625baec6878166539b32c3f27ba006e2 91
20260807113955 harden_profile_avatar_url b77875b25f407239ef3d1b92a719f2fe 230
20260807114103 move_yarn_store_versions_private a86ce6f1a0a8459ffe7db2d7a2c47cdf 6682
20260807114131 restrict_yarn_mutations_acl 6e08bbc8893406acef84a33fbd38a42b 1027
20260807114716 document_patterns_service_role_policy 0dbee86381808351d11f1bbceb017d94 200
20260807114728 document_recovery_grants_no_client_policy 04a4967027fb6ba5610bdeb8b1799abf 247
20260815115028 production_legal_versioned_recovery_delta 0f4d977c38f95ca0e6b627f7f61ad4c0 37364
```

Staging:

```text
20260803144824 create_patterns b93402d958fbb4433362d073f1a83563 1467
20260803144850 create_profiles_auth eed7247c2cee9e98404331028817d8c2 4986
20260803144854 harden_profiles_trigger_functions cb7747ff8b8c65a0deb07ff9c8a770ca 554
20260803144859 create_yarns 4a1fcf09dcdd91db40d953b3801d610f 3594
20260803144907 harden_yarns_trigger 2d773e68af4de3da72df75c347a1e1ba 205
20260803144911 add_pattern_matching_requirements e52421dfb150b18aead4d6a7f5058d97 498
20260803144920 add_atomic_yarn_insert_limit 503b5ba0867d261b9fc85e4acff86d32 1799
20260803144926 enforce_pattern_catalog_limit 73cec74f968e18db37ed35d7e86db734 1383
20260803144931 validate_pattern_matching_requirements a8b8ed04e7a11423f962ac524687771f 3655
20260803144942 align_pattern_requirement_validation c73dcd2ad90b4a4e8438b988a13b637c 6314
20260803145008 add_pattern_project_type fc524b2466875cadacd8f220f6cf7114 499
20260803145013 expand_yarn_materials a81e29f5173d1841b7fed1fd1bd9ab8e 4570
20260803145017 validate_pattern_matching_v2 43b32a982f64b433a59ae6fbea22a600 9240
20260803145021 email_login_and_remove_full_name fd5c57fcbf518c5eb9d1563d7b520f26 3615
20260803192748 add_versioned_yarn_inventory 621403595dc4c1f04cf3a9fc64f511c4 6954
20260803193245 fix_yarn_version_conflict_code b848a5a15918c97d00e61682eb2ed436 6954
20260803194324 restore_atomic_yarn_store_versions_contract 13e9a8c870a383bdc7ca48dff73a21f2 6665
20260803194809 fix_yarn_version_conflict_retry 453fbf6eda09819ca438b9d2e9a8e403 6665
20260806223153 restrict_yarn_mutations 89eef55fbe21e193d7d6b51aa8ed0853 2005
20260806223212 add_recovery_grants cc315eff4fc16e62929f61a6b4c95773 2366
20260806233940 revoke_yarns_sequence_acl 60476dc414fc76ac952cb72d268bbe1f 166
20260811115312 add_pattern_publication_audit ebbaa8f901ae94348db01aeb2ec281dc 677
20260811115324 add_invited_registration_and_legal_acceptance e3be1161dbdc3f1b24e826fd517dafea 18984
20260811115339 enforce_current_terms_for_private_data 371d5c58c749a9d1da24aef86eea1365 9388
20260811115351 revoke_registration_invitation 7cd6b2d3733eea2da4fdcb80a99f68bd 1753
20260812135011 add_recovery_grant_claim f87479d802e0f6c379c348f1457959da 2259
20260813103831 harden_recovery_grant_release 183119e910bdb6b805e24a2a66c25762 1784
20260815152553 restore_recovery_grant_creator b141cbb53bc93ce298168da00777efb8 734
```

Fingerprinty pokazują kilka bezpośrednich zgodności treści między Stagingiem
i Production (m.in. profile, yarns, walidacje i część RPC), ale także różne
instrukcje dla recovery, legal gate, ACL i versioned store. To wystarcza do
zamknięcia dowodu „pełny eksport zdalny”, lecz nie do zamknięcia zgodności
release’u. Następny krok ledgera to mapowanie tych fingerprintów do 26 plików
aktualnego checkoutu i efektów obiektów SQL; ta część pozostaje `OPEN`.

### Hashy aktualnego checkoutu — 2026-08-16

SHA-256 policzono dla dokładnie 26 plików obecnych w `supabase/migrations` na
branchu `agent/staging-security-merge`, HEAD `3b07f6c`. To są hashe plików
lokalnych, a nie fingerprinty zdalnych pól `statements`; nie należy ich
porównywać znak w znak bez jawnej normalizacji treści i mapowania grup.

```text
20260723000000_create_patterns.sql 078D9F9DF615EBF1C2ED558E788E2D7D67AF13C18760F5ADE92607E62CA46868
20260724000000_create_profiles_auth.sql C25696502CA6982E889FEB5D8A97F256496AAE0D81881E712B3327D8B4967EA5
20260724000001_harden_profiles_trigger_functions.sql B244BEABE851ABC395A390BD585DECD149C70BA2EE3289AFED24589D3D1D3C92
20260727000000_create_yarns.sql CBF4EADE6D1B53814A0F508161AB8908F5F6E0D51F36E42982882E4856208F86
20260727000001_harden_yarns_trigger.sql 0DB92A7A56CA032A5791512B99CE7A1025ECE094CE91777A54BB0AFEA8A078EF
20260727000002_add_pattern_matching_requirements.sql 930EDD23C049EA57F14C6E7E7B76994BEE8712D60A543BFA78F719C518A72330
20260728000000_add_atomic_yarn_insert_limit.sql 690C1C17D2DEA0C950AB1AF3A351CF2C3B890387CD427B65E8CC8C51F458367E
20260728000001_enforce_pattern_catalog_limit.sql 78C9D02E6008DA83018B22223C808D7459D5EABEEE4D1240F22354A6DBBCCED9
20260728000002_validate_pattern_matching_requirements.sql 0AF35BBBCFE5B5CFC9987D6E26ED770FCADE59EA647B79E8A05CB02290FD5B04
20260728000003_harden_rls_auto_enable_permissions.sql 0CCCF412A83A32A0AAB3C58B0AD80F2AFEE0D005D70D327B63A4DD799B1693A8
20260728000004_align_pattern_requirement_validation.sql 544BB571743CC89E55BFA1E8941961080086FC4E493DD18B9AA4655871F2CBDF
20260730000000_add_pattern_project_type.sql 7648E0C976AE4C1EFCF02C61D5C701ECCBAFF97EDAD0853991FE03CE07EBE52B
20260730211136_expand_yarn_materials.sql 0FF37163978A08485642C7C83265BC4ADB9558FB4F11831B6D74E6B566264A2C
20260730213157_validate_pattern_matching_v2.sql 43B918F6ACE05D46595AA9B0DA2588C600461EB8DEEC107C27425CD012417B00
20260731104741_email_login_and_remove_full_name.sql 3000B96A22EB99293502C128A5A649752316B22AAF2A97CB560FE420DC91127D
20260803113832_harden_matching_requirements_validation.sql 34930AF8871F618C350F10D62552FC48BCE1E1FA2B32211E4C7C849C56D25599
20260803125010_add_atomic_yarn_store_versions.sql 8C840A3AE2781FC5210F104B0CD69A50C8AAFDDF77ED1B8FFBF8F3AA97
20260803150000_remove_unsupported_matching_groups.sql 7E6DC0B4BDBC7BC6532D1E73DB3187E0064F5BB5CFC91FE96837E790C323A7EF
20260803200000_fix_yarn_version_conflict_retry.sql DF988919F77ED37AA1E94329A2A05469D23A029D8195C9FD8D8875E0DD042496
20260807150000_reconcile_yarn_acl_and_recovery.sql 90D57D6C2FFDD091F4F46BE5E20D4628643399EAC6F6C719832C7156A19E677E
20260809165750_add_pattern_publication_audit.sql 882FBD2C323BE9197A8E31E0986B562A3B9DE5B98E058D9FB27FFDBD33C592AD
20260809185511_add_invited_registration_and_legal_acceptance.sql D06DB9841619605125E7ED1496F163AA9C174F83ED959DED9969CB2FFEC294C9
20260810120111_enforce_current_terms_for_private_data.sql A8C74274E8843E66E4532D6ED6C134298F7C4CB35CB9C62059DBBCC14300B14E
20260810123000_revoke_registration_invitation.sql 0376E9C998CD2A375FA9BCC6E98AC1F261E614D399FBA5BD06AE9123ECB689CB
20260812122131_add_recovery_grant_claim.sql A025A53CA7E12BC903AA484754F4D225B1378F4FBF18BE269568252D24324829
20260815152553_restore_recovery_grant_creator.sql CDC6B71A11881FF20C5CCAE0F958FF1603B24A2AEBF11573EBF25A488A3029D3
```

Szczegółowa mapa bieżącego checkoutu, wraz z rozdzieleniem grup scalonych i
historycznych odpowiedników RC, znajduje się w
[supabase-ledger-current-checkout-map-2026-08-16.md](supabase-ledger-current-checkout-map-2026-08-16.md).
