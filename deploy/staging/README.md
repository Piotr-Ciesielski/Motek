# Staging Motka

Ten katalog przygotowuje staging, ale sam go nie publikuje. Publiczny ruch HTTPS
wchodzi wyłącznie przez WAF (Nginx + ModSecurity + OWASP CRS). Aplikacja,
Prometheus i opcjonalna Grafana pozostają w prywatnej sieci Dockera.

## Przed pierwszym uruchomieniem

1. Skieruj DNS domeny stagingowej na serwer i przygotuj prawidłowy certyfikat TLS.
2. Skopiuj `.env.staging.example` do pliku `.env.staging`, który jest ignorowany
   przez Git. Uzupełnij URL i klucze Supabase, publiczny site key Turnstile oraz
   `APP_ORIGIN`/`SERVER_NAME` zgodne z domeną.
3. Umieść certyfikat jako `certs/server.crt`, a klucz jako `certs/server.key`.
   Katalog `certs/` jest ignorowany przez Git.
4. Sprawdź konfigurację:

```bash
npm run staging:check
docker compose -f deploy/staging/compose.yaml --env-file deploy/staging/.env.staging config
```

5. Uruchom stos:

```bash
docker compose -f deploy/staging/compose.yaml --env-file deploy/staging/.env.staging up -d --build
```

Kontrola procesu: `https://DOMENA/health/live`. Kontrola połączenia z Supabase:
`https://DOMENA/health/ready`. Metryki `/internal/metrics` są blokowane przez
publiczny WAF i dostępne tylko dla Prometheusa w sieci prywatnej. Negatywny
readiness blokuje zwykły ruch odpowiedzią `503`, ale pozostawia dostępne
liveness, readiness i prywatne metryki potrzebne do diagnozy.

Grafanę można dodać drugim plikiem Compose. Nie publikuje ona portu; dostęp do
panelu wymaga osobnego, chronionego tunelu albo wewnętrznego reverse proxy.

## Ręczna checklista operatora (niewykonana przez kod)

- utwórz widget Cloudflare Turnstile ograniczony do domeny stagingowej;
- wpisz Turnstile secret key w Supabase Auth → Bot and Abuse Protection;
- sprawdź dozwolone redirect URL-e Supabase Auth;
- włącz ochronę przed wyciekłymi hasłami, jeżeli plan Supabase ją obsługuje;
- przejrzyj RLS oraz raporty Security i Performance Advisors;
- skonfiguruj Alertmanager i rzeczywistego odbiorcę alertów;
- wykonaj kontrolowany test reguł WAF przed dopuszczeniem użytkowników.

## Rollback

1. W `compose.yaml` ustaw poprzedni, zapisany wcześniej tag obrazu `motek`.
2. Odtwórz tylko aplikację, bez zmiany bazy danych:

```bash
docker compose -f deploy/staging/compose.yaml --env-file deploy/staging/.env.staging up -d --no-deps --no-build app
```

3. Sprawdź `/health/live`, `/health/ready`, logowanie i zapis jednej testowej
   włóczki. Jeśli WAF także był zmieniany, przywróć jego poprzedni dokładny tag i
   uruchom analogicznie usługę `waf`.

Dane są przechowywane w Supabase, więc rollback kontenera nie cofa migracji
bazy. Migracje trzeba wycofywać osobną, wcześniej sprawdzoną migracją naprawczą.
