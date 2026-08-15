# Stan gotowości prawnej i postęp prac — 2026-08-11

Ten raport jest bieżącym punktem odniesienia dla prac nad regulaminem,
informacją o prywatności i rejestrem dostawców. Nie zastępuje przeglądu
prawnego przez operatora.

## Aktualizacja po wdrożeniu stagingu — 2026-08-13

Kandydat stagingowy został zweryfikowany end-to-end:

- branch: `staging`;
- commit: `e691af891758ebc17f6d4683dbca5d997f65dbe5`;
- wersja: `2.0.0-alpha.39`;
- CI GitHub `31692102925`: testy kodu i replay migracji zakończone sukcesem;
- regresja po wdrożeniu `31692142042`: pełny profil stagingu zakończony sukcesem;
- `/health/live` zwraca `200` i `status: ok`, `/health/ready` zwraca `200` i
  `status: ready`, a `/health/release` potwierdza powyższy SHA oraz
  `environment: staging`;
- na Supabase Staging zastosowano migrację recovery claim; narzędzie nadało
  jej zdalny numer `20260812135011`, podczas gdy plik repozytorium ma numer
  `20260812122131` — rozbieżność numeracji została odnotowana i nie zmienia
  treści migracji;
- na Supabase Staging zastosowano również migrację
  `harden_recovery_grant_release` ze zdalnym numerem `20260813103831`;
- Railway deployment stagingu `1e99882d-668e-4264-b351-63ab37f1359f`
  zakończył się statusem `SUCCESS`;
- produkcyjny Supabase, Railway i Cloudflare nie były w ramach tego kroku
  modyfikowane.

Staging jest więc zweryfikowaną bramą techniczną dla tego kandydata, ale nie
oznacza to gotowości publikacji prawnej ani zgody na wdrożenie produkcyjne.
`npm run legal:check` nadal powinno zwracać `LEGAL_PUBLICATION=not ready`,
ponieważ Supabase, Railway i Cloudflare pozostają niezweryfikowane prawnie.

## Odczyt kontrolny — 2026-08-13

Odczyt historii migracji Supabase potwierdził rozjazd między środowiskami:

- produkcja (`Motek Production`, `eu-north-1`) kończy się na
  `20260807114728_document_recovery_grants_no_client_policy`;
- staging (`Motek Staging`, `eu-north-1`) ma dodatkowo migracje publikacji
  audytu wzorów, rejestracji i akceptacji prawa, egzekwowania bieżących
  warunków, unieważniania zaproszeń, claim recovery oraz
  `20260813103831_harden_recovery_grant_release`.

Nie wykonywać jeszcze produkcyjnej migracji ani wdrożenia. Najpierw potrzebne
jest osobne porównanie zakresu migracji, uprawnień RPC i planu rollbacku,
a następnie wyraźna zgoda operatora na operację produkcyjną.

Security Advisor stagingu nadal zgłasza ostrzeżenia dotyczące celowo
wywoływalnych przez `authenticated` funkcji `SECURITY DEFINER`, w tym RPC
claim/consume/release recovery, oraz informację o tabeli prywatnej z RLS bez
polityk. Są to znane kwestie do osobnego przeglądu; nie zostały automatycznie
zmienione. Produkcja nadal zgłasza wcześniejsze ostrzeżenia RPC oraz wyłączoną
ochronę przed wyciekłymi hasłami.

Bezpośredni odczyt uprawnień RPC wykazał dodatkowo:

- produkcja ma starsze funkcje recovery z argumentami
  `p_user_id, p_jti_hash` i nie ma nowych funkcji
  `claim_auth_recovery_grant(text)`, `release_auth_recovery_grant(text)` ani
  `consume_auth_recovery_grant(text)`;
- staging ma nowy kontrakt recovery z `auth.uid()`, pustym `search_path` i
  wykonaniem dostępnym tylko dla `authenticated`, obok historycznych funkcji,
  które pozostają niewykonywalne dla ról klienckich;
