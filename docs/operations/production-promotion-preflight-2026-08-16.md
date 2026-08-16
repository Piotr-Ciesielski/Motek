# Preflight promocji staging → production — 2026-08-16

## Werdykt

**NO-GO — kandydat jest gotowy do dalszego preflightu, ale nie do wdrożenia
produkcji.**

Staging pozostaje źródłem prawdy dla bieżącego efektu aplikacji. Promocja musi
objąć jawnie wskazany kandydat, a nie mechaniczny merge całej gałęzi.

## Tożsamość artefaktów

| Zakres | Referencja |
|---|---|
| Kandydat stagingowy | `agent/staging-candidate-20260816-v2` / `0b2311d6af0e30b60d8afc3f7296df7931b8ea4a` |
| Runtime stagingu | `https://staging.rysia.org`, Railway deployment `ba374ee6-d6d6-4d82-9e9e-6ef4aba395d7` |
| `origin/staging` | `18c1f5c530e0b26984ca2c04abecccceb36788e9` |
| `origin/main` / production | `0b3d43347d6b982eb86303db26650cc804ec8cd9` |

Kandydat zawiera cztery commity ponad `origin/staging`: formularz i backend
zmiany hasła, dokumentację wdrożenia, poprawkę układu Karty Konto oraz
dokumentację kompatybilności produkcji.

## Świeży preflight stagingu

- Railway: środowisko `staging Motek`, usługa `Motek`, `Online`;
- `/`: HTTP `200`;
- `/health/release`: HTTP `200`, `status=ready`, `environment=staging`;
- `/api/config`: HTTP `200`, Turnstile włączony;
- anonimowy `/api/yarns`: HTTP `401`;
- wdrożony CSS zawiera regułę pełnej szerokości sekcji zmiany hasła;
- wdrożony HTML zawiera formularz zmiany hasła i wymagany komunikat hasła.

Weryfikacja lokalna kandydata: `393/393` testów, lint i check zaliczone.
Funkcjonalny test zmiany hasła został potwierdzony ręcznie na stagingu.

## Blokady produkcyjne

1. **Linia release'u.** Runtime stagingu działa na osobnej gałęzi kandydata,
   podczas gdy `origin/staging` wskazuje wcześniejszy SHA. Przed promocją
   trzeba formalnie zatwierdzić dokładny SHA i sposób jego publikacji.
2. **Supabase ledger.** Bieżąca mapa pozostaje `OPEN`: Production ma 24,
   a Staging 28 wpisów. Część grup jest nierozstrzygnięta, istnieje konflikt
   lokalnego recovery (`grant_id`) ze zdalnym kontraktem stagingu i produkcji
   opartym o `jti_hash`, a Production zachowuje legacy overloady
   `insert_yarn_with_limit`.
3. **Katalog.** Efekt publikacji/audytu katalogu występuje na stagingu, ale
   nie w produkcji. To jest różnica funkcjonalna, nie tylko numeracja migracji.
4. **Produkcja — świeży smoke.** Produkcja zwraca `/health/release` `200`,
   ale `/informacje-prawne` nadal `404`, a anonimowy `/api/patterns` nadal
   `200`. To blokuje promocję niezależnie od zdrowia procesu.
5. **Backup/restore.** Świeży pakiet z 2026-08-16 ma warunkowy PASS, jest
   zaszyfrowany poza repozytorium i został odtworzony w zgodnym stacku
   Supabase/GoTrue. Storage produkcji jest pusty, więc wynik pozostaje
   warunkowy dla obecnego stanu; nie wykonano żadnej zmiany produkcji.
6. **Railway/infrastruktura.** Railway Production ma już jawne `node server.js`
   i `/health/ready`; ten punkt jest zamknięty. Nadal nie jest zamknięta pełna
   macierz originu, cache, WAF, rate limiting, monitoringu i alertów.
7. **Supabase Security Advisors.** Pozostają świadome decyzje dotyczące RPC
   `SECURITY DEFINER`, ochrony przed wyciekłymi hasłami oraz dodatkowych
   polityk RLS stagingu.

Read-only dowód DNS/HTTP z 2026-08-16 doprecyzował tę blokadę:
`www.rysia.org` jest proxied przez Cloudflare (`Server: cloudflare`,
`CF-Cache-Status: DYNAMIC`, `Cache-Control: no-store`), natomiast
`staging.rysia.org` wskazuje CNAME bezpośrednio na Railway i zwraca
`Server: railway-hikari`, bez warstwy Cloudflare. Nie jest to dowód
równoważnych reguł WAF, rate limiting, cache ani alertów; przed promocją
trzeba mieć zrzut konfiguracji obu ścieżek i testy negatywne.

## Zasada dla migracji

Stagingowy efekt zdalny jest źródłem prawdy. Nie należy wykonywać `db push`,
`migration repair` ani ręcznych grantów tylko po to, aby wyrównać numery
migracji. Najpierw trzeba zamknąć mapę efektów SQL i przygotować migrację
kompatybilną z istniejącymi danymi produkcji.

## Przyjęta zasada kompatybilności

Decyzja operatora: wyrównujemy zachowanie i bezpieczeństwo, nie wymuszamy
identycznego schematu fizycznego.

- zachowujemy produkcyjne `private.yarn_store_versions.updated_at`, ponieważ
  kolumna ma dane i nie zmienia kontraktu użytkownika;
- zachowujemy produkcyjne `public.patterns.description NOT NULL`, chyba że
  późniejszy dowód produktu wykaże potrzebę wartości `NULL`;
- promujemy brakujące efekty stagingu (np. publikację/audyt katalogu) przez
  migrację kompatybilną z istniejącymi wierszami;
- nie promujemy lokalnego wariantu recovery z `grant_id`; aktywny zdalny
  kontrakt `jti_hash` pozostaje źródłem prawdy;
- legacy overloady RPC pozostają osobnym cleanupem po audycie konsumentów.

Ta decyzja nie jest zgodą na `db push`, migrację ani deploy produkcji.

## Następne kroki

1. Zamknąć mapę ledgeru przez read-only porównanie każdej nierozstrzygniętej
   grupy i jawnie opisać, które lokalne migracje nie mogą być użyte bez zmian.
2. Wyjaśnić konfigurację Railway Production oraz macierz origin/cache/WAF.
3. Uzupełnić macierz origin/cache/WAF, monitoringu i alertów.
4. Przygotować pakiet `GO/NO-GO` z dokładnym SHA, zakresem migracji,
   rollbackiem, kryteriami STOP i 30-minutową obserwacją.
5. Dopiero po osobnej zgodzie wykonać migrację Supabase i deploy produkcji.

Do czasu zamknięcia tych punktów produkcja pozostaje bez zmian.
