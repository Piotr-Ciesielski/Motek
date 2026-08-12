# Production Readiness — Three Tracks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Przygotować Motka do odpowiedzialnej decyzji o produkcji przez domknięcie dowodów prawnych dostawców, kontrolowaną weryfikację infrastruktury oraz realizację najważniejszych zabezpieczeń i braków produktowych.

**Architecture:** Prace są podzielone na trzy niezależne ścieżki: A — gotowość prawna, B — produkcja i infrastruktura, C — bezpieczeństwo operacyjne i zakres katalogu. Każda ścieżka ma własne pliki, testy, checkpoint Git i kryterium odbioru; wdrożenie produkcyjne pozostaje osobną decyzją po zakończeniu ścieżek A i B.

**Tech Stack:** Node.js 24, `node:test`, vanilla JavaScript, Supabase/PostgreSQL, pgTAP, Railway, Cloudflare, Docker, Nginx, GitHub Actions.

## Global Constraints

- Nie wykonywać zdalnej migracji, importu ani wdrożenia produkcji bez osobnej, wyraźnej zgody operatora.
- Nie oznaczać dostawcy jako `verified` na podstawie samego planu taryfowego.
- Nie publikować stałych okresów retencji, jeżeli nie wynikają z potwierdzonej konfiguracji i źródła dostawcy.
- Zachować fail-closed: `npm run legal:check` ma blokować produkcję przy niekompletnych danych.
- Nie stage’ować nieśledzonych lokalnych materiałów bez osobnej decyzji; szczególnie `Designs/`, `tools/` i lokalnych audytów.
- Prace agentów mają rozłączne zakresy zapisu; agenci nie modyfikują tych samych plików równolegle.

## Aktualizacja A1 — 2026-08-12

Odczytowo potwierdzono produkcyjny projekt Supabase `Motek Production` w
regionie `eu-north-1`, plan Free organizacji oraz produkcyjne środowisko
Railway z jedną repliką w `sfo` i domeną `www.rysia.org`. Produkcyjny Supabase
nie ma jeszcze migracji prawnych z 9–10 sierpnia, więc nie traktujemy go jako
zgodnego z bieżącym release candidate.

Manifest został rozszerzony o zakres środowisk `production-and-staging` dla
Supabase i Railway, ale dostawcy nadal są `unverified`. Cloudflare pozostaje
jednym dostawcą z dwoma zakresami usług: `edge` i `turnstile`. Edge obsługuje
DNS/proxy/TLS/WAF i cały ruch HTTP, a Turnstile sygnały antybotowe. Do obu
zakresów trzeba zebrać osobne dowody retencji, transferów, DPA/subprocesorów
i ochrony originu, ale bramka wymaga tylko jednego wpisu `cloudflare`.

---

## Ścieżka A — gotowość prawna dostawców

**Właściciel wykonawczy:** `motek_worker` dla manifestu i polityki; `motek_reviewer` dla niezależnej kontroli dowodów.

**Zakres plików:** `data/legal-data-providers.json`, `legal-publication-policy.js`, `legal-document.js`, `scripts/check-legal-publication.js`, testy `test/legal-*.test.js`, raport `docs/operations/legal-readiness-status-2026-08-11.md`.

### A1. Zbudować macierz dowodów produkcyjnych

Stan po odczycie 2026-08-12: potwierdzono techniczny zakres Supabase
Production/Staging (`eu-north-1`, plan Free), Railway Production/Staging
(Hobby, `sfo`, po jednej replice, domeny `www.rysia.org` i
`staging.rysia.org`) oraz rzeczywisty routing DNS/HTTPS Cloudflare. A1 nie jest
jeszcze zamknięte: brakuje datowanych dowodów transferów, ról, DPA,
subprocesorów i retencji dla konkretnych konfiguracji, a Cloudflare edge nie
obejmuje stagingu. Wymagane zakresy zapisano jako `edge=production` oraz
`turnstile=production-and-staging`.
Stwierdzono też rozjazd: lokalna migracja prawna odbiera dostęp do czterech
RPC magazynu, a produkcyjny Security Advisor nadal raportuje ich dostępność
dla `authenticated`. To pozostaje blokadą do osobnego, zatwierdzonego
porównania historii migracji i grantów.