- produkcyjne RPC włóczek `get_yarn_store_version`, `insert_yarn_versioned`,
  `update_yarn_versioned` i `delete_yarn_versioned` mają `EXECUTE` dla
  `authenticated`, tak samo jak staging; jest to zachowanie wynikające z
  jawnego `grant execute ... to authenticated`, ale pozostaje ostrzeżeniem
  Security Advisor do osobnego przeglądu.

Różnica kontraktu recovery jest blokadą techniczną P1, niezależną od
legal-readiness. Nie należy jej naprawiać pojedynczym ręcznym `GRANT` ani
uruchamiać migracji produkcyjnych bez porównania całego łańcucha migracji,
backupu, planu rollbacku i osobnej zgody operatora. Ostrzeżenia RPC włóczek
pozostają osobnym, znanym ryzykiem do decyzji.

Bieżący odczyt produkcyjnego Railway przez konektor nie został wykonany,
ponieważ konto sesji nie ma roli `viewer` dla tego zasobu. Nie jest to dowód
zmiany ani awarii produkcji; pozostaje blokadą dowodową do czasu odczytu przez
uprawnioną sesję lub dostarczenia operatorowego dowodu.

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

## Release candidate i wdrożenia — 2026-08-12

Bieżący checkpoint gałęzi `agent/staging-security-merge` ma SHA
`e739ce6affea746965321a399d78cc7b55ed6258`. Nie jest on jeszcze wdrożony:

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

Wniosek: B1 nie jest jeszcze zamknięte jako release candidate. Przed promocją
trzeba wskazać jeden zatwierdzony SHA, sprawdzić staging na tym samym artefakcie
i dopiero potem rozważać produkcję. Nie wykonano promocji ani deployu.

Na potrzeby dalszej decyzji obecny checkout pozostaje linią roboczą:
`agent/staging-security-merge@2942393`, wersja `2.0.0-alpha.38`, SHA
`2942393`. Zweryfikowany snapshot stagingu `2.0.0-alpha.39` znajduje się na
SHA `62d0b84e`, a wdrożony artefakt na `f118c84`; obie linie nie są relacją
przodek–potomek. Oznacza to, że alpha.39 zawiera późniejsze poprawki
stagingowe, a obecny checkout zawiera późniejsze prace prawne i migracyjne.
Mechaniczne podbicie wersji do alpha.40 byłoby więc przedwczesne.
Najpierw trzeba wybrać i scalić potrzebny zakres obu linii, uzgodnić migracje
na stagingu i wykonać kontrolowaną regresję; dopiero potem można utworzyć
nowego kandydata wydaniowego.

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

## Odczyt dowodów technicznych — 2026-08-13

Wykonano ponowny, tylko-odczytowy odczyt konfiguracji dostawców. Nie zmieniano
manifestu prawnego ani konfiguracji usług.

- Supabase `Motek Production` i `Motek Staging` są `ACTIVE_HEALTHY`, oba w
  regionie `eu-north-1`, z PostgreSQL `17.6.1.155`.
- Railway projekt `balanced-fulfillment` ma środowiska `production` i
  `staging Motek`, oba z usługą `Motek` w stanie `SUCCESS`.
- Odczytany deployment Railway produkcji to
  `551aa616-a3e9-4b85-9e98-7cf15630b6d3` z 2026-08-08; stagingu to
  `1e99882d-668e-4264-b351-63ab37f1359f` z 2026-08-13.
- W odczycie z 2026-08-13 nie uzyskano jeszcze nowego dowodu konfiguracji
  strefy Cloudflare ani Turnstile; późniejszy odczyt z 2026-08-14 uzupełnia ten
  brak techniczny.

`npm run legal:check` nadal kończy się fail-closed jako
`LEGAL_PUBLICATION=not ready`, ponieważ `supabase`, `railway` i `cloudflare`
pozostają `unverified`. Nie wolno ustawiać `verified` na podstawie samego
odczytu technicznego; nadal potrzebne są datowane dowody prawne operatora.

