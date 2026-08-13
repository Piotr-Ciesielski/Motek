# Stan gotowości prawnej i postęp prac — 2026-08-11

Ten raport jest bieżącym punktem odniesienia dla prac nad regulaminem,
informacją o prywatności i rejestrem dostawców. Nie zastępuje przeglądu
prawnego przez operatora.

## Kanoniczny release candidate — 2026-08-13

Bieżący rekord wydania znajduje się w [`staging-status-2026-08-07.md`](staging-status-2026-08-07.md): branch `release/motek-recovery-rc`, pełny SHA `504d33ba8becd4e596f7451b3ce7f40bf972e1fc`, wersja `2.0.0-alpha.39`. Staging i produkcja są `NOT CONFIRMED` na tym SHA. `LEGAL_PUBLICATION=not ready`; brak zewnętrznych dowodów.

## Aktualizacja stanu — 2026-08-12

W ramach punktu A1 odczytowo potwierdzono konfigurację produkcyjną:

- Supabase Production (`Motek Production`) jest aktywny, działa w regionie
  `eu-north-1`, a organizacja ma plan Free. Staging działa w tym samym regionie.
- Railway Production ma osobne środowisko, jedną replikę w regionie `sfo`,
  domenę `www.rysia.org`, plan Hobby i ostatni odczytany deployment zakończony
  statusem `SUCCESS` z SHA `c4b777a5f8a96277c0e7fb7ca6ec52d425a0900b`.
- Bieżący odczyt konfiguracji Railway potwierdził, że staging korzysta z
  gałęzi `staging`, domeny `staging.rysia.org` i jawnego healthchecka
  `/health/ready`; produkcja korzysta z gałęzi `main`, domeny `www.rysia.org`
  i jednej repliki `sfo`. Pole healthchecka nie było widoczne w odpowiedzi
  konfiguracji produkcji, ale logi builda ostatniego wdrożenia potwierdziły
  udane sprawdzenie `/health/ready` także dla produkcji.
- Produkcyjny Supabase ma zastosowane migracje tylko do
  `20260807114728_document_recovery_grants_no_client_policy`; późniejsze
  migracje prawne z 9–10 sierpnia nie zostały jeszcze wdrożone.
- Supabase Security Advisor zgłasza ostrzeżenia dla czterech wersjonowanych RPC
  `SECURITY DEFINER` dostępnych roli `authenticated` oraz wyłączoną ochronę
  przed wyciekłymi hasłami. Ochrona haseł jest ograniczeniem planu Free;
  dostępność RPC wymaga osobnego przeglądu, nie automatycznej zmiany.

Manifest został uzupełniony o zakres `production-and-staging` dla Supabase i
Railway oraz o potwierdzony produkcyjny region Supabase. Dostawcy nadal mają
status `unverified`, ponieważ nie potwierdzono jeszcze transferów, pełnej
retencji, DPA/subprocesorów ani zakresu Cloudflare DNS/proxy/WAF/TLS.

Walidacja bramki została zaostrzona: zweryfikowany dostawca musi mieć
potwierdzony zakres produkcyjny, lokalizację, transfer, retencję i zakres
dowodu, co najmniej jeden dowód HTTPS z zatwierdzonej domeny oraz prawidłową,
nieprzyszłą datę `verifiedAt`. Nieznani dostawcy i nieznane środowisko
wdrożenia również blokują produkcję. Wartości typu „do uzupełnienia” i „do
potwierdzenia” są odrzucane.

Weryfikacja zakresów Cloudflare jest teraz rozdzielona wewnątrz jednego wpisu
dostawcy: `edge` i `turnstile` muszą mieć własne lokalizacje, transfery,
retencje, zakresy dowodów, źródła i daty weryfikacji. Nie powstaje osobny
dostawca `cloudflare-edge`.

## Odczyt źródeł i konfiguracji — 2026-08-12

Odczyt Supabase potwierdził bezpośrednio w panelu/API:

- `Motek Production` i `Motek Staging` są aktywne i zdrowe w regionie
  `eu-north-1`;
- organizacja `Piotr Ciesielski` działa na planie Free;
- produkcja ma zastosowane migracje tylko do
  `20260807114728_document_recovery_grants_no_client_policy`;
- Security Advisor produkcji nadal zgłasza cztery funkcje `SECURITY DEFINER`
  dostępne dla `authenticated` oraz wyłączoną ochronę przed wyciekłymi
  hasłami; wykryto także informacyjnie nieużywany indeks.

