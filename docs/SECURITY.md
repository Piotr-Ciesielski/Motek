# Bezpieczeństwo

## Granica sekretów

- `.env` jest plikiem lokalnym, ignorowanym przez Git. Dokumentacja i testy mogą sprawdzać nazwy kluczy, ale nie powinny odczytywać ani wypisywać ich wartości.
- `SUPABASE_SECRET_KEY` pozostaje wyłącznie po stronie backendu i skryptów operatorskich. Nie trafia do HTML, JavaScriptu klienta ani odpowiedzi API.
- `SUPABASE_PUBLISHABLE_KEY` służy backendowemu klientowi Auth użytkownika. Frontend komunikuje się z API Motka, nie bezpośrednio z Supabase.
- Publiczny klient może otrzymać tylko niesekretne dane, między innymi klucz witryny Turnstile.
- Środowiska lokalne, staging i produkcja muszą mieć osobne sekrety. Lokalny `SUPABASE_URL` może wskazywać zdalny projekt, więc skrypt z zapisem zawsze wymaga sprawdzenia celu.

## Supabase: RLS, ACL i RPC

`profiles` i `yarns` mają włączone RLS. Polityki ograniczają odczyt i zmianę do `auth.uid()` właściciela oraz wymagają bieżącej akceptacji regulaminu. `patterns` jest wspólnym katalogiem, ale API katalogu nadal wymaga uwierzytelnienia i legal gate.

Bezpośrednie granty zapisu do prywatnych tabel i sekwencji są odebrane rolom `anon` i `authenticated`. Magazyn jest zmieniany przez wersjonowane funkcje `SECURITY DEFINER` z pustym `search_path`, jawnymi grantami `authenticated`, kontrolą właściciela, limitem 500 i ochroną przed utraconym zapisem.

Tabele schematu `private` przechowują liczniki wersji, granty recovery, zaproszenia i dane prawne. Publiczne role nie mają do nich dostępu. Operacje zaproszeń i finalizacji rejestracji są dostępne dla `service_role`; RPC recovery mają wyłącznie granty potrzebne do konkretnego etapu.

Migracje w `supabase/migrations/` i testy pgTAP są źródłem kontraktu. Zgodność sygnatury RPC nie zastępuje sprawdzenia definicji, ACL, RLS i ledgera migracji.

## Sesja i cookies

Tokeny dostępu, odświeżania, aktywności i recovery są przechowywane w cookies `HttpOnly`, `SameSite=Lax`. Publiczne wdrożenie wymaga `COOKIE_SECURE=true`, HTTPS, `TRUST_PROXY=true` i prawidłowego `APP_ORIGIN`.

Sesja wygasa domyślnie po 7200 sekundach bezczynności. Cookie aktywności jest podpisane HMAC i odrzuca zmieniony czas. `IDLE_SESSION_SECRET` może być osobnym sekretem; gdy go nie ma, backend używa `SUPABASE_SECRET_KEY`. W środowiskach publicznych zalecany jest osobny losowy `IDLE_SESSION_SECRET`.

Żądania zapisujące wymagają zaufanego originu. Wylogowanie, wygaśnięcie sesji i niepewny wynik krytycznej zmiany czyszczą cookies.

## Auth, limity i CAPTCHA

Publiczne wdrożenie nie uruchamia się bez włączonego Turnstile, klucza witryny, bezpiecznych cookies, zaufanego proxy i pełnej konfiguracji Supabase. Token CAPTCHA jest walidowany po stronie backendu dla rejestracji, logowania, resetu i zmiany hasła.

Limity żądań aplikacji:

| Operacja | Limit | Blokada |
| --- | --- | --- |
| Logowanie | 10 żądań / minutę | 1 minuta |
| Rejestracja | 3 żądania / minutę | 1 minuta |
| Żądanie resetu hasła | 3 / 15 minut, wspólnie dla IP i e-maila | 15 minut |
| Wymiana recovery | 5 / 10 minut na IP | 10 minut |
| Zmiana hasła | 30 / 15 minut | 15 minut |
| Odczyt katalogu | 60 / minutę | 1 minuta |
| Dopasowanie | 30 / minutę | 1 minuta |