## Odczyt Cloudflare — 2026-08-13

Odczytano zalogowany panel Cloudflare dla strefy `rysia.org`. Nie zmieniano
rekordów ani ustawień.

- plan strefy: `Free`, DNS Setup: `Full`;
- `rysia.org` i `www.rysia.org` wskazują przez CNAME na Railway i mają status
  `Proxied`;
- `staging.rysia.org` wskazuje na osobny adres Railway i ma status `DNS only`;
- produkcyjny widget Turnstile `Motek production` obejmuje 2 hosty, działa w
  trybie `Managed` i nie ma pre-clearance;
- Cloudflare pokazywał ostrzeżenie, że dla widgetu produkcyjnego nie jest
  wywoływany `Siteverify`, więc formularz chroniony widgetem nie był wówczas
  walidowany po stronie serwera. Była to blokada techniczna P1; nie uruchamiano
  automatycznej funkcji „Fix with Spin”.

## Weryfikacja produkcyjnego Turnstile — 2026-08-13

Blokada P1 została usunięta operacyjnie bez zmian w kodzie Motka:

- sekret widgetu produkcyjnego został uzupełniony w Supabase Auth → Bot and
  Abuse Protection; wartość sekretu nie jest zapisywana w repozytorium ani tej
  dokumentacji;
- produkcyjne `/api/config` zwróciło `HTTP 200` z `captcha.enabled=true`;
- po odblokowaniu żądań Cloudflare w przeglądarce widget został użyty podczas
  ręcznej próby logowania;
- Supabase Production zarejestrował udane żądanie `POST /token` ze statusem
  `200` o `2026-08-13 15:41:28Z`;
- po odświeżeniu panelu Cloudflare ostrzeżenie o braku `Siteverify` zniknęło.

Wniosek: produkcyjny przepływ CAPTCHA → Supabase Auth działa, a Supabase Auth
pozostaje jedynym właścicielem weryfikacji tokenu. Nie dodano drugiego
wywołania Cloudflare `Siteverify` w backendzie Motka.

Panel WAF/TLS nie załadował się stabilnie w sesji z 2026-08-13. Późniejszy
odczyt z 2026-08-14 uzupełnił techniczny stan tych ustawień; nadal brakuje
prawnych dowodów transferu, retencji, DPA i subprocesorów Cloudflare.

## Odczyt Cloudflare — 2026-08-14

Ponowny odczyt panelu Cloudflare wykonano wyłącznie odczytowo. Potwierdzono:

- `rysia.org` i `www.rysia.org` są `proxied` do
  `u6438t9v.up.railway.app`, a `staging.rysia.org` jest `DNS-only` i wskazuje
  `wkdo2piu.up.railway.app`;
- produkcyjny widget Turnstile odnotował 167 wydanych challenge’y, 96
  rozwiązanych oraz 5 żądań Siteverify: 5 poprawnych i 0 niepoprawnych;
- Universal SSL jest aktywny, TLS 1.3 oraz Automatic HTTPS Rewrites są
  włączone;
- Always Use HTTPS i HSTS są wyłączone, minimalna wersja TLS pozostaje
  domyślna — TLS 1.0;
- strefa nie ma reguł custom, rate limiting ani managed WAF.

Ten odczyt zamyka wcześniejszą niepewność techniczną dotyczącą podstawowego
stanu edge/Turnstile, ale nie zamyka legal-readiness. Manifest pozostaje
`unverified`, a `LEGAL_PUBLICATION=not ready`, ponieważ nadal brakuje dowodów
lokalizacji przetwarzania, transferów, retencji, DPA i subprocesorów. Nie
zmieniano ustawień Cloudflare.

## Dokumentacja dostawców — 2026-08-14

Aktualne materiały źródłowe doprecyzowują zakres, ale nie zmieniają statusu
legal-readiness:

