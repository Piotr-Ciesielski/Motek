# Wdrożenie i regresja po wdrożeniu

Ten runbook prowadzi właściciela Motka od pustych środowisk do decyzji o udostępnieniu produkcji. Repozytorium zawiera konfigurację i testy, ale nie tworzy projektów ani nie zmienia ustawień Railway, Cloudflare, Supabase lub GitHub. Kroki w panelach i pierwsze wdrożenie wykonuje operator.

## 1. Docelowy układ

```text
użytkownik -> Cloudflare (DNS, proxy, WAF, TLS)
            -> Railway (staging albo production)
            -> aplikacja Node.js Motek
            -> osobny projekt Supabase dla danego środowiska
```

- `staging.rysia.org` prowadzi do Railway `staging`, gałęzi `staging` i stagingowego Supabase z wyłącznie testowymi danymi.
- `www.rysia.org` prowadzi do Railway `production`, gałęzi `main` i produkcyjnego Supabase.
- `rysia.org` wykonuje stałe przekierowanie 301 lub 308 do `www.rysia.org`, z zachowaniem ścieżki i parametrów.
- Cloudflare używa TLS **Full (strict)** i weryfikuje certyfikat Railway.

## 2. Kolejność i bramka promocji

1. Utwórz dwa odrębne projekty Supabase i dwa środowiska Railway.
2. Najpierw skonfiguruj staging, zastosuj migracje, dodaj testowe dane i konto QA, a potem podłącz `staging.rysia.org`.
3. Uruchom `npm run railway:check`, wdróż gałąź `staging` i wymagaj zielonego `regression:full` oraz ręcznej macierzy z sekcji 8. Każde niepowodzenie oznacza **no-go**.
4. Dopiero po przejściu stagingu skonfiguruj produkcyjny Supabase i Railway, zastosuj ocenione migracje i wdróż `main`.
5. Sprawdź produkcję na domenie Railway, potem własną domenę i `regression:smoke`. Wykonaj ręczny QA z sekcji 11 przed skierowaniem ruchu.

Automat nie tworzy środowisk, DNS, WAF, kluczy Turnstile ani konta QA; nie stosuje migracji, nie importuje wzorów, nie promuje wdrożenia i nie robi rollbacku. Nie automatyzuje rejestracji, potwierdzenia e-maila, resetu hasła ani usunięcia konta na prawdziwym Turnstile.

## 3. Railway

Połącz `staging` z gałęzią `staging`, a `production` z `main`. Ustaw jedną replikę. `railway.json` i `deploy/railway/Dockerfile` definiują start `node server.js`, Node.js 24, healthcheck `/health/ready`, 300 sekund oczekiwania i restart po błędzie. `PORT` pozostaw Railway — nie twórz ani nie nadpisuj tej zmiennej.

W Railway Variables ustaw osobno dla każdego środowiska:

| Nazwa | Staging | Produkcja | Sekret |
| --- | --- | --- | --- |
| `NODE_ENV` | `production` | `production` | nie |
| `DEPLOYMENT_ENV` | `staging` | `production` | nie |
| `HOST` | `0.0.0.0` | `0.0.0.0` | nie |
| `APP_ORIGIN` | `https://staging.rysia.org` | `https://www.rysia.org` | nie |
| `COOKIE_SECURE` | `true` | `true` | nie |
| `TRUST_PROXY` | `true` | `true` | nie |
| `SUPABASE_URL` | URL stagingu | URL produkcji | nie |
| `SUPABASE_PUBLISHABLE_KEY` | klucz stagingu | klucz produkcji | nie |
| `SUPABASE_SECRET_KEY` | sekret stagingu | sekret produkcji | **tak** |
| `CAPTCHA_ENABLED` | `true` | `true` | nie |
| `CAPTCHA_PROVIDER` | `turnstile` | `turnstile` | nie |
| `CAPTCHA_SITE_KEY` | testowy site key | prawdziwy site key | nie |
| `METRICS_ENABLED` | `false` | `false` | nie |

Nie kopiuj wartości między środowiskami. `SUPABASE_SECRET_KEY` jest wyłącznie sekretem backendu; nie może znaleźć się w GitHub Actions ani przeglądarce.

