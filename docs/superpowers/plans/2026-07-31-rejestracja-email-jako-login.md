# Rejestracja z adresem e-mail jako loginem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uprościć zakładanie konta do adresu e-mail i hasła, używać adresu e-mail jako loginu oraz usunąć dane imienia i nazwiska z aplikacji i Supabase.

**Architecture:** Zachowujemy kolumnę `public.profiles.login` dla kompatybilności, ale wymuszamy w bazie, aby była znormalizowaną kopią `profiles.email`. Formularz wysyła pole `login`; serwer normalizuje je jako e-mail i przekazuje tę samą wartość do Supabase Auth oraz metadanych profilu. Jedna nowa migracja aktualizuje istniejące profile, zabezpiecza synchronizację e-maila, usuwa `full_name` z profilu i czyści je z metadanych Auth.

**Tech Stack:** Vanilla JavaScript, Node.js `node:test`, Supabase Auth, PostgreSQL migrations, Markdown documentation.

## Global Constraints

- Etykieta pola rejestracji musi brzmieć dokładnie `Login (Twój e-mail)`.
- Adres e-mail jest normalizowany przez `trim()` i `toLowerCase()`.
- Login i e-mail profilu muszą mieć tę samą wartość.
- Nowa rejestracja nie może zbierać ani zapisywać `full_name`.
- Istniejące `full_name` zostaje usunięte z `profiles` i `auth.users.raw_user_meta_data`.
- Nie zmieniamy zasad haseł, sesji, resetu hasła ani danych magazynu włóczek.
- Nie stage'ujemy ani nie modyfikujemy plików niezwiązanych z funkcją.

---

### Task 1: Zabezpieczyć kontrakt walidacji i rejestracji testami

**Files:**
- Modify: `test/auth.test.js`
- Modify: `test/server.test.js`

**Interfaces:**
- Consumes: istniejące funkcje `normalizeAuthEmail`, `normalizeAuthLogin` oraz testowy klient Supabase.
- Produces: testy opisujące nowy kontrakt, które początkowo failują na obecnej implementacji.

- [ ] **Step 1: Dodać test walidacji e-maila jako loginu**

W `test/auth.test.js` zmienić test normalizacji loginu tak, aby oczekiwał adresu e-mail, oraz dodać przypadek odrzucający dawny login `Piotr_01` przez `normalizeAuthLogin`.

```js
test("normalizacja Auth traktuje login jako adres e-mail", () => {
  assert.equal(normalizeAuthLogin("  JAN+test@Domena.pl  "), "jan+test@domena.pl");
});

test("walidacja Auth odrzuca login bez formatu e-mail", () => {
  assert.throws(() => normalizeAuthLogin("Piotr_01"), /prawidłowy adres/);
});
```

- [ ] **Step 2: Dodać test rejestracji z jednym polem loginu**

W teście endpointu `/api/auth/register` wysłać `login: "  NOWY@EXAMPLE.COM "` bez `email` i `full_name`. Rozszerzyć atrapę `signUp`, aby zapisała wywołanie, a następnie sprawdzić, że do Auth trafiło `email: "nowy@example.com"`, a `options.data.login` ma tę samą wartość. Odpowiedź użytkownika ma zawierać `metadata: { login: "nowy@example.com" }` bez `fullName`.

- [ ] **Step 3: Uruchomić testy i potwierdzić oczekiwane RED**

Run: `node --test test/auth.test.js test/server.test.js`

Expected: FAIL, ponieważ obecna funkcja loginu nadal akceptuje tylko dawny format, a endpoint wymaga osobnego `email` i zapisuje `full_name`.

- [ ] **Step 4: Zatwierdzić tylko testy jako etap RED**

```powershell
git add test/auth.test.js test/server.test.js
git commit -m "test: define email login registration contract"
git push origin feat/frontend-design-refresh
```

### Task 2: Zmienić backend rejestracji i odpowiedź użytkownika

**Files:**
- Modify: `server.js:352-383,392-402,1137-1173`
- Modify: `test/auth.test.js`
- Modify: `test/server.test.js`

**Interfaces:**
- Consumes: pole `login` z formularza oraz funkcje normalizacji e-maila.
- Produces: `POST /api/auth/register` przyjmujące `{ login, password }`, wywołujące `signUp({ email: login, options: { data: { login } } })` i odpowiedź bez `fullName`.

- [ ] **Step 1: Zmienić `normalizeAuthLogin` na walidację adresu e-mail**

Zachować publiczną nazwę funkcji używaną przez testy, ale delegować do tej samej walidacji co `normalizeAuthEmail`, aby login i e-mail miały identyczną normalizację oraz komunikat błędu.