- Supabase wskazuje `eu-north-1` jako obsługiwany region i opisuje, że
  automatyczne backupy dzienne dotyczą planów Pro, Team i Enterprise; dla Free
  zalecane są własne eksporty. Wcześniejsza aktualizacja obejmowała tylko
  schema-only rehearsal; wynik pełnego eksportu i zgodnego restore zapisano
  poniżej.
- Railway dokumentuje retencję logów Hobby/Trial na 7 dni. DPA wskazuje, że
  podstawowe przetwarzanie odbywa się w USA, a lista subprocesorów jest w Trust
  Center. Trzeba potwierdzić zastosowanie tych warunków do konkretnego
  workspace'u Motka.
- Cloudflare rozdziela role przy Turnstile: procesor dla ochrony strony oraz
  administrator danych przy ulepszaniu detekcji. Kontrola regionu przetwarzania
  i metadanych wymaga Data Localization Suite, płatnego dodatku Enterprise;
  proxied DNS i poprawny Siteverify nie dowodzą lokalizacji EOG.

## Stan bram backup/restore — 2026-08-14

Kontrolowany eksport produkcyjnych danych `public/private`, Auth i Storage oraz
izolowany restore zostały wykonane bez zapisu do produkcji. Dane aplikacyjne
odtworzono z zgodnymi licznościami, a dane Auth przyjęto w świeżym, zgodnym
stacku Supabase z GoTrue; potwierdzono zdrowie Auth oraz syntetyczne logowanie i
recovery. Tymczasowe dane, konto testowe i stack usunięto.

Zamyka to wyłącznie techniczną bramkę backup/restore. Legal-readiness pozostaje
`not ready`: lokalizacja, transfery, retencja, DPA/subprocesorzy i ochrona
originu nadal wymagają dowodów. Produkcja pozostaje `NO-GO`.

## Reconciliation ledger migracji — 2026-08-14

Świeży, odczytowy `list_migrations` dla Supabase Staging zwrócił 27 wpisów i
kończy się na `20260813103831_harden_recovery_grant_release`. Nie jest to
bezpośrednio ten sam ledger co lokalny RC:

- staging nadaje migracji claim numer `20260812135011`, a lokalny plik to
  `20260812122131_add_recovery_grant_claim.sql`;
- staging nadaje migracji release numer `20260813103831`, a lokalny plik to
  `20260813100000_harden_recovery_grant_release.sql`;
- staging ma także nazwy `add_versioned_yarn_inventory`,
  `fix_yarn_version_conflict_code` i
  `restore_atomic_yarn_store_versions_contract`, których nie ma jako plików
  1:1 w lokalnym RC; lokalny RC ma w tym obszarze inaczej nazwane lub scalone
  migracje.

Zapisane hashe dotyczą lokalnych plików, nie zdalnych treści: claim
`A025A53CA7E12BC903AA484754F4D225B1378F4FBF18BE269568252D24324829`, release
`56F7F26CB73D4052F89BFE866282C21852F0BCF357B501457C1D11AFF23DBD1A`.
Jednocześnie GitHub `staging` zawiera oba aktualne pliki źródłowe; ich Git blob
SHA-1 odpowiada odpowiednio `f8507e3dc725fffc5db06365fab188b47fc535c0` i
`8e0405de10e7ee300873a6271bbc86ee05a93f1f`. Potwierdza to zgodność źródła
candidate z branch `staging`, ale nie rozstrzyga, które starsze migracje zostały
wcześniej scalone lub przemianowane w zdalnym ledgerze.
Nie traktujemy samej zgodności nazw jako dowodu zgodności historii SQL. Replay
migracji na odtworzonym celu pozostaje wstrzymany do przygotowania mapy
`zdalny version/name → lokalny plik → hash treści → efekt schematu`.

Manifest pozostaje `unverified`, `verifiedAt` pozostaje puste, a
`LEGAL_PUBLICATION=not ready`. Nie wykonano żadnej zmiany u dostawców.