- [ ] Dla Supabase potwierdzić osobno projekt produkcyjny: plan, region, zakres danych, retencję logów i kopii, usuwanie danych, transfery poza EOG, DPA i subprocesorów.
- [ ] Dla Railway potwierdzić plan Hobby, region wdrożenia produkcji, miejsce przetwarzania logów, retencję logów, zakres danych w logach, transfery, DPA i subprocesorów.
- [ ] Dla Cloudflare potwierdzić osobno dla zakresów `edge` i `turnstile`: plan Free, retencję, lokalizację przetwarzania, transfery, role Cloudflare, DPA i subprocesorów.
- [x] Cloudflare opisujemy jako jednego dostawcę z zakresami `edge` i `turnstile`; nie tworzymy osobnego wpisu `cloudflare-edge`.
- [ ] Zachować w manifeście adresy źródeł, datę weryfikacji i zakres środowiska, którego dowód dotyczy.
- [ ] Nie wpisywać do dokumentu wartości „30 dni” ani „90 dni”, dopóki nie ma źródła dla konkretnej konfiguracji Motka.

**Kryterium:** dla każdego dostawcy wiadomo, które fakty dotyczą stagingu, które produkcji, a które nadal wymagają potwierdzenia.

### A2. Zaostrzyć walidację manifestu

- [x] Dodać do `legal-publication-policy.js` wymaganie nie-placeholderowych pól `location`, `transfer` i `retention` dla produkcji.
- [x] Wymagać niepustego `evidence`, daty `verifiedAt` w formacie `YYYY-MM-DD` oraz statusu `verified`.
- [x] Wymagać zakresu dowodu (`evidenceScope`) oraz adresu `https:` do zatwierdzonej domeny dostawcy; sama obecność dowolnego linku nie może wystarczać.
- [x] Dla dostawcy z wieloma zakresami wymagać osobnych dowodów per zakres; Cloudflare pozostaje jednym dostawcą z `serviceEvidence.edge` i `serviceEvidence.turnstile`.
- [x] Dodać testy odrzucające dostawcę z uzupełnionym planem, ale bez potwierdzonego transferu albo retencji.
- [x] Zachować test, który nie ujawnia danych operatora w komunikacie błędu.

Stan po wykonaniu: produkcja nadal jest blokowana, ponieważ bieżący manifest
ma status `draft`, a wszyscy dostawcy pozostają `unverified`.

**Sprawdzenie:**

```powershell
node --test test/legal-publication-policy.test.js test/legal-readiness.test.js
npm run legal:check
```

Oczekiwany stan przed zebraniem dowodów: testy przechodzą, a `npm run legal:check` kończy się `LEGAL_PUBLICATION=not ready`.

### A3. Uzupełnić publiczny dokument prawny po akceptacji operatora

- [ ] Dodać do `legal-document.js` tylko zatwierdzoną listę dostawców, role, kategorie danych, przepływy, transfery i rzeczywistą retencję.
- [ ] Sprawdzić, że treść publiczna jest zgodna z manifestem i nie pokazuje danych stagingowych jako produkcyjnych.
- [ ] Uruchomić testy strony prawnej, layoutu, dokumentu i polityki publikacji.
- [ ] Uzyskać końcową akceptację operatora przed zmianą statusu dostawców na `verified`.

**Checkpoint:** `legal: verify production provider evidence`.

---

## Ścieżka B — produkcja i infrastruktura

**Właściciel wykonawczy:** `motek_worker` dla lokalnych konfiguracji i runbooka; działania zdalne wykonuje główny agent dopiero po zgodzie operatora. `motek_reviewer` sprawdza gotowość bez wykonywania wdrożenia.

**Zakres plików:** `railway.json`, `deploy/railway/`, `deploy/staging/`, `supabase/migrations/`, `supabase/tests/database/`, `scripts/regression/`, `docs/operations/post-deploy-regression.md`, `test/deployment-policy.test.js`, `test/railway-config.test.js`, `test/staging-config.test.js`.

### B1. Ustalić niezmienny release candidate

Stan po weryfikacji 2026-08-12: zaakceptowany technicznie kandydat stagingowy
to `staging@301469dfb19e576ac38034c269bdc1089b7690fd`, wersja
`2.0.0-alpha.39`. Railway staging działa z gałęzi `staging`, a produkcja z
`main`; oba środowiska mają po jednej replice w `sfo`. Produkcja nadal działa
na osobnym, wcześniejszym SHA. Dockerfile używa jawnej listy kopiowanych
ścieżek, więc nieśledzone materiały lokalne nie trafiają do obrazu. B1 jest
zamknięte technicznie dla stagingu, ale pozostaje otwarte jako decyzja
produkcyjna do czasu kontroli migracji i osobnej zgody operatora.

