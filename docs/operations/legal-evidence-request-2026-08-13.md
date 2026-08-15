# Paczka dowodów legal-readiness — Motek

Ten formularz służy do zebrania dowodów dla konkretnej konfiguracji Motka.
Nie zastępuje opinii prawnej. Dopóki pola nie zostaną potwierdzone
dokumentem, zrzutem konfiguracji lub innym datowanym dowodem, dostawca musi
pozostać `unverified`.

## Zasady dowodu

Każdy dowód powinien zawierać:

- dostawcę i konkretny zakres usługi;
- środowisko: produkcja albo produkcja i staging;
- datę pozyskania;
- adres źródłowy HTTPS z domeny dostawcy;
- informację, czego dokładnie dowód dotyczy;
- bezpieczny zrzut ekranu lub link bez sekretów, tokenów i danych klientów.

Nie wpisywać do manifestu wartości „do potwierdzenia”, ogólnych deklaracji
marketingowych ani okresów retencji niepotwierdzonych dla konta Motka.

## Supabase

Do potwierdzenia dla projektu produkcyjnego:

- identyfikator/nazwa projektu i region `eu-north-1`;
- plan organizacji;
- zakres danych przetwarzanych w bazie, Auth, Storage i logach;
- retencja logów, kopii zapasowych i danych po usunięciu konta;
- lokalizacja oraz mechanizm transferu poza EOG, jeśli występuje;
- rola Supabase, DPA i lista właściwych subprocesorów;
- data i źródło każdego potwierdzenia.

Status techniczny: produkcja nie ma jeszcze migracji prawnych i recovery
zastosowanych na stagingu. Przed wdrożeniem potrzebne są osobno: porównanie
migracji, przegląd uprawnień RPC, backup oraz plan rollbacku.

## Railway

Do potwierdzenia dla produkcyjnego środowiska Motka:

- środowisko i usługa produkcyjna;
- region wdrożenia `sfo` oraz informacja, czy obejmuje on także przetwarzanie
  i przechowywanie logów;
- zakres danych w logach;
- retencja i usuwanie logów;
- transfery poza EOG;
- rola Railway, DPA i lista subprocesorów;
- data i źródło każdego potwierdzenia.

Bieżący odczyt produkcyjnego Railway przez konektor wymaga uprawnienia
`viewer`. Nie należy obchodzić tego ograniczenia; potrzebny jest odczyt przez
uprawnioną sesję albo datowany dowód operatora.

## Cloudflare — edge

Zakres: produkcyjna strefa DNS/proxy/TLS/WAF.

Do potwierdzenia:

- rzeczywisty status proxied rekordów produkcyjnych;
- lokalizacja przetwarzania metadanych ruchu;
- transfery poza EOG;
- retencja metadanych i logów;
- DPA, role Cloudflare i właściwi subprocesorzy;
- ochrona originu Railway przed bezpośrednim obejściem Cloudflare;
- data i źródło każdego potwierdzenia.

## Cloudflare — Turnstile

Zakres: widgety produkcyjne i stagingowe.

Do potwierdzenia:

- identyfikator i domeny widgetu, bez ujawniania sekretnego klucza;
- zakres sygnałów antybotowych;
- lokalizacja przetwarzania;
- transfery poza EOG;
- retencja sygnałów i wyników walidacji;
- rola Cloudflare, DPA i właściwi subprocesorzy;
- data i źródło każdego potwierdzenia.

## Decyzja operatora

Po zebraniu dowodów operator potwierdza, że:

- informacje odpowiadają rzeczywistej konfiguracji Motka;
- zakres produkcyjny i stagingowy jest opisany osobno, gdy się różni;
- publiczny dokument prawny może używać tych informacji;
- można oznaczyć odpowiedniego dostawcę jako `verified`.

Dopiero po tej decyzji wolno uzupełnić `data/legal-data-providers.json`, dodać
`verifiedAt` i ponownie uruchomić `npm run legal:check`.

## Stan odczytu — 2026-08-14

Odczyt techniczny potwierdził zdrowie projektów Supabase Production/Staging,
wdrożeń Railway oraz podstawowej konfiguracji Cloudflare. Bezpośredni odczyt
panelu Cloudflare potwierdził proxied DNS produkcji, DNS-only dla stagingu,
aktywny widget Turnstile z poprawnymi żądaniami Siteverify, aktywny Universal
SSL, TLS 1.3 i Automatic HTTPS Rewrites. Jednocześnie wykazał wyłączone HSTS,
wyłączone Always Use HTTPS, domyślny minimalny TLS 1.0 oraz brak reguł custom,
rate limiting i managed WAF.