## Decyzja źródła migracji i lokalny replay — 2026-08-14

Na decyzję operatora aktualny branch GitHub `staging` został przyjęty jako
źródło prawdy dla dalszych replayów migracji. Zdalne numery i nazwy z listy
Supabase Staging pozostają zapisem historii tego środowiska; nie są używane
jako osobna lista wejściowa, ponieważ część starszych migracji została tam
scalona lub przemianowana.

W świeżym, tymczasowym stacku Supabase wykonano replay wszystkich 30 plików
źródłowych `staging` od pustej bazy. `migration list` potwierdził 30/30 wersji,
a pgTAP zakończył się wynikiem 8 plików / 287 testów — `PASS`. Dodatkowo
zweryfikowano funkcje recovery: `SECURITY DEFINER`, pusty `search_path`, brak
EXECUTE dla `anon`, właściwe granty dla ról uwierzytelnionych/serwisowych oraz
brak odczytu tabeli `private.auth_recovery_grants` przez role API.

Stack i katalog tymczasowy zostały usunięte. To zamyka lokalną bramkę replayu
źródła `staging`, ale nie jest zgodą na migrację zdalną ani wdrożenie. Produkcja
pozostaje `NO-GO`; nadal otwarte są bramki legal/infrastruktura oraz osobne
zgody operacyjne.

Dowód zakresu źródła: `origin/staging` wskazuje na
`e691af891758ebc17f6d4683dbca5d997f65dbe5` i zawiera 30 plików migracji.
Porównanie treści `origin/staging` z `release/motek-recovery-rc` dla katalogów
`supabase/migrations` i `supabase/tests/database` nie wykazało różnic. Główny
checkout `agent/staging-security-merge` jest niezależnym, brudnym środowiskiem
roboczym i nie jest źródłem tego dowodu. Nie wykonano żadnego zapisu zdalnego.

## Aktualny wybór artefaktu i bramki wydania — 2026-08-14

Jedynym wybranym artefaktem kandydującym jest
`origin/staging@e691af891758ebc17f6d4683dbca5d997f65dbe5`. Bieżący checkout
`agent/staging-security-merge` zawiera niezależne, niescalone zmiany i nie może
być traktowany jako kandydat do promocji.

Lokalny `npm run legal:check` zakończył się kodem 1 i wynikiem
`LEGAL_PUBLICATION=not ready`; Supabase, Railway oraz Cloudflare pozostają
`unverified`. Do zamknięcia pozostają również dowody produkcyjnego HTTPS/
`Full (strict)`, ochrony originu Railway, konfiguracji WAF/rate limitingu/HSTS,
monitoringu i odbiorcy alertów, a także zatwierdzona kolejność migracji z
rollbackiem oraz osobne zgody na migrację i deploy.

Nie wykonano żadnego zapisu zdalnego, migracji produkcyjnej ani wdrożenia.
Produkcja pozostaje `NO-GO`.

## Aktualny odczyt Supabase Advisors — 2026-08-14

Ponowny odczyt obu projektów nie zmieniał ustawień ani danych:

- Production i Staging są `ACTIVE_HEALTHY`, oba działają w `eu-north-1` na
  PostgreSQL `17.6.1.155`.
- Production zgłasza ostrzeżenia Security Advisor dla czterech celowo
  wywoływalnych przez `authenticated` RPC magazynu włóczek oraz dla wyłączonej
  ochrony przed wyciekłymi hasłami.
- Staging zgłasza te same ostrzeżenia RPC magazynu, dodatkowo ostrzeżenia dla
  `claim/release/consume` recovery i `has_current_terms_acceptance`, a także
  wyłączoną ochronę przed wyciekłymi hasłami. RLS bez polityki na prywatnej tabeli
  grantów i publicznych wzorach jest odnotowany jako informacja; dostęp jest
  dodatkowo zamknięty grantami i nie jest powodem do automatycznej zmiany.
