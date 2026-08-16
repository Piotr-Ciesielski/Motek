# Supabase Security Advisors — odczyt 2026-08-16

## Zakres

Wykonano wyłącznie odczyt raportów Security Advisors dla projektów Motka.
Nie wykonywano SQL, migracji, zmian Auth, RLS, RPC ani ustawień projektu.

Projekty:

- Production: `vueotocjsgzosqzhcish`;
- Staging: `rprhbmtabwjsenvfgicg`.

## Wspólne ostrzeżenia `WARN`

W obu środowiskach advisor zgłasza, że zalogowani użytkownicy mogą wykonywać
funkcje `SECURITY DEFINER` w schemacie `public` przez RPC Data API:

- `create_auth_recovery_grant()`;
- `claim_auth_recovery_grant(text)`;
- `release_auth_recovery_grant(text)`;
- `consume_auth_recovery_grant(text)`;
- `get_yarn_store_version()`;
- `insert_yarn_versioned(...)`;
- `update_yarn_versioned(...)`;
- `delete_yarn_versioned(...)`;
- `has_current_terms_acceptance()`.

To nie jest automatycznie dowód podatności: obecny kontrakt aplikacji celowo
korzysta z części tych RPC jako kontrolowanego API dla `authenticated`, a
funkcje mają dodatkowe kontrole właściciela, sesji i wersji. Jest to jednak
realny punkt przeglądu bezpieczeństwa, ponieważ Supabase rekomenduje ograniczać
wykonywanie funkcji `SECURITY DEFINER`, przenosić je poza eksponowany schemat
albo bardzo dokładnie ograniczać ich uprawnienia i wejścia.

Nie zmieniać tego kontraktu ad hoc. Przed ewentualną zmianą trzeba wykonać
pełny przegląd wywołań aplikacji, uprawnień `anon`/`authenticated`, negatywnych
przypadków RPC i testów regresji.

Źródło remediacji: <https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable>.

## Ochrona przed wyciekłymi hasłami

Oba projekty zgłaszają:

- `auth_leaked_password_protection` — `WARN`;
- ochrona przed hasłami znalezionymi w bazie HaveIBeenPwned jest wyłączona.

To jest osobna zmiana ustawienia Supabase Auth. Nie włączano jej bez decyzji
operatora, ponieważ może zmienić zachowanie rejestracji i zmiany haseł dla
użytkowników używających haseł znajdujących się w bazie wycieków.

Źródło remediacji: <https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection>.

## Dodatkowe informacje stagingu

Staging zgłasza także `INFO`:

- `private.auth_recovery_grants` ma włączone RLS, ale nie ma polityk;
- `public.patterns` ma włączone RLS, ale nie ma polityk.

Samo `INFO` nie oznacza publicznego dostępu. Trzeba je oceniać razem z
uprawnieniami schematu, bezpośrednim dostępem Data API i wywołaniami RPC.
Dodanie polityk bez potwierdzenia modelu dostępu może zablokować backend lub
przypadkowo rozszerzyć dostęp.

Źródło remediacji: <https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy>.

## Wniosek operacyjny

Raport nie daje podstaw do automatycznej zmiany produkcji. Pozostają trzy
oddzielne decyzje:

1. czy utrzymujemy celowy publiczny kontrakt RPC dla `authenticated`, czy
   przygotowujemy osobny hardening schematu i uprawnień;
2. czy włączamy ochronę przed wyciekłymi hasłami w Production i Staging;
3. czy dla tabel stagingu przygotowujemy polityki RLS jako obronę warstwową,
   po potwierdzeniu pełnego modelu dostępu.

Do czasu tych decyzji nie wykonywać zdalnych zmian. Stan produkcji pozostaje
`NO-GO` także z powodu wcześniejszych blokad legal-readiness, strony prawnej,
anonimowego katalogu, backupu/restore i konfiguracji originu/cache.