Zakres prawny dostawcy nadal nie jest kompletny: nie potwierdzono lokalizacji
przetwarzania, transferów, retencji, DPA ani właściwych subprocesorów. Operacyjne
skonfigurowanie Turnstile i odczyt panelu nie są same w sobie dowodem tych
elementów. Zakresy `edge` i `turnstile` pozostają `unverified` w manifeście.

Do czasu zebrania powyższych dowodów nie zmieniać statusu manifestu, nie wpisywać
daty `verifiedAt` i utrzymać wynik `LEGAL_PUBLICATION=not ready`.

## Odczyt dokumentacji dostawców — 2026-08-14

Przejrzano aktualne materiały źródłowe dostawców. Są one dowodem zakresu i
warunków usługi, ale nie potwierdzają jeszcze akceptacji warunków przez
operatora ani konfiguracji konkretnego konta:

- Supabase opisuje region projektu jako podstawowy region wdrożenia; oba
  projekty Motka są odczytowo w `eu-north-1`. Dokumentacja backupów wskazuje,
  że automatyczne backupy dzienne dotyczą planów Pro, Team i Enterprise, a dla
  Free zalecany jest regularny własny eksport CLI. To nie zamyka bramki pełnego
  backupu danych i restore rehearsal.
- Railway opisuje retencję logów Hobby/Trial jako 7 dni. Aktualne DPA wskazuje,
  że podstawowe operacje przetwarzania odbywają się w USA, przewiduje transfery
  z odpowiednimi zabezpieczeniami oraz odsyła do listy autoryzowanych
  subprocesorów w Trust Center. Trzeba potwierdzić, że te warunki są właściwe
  dla używanego workspace'u i zakresu danych Motka.
- Cloudflare Turnstile opisuje minimalne sygnały antybotowe, ale rozdziela rolę
  procesora dla zabezpieczenia strony od roli administratora danych przy
  ulepszaniu detekcji. Cloudflare wskazuje też, że kontrola regionu przetwarzania
  i metadanych wymaga Data Localization Suite, będącego płatnym dodatkiem
  Enterprise. Nie należy więc wywodzić lokalizacji EOG z samego proxied DNS ani
  z poprawnego Siteverify.