- Performance Advisor zwraca wyłącznie informacje o nieużywanych indeksach i
  indeksach kluczy obcych; nie jest to blokada release, ale wymaga osobnego
  zadania optymalizacyjnego po zamknięciu produkcji.

Ostrzeżenia `SECURITY DEFINER` nie mogą być usuwane mechanicznie: część RPC jest
celowo używana przez zalogowaną aplikację. Przed produkcją trzeba udokumentować
intencję, właściciela ryzyka i testy uprawnień; nie wykonywać automatycznego
`REVOKE` ani zmiany na `SECURITY INVOKER` bez decyzji architektonicznej.

## Macierz Production ↔ Staging recovery — odczyt 2026-08-14

Ponowny odczyt Supabase potwierdził aktualny stan bez wykonywania zapisów:

- Production ma 23 migracje i kończy się na
  `20260807114728_document_recovery_grants_no_client_policy`.
- Staging ma 27 wpisów i kończy się na
  `20260813103831_harden_recovery_grant_release`.
- Production udostępnia wyłącznie historyczne
  `create_auth_recovery_grant(uuid,text,timestamptz)` oraz
  `consume_auth_recovery_grant(uuid,text)`, z EXECUTE tylko dla `service_role`.
- Staging ma dodatkowo `claim(text)`, `release(text)` i `consume(text)` z
  EXECUTE dla `authenticated`; oba środowiska mają `SECURITY DEFINER` i pusty
  `search_path`.
- `private.auth_recovery_grants` nie jest czytelna dla `anon` ani
  `authenticated` w żadnym z tych środowisk.

To potwierdza rzeczywistą lukę P1 w produkcji: bieżący przepływ recovery wymaga
sygnatur, których produkcja jeszcze nie posiada. Nie należy jej obchodzić
ręcznym `GRANT`; wymagany jest pełny pakiet migracji stagingu, kontrola przed i
po migracji oraz plan rollbacku. Produkcja pozostaje `NO-GO`.

## Weryfikacja publiczna po zmianie Cloudflare — 2026-08-14

Po zapisaniu ustawień wykonano odczyt publiczny poza przeglądarką:

- `GET https://www.rysia.org/health/ready` zwrócił `200` i `{"status":"ready"}`;
- `GET http://www.rysia.org/health/ready` zwrócił `301` do HTTPS, a następnie
  `200` z tym samym wynikiem;
- `GET https://rysia.org/health/ready` zwrócił `301` do
  `https://www.rysia.org/health/ready`, a następnie `200`;
- Railway HTTP logs potwierdziły te żądania na deploymentcie
  `551aa616-a3e9-4b85-9e98-7cf15630b6d3`, bez `upstreamErrors`;
- wcześniejszy `HEAD /health/ready` z `404` jest różnicą metody HTTP, nie błędem
  TLS ani brakiem trasy GET.

Bramę techniczną HTTPS/TLS/redirect/readiness uznaję za zamkniętą dla tego
zakresu. Legal scope dostawców, recovery produkcji, ochrona originu, cache,
WAF/rate limiting i monitoring pozostają otwarte. Produkcja nadal `NO-GO`.

## Odczyt Cloudflare rules/cache — 2026-08-14

Panel potwierdził wyłącznie odczytowo:

- Security Rules: `0/5` custom rules i `0/1` rate limiting rules;
- Managed rules: brak aktywnych reguł na planie Free; panel pokazuje opcję
  upgrade do Pro;
- Cache Rules: `0 active`;
- Cache Response Rules: `0 active`.

Jest to inwentaryzacja braku reguł, a nie dowód pełnej ochrony. Nie twierdzę na
jej podstawie, że origin Railway jest nieosiągalny ani że API/Auth są odporne
na cache. WAF/rate limiting, bezpośredni origin, cache API/Auth i monitoring
pozostają otwartymi bramami. Nie zmieniono żadnej reguły.