- [x] Potwierdzić branch, SHA i wersję aplikacji kandydata stagingowego.
- [ ] Potwierdzić zakres migracji przeznaczony do produkcji oraz plan jego bezpiecznego zastosowania.
- [x] Sprawdzić, że nieśledzone lokalne pliki nie wchodzą do artefaktu wdrożenia.
- [x] Uruchomić lokalnie pełne kontrole kodu i testy bazy bez kontaktu z produkcją.

Weryfikacja kandydata objęła `npm run check`, lint, formatowanie, testy bazy,
`git diff --check`, testy serwera 33/33, CI oraz pełną regresję po wdrożeniu.

```powershell
npm run check
npm run lint
npm run format:check
npm run test:db
git diff --check
```

### B2. Zweryfikować staging jako bramę przed produkcją

- [x] Wykonać migrację wyłącznie na kontrolowanym stagingu.
- [x] Sprawdzić `/health/live`, `/health/ready` i `/health/release`.
- [x] Uruchomić pełną regresję stagingu po wdrożeniu.
- [x] Potwierdzić, że regresja obejmuje logowanie, akceptację dokumentów, magazyn, ETag/If-Match, katalog, dopasowania i wylogowanie.
- [x] Zarchiwizować SHA, wynik migracji i wynik regresji w raporcie operacyjnym.
- [x] Odnotować różnicę między lokalnym replay migracji w CI a zastosowaniem migracji na zdalnym Supabase; zdalne zastosowanie potwierdzono osobnym odczytem stagingu.

**Kryterium:** staging działa z dokładnie tym samym artefaktem, który ma zostać zatwierdzony do produkcji.

### B3. Przygotować decyzję produkcyjną

- [ ] Zweryfikować produkcyjny projekt Supabase, kolejność migracji i plan odzyskania.
- [ ] Zweryfikować produkcyjny serwis Railway, domenę `www.rysia.org`, port, healthcheck i zmienne bez ujawniania sekretów.
- [ ] Zweryfikować Cloudflare DNS, proxy, TLS, WAF, cache i ukrycie originu.
- [ ] Nie włączać Cloudflare Access w tym etapie, ponieważ obecny workflow nie obsługuje jeszcze service-tokenów.
- [ ] Przygotować plan rollbacku do poprzedniego znanego SHA.
- [ ] Przed wykonaniem zdalnej migracji lub deployu przedstawić operatorowi zakres, ryzyko i komendę/akcję do zatwierdzenia.

**Kryterium:** istnieje pisemna decyzja „wdrażamy” albo „nie wdrażamy”, a nie domyślne przejście z stagingu do produkcji.

### B4. Wykonać produkcję tylko po osobnej zgodzie

- [ ] Zastosować migracje produkcyjne w kontrolowanej kolejności.
- [ ] Uruchomić deploy Railway z zatwierdzonego SHA.
- [ ] Wykonać smoke test produkcji: healthcheck, strona prawna, logowanie testowe, odczyt magazynu i wylogowanie.
- [ ] Rozszerzyć ręczny smoke o niedestrukcyjny zapis, edycję i usunięcie dokładnie utworzonej włóczki; rollback Railway nie cofa migracji Supabase.
- [ ] W razie niepowodzenia zatrzymać dalsze działania i zastosować wcześniej zatwierdzony rollback.

**Checkpoint:** `ops: verify production release <SHA>`.

---

## Ścieżka C — bezpieczeństwo operacyjne i zakres produktu

**Właściciel wykonawczy:** osobne zadania `motek_worker` z rozłącznymi zakresami; `motek_reviewer` wykonuje przegląd końcowy.

### C1. Rate limiting i monitoring Auth — przed produkcją

**Zakres:** `deploy/staging/nginx/templates/default.conf.template`, `deploy/staging/.env.staging.example`, `limits.js`, `observability.js`, `server.js`, `test/proxy-policy.test.js`, `test/observability.test.js`, `test/staging-config.test.js`.

Stan rozpoznany przez audyt: stagingowy Nginx ma wspólny limit `20 r/m` z
`burst=10` dla ścieżek Auth, a limiter aplikacyjny działa w pamięci procesu.
Przy wielu replikach Railway nie zapewnia on wspólnego licznika.

