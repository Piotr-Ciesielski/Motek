# Aktualny pakiet decyzji produkcyjnej — 2026-08-16

## Werdykt

**NO-GO — nie wykonywać jeszcze migracji ani deployu produkcji.**

Ten dokument jest aktualnym, read-only uzupełnieniem starszego pakietu
`production-promotion-decision-packet-2026-08-14.md`. Nie nadpisuje jego
historycznych snapshotów i nie jest zgodą wykonawczą.

## Zamknięte bramki

- **Legal-readiness:** zamknięte na lokalnym kandydacie `f63b615`; świeże
  `npm run legal:check` zwraca `LEGAL_PUBLICATION=ready`, a testy bramki
  przechodzą `13/13`.
- **HSTS:** aktywne dla produkcyjnych odpowiedzi proxied przez Cloudflare na
  1 miesiąc (`max-age=2592000`), bez `includeSubDomains` i bez `preload`.
- **Stagingowy kontrakt aplikacji:** zweryfikowany na SHA
  `18c1f5c530e0b26984ca2c04abecccceb36788e9`; CI i post-deploy regression są
  zielone, strona prawna działa, a anonimowy katalog zwraca `401`.
- **Recovery contract:** najnowszy odczyt zdalny potwierdza w Production i
  Staging `claimed_at`, hash JTI długości 64 oraz zgodne RPC claim/release/
  consume. Historyczne overloady pozostają osobnym cleanupem.

## Aktualne artefakty zewnętrzne

| Środowisko | Branch | Deployment | SHA | Stan |
| --- | --- | --- | --- | --- |
| Staging | `staging` | `1b0609b1-5b3e-48b3-88e8-2d6c39343c3c` | `18c1f5c530e0b26984ca2c04abecccceb36788e9` | `SUCCESS`, verified |
| Production | `main` | `b1d1fa03-b4e1-47f6-965e-e578a5c4658e` | `0b3d43347d6b982eb86303db26650cc804ec8cd9` | `SUCCESS`, legacy release |
| Candidate lokalny | `agent/staging-security-merge` | — | `f63b6158fff65a4508fc2fcee2173e2c8f082ee6` | legal gate ready, not deployed |

## Otwarte blokady STOP

1. **Candidate nie jest jeszcze zweryfikowany end-to-end na stagingu.** SHA
   `f63b615` zawiera domknięty manifest legal, ale stagingowy dowód dotyczy
   `18c1f5c`. Nie wolno traktować tych SHA jako jednego artefaktu.
2. **Ledger Supabase wymaga pełnej mapy efektu.** Zdalne środowiska mają
   różne liczby wpisów migracji; przed `db push` trzeba powiązać każdy wpis z
   lokalnym plikiem, hashem i efektem funkcji, constraintów, RLS, polityk,
   triggerów oraz grantów.
3. **Backup/restore musi być odświeżony bezpośrednio przed oknem.** Poprzedni
   rehearsal pozostaje dowodem kontrolowanym, ale nie jest świeżym backupem
   dla przyszłej operacji produkcyjnej.
4. **Konfiguracja Railway Production wymaga wyjaśnienia.** Odczyt nie
   pokazał jawnych `startCommand` i `healthcheckPath`, mimo że repozytorium i
   staging definiują `node server.js` oraz `/health/ready`.
5. **Pełna macierz infrastruktury nadal nie jest zamknięta.** Pozostają
   origin Railway, cache wszystkich prywatnych API/Auth, WAF/rate limiting,
   monitoring i alerty.
6. **Migracja i deploy wymagają osobnej zgody wysokiego ryzyka.** Samo
   zamknięcie legal-readiness i zielony staging nie są zgodą na wykonanie.

## Najbezpieczniejsza kolejność

1. Zbudować jeden candidate z kodu stagingowego i domkniętego manifestu legal,
   bez mechanicznego merge całej gałęzi.
2. Zweryfikować candidate na stagingu: exact SHA, CI, migracje, pgTAP,
   regression i publiczny smoke.
3. Wykonać read-only production preflight: ledger, efekt RPC/RLS/ACL,
   konfiguracja Railway, origin/cache i aktualny stan danych.
4. Odświeżyć backup produkcji i wykonać izolowany restore; nie przywracać na
   produkcję.
5. Przedstawić osobny pakiet GO/NO-GO z exact SHA, migracjami, rollbackiem,
   kryteriami STOP i 30-minutowym oknem obserwacji.
6. Dopiero po osobnej zgodzie wykonać migrację Supabase, deploy Railway,
   smoke i obserwację.

## Bezwzględne kryteria zatrzymania

Operację trzeba zatrzymać przy niezgodnym SHA, nieuzgodnionym ledgerze,
nieświeżym lub nieodtwarzalnym backupie, braku kontroli zapisów, błędzie
RPC/RLS/ACL, `404` strony prawnej, anonimowym `200` katalogu, cache `HIT` dla
prywatnych odpowiedzi, nieoczekiwanym `5xx`, błędzie Auth/recovery albo braku
kompatybilnego rollbacku aplikacji.

Do czasu zamknięcia powyższych punktów produkcja pozostaje `NO-GO`; nie
wykonano w ramach tego raportu żadnej migracji, deployu ani zmiany danych.
