# Motek

Motek to prywatna aplikacja webowa dla osób robiących na drutach i szydełku. Pozwala prowadzić własny magazyn włóczek, przeglądać katalog wzorów i sprawdzać, które projekty można wykonać z posiadanych materiałów.

## Ostatnie zmiany — 2026-08-23

- rejestracja działa automatycznie przez Supabase Auth i wymaga potwierdzenia adresu e-mail;
- po zalogowaniu lub zaakceptowaniu aktualnych dokumentów prawnych katalog odświeża się bez ręcznego przeładowania strony;
- długość i waga włóczki muszą być dodatnimi liczbami całkowitymi od 1 do 1 000 000;
- dopasowanie pokazuje najbliższy powód braku wyniku; włóczka z materiałem `mieszanka` może zostać oznaczona jako możliwa przy nieokreślonym składzie, ale nie jest wtedy prezentowana jako potwierdzone dopasowanie;
- uproszczono nagłówki ekranów Konta, Dopasowania i Katalogu.

## Lokalny start

Wymagane są Node.js 24, npm i projekt Supabase.

```powershell
npm install
if (-not (Test-Path -LiteralPath .env)) {
  Copy-Item -LiteralPath .env.example -Destination .env
}
npm start
```

Jeśli `.env` już istnieje, pozostaje bez zmian razem z zapisanymi w nim lokalnymi sekretami.

Aplikacja działa domyślnie pod `http://127.0.0.1:3001`, a publiczne informacje prawne pod `http://127.0.0.1:3001/informacje-prawne`.

Minimalny profil lokalny używa poniższych nazw kluczy. Wartości Supabase należy pobrać z właściwego projektu; sekretów nie wolno dodawać do Git. Lokalny `SUPABASE_URL` może wskazywać projekt zdalny, więc każdą operację zapisującą trzeba traktować świadomie.

```dotenv
HOST=127.0.0.1
PORT=3001
NODE_ENV=development
SUPABASE_URL=https://twoj-projekt.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
APP_ORIGIN=http://127.0.0.1:3001
COOKIE_SECURE=false
AUTH_IDLE_TIMEOUT_SECONDS=7200
IDLE_SESSION_SECRET=...
DEPLOYMENT_ENV=local
CAPTCHA_ENABLED=false
CAPTCHA_PROVIDER=turnstile
CAPTCHA_SITE_KEY=
METRICS_ENABLED=false
TRUST_PROXY=false
```

`IDLE_SESSION_SECRET` jest opcjonalny lokalnie. W środowiskach publicznych powinien być osobnym losowym sekretem.

## Polecenia

```powershell
npm start                 # serwer lokalny
npm run check             # składnia i wszystkie testy Node
npm run lint              # ESLint
npm run format:check      # kontrola formatowania
npm run coverage          # testy z progami pokrycia
npm run legal:check       # gotowość publikacji prawnej
npm run patterns:check    # walidacja importu bez zapisu
npm run invite -- create --email osoba@example.com --expires-at 2030-01-01T00:00:00Z
npm run invite -- revoke --id <id-zaproszenia>
npm run invite -- purge
npm run test:db           # lokalny Supabase i testy pgTAP
npm run railway:check     # kontrakt konfiguracji Railway
npm run regression:smoke  # niedestrukcyjny test wdrożenia
npm run regression:full   # pełna regresja stagingu
```

## Środowiska

Wersja źródła lokalnego to `2.0.0-alpha.38` w `VERSION` i `package.json`.

| Środowisko | Adres | Stan 2026-08-23 | Release |
| --- | --- | --- | --- |
| Staging | `https://staging.rysia.org` | osiągalny, `/health/release` gotowy; staging nie jest produkcją i nie jest dostępny dla użytkowników | `2.0.0-alpha.39`, SHA `03b62e72308770f6d9cc591c4ef1f69016bc437e`, `staging` |
| Produkcja | `https://www.rysia.org` | osiągalna, `/health/release` gotowy | `2.0.0-alpha.39`, SHA `cc06179bd9481a83c016a4447930ddc3e9f09cb2`, `production` |

Na obu osiągalnych środowiskach `/informacje-prawne` zwraca `200`, a anonimowe `/api/patterns` zwraca `401`. Manifest dostawców jest zweryfikowany, a `npm run legal:check` zwraca `LEGAL_PUBLICATION=ready`.

## Wdrożenia

Przepływ kodu to PR → CI → gałąź `staging` → pełna regresja → gałąź `main` → ręczny deploy produkcji → smoke test. Staging wdraża się automatycznie, produkcja wymaga działania operatora. Każde środowisko ma osobny projekt Supabase i osobne sekrety.

Railway buduje `deploy/railway/Dockerfile`, uruchamia Node.js 24 i sprawdza `/health/ready`. `/health/live` potwierdza działanie procesu, a `/health/release` podaje wersję, SHA i środowisko.

Zielone testy lub zweryfikowane wdrożenie nie są zgodą na migrację, import z zapisem, zmianę infrastruktury ani deploy produkcji. Każda taka operacja zewnętrzna wymaga osobnej, świadomej zgody.

## Dokumentacja

- [Specyfikacja produktu](SPEC.md)
- [Architektura](docs/ARCHITECTURE.md)
- [Jakość i testy](docs/QUALITY.md)
- [Bezpieczeństwo](docs/SECURITY.md)
- [Operacje i wdrożenia](docs/OPERATIONS.md)
- [Design QA](docs/DESIGN-QA.md)