Źródła robocze: [Supabase regions](https://supabase.com/docs/guides/platform/regions),
[Supabase backups](https://supabase.com/docs/guides/platform/backups),
[Railway logs](https://docs.railway.com/observability/logs),
[Railway DPA](https://railway.com/legal/dpa),
[Cloudflare Turnstile Privacy Addendum](https://www.cloudflare.com/en-in/turnstile-privacy-policy/)
i [Cloudflare Data Localization Suite](https://developers.cloudflare.com/data-localization/).

Wniosek: dokumentacja dostawców uzupełnia macierz ryzyk, ale nie zastępuje
potwierdzenia operatora dotyczącego DPA, subprocesorów, transferów, retencji i
rzeczywistego planu usług. Manifest pozostaje `unverified`, a publikacja
`LEGAL_PUBLICATION=not ready`.

## Pakiet do zamknięcia blokady — stan po oknie 2026-08-15

Technicznie Production działa na rollbacku c4b777a, a migracja
production_legal_versioned_recovery_delta jest zastosowana w Supabase
Production. Nie zmienia to statusu legal-readiness: npm run legal:check
zwraca LEGAL_PUBLICATION=not ready, ponieważ wszystkie trzy grupy
dostawców pozostają unverified.

Poniższa tabela jest właściwym formularzem zamknięcia. Wypełnienie wymaga
rzeczywistego dowodu operatora lub datowanego dokumentu dostawcy; sam wpis
w konfiguracji, dokumentacja projektu albo poprawne działanie usługi nie
wystarczają.

| Dostawca / zakres | Dowód konfiguracji Motka | Dowód warunków prawnych | Wymagane pola | Właściciel | Status |
|---|---|---|---|---|---|
| Supabase Production: Database, Auth, Storage, logi | Zrzut lub eksport projektu vueotocjsgzosqzhcish, region, plan, zakres danych i ustawień backupu | DPA, subprocesorzy, region przetwarzania, transfer poza EOG, retencja i usuwanie | URL, data, projekt, region, plan, transfer, retencja, źródło | operator Motka | unverified |
| Railway Production: usługa Motek, deployment i logi | Zrzut usługi balanced-fulfillment, region sfo, plan, retencja logów, dostęp i bieżący deployment | DPA, subprocesorzy, lokalizacja przetwarzania/logów, transfer poza EOG, retencja i usuwanie | URL, data, usługa, region, plan, transfer, retencja, źródło | operator Motka | unverified |
| Cloudflare Edge: DNS/proxy/TLS/WAF | Zrzut produkcyjnej strefy i rekordów, status proxied, TLS, WAF/rate limiting | DPA, subprocesorzy, lokalizacja metadanych, transfer, retencja logów i analytics, ochrona originu | URL, data, strefa, zakres, transfer, retencja, źródło | operator Motka | unverified |
| Cloudflare Turnstile: widget production/staging | Zrzut domen/widgetu bez sekretu oraz potwierdzenie Siteverify | polityka Turnstile, rola Cloudflare, lokalizacja sygnałów, transfer, retencja, subprocesorzy | URL, data, widget/domeny, zakres sygnałów, transfer, retencja, źródło | operator Motka | unverified |

### Minimalny wpis dla każdego dowodu

    Dostawca i zakres:
    Środowisko:
    Źródło HTTPS:
    Data pozyskania:
    Co dokładnie potwierdza:
    Region/lokalizacja:
    Transfer poza EOG i zabezpieczenie:
    Retencja oraz usuwanie:
    Plan/usługa/projekt:
    Plik lub zrzut bez sekretów:
    Potwierdzenie operatora:

### Bramka decyzji

Do czasu uzupełnienia wszystkich pól i ponownego przejścia
npm run legal:check obowiązuje:

- nie zmieniać status ani verifiedAt w data/legal-data-providers.json;
- nie wdrażać e691af8 ani jego następców do Production;
- nie wykonywać cleanupu legacy RPC;
- nie traktować migracji Supabase ani testów lokalnych jako dowodu legalnego.

Po zebraniu dowodów można przygotować osobny, mały commit manifestu legalnego,
uruchomić npm run legal:check, przeprowadzić niezależną recenzję i dopiero
potem wrócić do stagingu oraz kolejnego okna produkcyjnego.

## Snapshot konfiguracji kontowej — odczyt read-only 2026-08-15

Poniższy snapshot został zebrany z konektorów dostawców bez zmiany ustawień.
Potwierdza konfigurację techniczną Motka, ale nie jest samodzielnym dowodem
warunków prawnych. Nie zmienia statusu `unverified` w manifeście.

### Supabase

- Production: projekt `Motek Production`, ref `vueotocjsgzosqzhcish`, status
  `ACTIVE_HEALTHY`, region `eu-north-1`, PostgreSQL `17.6.1.155`.
- Staging: projekt `Motek Staging`, ref `rprhbmtabwjsenvfgicg`, status
  `ACTIVE_HEALTHY`, region `eu-north-1`, PostgreSQL `17.6.1.155`.
- Odczyt potwierdza identyfikację projektów, region i zdrowie usługi. Nie
  potwierdza planu, konfiguracji backupów, retencji, transferu ani usuwania
  danych.
- Dowód techniczny: wynik read-only `supabase_get_project` / `supabase_list_projects`,
  pozyskany 2026-08-15. Do pakietu operatora należy dołączyć zrzut lub eksport
  panelu projektu obejmujący plan i backupy.

### Railway

- Production: projekt `balanced-fulfillment`, usługa `Motek`, źródło
  `Piotr-Ciesielski/Motek` z gałęzi `main`, Dockerfile
  `/deploy/railway/Dockerfile`, jedna replika w `sfo`, domena
  `https://www.rysia.org`.
- Staging: gałąź `staging`, jedna replika w `sfo`, domeny
  `https://staging.rysia.org` oraz
  `https://motek-staging-motek.up.railway.app`.
- Produkcyjny deployment `063029eb-4ea6-415b-884d-d51823ecd359` zakończył się
  statusem `SUCCESS` 2026-08-15. Log startowy potwierdził nasłuchiwanie na
  porcie 8080 i połączenie z Supabase.
- Odczyt nazw zmiennych nie ujawniał ich wartości ani sekretów. Nie potwierdza
  planu workspace'u, retencji logów, lokalizacji przetwarzania logów, transferu
  ani usuwania danych.
- Dowód techniczny: wynik read-only `railway_get_service_config`,
  `railway_list_domains`, `railway_list_deployments` i
  `railway_get_logs`, pozyskany 2026-08-15. Do pakietu operatora należy
  dołączyć zrzut planu workspace'u i ustawień retencji/logów.

### Cloudflare Edge i Turnstile

- Wcześniejszy snapshot konektorowy pozostawał materiałem roboczym: proxied DNS
  produkcji, DNS-only dla stagingu, ustawienia TLS i brak reguł custom wymagały
  datowanego potwierdzenia z panelu.
- Późniejszy odczyt zalogowanego panelu Cloudflare z 2026-08-15 dostarczył
  account-specific dowodu technicznego, opisanego w sekcji poniżej. Nie jest on
  samodzielnym dowodem warunków prawnych ani lokalizacji przetwarzania.
- Nie zmieniono żadnych ustawień Cloudflare ani sekretów Turnstile.

## Snapshot paneli zalogowanych — odczyt read-only 2026-08-15

Uzupełniający odczyt wykonano w istniejących, zalogowanych panelach dostawców.
Nie wykonywano zapisów, wdrożeń, zmian planu, zmian sekretów ani odrzucania
oczekujących zmian. Są to dowody techniczne konfiguracji konta; nie zastępują
oceny prawnej i nie zmieniają statusu `unverified` w manifeście.

### Supabase Production

- Panel projektu `Motek Production` potwierdza plan `Free`, status `Healthy`,
  region `North EU (Stockholm)` (`eu-north-1`) i PostgreSQL `17.6.1.155`.
- Panel pokazuje `Last migration: production_legal_versioned_recovery_delta`
  oraz `Last backup: No backups`.
- Odczyt nie zmieniał ustawień backupów ani danych. Brak backupu widocznego w
  panelu jest ryzykiem operacyjnym i pozostaje osobnym punktem do decyzji.

### Railway Production

- Panel usługi `Motek` potwierdza repozytorium
  `Piotr-Ciesielski/Motek`, gałąź `main`, domenę `www.rysia.org`, region
  `US West (California, USA)` i jedną replikę.
- Auto-deploy z gałęzi GitHub jest wyłączony. Ustawienia wynikające z
  `railway.json` są widoczne jako `Start command: node server.js` oraz
  `Healthcheck Path: /health/ready`.
- Panel ma obecnie `2 changes to apply`: usunięcie `Healthcheck Path` oraz
  usunięcie `Start Command`. Nie zastosowano ani nie odrzucono tych zmian,
  ponieważ ich zastosowanie spowodowałoby ponowne wdrożenie produkcji.

### Cloudflare Edge i Turnstile

- Panel konta potwierdza strefę `rysia.org` na planie `Free`, pełny status DNS
  oraz ruch przechodzący przez Cloudflare. Panel nie wykazał podłączonego
  Workera dla tej strefy.
- Panel Turnstile potwierdza widget `Motek production`, tryb `Managed`,
  `2` hostnames i brak pre-clearance.
- Cloudflare wyświetla ostrzeżenie: `Siteverify isn't being called for Motek
  production`; tokeny widgetu nie są walidowane, a chronione formularze
  pozostają otwarte na boty. To jest aktywna blokada bezpieczeństwa, a nie
  tylko brak dokumentu.
- Nie odczytywano ani nie zapisywano sekretu Turnstile. Nie zmieniano ustawień
  Cloudflare.

## Diagnoza braku Siteverify — 2026-08-15

- Kod Motka renderuje widget Turnstile z publicznym site key i przekazuje
  otrzymany `captchaToken` do Supabase Auth przy rejestracji, logowaniu oraz
  żądaniu resetu hasła. Nie ma potrzeby dodawania osobnego endpointu
  `siteverify` do aplikacji, jeśli działa wbudowana integracja Supabase Auth.
- Oficjalna dokumentacja Supabase wskazuje, że trzeba włączyć ochronę CAPTCHA
  w ustawieniach Auth projektu, wybrać Cloudflare Turnstile i zapisać jego
  Secret Key. Sam widget w przeglądarce nie wystarcza.
- Ostrzeżenie Cloudflare `Siteverify isn't being called` oznacza więc, że
  produkcyjna konfiguracja Supabase Auth najprawdopodobniej nie ma aktywnej
  integracji Turnstile albo nie ma zapisanego sekretu. To wymaga odczytu i
  ewentualnej konfiguracji w panelu Supabase dla Production oraz Staging.
- Preferowany jest ten prostszy wariant oparty o Supabase Auth. Własna walidacja
  `siteverify` w backendzie byłaby osobną zmianą architektoniczną i nie jest
  obecnie potrzebna ani zatwierdzona.
- Źródło: [Supabase — Enable CAPTCHA Protection](https://supabase.com/docs/guides/auth/auth-captcha).

## Odczyt Supabase Auth Protection — 2026-08-15

- Production: `Enable Captcha protection` jest włączone, provider to
  `Turnstile by Cloudflare`, sekret jest zapisany, a przycisk `Save changes`
  pozostaje nieaktywny. Wartości sekretu nie odczytywano ani nie ujawniano.
- Staging: identycznie — ochrona jest włączona, provider to Turnstile, sekret
  jest zapisany, a formularz nie ma niezapisanych zmian. Nie odczytywano ani
  nie ujawniano wartości sekretu.
- Odczyt nie wykonywał logowania, rejestracji, resetu hasła ani żadnej operacji
  na danych użytkowników. Nie zmieniono konfiguracji Supabase.
- Wniosek: wcześniejsza hipoteza o pustym sekrecie nie potwierdziła się.
  Ostrzeżenie Cloudflare o braku `Siteverify` wymaga jeszcze kontrolowanego
  testu rzeczywistego przepływu Auth albo obserwacji logów; samo ostrzeżenie
  nie jest wystarczającym dowodem, że konfiguracja Supabase jest wyłączona.

## Kontrolowany probe stagingu — 2026-08-15

- Wysłano jedno żądanie `POST /api/auth/login` na staging z poprawnym
  pochodzeniem, fikcyjnym adresem e-mail, fikcyjnym hasłem i testowym dummy
  tokenem CAPTCHA. Odpowiedź była `401 Nieprawidłowy e-mail lub hasło.`; nie
  utworzono konta i nie wykonano zapisu danych.
- Po odświeżeniu panelu Cloudflare ostrzeżenie `Siteverify isn't being called`
  dla widgetu produkcyjnego pozostało bez zmian.
- Wynik jest niejednoznaczny: test potwierdza ścieżkę backendu Auth, ale dummy
  token nie jest dowodem pomyślnej walidacji Turnstile. Do zamknięcia blokady
  potrzebny jest kontrolowany test z prawdziwym tokenem uzyskanym przez widget
  oraz bezpiecznym kontem QA stagingu albo jednoznaczny odczyt logów dostawcy.
- Nie wykonywano analogicznego testu na produkcji.

## Korelacja publicznego site key — 2026-08-15

- Production `/api/config` zwraca publiczny site key
  `0x4AAAAAAEGHX0B76Mq86Y3p`, zgodny z widgetem `Motek production` odczytanym
  w panelu Cloudflare. Nie jest to sekret.
- Staging `/api/config` zwraca oficjalny testowy site key
  `1x00000000000000000000AA`; testowy token pozostaje ograniczony do stagingu.
- W połączeniu z odczytem Supabase Auth Protection oznacza to, że znane
  elementy konfiguracji (`enabled`, provider, site key i obecność sekretu)
  są spójne między aplikacją, Supabase i Cloudflare. Nadal brakuje dowodu
  pomyślnej walidacji prawdziwego tokenu produkcyjnego.

## Ręczny smoke Auth QA — staging — 2026-08-15

- Operator wykonał ręczne logowanie istniejącym kontem QA na
  `https://staging.rysia.org`.
- Logowanie zakończyło się sukcesem i dostęp do aplikacji został uzyskany.
- Hasło, token CAPTCHA i dane konta nie zostały przekazane ani zapisane w
  dokumentacji.
- Ten wynik potwierdza stagingowy przepływ Auth z użytkownikiem QA. Nie jest
  pełną regresją mutacji danych i nie potwierdza produkcyjnego Siteverify,
  ponieważ staging używa testowego widgetu Turnstile.

## Diagnoza pustych dopasowań — staging — 2026-08-15

- Operator potwierdził poprawne działanie magazynu włóczek, ale ekran
  dopasowania zwracał dla każdego magazynu komunikat o braku pełnego
  dopasowania.
- Odczyt stagingowego `public.patterns` wykazał 111 rekordów, z czego 111
  ma `publication_status = pending_review`, a 0 ma `publication_status =
  published`. Żaden rekord nie ma jeszcze `content_audit_version` ani
  `content_audited_at`.
- To jest zgodne z zachowaniem backendu: `getCatalogPatterns()` filtruje
  katalog do rekordów `published`, a `/api/matches` korzysta z tego samego
  katalogu. Przy zerowej liczbie opublikowanych wzorów wynik dopasowania
  jest pusty niezależnie od zawartości prywatnego magazynu.
- Trzy syntetyczne wzory demonstracyjne również są obecnie
  `pending_review`; nie publikowano ich automatycznie. Rozwiązanie wymaga
  osobnego audytu i decyzji dotyczącej publikacji katalogu, a nie obejścia
  filtra `published`.
- Porównanie identyfikatorów źródeł wykazało, że staging zawiera 106 rekordów
  zgodnych z lokalnym `data/patterns-import.json` oraz pięć dodatkowych
  rekordów testowych: `test-motek-fingering-any-material.pdf`,
  `test-motek-holly-berry.pdf`, `test-motek-oslo-double.pdf`,
  `test-motek-sport-bamboo.pdf` i `test-motek-sport-cotton.pdf`. Wszystkie
  pozostają `pending_review`; nie wchodzą do audytu właściwego katalogu.
- Usunięcie tych pięciu rekordów wymaga osobnej zgody na zmianę danych
  stagingu. Do czasu decyzji traktujemy je jako nieuzgodniony fixture, a nie
  część źródła prawdy katalogu.

## Audyt pierwszego pakietu katalogu — 2026-08-15

Read-only weryfikacja stron autorów/wydawców potwierdziła tożsamość i zakres
metadanych dla trzech wzorów, które już mają lokalne warianty dopasowania:

- `HollyBerryCharitySocks.pdf` → [Ravelry — HollyBerryCharitySocks](https://www.ravelry.com/patterns/library/hollyberrycharitysocks),
- `Kopia pliku na_pole_wzor.pdf` → [Ravelry — Na Pole Tee](https://www.ravelry.com/patterns/library/na-pole-tee),
- `Oslohuen_2.0_ENGELSK.pdf` → [PetiteKnit — Oslo Hat](https://www.petiteknit.com/en/products/oslo-hue).

Manifest `data/pattern-content-audit.json` oznacza te trzy rekordy jako
`published` z datą audytu `2026-08-15` i zachowuje pozostałe 103 rekordy jako
`hidden`. Jest to wyłącznie przygotowanie lokalnego pakietu; nie wykonano
jeszcze importu do Supabase ani publikacji na stagingu. Przed importem należy
uruchomić walidację i uzyskać zgodę na zmianę zdalnych danych stagingu.

## Reconciliation Supabase Production — odczyt read-only 2026-08-15

Po migracji wykonano ponowny, ograniczony odczyt metadanych i agregatów
Production. Wynik nie zmienia schematu ani danych użytkowników:

- migracja `20260815115028 / production_legal_versioned_recovery_delta` jest
  obecna w historii Supabase;
- `private.auth_recovery_grants` ma 0 rekordów, a kolumny obejmują
  `jti_hash`, `user_id`, `expires_at`, `used_at`, `created_at`, `claimed_at`;
- `private.yarn_store_versions` ma 2 rekordy, z `max(version) = 4`;
- RPC recovery `claim_auth_recovery_grant(text)`,
  `release_auth_recovery_grant(text)` i
  `consume_auth_recovery_grant(text)` są wykonywalne przez `authenticated`;
- legacy UUID overload `consume_auth_recovery_grant(uuid,text)` nie jest
  wykonywalny przez `authenticated`;
- wersjonowane RPC yarnów są obecne i wykonywalne przez `authenticated`;
- oba legacy overloads `insert_yarn_with_limit(...)` nadal istnieją i są
  wykonywalne przez `authenticated`. Ich usunięcie pozostaje odroczone do
  czasu wdrożenia zgodnego release'u i obserwacji po wdrożeniu.

Odczyt tabel wykazał siedem tabel schematu `private`; advisory Supabase
`rls_disabled` zgłosił sześć z nich (`yarn_store_versions`,
`legal_document_versions`, `terms_acceptances`, `registration_invitations`,
`registration_attempts`, `privacy_notice_deliveries`).
`auth_recovery_grants` ma RLS włączone i nie pojawia się na tej liście.
Read-only privilege check potwierdził, że role `anon` i `authenticated` nie
mają uprawnień `USAGE` do schematu `private` ani bezpośrednich uprawnień
odczytu lub mutacji tych tabel. Oznacza to, że advisory nie jest obecnie
dowodem publicznej ekspozycji danych; pozostaje jednak brak obrony warstwowej
i ryzyko przy przyszłej zmianie ekspozycji lub błędzie w RPC.
Nie stosuję automatycznej remediacji: włączenie RLS bez dopasowanych polityk
może zablokować legalne operacje backendu. Przed zmianą potrzebna jest osobna
analiza ekspozycji schematu `private`, ścieżek RPC i polityk właścicielskich,
a następnie testy regresji.

Źródło: read-only `supabase_list_migrations`, `supabase_list_tables` oraz
`supabase_execute_sql`, projekt `vueotocjsgzosqzhcish`, pozyskane
2026-08-15. Odczyt nie zawiera sekretów ani surowych danych użytkowników.

## Audyt kontraktu RPC Production — odczyt read-only 2026-08-15

- `create_auth_recovery_grant()` dla zalogowanego użytkownika oraz tekstowe
  `claim/release/consume` są `SECURITY DEFINER`, mają `search_path = ''`,
  wiążą operację z `auth.uid()` i są wykonywalne przez `authenticated`, ale
  nie przez `anon`.
- Przeciążenie administracyjne `create_auth_recovery_grant(uuid,text,timestamptz)`
  jest ograniczone do `service_role`; stare UUID `consume` nie jest dostępne
  dla `authenticated`.
- Wersjonowane RPC magazynu (`get/insert/update/delete_yarn_versioned`) mają
  `SECURITY DEFINER`, pusty `search_path`, kontrolę właściciela, kontrolę
  wersji i wymaganie aktualnej akceptacji dokumentów.
- Oba legacy `insert_yarn_with_limit(...)` nadal są wykonywalne przez
  `authenticated`. Nie są `SECURITY DEFINER`, ale stanowią stary publiczny
  kontrakt i nie mogą zostać usunięte przed potwierdzeniem, że nie ma już
  kompatybilnych klientów oraz że release korzysta wyłącznie z wersjonowanych
  RPC.
- Brakuje pełnych testów negatywnych dla wszystkich recovery RPC: jawnego
  zachowania bez sesji, `PUBLIC/anon` dla każdego przeciążenia, grantu
  wygasłego i grantu należącego do innego użytkownika. To jest luka testowa,
  nie zgoda na zmianę produkcji.

Decyzja techniczna na teraz: nie włączać RLS ad hoc i nie wykonywać cleanupu
legacy RPC. Najpierw uzupełnić lokalne testy kontraktu RPC, wykonać replay
migracji oraz ponownie zweryfikować Production read-only. Dopiero potem można
przygotować małą, forward-only zmianę i osobno zatwierdzić jej wykonanie.

## Świeży publiczny smoke — 2026-08-15

Odczyt GET bez sesji potwierdził aktualny rozjazd środowisk:

| Środowisko | `/health/release` | `/informacje-prawne` | anonimowy `/api/patterns` |
|---|---|---:|---:|
| Production | `200`, `environment=production`, `commit=local` | `404` | `200` |
| Staging | `200`, exact `e691af891758ebc17f6d4683dbca5d997f65dbe5`, `environment=staging` | `200` | `401` |

Production `/health/live` i `/health/ready` zwróciły `200`, ale nie zamyka to
bramki promocji: brak dokładnego SHA, brak strony prawnej i anonimowy dostęp
do katalogu pozostają kryteriami STOP. Smoke nie wykonywał zapisu, logowania,
migracji, cleanupu ani zmian Cloudflare.

Dodatkowy odczyt kontraktu API potwierdził w obu środowiskach: `/api/config`
zwraca `200`, chronione `/api/yarns` i `/api/matches` zwracają `401`, a
`/internal/metrics` zwraca `404`. Ten wynik nie zmienia blokady produkcji, ale
potwierdza, że problem nie dotyczy ogólnej ochrony API ani publicznych metryk.

Automatyczny `npm run regression:smoke` przeszedł dla stagingu z exact
`e691af891758ebc17f6d4683dbca5d997f65dbe5`. Uruchomienie tego samego profilu
dla Production z oczekiwanym rollbackiem `c4b777a5f8a96277c0e7fb7ca6ec52d425a0900b`
nie zakończyło się w limicie runnera, ponieważ Production nadal zwraca
`commit: local` zamiast 40-znakowego SHA. Jest to formalne potwierdzenie
blokady exact release; smoke był wyłącznie odczytowy.

Diagnoza źródłowa: `release-info.js` raportuje exact SHA wyłącznie z
`RAILWAY_GIT_COMMIT_SHA`, a bieżący rollback został uruchomiony przez CLI z
izolowanego worktree. W tej ścieżce Railway nie przekazał SHA do procesu, więc
aplikacja prawidłowo przełączyła się na bezpieczną wartość `local`. Nie należy
omijać tej bramki zmianą kodu; przyszłe wdrożenie exact SHA musi użyć ścieżki,
która przekaże identyfikator do środowiska, a następnie przejść smoke.

## Niezależna recenzja i check lokalny — 2026-08-15

- Pełny `npm run check` przeszedł: 363 testy, 0 błędów.
- Recenzja kontraktu publicznego potwierdziła, że kolejny release musi
  zapewnić między innymi `200` dla `/health/live`, `/health/ready` i
  `/health/release` przy prawidłowym środowisku oraz `401` dla anonimowego
  `/api/patterns`, `/api/yarns` i `/api/matches`.
- Zapisany stan produkcyjny nadal nie spełnia bramki GO: `/informacje-prawne`
  i anonimowy katalog pozostają do ponownej weryfikacji na dokładnym release;
  `e691af8` nie jest zatwierdzony do produkcji.
- Włączenie RLS na sześciu tabelach zgłoszonych przez advisory pozostaje
  osobnym zadaniem bezpieczeństwa. Najpierw trzeba potwierdzić ekspozycję
  schematu, ścieżki RPC i polityki właścicielskie; dopiero potem można
  przygotować migrację oraz testy. Nie wykonano żadnej zmiany zdalnej.

## Oficjalne źródła referencyjne — zebrane 2026-08-15

Poniższe materiały potwierdzają warunki ogólne usług. Nie potwierdzają same
w sobie planu, ustawień ani zakresu przetwarzania konkretnego konta Motka.
Do każdego dostawcy nadal potrzebny jest dowód konfiguracji konta.

### Supabase

- Regiony platformy: https://supabase.com/docs/guides/platform/regions
- Backupy i restore: https://supabase.com/docs/guides/platform/backups
- Backup/restore CLI: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- DPA: https://supabase.com/downloads/docs/Supabase%2BDPA%2B260601.pdf

Do potwierdzenia kontowego pozostają: plan projektu vueotocjsgzosqzhcish,
aktualny region, zakres Database/Auth/Storage, retencja i sposób wykonywania
backupów oraz zasady usuwania danych.

### Railway

- DPA: https://railway.com/legal/dpa
- Privacy Policy: https://railway.com/legal/privacy
- Logi i retencja planów: https://docs.railway.com/observability/logs
- Lista subprocesorów: https://trust.railway.com/item/subprocessors

Materiały Railway wskazują między innymi retencję logów zależną od planu oraz
możliwe transfery poza EOG opisane w DPA. Do potwierdzenia kontowego pozostają:
plan workspace’u, region usługi Motek, zakres logów, retencja dla bieżącego
planu oraz rzeczywisty zakres przetwarzania.

### Cloudflare Edge i Turnstile

- Data Localization Suite: https://developers.cloudflare.com/data-localization/
- Region support: https://developers.cloudflare.com/data-localization/region-support/
- Customer Metadata Boundary: https://developers.cloudflare.com/data-localization/metadata-boundary/get-started/
- Turnstile: https://developers.cloudflare.com/turnstile/
- Siteverify: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Customer DPA: https://cf-assets.www.cloudflare.com/slt3lc6tev37/1TTgT35GoUNlKZYGuKWBFy/4e7dfc8cf402419a9b1cf624291fc69f/cloudflare_customer_dpa-v6.4_april_3_2026.pdf

Materiały Cloudflare wyraźnie rozdzielają lokalizację przetwarzania ruchu,
lokalizację metadanych/logów oraz ustawienia Turnstile. Do potwierdzenia
kontowego pozostają: rzeczywisty status Customer Metadata Boundary, ustawienia
strefy i widgetów, zakres analytics/logów, retencja oraz używane warunki DPA.