Aktualny odczyt lokalny przed zmianą: logowanie, rejestracja i reset hasła
korzystały ze wspólnego limitu aplikacyjnego `30 żądań/min`, a blokada po `5`
nieudanych próbach trwała `15 min`, po kluczu IP i e-maila. Recovery ma osobny
limit żądań, a zaproszenia nie mają publicznej trasy Auth. Stagingowy reverse
proxy stosował wspólny limit `20r/m` z `burst=10` dla logowania, rejestracji i
resetu hasła. Metryki Prometheus obejmowały żądania, czas odpowiedzi, readiness
i alerty 5xx, ale produkcja ma obecnie `METRICS_ENABLED=false`.

- [x] Zmapować obecne limity aplikacyjne dla logowania, rejestracji, resetu hasła i zaproszeń.
- [x] Dodać ograniczenia na reverse proxy dla tych samych ścieżek, bez blokowania healthchecków i legal page.
- [x] Ustalić z operatorem wartości progów i okno czasowe; zapisać je w konfiguracji i testach.
- [x] Dodać bezpieczne, niesekretne metryki liczby odrzuceń i błędów Auth.
- [x] Sprawdzić, że logi nie zawierają haseł, tokenów, pełnych ciasteczek ani sekretów.
- [x] Ustalić osobne progi dla logowania, rejestracji, resetu hasła i recovery; nie kopiować automatycznie jednego limitu `20 r/m` na wszystkie operacje.

Decyzja operatora przyjęta: login `10/min/IP`, rejestracja `3/min/IP`, żądanie
resetu hasła `3/15 min/IP+email`, recovery `5/10 min/IP`, a blokada po `5`
nieudanych próbach pozostaje na `15 min`. Limiter aplikacyjny działa w pamięci
procesu; Nginx stosuje przybliżenie brzegowe. Metryka aplikacyjna nie obejmuje
429 wygenerowanych przez Nginx.

### C2. HTTPS, HSTS i nagłówki — przed produkcją

**Zakres:** konfiguracja proxy Cloudflare/Railway, `deploy/staging/nginx/`, `test/proxy-policy.test.js`, `test/deployment-policy.test.js`, dokumentacja runbooka.

Stan rozpoznany przez audyt: HTTPS i przekierowanie HTTP→HTTPS są przygotowane
dla stagingu, ale `Strict-Transport-Security` nie jest obecnie egzekwowane.

Odczyt lokalny potwierdził wymaganie `APP_ORIGIN=https://...`, bezpieczne
cookies oraz nagłówki CSP, `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy`, COOP i CORP. HSTS pozostaje wyłączone
do czasu zewnętrznego potwierdzenia produkcyjnego HTTPS i wszystkich subdomen.