## 4. GitHub Environments

Environment `staging`:

- variable `MOTEK_BASE_URL=https://staging.rysia.org`;
- secrets `MOTEK_QA_EMAIL` i `MOTEK_QA_PASSWORD` dla dedykowanego konta QA;
- deployment branch policy: wyłącznie `staging`.

Environment `production`:

- variable `MOTEK_BASE_URL=https://www.rysia.org`;
- bez sekretów QA i bez sekretów administracyjnych;
- deployment branch policy: wyłącznie `main`.

Workflow `.github/workflows/post-deploy-regression.yml` bierze SHA ze zdarzenia `deployment_status`, pobiera dokładnie ten commit i odrzuca inną parę środowisko/gałąź. Integracja wdrożeniowa musi wysłać to zdarzenie; sam workflow jej nie konfiguruje.

## 5. Cloudflare: DNS, TLS i ochrona

1. Dodaj CNAME dla `staging` i `www` oraz rekordy TXT dokładnie w postaci pokazanej przez Railway dla właściwej domeny. Nie zgaduj celu ani wartości.
2. Na czas walidacji ustaw CNAME jako **DNS only**. Proxy włącz dopiero po potwierdzeniu domeny i certyfikatu.
3. Ustaw SSL/TLS na **Full (strict)** i włącz **Always Use HTTPS**.
4. Dodaj stałe przekierowanie `rysia.org/*` do `https://www.rysia.org/$1`, zachowując query string.
5. Włącz dostępne zarządzane reguły WAF. Dodaj limity dla `/api/auth/*`, ostrzejsze dla rejestracji i resetu hasła. Nie cache'uj `/api/*`, Auth ani treści konta.
6. Na stagingu ustaw `X-Robots-Tag: noindex, nofollow`. Jeśli używasz Cloudflare Access, zezwól GitHub Actions na testy — ochrona nie może blokować workflow regresji.

Po ustabilizowaniu HTTPS można rozpocząć HSTS od `max-age=86400`, bez `includeSubDomains`. Proxy i WAF nie dowodzą, że originu Railway nie da się ominąć; usuń zbędne domeny Railway dopiero po sprawdzeniu domen własnych i healthchecka.

## 6. Supabase i Turnstile

Zastosuj ten sam uporządkowany zestaw `supabase/migrations/` osobno w stagingu i produkcji. Migracje nie uruchamiają się wraz z kontenerem. Przed promocją sprawdź RLS tabel eksponowanych przez API, Security Advisor, Performance Advisor i funkcje `SECURITY DEFINER`.

| Środowisko | Auth Site URL | dozwolony Redirect URL |
| --- | --- | --- |
| staging | `https://staging.rysia.org` | `https://staging.rysia.org/?recovery=1` |
| production | `https://www.rysia.org` | `https://www.rysia.org/?recovery=1` |

Staging używa oficjalnej testowej pary Turnstile i tokenu `XXXX.DUMMY.TOKEN.XXXX`. Testowe klucze i dummy token są dozwolone wyłącznie na stagingu. Produkcja używa prawdziwego site key w Railway i prawdziwego secret key w Supabase Auth. Secret key Turnstile nie trafia do aplikacji ani GitHub.

## 7. Komendy regresji

Przed publikacją konfiguracji uruchom lokalnie:

```text
npm run railway:check
```

Runner używa `MOTEK_BASE_URL`, `MOTEK_EXPECTED_SHA` (pełne 40 znaków) i `MOTEK_ENVIRONMENT`. Profil pełny wymaga też stagingowych `MOTEK_QA_EMAIL` i `MOTEK_QA_PASSWORD`:

```text
npm run regression:smoke
npm run regression:full
```

Nie wklejaj sekretów do polecenia, logu ani raportu. Workflow pobiera je z właściwego GitHub Environment.

## 8. Macierz testów