- [ ] **Step 2: Usunąć `normalizeFullName` z rejestracji i sanitizacji Auth**

Nie odczytywać `user_metadata.full_name` w `sanitizeAuthUser`. Endpoint rejestracji nie może pobierać ani przekazywać `body.full_name` do Supabase.

- [ ] **Step 3: Przepiąć endpoint rejestracji na `body.login`**

Ustawić `const email = normalizeAuthLogin(body.login);` i `const login = email;`. Przekazać do `auth.signUp` tylko `email`, `password` oraz `options.data.login`.

- [ ] **Step 4: Uruchomić testy kontraktu**

Run: `node --test test/auth.test.js test/server.test.js`

Expected: PASS dla testów walidacji i rejestracji; istniejące testy logowania oraz resetu hasła pozostają PASS.

- [ ] **Step 5: Zatwierdzić backend**

```powershell
git add server.js test/auth.test.js test/server.test.js
git commit -m "feat: use email as account login"
git push origin feat/frontend-design-refresh
```

### Task 3: Zaktualizować formularz i ekran konta

**Files:**
- Modify: `index.html:98-127`
- Modify: `app.js:1728-1746`

**Interfaces:**
- Consumes: endpoint rejestracji przyjmujący `login` jako e-mail oraz profil bez `full_name`.
- Produces: formularz z jednym identyfikatorem, którego etykieta brzmi `Login (Twój e-mail)`, bez pola imienia i nazwiska oraz bez wyświetlania tej wartości.

- [ ] **Step 1: Dodać test/automatyczną kontrolę kontraktu HTML**

Przed zmianą potwierdzić wyszukiwaniem, że `index.html` zawiera trzy stare elementy (`register-email`, `register-full-name`, stary opis loginu); po zmianie kontrola ma potwierdzić obecność dokładnej etykiety i brak nazw starych pól.

- [ ] **Step 2: Zmienić pole loginu na pole e-mail**

Ustawić `type="email"`, `maxlength="254"`, `autocomplete="email"` i opis pomocniczy `Adres e-mail będzie Twoim loginem.`. Zachować `name="login"`, aby `FormData` wysłała właściwy klucz.

- [ ] **Step 3: Usunąć osobne pole e-mail i pole imienia i nazwiska**

Formularz rejestracji ma wysyłać tylko `login` i `password`.

- [ ] **Step 4: Usunąć renderowanie imienia i nazwiska**

W `renderAuthState` wyświetlać adres profilu albo komunikat zastępczy, bez gałęzi zależnej od `profile.full_name`.

- [ ] **Step 5: Sprawdzić składnię i kontrakt UI**

Run: `node --check app.js`; następnie `rg -n "register-email|register-full-name|full_name|Imię i nazwisko|^\s*Login$" index.html app.js`.

Expected: składnia PASS, brak starych pól i starego opisu w formularzu.

- [ ] **Step 6: Zatwierdzić UI**

```powershell
git add index.html app.js
git commit -m "ui: simplify registration identity fields"
git push origin feat/frontend-design-refresh
```

### Task 4: Przygotować i zweryfikować migrację Supabase

**Files:**
- Create: the single SQL file generated in `supabase/migrations/` by `supabase migration new email_login_and_remove_full_name`

**Interfaces:**
- Consumes: obecne `public.profiles`, `auth.users`, funkcje `handle_new_user` i `sync_profile_email` z migracji `20260724000000_create_profiles_auth.sql`.
- Produces: schemat, w którym login jest znormalizowanym e-mailem, nowe profile nie mają `full_name`, a historyczne wartości są usunięte.

- [ ] **Step 1: Sprawdzić CLI i dostępne komendy**

Run: `supabase --version`; `supabase migration --help`; `supabase db --help`.

Expected: potwierdzenie wersji CLI i dostępnych poleceń bez zmiany bazy.

- [ ] **Step 2: Utworzyć plik migracji przez CLI**

Run: `supabase migration new email_login_and_remove_full_name`

Expected: jeden nowy plik SQL w `supabase/migrations`.

- [ ] **Step 3: Dodać migrację danych i ograniczeń**

Migracja ma wykonać w tej kolejności:

```sql
update public.profiles as p
set email = lower(trim(u.email)),
    login = lower(trim(u.email))
from auth.users as u
where p.id = u.id
  and u.email is not null
  and trim(u.email) <> '';

alter table public.profiles
  drop constraint if exists profiles_login_check;

alter table public.profiles
  add constraint profiles_login_email_check
  check (login = email and login ~ '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$');
```