## Odczyt originu i cache — zakres częściowy, 2026-08-14

- Techniczny adres Railway `u6438t9v.up.railway.app` zwraca `404 Application
  not found` z `x-railway-fallback`, a nie aplikację Motka. Nie jest to dowód
  pełnej blokady wszystkich możliwych adresów originu.
- Publiczny `GET /api/config` przez `www.rysia.org` zwraca `200`,
  `Cache-Control: no-store` i `cf-cache-status: DYNAMIC`.

To zamyka tylko dowód niecache'owania publicznej konfiguracji. Nie potwierdza
cache API/Auth jako całości ani pełnej ochrony originu Railway. Te bramy nadal
pozostają otwarte.

## Decyzje produktowe i architektoniczne — 2026-08-14

Advisor nie daje automatycznej zgody `GO`. Przyjęto następujące rekomendacje i
decyzje:

1. **Katalog wzorów — decyzja operatora:** pozostawić `public.patterns` dostępny
   wyłącznie przez backend `service_role`. To upraszcza RLS i nie ujawnia
   rekordów ukrytych ani nieopublikowanych.
2. **RPC `SECURITY DEFINER` — decyzja operatora:** pozostawić obecny kontrakt jako
   celowy, z formalnym właścicielem ryzyka i testami uprawnień. Automatyczny
   `REVOKE` mógłby złamać działającą aplikację.
3. **Ochrona wyciekłych haseł — decyzja operatora:** zaakceptowano jej
   wyłączenie na planie Free. Nie zmieniamy konfiguracji ani planu w tym etapie.
4. **Performance Advisor:** kto jest właścicielem zadania indeksów i jaki jest
   termin ponownej oceny. Jest to zadanie optymalizacyjne, nie obecna blokada
   recovery.

Decyzje te są zapisane. Produkcja pozostaje `NO-GO` do czasu zamknięcia
pozostałych bram legal/infrastructure oraz osobnych zgód operacyjnych.

## Świeży odczyt Cloudflare SSL/DNS — 2026-08-14

Odczyt panelu Cloudflare dla `rysia.org` wykonano wyłącznie informacyjnie;
nie zmieniono DNS, certyfikatów ani ustawień ochrony:

- tryb SSL/TLS to **Full**, a nie **Full (strict)**; tryb automatyczny jest
  włączony;
- Universal SSL jest aktywny dla `rysia.org` i `*.rysia.org`, z ważnością do
  2026-11-02; certyfikat zapasowy został wydany;
- `Always Use HTTPS` i HSTS są wyłączone, minimalny TLS pozostaje na wartości
  domyślnej `TLS 1.0`, natomiast TLS 1.3 i Automatic HTTPS Rewrites są
  włączone;
- rekordy `rysia.org` i `www.rysia.org` są proxied do Railway, a
  `staging.rysia.org` jest DNS-only do osobnego originu Railway.

Pozostają otwarte dowody ochrony originu Railway oraz decyzja o bezpiecznym
minimum TLS, redirectach HTTPS, HSTS, WAF/rate limiting i monitoringu. Ten
odczyt nie zamyka tych bram. Produkcja pozostaje `NO-GO`.

Lokalny indeks dowodów preflight, który rozdziela fakty repozytorium od dowodów
wymagających operatora lub usług, znajduje się w
[release-preflight-evidence-index-2026-08-14.md](release-preflight-evidence-index-2026-08-14.md).

## Zmiany Cloudflare wykonane za zgodą operatora — 2026-08-14

W panelu produkcyjnej strefy `rysia.org` zapisano:

- SSL/TLS: `Full (strict)`; tryb automatyczny wyłączony;
- minimalny TLS: `TLS 1.2`;
- `Always Use HTTPS`: włączone;
- TLS 1.3 i Automatic HTTPS Rewrites: pozostawione włączone;
- HSTS: pozostawione wyłączone;
- nie zmieniano DNS, certyfikatów, WAF, rate limiting, Turnstile ani originu
  Railway.