Niezależnie od limitu żądań pięć nieudanych prób logowania blokuje klucz IP/e-mail, a pięć nieudanych prób usunięcia konta — klucz IP/identyfikator użytkownika, w obu przypadkach na 15 minut. Odpowiedź `429` zawiera `Retry-After`. Limity procesu uzupełniają, ale nie zastępują ochrony na brzegu Cloudflare/WAF.

## Zaproszenia i bramka prawna

Rejestracja działa tylko z ważnym, jednorazowym, wygasającym i odwoływalnym zaproszeniem przypisanym do e-maila. Pełny token jest pokazywany operatorowi raz; baza przechowuje jego SHA-256.

Frontend wymaga jawnej akceptacji bieżącego regulaminu i przekazuje wersje dokumentów. Backend ponownie waliduje token, e-mail, wersje i akceptację, a Supabase egzekwuje bramkę przez RLS i RPC.

Po zmianie regulaminu sesja pozostaje aktywna tylko dla informacji prawnych, ponownej akceptacji, wylogowania i usunięcia konta. Modyfikacja formularza w przeglądarce nie otwiera dostępu do danych.

Manifest dostawców ma status `verified`, a `npm run legal:check` zwraca `LEGAL_PUBLICATION=ready`. Ten wynik potwierdza kompletność publikacji prawnej, ale nie zezwala na migrację ani deploy.

## Hasła i recovery

Hasło ma 8–256 znaków oraz zawiera małą i wielką literę, cyfrę i znak specjalny. Zmiana hasła zalogowanego użytkownika wymaga bieżącego hasła i poprawnego CAPTCHA. Po sukcesie pozostałe sesje są unieważniane, a użytkownik loguje się ponownie.

Żądanie resetu zwraca taki sam komunikat niezależnie od istnienia konta. Recovery przyjmuje jednorazowy kod lub tokeny callbacku, tworzy podpisany grant ważny 10 minut i zapisuje w prywatnej tabeli hash JTI. Grant jest atomowo zajmowany, zwalniany po kontrolowanym błędzie albo zużywany po sukcesie. Powtórne użycie i zmienione cookie są odrzucane.

Supabase Free nie udostępnia funkcji Leaked Password Protection. Jest to znane ograniczenie; aplikacja nie udaje równoważnej ochrony. Kompensują je polityka złożoności, CAPTCHA, limity, neutralne komunikaty i unieważnianie sesji.

## Usunięcie konta

Użytkownik może usunąć konto także bez bieżącej akceptacji regulaminu. Operacja wymaga aktywnej sesji, ponownego podania poprawnego hasła i dokładnej frazy `USUŃ KONTO`.

Backend ponownie uwierzytelnia ten sam identyfikator użytkownika, a następnie usuwa konto Auth. Kaskady usuwają profil, akceptacje i prywatne włóczki. Zużyte zaproszenie i ograniczony log bezpieczeństwa mogą pozostać bez identyfikatora użytkownika zgodnie z retencją.

## Weryfikacja

```powershell
node --test test/auth.test.js test/server.test.js test/registration-policy.test.js test/registration-service.test.js
node --test test/account-deletion-policy.test.js test/account-deletion-service.test.js
node --test test/recovery-schema-migration.test.js test/legal-access-service.test.js test/legal-publication-policy.test.js
npm run legal:check
npm run lint
npm run check
npm audit --omit=dev --audit-level=moderate
npm run test:db
```

`npm run test:db` jest lokalnym replayem i nie potwierdza zdalnego ledgera. Przed migracją zdalną trzeba osobno zweryfikować target, backup, restore, zakres SQL i zgodę operatora.