Następnie zastąpić `handle_new_user`, aby insert obejmował tylko `id, login, email, avatar_url`, oraz ustawić `normalized_login` z `new.email` zamiast z metadanych loginu. Zastąpić `sync_profile_email`, aby przy zmianie e-maila ustawiać jednocześnie `email` i `login`. Cofnąć `grant update (login, full_name, avatar_url)` i nadać `grant update (avatar_url)` dla `authenticated`.

- [ ] **Step 4: Wyczyścić dane osobowe i usunąć kolumnę**

Po zastąpieniu funkcji triggera wykonać:

```sql
update auth.users
set raw_user_meta_data = raw_user_meta_data - 'full_name'
where raw_user_meta_data ? 'full_name';

alter table public.profiles drop column if exists full_name;
```

Kolejność zapobiega temu, aby trigger tworzenia profilu nadal próbował zapisywać do usuniętej kolumny.

- [ ] **Step 5: Sprawdzić SQL statycznie i lokalnie, jeśli Supabase jest uruchomiony**

Run: `supabase db lint` (jeśli dostępne po sprawdzeniu `supabase db --help`) oraz `supabase migration list --local`.

Expected: brak błędów składni i migracja widoczna jako nowa, bez wykonywania zdalnego usunięcia danych na tym etapie.

- [ ] **Step 6: Zastosować migrację w zdalnym Supabase po końcowej kontroli zakresu**

Przed wykonaniem sprawdzić `supabase link --help`, status projektu i diff migracji. Następnie użyć wyłącznie zatwierdzonego przez CLI polecenia push, np. `supabase db push` jeśli jest dostępne.

Zakres zmiany wysokiego ryzyka jest ograniczony do: `profiles.login`, `profiles.email`, klucza `full_name` w metadanych Auth oraz kolumny `profiles.full_name`. Nie usuwa użytkowników, haseł, sesji ani danych włóczek.

- [ ] **Step 7: Zweryfikować rezultat zapytaniami kontrolnymi**

Sprawdzić, że:

```sql
select count(*) from public.profiles where login <> email;
select count(*) from auth.users where raw_user_meta_data ? 'full_name';
select count(*) from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name = 'full_name';
```

Expected: wszystkie trzy wyniki `0`, co potwierdza zgodność loginów z e-mailami, brak klucza `full_name` w metadanych Auth i brak kolumny `profiles.full_name`.

- [ ] **Step 8: Zatwierdzić migrację**

```powershell
git add supabase/migrations
git commit -m "db: use email as profile login"
git push origin feat/frontend-design-refresh
```

### Task 5: Aktualizacja dokumentacji i pełna weryfikacja

**Files:**
- Modify: `README.md` sekcje Auth/API i bezpieczeństwo danych
- Modify: `SPEC.md` sekcje zakresu konta i API rejestracji
- Modify: `CHANGELOG.txt` wpis bieżącej wersji

**Interfaces:**
- Consumes: finalny kontrakt formularza, endpointu i schematu Supabase.
- Produces: dokumentacja zgodna z zachowaniem aplikacji i migracją.

- [ ] **Step 1: Zaktualizować README**

Opisać, że rejestracja wymaga adresu e-mail i hasła, adres e-mail jest loginem, a aplikacja nie zbiera imienia i nazwiska. Zaktualizować ewentualny przykład payloadu `/api/auth/register` z `email/login/full_name` do `login/password`.

- [ ] **Step 2: Zaktualizować SPEC**

Usunąć sprzeczne wymagania osobnego loginu i imienia oraz opisać synchronizację `profiles.login = profiles.email`.

- [ ] **Step 3: Dodać wpis do CHANGELOG**

Dodać wpis opisujący uproszczony formularz, login jako e-mail i usunięcie imion i nazwisk z profilu.

- [ ] **Step 4: Uruchomić pełny zestaw kontroli**

Run: `npm run check`; `git diff --check`; `rg -n "full_name|fullName|register-email|register-full-name|Login\\s*</|Login$" index.html app.js server.js README.md SPEC.md`.

Expected: `npm run check` PASS, brak błędów whitespace, brak użycia usuniętego pola w aktywnym kodzie i dokumentacji.

- [ ] **Step 5: Sprawdzić stan Git i synchronizację z GitHub**

Run: `git status --short --branch`; `git fetch origin`; `git rev-parse HEAD`; `git rev-parse origin/feat/frontend-design-refresh`.

Expected: lokalny `HEAD` i zdalna gałąź wskazują ten sam commit, a katalog roboczy jest czysty poza ewentualnymi zmianami niezwiązanymi z funkcją, które zostaną jawnie opisane.

- [ ] **Step 6: Zatwierdzić dokumentację i finalny stan**

```powershell
git add README.md SPEC.md CHANGELOG.txt
git commit -m "docs: document email-based account login"
git push origin feat/frontend-design-refresh
```