Panel potwierdził zapis `Full (strict)` po ponownym odczycie oraz utrzymanie
minimum TLS 1.2 i redirectu HTTPS po odświeżeniu strony. Bezpośredni adres
techniczny Railway odpowiadał przez HTTPS, ale zwrócił stronę Railway `Not
Found`, co nie jest dowodem stanu aplikacji. Próba otwarcia publicznego
healthchecka przez kontrolowaną przeglądarkę została zablokowana lokalnie
przez `ERR_BLOCKED_BY_CLIENT`; nie oznaczam więc healthchecka jako potwierdzonego.
Produkcja nadal `NO-GO`.
## Publiczna strona prawna — porównanie staging/production, 2026-08-14

Staging pod `https://staging.rysia.org` działa na kandydacie
`e691af891758ebc17f6d4683dbca5d997f65dbe5`; oba warianty
`/informacje-prawne` i `/informacje-prawne/` zwracają `200` oraz nagłówki
bezpieczeństwa. Publiczny staging smoke i pełna regresja dla tego SHA przeszły.

Produkcja pod `https://www.rysia.org` działa na starszym
`c4b777a5f8a96277c0e7fb7ca6ec52d425a0900b`; oba warianty strony prawnej
zwracają `404`. Oznacza to, że publiczny kontrakt prawny produkcji nie jest
obecnie spełniony. Nie należy łatać tego ręcznie ani traktować stagingowego
wyniku jako publikacji produkcyjnej.

Ten dowód zamyka wyłącznie techniczny zakres stagingu. Manifest dostawców
pozostaje `unverified`, `LEGAL_PUBLICATION=not ready`, a produkcja pozostaje
`NO-GO` do czasu zatwierdzenia zakresu prawnego, konfiguracji dostawców i
osobnego okna deployu.

## Świeży odczyt Cloudflare — 2026-08-14

Ponowny odczyt zalogowanego panelu strefy `rysia.org` potwierdził aktualny stan
techniczny:

- SSL/TLS: `Full (strict)`, tryb automatyczny wyłączony;
- Universal SSL dla `*.rysia.org` i `rysia.org`: aktywny, ważny do 2026-11-02;
- `Always Use HTTPS`: włączone;
- minimalny TLS: `TLS 1.2`, TLS 1.3: włączone;
- HSTS: nadal wyłączone;
- panel certyfikatu originu nie udostępnił danych na dostępnej trasie, więc
  handshake Cloudflare → Railway i certyfikat originu pozostają
  niepotwierdzone.

To jest świeży dowód konfiguracji technicznej, nie dowód gotowości prawnej ani
ochrony originu. Nie zmieniano ustawień Cloudflare, DNS, WAF, rate limiting ani
HSTS; manifest dostawców pozostaje `unverified`, a produkcja `NO-GO`.

## Świeży publiczny smoke i bramka publikacji — 2026-08-15

Odczyt publiczny nie wykazał zmiany położenia bramek:

- Production `/health/release` nadal wskazuje `2.0.0-alpha.39` na SHA
  `c4b777a5f8a96277c0e7fb7ca6ec52d425a0900b` i środowisko `production`;
- Production `/informacje-prawne` zwraca `404`;
- anonimowy Production `/api/patterns` zwraca `200`, co nadal narusza ustaloną
  decyzję „katalog wyłącznie przez backend”;
- staging działa na SHA `e691af891758ebc17f6d4683dbca5d997f65dbe5`, strona
  `/informacje-prawne` zwraca `200`, a anonimowy `/api/patterns` `401`;
- `npm run legal:check` pozostaje fail-closed: `LEGAL_PUBLICATION=not ready`,
  ponieważ Supabase, Railway i Cloudflare nadal są oznaczone jako
  `unverified` w manifeście.

Wniosek: produkcja pozostaje `NO-GO`. Nie wykonano patcha produkcyjnego,
migracji, deployu ani zmian GitHub.