| Obszar | Staging auto `full` | Produkcja auto `smoke` | Ręcznie | Powód |
| --- | --- | --- | --- | --- |
| SHA, live, ready, HTTPS | tak | tak | przy diagnozie | automat potwierdza dokładny release |
| frontend, CSS, JS, CSP, brak CORS | tak | tak | widok telefon/desktop | automat nie ocenia wyglądu |
| katalog i paginacja | tak | tak | nie | odczyt niedestrukcyjny |
| prywatne API bez sesji, obcy Origin, prywatne metryki | tak | tak | nie | stałe kontrakty bezpieczeństwa |
| login konta QA | tak, dummy Turnstile | nie | produkcja: tak | produkcja ma prawdziwe wyzwanie |
| dodaj/edytuj włóczkę, ETag, dopasowania | tak | nie | produkcja: tak | automat nie modyfikuje produkcji |
| usuń dokładny testowy motek i logout | tak | nie | produkcja: tak | bezpieczne sprzątanie danych QA |
| apex `rysia.org` -> `www` | nie | tak | tak | reguła jest zewnętrzna |
| rejestracja, e-mail, reset hasła | nie | nie | staging i produkcja | wymagają e-maila i realnego Turnstile |
| usunięcie konta | nie | nie | staging przed promocją | nieodwracalne; nigdy automatycznie na produkcji |
| WAF/rate limit/noindex/Access | nie | nie | tak | ustawienia Cloudflare są zewnętrzne |
| RLS i izolacja projektów | nie | nie | tak | wymaga kontroli obu projektów |

Zielony wynik oznacza, że przetestowano wskazany SHA i profil. Czerwony wynik oznacza brak akceptacji, nie automatyczny rollback. Brak workflow oznacza problem ze zdarzeniem, Environment albo regułą gałęzi — nie sukces.

Pełny test tworzy jedną włóczkę `regression-<id>`, zapamiętuje ID i usuwa wyłącznie `/api/yarns/<to-id>`, również podczas sprzątania. Gdy cleanup zawiedzie, zaloguj się na konto QA, znajdź rekord o podanym ID, potwierdź nazwę i usuń tylko ten rekord. Nigdy nie czyść po prefiksie ani całego magazynu.

## 9. Diagnoza

Sprawdzaj kolejno:

1. `/health/release`: dokładny `commit` i właściwe `environment`;
2. log GitHub Actions: właściwy profil i Environment;
3. `/health/ready`: HTTP 200 i `status: ready`;
4. Railway deployment logs;
5. Cloudflare Security Events, DNS i TLS;
6. Supabase Auth/API logs.

Nie wypisuj ciasteczek, tokenów, haseł ani kluczy. Przypadek „stara wersja” rozstrzyga `/health/release`, nie wygląd strony.

## 10. Rollback i kryteria stop

W Railway wybierz **poprzedni udany deployment tego samego środowiska**, potem ponownie sprawdź SHA, readiness i regresję. Rollback aplikacji nie cofa migracji Supabase; dla niezgodnej migracji zatrzymaj publikację i użyj wcześniej przygotowanej procedury naprawczej bazy.

**Stop/no-go**: inne SHA, readiness różne od 200, nieudana wymagana regresja, niepewny cleanup, błędy 5xx, sekret w logu, problem RLS/advisors, wspólny Supabase dla obu środowisk, TLS inny niż Full (strict), WAF blokujący poprawny ruch lub brak sprawdzonego rollbacku.

## 11. Ręczny QA produkcji

Użyj dedykowanego zwykłego konta QA i prawdziwego Turnstile:

1. Zaloguj się i potwierdź prywatny magazyn.
2. Zanotuj stan. Dodaj dokładnie jedną włóczkę `prod-qa-<data-i-id>` i zapisz jej dokładne ID.
3. Potwierdź włóczkę w magazynie i działanie dopasowań.
4. Usuń wyłącznie rekord o zanotowanym ID i sprawdź jego brak.
5. Wyloguj się i potwierdź brak dostępu do magazynu.

Nie uruchamiaj `regression:full` na produkcji. Nie automatyzuj tam usunięcia konta i nie przekazuj Actions klucza administracyjnego Supabase. Rejestrację, e-mail i reset hasła sprawdź ręcznie; konto QA zachowaj do niedestrukcyjnych kontroli.
