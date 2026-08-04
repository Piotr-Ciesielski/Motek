# Runbook wdrożenia i regresji Motka

Dokument opisuje bieżący przepływ dla Railway, Cloudflare i Supabase. Nie zawiera sekretów ani wartości kluczy.

## Środowiska

| Środowisko | Gałąź | Adres | Deploy | Test po deployu |
|---|---|---|---|---|
| staging | `staging` | `https://staging.rysia.org` | automatyczny po pushu | `regression:full` |
| production | `main` | `https://www.rysia.org` | ręczny | `regression:smoke` |

Każde środowisko korzysta z osobnego projektu Supabase. Dane stagingowe są syntetyczne i nie mogą być kopiowane do produkcji. Konfiguracja publicznej domeny jest obsługiwana przez Cloudflare, a Railway pozostaje originem aplikacji.

## Publikacja na staging

1. Wypchnij zaakceptowane zmiany do `staging`.
2. Railway powinien rozpocząć deploy automatycznie. Sprawdź status usługi i healthcheck `/health/ready`.
3. GitHub Actions uruchomi pełną regresję. Wymaga zmiennej `MOTEK_BASE_URL` oraz sekretów środowiska `MOTEK_QA_EMAIL` i `MOTEK_QA_PASSWORD`.
4. Zaakceptuj staging dopiero po zielonym `npm run check` i zielonej regresji.

## Ręczna publikacja produkcji

Auto-deploy produkcji jest wyłączony. Po zaakceptowaniu stagingu:

```powershell
railway redeploy --service Motek --environment production --from-source --yes
```

Polecenie pobiera aktualny kod z gałęzi skonfigurowanej dla produkcji (`main`). Po deployu sprawdź `/health/release`, `/health/ready`, logi Railway i workflow `regression:smoke`. Nie uruchamiaj produkcji z gałęzi `staging` ani z bieżącej gałęzi roboczej.

## Zakres regresji

Profil `full` na stagingu sprawdza HTTPS, healthchecki, konfigurację CAPTCHA, katalog wzorów, autoryzację, odczyt profilu i magazynu, dodanie/edycję/usunięcie włóczki, dopasowania oraz wylogowanie. Rekordy testowe mają prefiks `regression-` i są usuwane po teście.

Profil `smoke` na produkcji jest niedestrukcyjny: sprawdza HTTPS, kanoniczną domenę, healthchecki, wersję/SHA, zasoby frontendowe, nagłówki bezpieczeństwa, publiczny katalog, odpowiedzi 401/403 i brak publicznych metryk. Operacje wymagające prawdziwego Turnstile wykonuje operator ręcznie.

W obu profilach należy potwierdzić wygaśnięcie sesji po 2 godzinach bezczynności (`AUTH_IDLE_TIMEOUT_SECONDS=7200`) w cyklicznym teście ręcznym; automatyczny test nie powinien czekać dwóch godzin.

## DNS i HTTPS

Nameservery domeny są delegowane do Cloudflare. Rekordy `@` i `www` wskazują na origin Railway dla produkcji, `staging` na origin stagingu, a rekordy TXT służą weryfikacji domeny Railway. Proxy Cloudflare jest włączone dla publicznych rekordów aplikacji; po zmianach DNS należy sprawdzić propagację i certyfikat HTTPS.

## Rollback

Jeśli smoke test lub healthcheck nie przejdzie, wstrzymaj dalszą publikację i zachowaj logi. W Railway wybierz poprzedni udany deployment i wykonaj rollback. Rollback kontenera nie cofa migracji Supabase — migracje wymagają osobnej, kompatybilnej procedury naprawczej. Nie wyłączaj proxy Cloudflare jako pierwszego kroku; użyj tego tylko jako awaryjnej diagnostyki.

## Kontrola sekretów

Nie wpisuj kluczy Supabase, Turnstile, Railway ani haseł QA do repozytorium, logów, issue ani dokumentacji. W GitHub Environment `staging` przechowuj tylko `MOTEK_QA_EMAIL` i `MOTEK_QA_PASSWORD` jako sekrety; produkcja nie potrzebuje sekretów QA dla automatycznego smoke testu.
