# Kanoniczny rekord release candidate — 2026-08-13

Ten dokument jest jedynym bieżącym rekordem release candidate. Starsze raporty
pozostają historycznymi snapshotami i nie opisują bieżącego statusu.

| Pole | Wartość |
| --- | --- |
| Branch | `release/motek-recovery-rc` |
| Pełny SHA | `e691af891758ebc17f6d4683dbca5d997f65dbe5` |
| Wersja | `2.0.0-alpha.39` |
| Data rekordu | `2026-08-13` |
| Staging na tym SHA | `CONFIRMED` |
| Produkcja na tym SHA | `NOT CONFIRMED` / nietknięta |
| Legal publication | `LEGAL_PUBLICATION=not ready` |

## Lokalne dowody

- `npm run check` — `388/388`
- `node --test test/server.test.js` — `35/35`
- `npm run lint` — `PASS`
- Supabase lokalnie — `287/287`

Dowody w tej sekcji są wyłącznie lokalne. Nie potwierdzają wdrożenia stagingu
ani produkcji i nie zawierają zewnętrznych dowodów publikacji prawnej.

## Zewnętrzne dowody stagingu — 2026-08-13

- Railway staging deployment: `SUCCESS`, domena `staging.rysia.org`;
- `/health/live`: `200`, `/health/ready`: `200`, `/health/release`: `200`;
- `/health/release` raportuje environment `staging` oraz dokładny SHA
  `e691af891758ebc17f6d4683dbca5d997f65dbe5`;
- GitHub CI run `31692102925`: test + database `PASS`;
- GitHub post-deploy regression run `31692142042`: full staging regression
  `PASS`;
- staging: `CONFIRMED` na tym SHA;
- production: `NOT CONFIRMED` / untouched — nie wykonano wdrożenia produkcyjnego;
- `LEGAL_PUBLICATION=not ready`; brak zewnętrznych dowodów legalnych.

Powyższe wpisy są dowodami zewnętrznymi z Railway i GitHub Actions. Nie należy
łączyć ich z lokalnymi wynikami z sekcji powyżej ani traktować jako potwierdzenia
produkcji lub gotowości publikacji prawnej.

## Historyczne snapshoty i checkpointy

Poniższe SHA zachowują znaczenie historyczne i nie są bieżącym kandydatem:

Poprzedni kandydat: `504d33ba8becd4e596f7451b3ce7f40bf972e1fc`.

Pozostałe historyczne snapshoty i checkpointy: `62d0b84e`, `301469d`,
`f118c84`, `c4b777a`, `c7b4639`, `3e3712e`.