- [ ] Potwierdzić wymuszanie HTTPS na domenie produkcyjnej.
- [ ] Włączyć HSTS dopiero po potwierdzeniu, że wszystkie ścieżki i subdomeny są dostępne przez HTTPS.
- [ ] Zacząć od `max-age=86400` bez `includeSubDomains`; zwiększać zakres dopiero po osobnej weryfikacji wszystkich subdomen.
- [ ] Zachować wyjątki dla lokalnego developmentu i stagingu, jeżeli są wymagane przez istniejące testy.
- [ ] Zweryfikować CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` i bezpieczne cookies.

### C3. WAF, DDoS i origin — przed publicznym udostępnieniem

**Zakres:** Cloudflare dashboard/runbook, `docs/operations/post-deploy-regression.md`, testy konfiguracji i checklisty operacyjne.

Staging ma ModSecurity/OWASP CRS, ale nie jest to dowód, że publiczny origin
Railway nie może ominąć Cloudflare. Cloudflare Access pozostaje wyłączony,
ponieważ obecny workflow regresji nie obsługuje service-tokenów.

Odczyt lokalny potwierdził przypięty obraz WAF, limity połączeń i Auth,
blokadę publicznych metryk, prywatną sieć Prometheusa oraz nadpisywanie
`X-Forwarded-For`. Nie potwierdza to jeszcze produkcyjnego DNS/proxy,
ukrycia originu Railway, reguł WAF ani alertów.

- [ ] Potwierdzić, że DNS/proxy Cloudflare wskazuje na origin Railway i że origin nie jest publicznie omijany.
- [ ] Ustawić i udokumentować reguły WAF oraz limity brzegowe dla Auth, API i dużych żądań.
- [ ] Zdefiniować alerty, kontakt operatora i procedurę reakcji na skok ruchu albo atak.
- [ ] Wykonać tylko bezpieczne testy smoke; testy obciążeniowe i zmiany WAF wymagają osobnej zgody.

### C4. Katalog wzorów — po zabezpieczeniu bram produkcyjnych

**Zakres:** `data/pattern-content-audit.json`, `data/patterns-import.json`, `scripts/build-pattern-import.py`, `scripts/import-patterns.js`, `test/pattern-catalog-data.test.js`, `test/import-patterns.test.js`.

Aktualny manifest ma 106 rekordów `hidden`, 0 `published` i 0
`pending_review`. API filtruje wyłącznie `published`, więc po bezpiecznym
imporcie katalog pozostaje pusty do czasu jawnej publikacji zweryfikowanych
rekordów.

- [ ] Wybrać następne wzory wymagające kompletnych wymagań zużycia.
- [ ] Dla każdego wzoru uzupełnić wyłącznie potwierdzone warianty, materiały, metry/gramy, role i alternatywy.
- [ ] Utrzymać `hidden` albo `pending_review` do czasu osobnej decyzji audytowej.
- [ ] Uruchomić kontrolę danych bez importu, a import wykonawczy wykonać dopiero po osobnej zgodzie.

**Checkpoint:** `feat: extend verified pattern requirements`.

### C5. Zmierzyć koszt rankingu przed skalowaniem

**Zakres:** `limits.js`, `server.js`, `server/matching-service.js`, `test/limits.test.js`, `test/matching-service.test.js`, `test/server.test.js`.

- [ ] Przygotować benchmark dla magazynu 500 włóczek, katalogu 300 wzorów i maksymalnego limitu wariantów.
- [ ] Zmierzyć czas odpowiedzi, pamięć i zachowanie przy pełnym limicie wyszukiwania.
- [ ] Zapisać wynik jako kryterium decyzji; worker lub kolejka pozostają odłożone, jeśli benchmark nie pokaże realnego problemu.

**Kryterium:** decyzja „worker potrzebny” albo „worker odłożony” wynika z pomiaru, a nie z założenia.

## Punkt kontrolny sesji — 2026-08-11

Na dziś przyjęto, że obecna architektura Motka jest właściwa dla małej,
prywatnej grupy i obecnych planów Supabase Free, Railway Hobby oraz Cloudflare
Free. Nie dodajemy Redis, kolejki, workera, Supabase Edge Functions, Cloudflare
Workers ani płatnego systemu monitoringu bez konkretnego pomiaru, incydentu lub
wymagania prawnego.

Utrzymujemy jedną replikę Railway, dane użytkowników w Supabase, ochronę
brzegową Cloudflare oraz lokalne ograniczenia aplikacji. Przed produkcją trzeba
jeszcze udokumentować ręczny backup/odtworzenie Supabase, ponieważ plan Free nie
zapewnia automatycznych backupów, oraz potwierdzić, że origin Railway nie omija
Cloudflare.

Stan końcowy dnia:

- plan trzech ścieżek jest zapisany;
- nie wykonano żadnej zdalnej migracji ani wdrożenia produkcyjnego;
- `npm run legal:check` nadal blokuje publikację z powodu niezweryfikowanych
  dostawców;
- następny krok: ścieżka A1 — zebranie dowodów produkcyjnych Supabase,
  Railway i Cloudflare; bramka A2 jest gotowa do użycia fail-closed.

---

## Kolejność i wykorzystanie zespołu

1. `motek_explorer` — analiza dowodów prawnych, produkcji i bezpieczeństwa; raporty tylko do odczytu.
2. Decyzje operatora — zatwierdzenie treści prawnej, progów rate limitingu, zakresu WAF i gotowości produkcji.
3. `motek_worker` A — manifest/polityka prawna; `motek_worker` B — runbook i lokalna gotowość produkcji; `motek_worker` C — zabezpieczenia operacyjne. Zapisy mogą być równoległe tylko dla rozłącznych plików.
4. `motek_reviewer` — niezależna kontrola każdego checkpointu: wymagania, bezpieczeństwo, regresje i kompletność dowodów.
5. Główny agent — integracja, pełne testy, propozycja commitów oraz osobne pytanie o migrację/deploy produkcji.

## Completion Gate

Plan jest zakończony dopiero wtedy, gdy:

- `npm run legal:check` przechodzi dla konfiguracji produkcyjnej;
- Supabase, Railway i Cloudflare mają potwierdzone dane, dowody i daty weryfikacji;
- staging przechodzi pełną regresję na release candidate;
- produkcyjne HTTPS/HSTS, WAF, rate limiting, monitoring i rollback są udokumentowane;
- katalog nie publikuje niezaudytowanych treści;
- operator osobno zatwierdził albo odrzucił wdrożenie produkcyjne.
