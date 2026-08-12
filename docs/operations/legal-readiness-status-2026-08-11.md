# Stan gotowości prawnej i postęp prac — 2026-08-11

Ten raport jest bieżącym punktem odniesienia dla prac nad regulaminem,
informacją o prywatności i rejestrem dostawców. Nie zastępuje przeglądu
prawnego przez operatora.

## Aktualizacja stanu — 2026-08-12

W ramach punktu A1 odczytowo potwierdzono konfigurację produkcyjną:

- Supabase Production (`Motek Production`) jest aktywny, działa w regionie
  `eu-north-1`, a organizacja ma plan Free. Staging działa w tym samym regionie.
- Railway Production ma osobne środowisko, jedną replikę w regionie `sfo`,
  domenę `www.rysia.org` i ostatni odczytany deployment zakończony statusem
  `SUCCESS`.
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

## Co zrobiono dziś

- poprawiono nachodzenie mobilnej nawigacji na dolną nawigację aplikacji;
- uzupełniono operatora prawnego: Piotr Ciesielski,
  `pc.piotr.ciesielski@gmail.com`;
- uzupełniono manifest dostawców o potwierdzone plany, znane regiony,
  dostępne informacje o retencji i źródła dowodowe;
- zachowano bramkę fail-closed: produkcja nie przejdzie dalej na podstawie
  samych deklaracji planu;
- uruchomiono lint, formatowanie, 23 testy prawne oraz pełny check projektu
  obejmujący 346 testów — wszystkie zakończyły się powodzeniem;
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
| Cloudflare (`edge` + `turnstile`) | Plan Free. Turnstile opisuje minimalne sygnały antybotowe, m.in. IP, fingerprint TLS, User-Agent, sitekey i origin. Edge obsługuje DNS, proxy, TLS i WAF dla ruchu aplikacji. | Potwierdzić osobno dla obu zakresów rzeczywistą retencję, lokalizację przetwarzania, transfery poza EOG, role Cloudflare, właściwe DPA/subprocesorów oraz ochronę originu Railway. Dla Turnstile nie znaleziono stałego okresu retencji w przywołanym dodatku. |

Źródła robocze:

- [Supabase — regiony](https://supabase.com/docs/guides/platform/regions)
- [Supabase — ceny i limity planu Free](https://supabase.com/pricing)
- [Railway — logi i retencja](https://docs.railway.com/observability/logs)
- [Cloudflare — Turnstile Privacy Addendum](https://www.cloudflare.com/en-in/turnstile-privacy-policy/)

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
