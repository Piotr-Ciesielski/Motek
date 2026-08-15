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