To nie jest wyłącznie ostrzeżenie dokumentacyjne: lokalna migracja
`20260810120111_enforce_current_terms_for_private_data.sql` zawiera odebranie
wykonania tych czterech RPC rolom `public`, `anon` i `authenticated`, ale
zdalny advisor nadal widzi je jako dostępne dla `authenticated`. Oznacza to
rozjazd między lokalnym checkoutem a produkcyjną bazą albo brak zastosowania
migracji. Przed jakąkolwiek publikacją trzeba osobno porównać historię i
uprawnienia; nie wykonano automatycznej naprawy zdalnej.

Odczyt historii migracji stagingu potwierdził zastosowanie czterech migracji
prawnych: publikacji audytu wzorów, rejestracji zaproszonej i akceptacji prawa,
egzekwowania bieżących warunków dla danych prywatnych oraz unieważniania
zaproszeń. Produkcja nie ma tych migracji. Jest to oczekiwany stan stagingu,
ale jednocześnie blokada do osobno zatwierdzonego porównania i wdrożenia
migracji produkcyjnych.

Odczyt publicznego DNS i HTTPS potwierdził dodatkowo: `www.rysia.org` ma
rekordy A Cloudflare i odpowiedź `Server: cloudflare`, natomiast
`staging.rysia.org` jest CNAME do Railway i odpowiada z `Server:
railway-hikari`. W manifeście oznacza to zakres `edge` tylko dla produkcji,
a zakres `turnstile` dla produkcji i stagingu.

## Historyczne odczyty wdrożeń — 2026-08-12

Poniższe odczyty są historyczne i nie opisują bieżącego release candidate:

- ostatnio odczytany udany deployment stagingu ma identyfikator Railway
  `7e4b790d-7b09-4c11-811e-d4a0e82d9605` z 11 sierpnia i commit
  `f118c84` (`fix: keep session before legal acceptance`);
- ostatnio odczytany udany deployment produkcji ma identyfikator Railway
  `551aa616-a3e9-4b85-9e98-7cf15630b6d3` z 8 sierpnia i commit
  `c4b777a` (`ui: align auth action typography`);
- oba środowiska mają po jednej replice w `sfo`; logi ostatnich wdrożeń
  potwierdzają udany healthcheck `/health/ready` dla stagingu i produkcji;
- bieżący checkout `e739ce6` nie jest jeszcze wdrożony; staging i produkcja
  działają więc na starszych, dokładnie zidentyfikowanych artefaktach.
- Dockerfile kopiuje jawnie pliki aplikacji, `client`, `server`, `assets` i
  `VERSION`, więc nieśledzone `Designs/`, `tools/` ani audyty nie są częścią
  obrazu.

Wniosek historyczny: wcześniejsze odczyty nie potwierdzały jednego kandydata.
Bieżący kandydat i jego status są określone wyłącznie w kanonicznym rekordzie.

## Analiza integracyjna alpha.39 — 2026-08-12

Porównanie wdrożonego stagingu `f118c84` z bieżącą linią nie uzasadnia
mechanicznego merge ani cherry-pick całego branchu stagingowego:

- początkowa poprawka bezpieczeństwa z `4b24191` została później przekształcona
  przez kolejne prace Supabase Free i bieżące zmiany prawne; bezpośredni
  cherry-pick grozi przywróceniem starych migracji i konfliktami w `server.js`;
- migracja `20260807150000_reconcile_yarn_acl_and_recovery.sql` w bieżącym
  checkoutcie jest zgodna z wariantem użytym w linii stagingowej i nie wymaga
  ponownego dodawania; problemem pozostaje jej zastosowanie na produkcji;
- poprawka `f118c84` dotycząca zachowania sesji po akceptacji regulaminu ma
  odpowiednik w bieżącym `server.js`, a lokalny regres obejmuje akceptację prawa;
- poprawki stagingowe dotyczące zachowania starszych wersji włóczek i ACL
  należy potwierdzić przez replay migracji oraz testy na nowym kandydacie, a
  nie przenosić jako osobne, historyczne migracje.

Wniosek: następny candidate powinien powstać z bieżącej linii prawnej po
kontroli równoważności zachowań i migracji. Nie tworzymy alpha.40 przed tym
sprawdzeniem i przed pozytywną regresją stagingu.

Oficjalne źródła potwierdzają fakty ogólne, ale nie zastępują dowodu konkretnej
konfiguracji Motka:

- [Supabase — regiony i rezydencja danych](https://supabase.com/docs/guides/platform/regions)
  wskazuje, że wybrany region określa miejsce przechowywania głównych danych
  projektu;
- [Supabase — backupy](https://supabase.com/docs/guides/platform/backups)
  zaleca dla planu Free regularne ręczne eksporty i backup poza Supabase;
- [Supabase — DPA](https://supabase.com/downloads/docs/Supabase%2BDPA%2B260601.pdf)
  opisuje role procesora, transfery i listę subprocesorów, ale samo źródło nie
  potwierdza zawarcia DPA dla Motka;
- [Railway — logi](https://docs.railway.com/observability/logs) podaje 7 dni
  retencji logów dla Hobby/Trial;
- [Railway — regiony](https://docs.railway.com/deployments/regions) opisuje
  dostępne regiony wdrożeń, ale nie potwierdza lokalizacji logów;
- [Railway — DPA](https://railway.com/legal/dpa) opisuje role, transfery,
  usuwanie danych i subprocesorów, ale nie potwierdza zawarcia DPA dla Motka;
- [Cloudflare — Turnstile Privacy Addendum](https://www.cloudflare.com/en-in/turnstile-privacy-policy/)
  rozróżnia rolę procesora dla ochrony strony i administratora dla ulepszania
  detekcji botów, bez podania stałej retencji dla konkretnego widgetu;
- [Cloudflare — DPA](https://www.cloudflare.com/en-gb/cloudflare-customer-dpa/)
  opisuje role, subprocesory, transfery i kryteria usuwania danych, ale nie
  potwierdza zawarcia DPA dla Motka;
- [Cloudflare — Data Localization Suite](https://developers.cloudflare.com/data-localization/how-to/)
  opisuje mechanizmy lokalizacji inspekcji ruchu i metadanych; nie są one
  włączone ani potwierdzone dla obecnego planu Motka;
- [Cloudflare — proxy status](https://developers.cloudflare.com/dns/proxy-status/)
  opisuje, że ruch przez rekord proxied przechodzi przez Cloudflare, a rekord
  DNS-only kieruje bezpośrednio do originu;
- [Cloudflare — ochrona originu](https://developers.cloudflare.com/fundamentals/security/protect-your-origin-server/)
  wskazuje wymagane kontrole proxy, allowlisty i ochrony przed obejściem
  originu.

Wniosek: źródła ogólne można zachować jako podstawę opisu usług, ale nie można
na ich podstawie ustawić `verified`. Nadal potrzebne są datowane dowody
konkretnego projektu Railway i strefy Cloudflare, a także potwierdzenie DPA,
subprocesorów, transferów, lokalizacji i retencji.

## Co zrobiono dziś

- poprawiono nachodzenie mobilnej nawigacji na dolną nawigację aplikacji;
- uzupełniono operatora prawnego: Piotr Ciesielski,
  `pc.piotr.ciesielski@gmail.com`;
- uzupełniono manifest dostawców o potwierdzone plany, znane regiony,
  dostępne informacje o retencji i źródła dowodowe;
- zachowano bramkę fail-closed: produkcja nie przejdzie dalej na podstawie
  samych deklaracji planu;
- uruchomiono lint, formatowanie, 14 testów bramki prawnej oraz pełny zestaw
  350 testów projektu — wszystkie zakończyły się powodzeniem;
- zapisano i wysłano na GitHub trzy dzisiejsze etapy na gałęzi
  `agent/staging-security-merge`:
  `70250fd`, `77fc4dc`, `62f24bf`.

## Aktualny stan bramki publikacji

`npm run legal:check` zwraca obecnie `LEGAL_PUBLICATION=not ready` z trzema
blokadami:

- Supabase nie jest zweryfikowany;
- Railway nie jest zweryfikowany;
- Cloudflare nie jest zweryfikowany dla zakresów `edge` i `turnstile`.

Dane operatora nie są już blokadą. Manifest pozostaje w stanie `draft`, a
wszyscy dostawcy mają status `unverified` do czasu zebrania dowodów dla
konfiguracji produkcyjnej.

## Brakujące kwestie prawne i dowodowe

| Dostawca | Potwierdzone | Do uzupełnienia przed publikacją |
| --- | --- | --- |
| Supabase | Plan Free organizacji. Projekty Production i Staging są aktywne w `eu-north-1`. Dla planu Free dokumentacja wskazuje 1 dzień logów API/bazy i 1 godzinę logów audytowych Auth. | Potwierdzić retencję kopii/logów po usunięciu konta, zasady transferu poza EOG, role administratora/podmiotu przetwarzającego oraz właściwe DPA/subprocesorów. Osobno zastosować i zweryfikować brakujące migracje prawne; przedtem przejrzeć ostrzeżenia Security Advisor dla RPC. |
| Railway | Plan Hobby. Region `sfo` odczytany z konfiguracji wdrożenia produkcji i stagingu. Dokumentacja Railway wskazuje 7 dni retencji logów dla Hobby. | Potwierdzić, czy `sfo` jest także lokalizacją przetwarzania i przechowywania logów. Ustalić zakres danych w logach, zasady ich usunięcia, mechanizm transferu poza EOG oraz właściwe DPA/subprocesorów dla produkcji. |
| Cloudflare (`edge` + `turnstile`) | Plan Free. Produkcja jest kierowana przez Cloudflare edge; staging odpowiada bezpośrednio z Railway. Turnstile jest używany w obu środowiskach. Turnstile opisuje minimalne sygnały antybotowe, m.in. IP, fingerprint TLS, User-Agent, sitekey i origin. | Potwierdzić osobno dla obu zakresów rzeczywistą retencję, lokalizację przetwarzania, transfery poza EOG, role Cloudflare, właściwe DPA/subprocesorów oraz ochronę originu Railway. Dla Turnstile nie znaleziono stałego okresu retencji w przywołanym dodatku. |

Źródła robocze:

- [Supabase — regiony](https://supabase.com/docs/guides/platform/regions)
- [Supabase — ceny i limity planu Free](https://supabase.com/pricing)
- [Supabase — DPA](https://supabase.com/downloads/docs/Supabase%2BDPA%2B260601.pdf)
- [Railway — logi i retencja](https://docs.railway.com/observability/logs)
- [Railway — DPA](https://railway.com/legal/dpa)
- [Cloudflare — Turnstile Privacy Addendum](https://www.cloudflare.com/en-in/turnstile-privacy-policy/)
- [Cloudflare — DPA](https://www.cloudflare.com/en-gb/cloudflare-customer-dpa/)

Do manifestu nie należy wpisywać okresów „30 dni” albo „90 dni”, dopóki nie
zostaną potwierdzone dla rzeczywistej konfiguracji Motka. Po zebraniu dowodów
trzeba uzupełnić `data/legal-data-providers.json`, nadać dostawcy `verified`,
dodać `verifiedAt`, a następnie ponownie uruchomić `npm run legal:check`.

## Niezależne prace pozostające poza bieżącym uzupełnieniem danych

1. **Domknięcie publikacji prawnej** — potwierdzenie produkcyjnych ustawień
   trzech dostawców, uzupełnienie podstaw prawnych, transferów i retencji w
   dokumencie publicznym oraz końcowa akceptacja operatora.
2. **Produkcja i infrastruktura** — osobne potwierdzenie migracji i konfiguracji
   produkcyjnego Supabase, procedury wdrożenia Railway oraz ustawień DNS,
   proxy/WAF/TLS Cloudflare. Nie wykonano dziś zdalnej migracji ani wdrożenia.
3. **Bezpieczeństwo operacyjne** — dokończenie limitów na reverse proxy,
   monitoringu prób Auth, wymuszenia HSTS/HTTPS i procedury ochrony przed
   przeciążeniem/DDoS zgodnie ze specyfikacją.
4. **Katalog wzorów** — rozszerzenie kompletnych, zweryfikowanych wymagań
   zużycia na kolejne wzory; nie jest to blokada techniczna obecnego manifestu,
   ale pozostaje zakresem produktu.

## Niezapisane, niezależne zmiany w checkoutcie

Na końcu dnia poza zapisanymi commitami pozostają:

- zmodyfikowany `.gitignore`;
- usunięty `design-qa.md`;
- nieśledzony katalog `.audit/` z materiałami wizualnej weryfikacji;
- nieśledzona migracja `supabase/migrations/20260803193000_add_versioned_yarn_inventory.sql`.

Nie zostały dołączone do dzisiejszych commitów. Przed osobnym zapisaniem trzeba
potwierdzić ich zakres i powiązanie z planem.

Lista nieśledzonych zmian powyżej jest historyczna dla raportu z 11 sierpnia;
aktualny stan checkoutu należy sprawdzać przez `git status --short`.
