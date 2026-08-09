# Legal Readiness and Pattern Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Przygotować prawdziwe, wersjonowane dane prawne, ukryć niezaudytowane treści katalogu i blokować produkcję, dopóki operator, dostawcy, retencja oraz katalog nie są gotowe.

**Architecture:** Wspólny moduł `legal-document.js` przechowuje bieżącą wersję dokumentu i ustrukturyzowaną treść, a dwa jawne manifesty opisują dostawców danych i decyzje publikacyjne katalogu. Czyste moduły polityk walidują manifesty w testach, CI i podczas startu produkcji. Katalog działa fail-closed: rekord jest widoczny tylko ze statusem `published` i kompletnym audytem.

**Tech Stack:** Node.js 24, vanilla JavaScript UMD/CommonJS, `node:test`, Supabase/PostgreSQL migrations, pgTAP, Python 3, JSON, GitHub Actions.

## Global Constraints

- Motek jest bezpłatnym, prywatnym narzędziem dla ograniczonej grupy zaproszonych osób.
- Dane operatora pozostają `[IMIĘ I NAZWISKO OPERATORA]` i `[E-MAIL KONTAKTOWY]` w wersji roboczej.
- Produkcja musi pozostać zablokowana, dopóki placeholdery i niepotwierdzone dane prawne istnieją.
- Rekordy pochodzące z PDF są domyślnie `hidden`; publikacja wymaga osobnej, jawnej decyzji audytowej.
- `needs_review` pozostaje statusem jakości danych technicznych i nie może oznaczać audytu prawnego.
- Nie przechowujemy cytatów, instrukcji, zdjęć, schematów ani fragmentów PDF w manifeście audytu.
- Nie nadpisujemy istniejących zmian użytkownika w `.gitignore`, `test/deployment-policy.test.js`, `test/proxy-policy.test.js` ani migracji magazynu.
- Wdrożenie zdalne, migracja produkcyjna i import wykonawczy wymagają osobnej zgody użytkownika.

---

### Task 1: Kanoniczny dokument prawny i walidacja wersji roboczej

**Files:**
- Create: `legal-document.js`
- Create: `test/legal-document.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `CURRENT_LEGAL_DOCUMENT`, `formatCopyrightNotice(document)`, `assertLegalDocumentShape(document)`.
- Consumers: plany rejestracji, strony prawnej i bramki publikacyjnej.

- [ ] **Step 1: Napisać failing test kanonicznego dokumentu**

Utworzyć `test/legal-document.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CURRENT_LEGAL_DOCUMENT,
  assertLegalDocumentShape,
  formatCopyrightNotice,
} = require("../legal-document");

test("dokument ma stabilną wersję i trzy wymagane sekcje", () => {
  assert.doesNotThrow(() => assertLegalDocumentShape(CURRENT_LEGAL_DOCUMENT));
  assert.match(CURRENT_LEGAL_DOCUMENT.termsVersion, /^\d+\.\d+$/);
  assert.equal(CURRENT_LEGAL_DOCUMENT.privacyVersion, "1.0");
  assert.deepEqual(
    CURRENT_LEGAL_DOCUMENT.sections.map(({ id }) => id),
    ["regulamin", "prywatnosc", "prawa-autorskie"],
  );
});

test("nota copyright ma dokładny format produktu", () => {
  assert.equal(
    formatCopyrightNotice(CURRENT_LEGAL_DOCUMENT),
    "© 2026 Motek — [IMIĘ I NAZWISKO OPERATORA]. Wszelkie prawa zastrzeżone.",
  );
});
```

- [ ] **Step 2: Uruchomić test i potwierdzić RED**

Run: `node --test test/legal-document.test.js`

Expected: FAIL z `Cannot find module '../legal-document'`.

- [ ] **Step 3: Utworzyć wspólny moduł UMD/CommonJS**

`legal-document.js` ma eksportować zamrożony obiekt:

```js
const CURRENT_LEGAL_DOCUMENT = Object.freeze({
  termsVersion: "1.0",
  privacyVersion: "1.0",
  effectiveDate: "2026-08-09",
  revisionDate: "2026-08-09",
  path: "/informacje-prawne",
  copyrightYear: 2026,
  operator: Object.freeze({
    name: "[IMIĘ I NAZWISKO OPERATORA]",
    email: "[E-MAIL KONTAKTOWY]",
  }),
  sections: Object.freeze([
    Object.freeze({
      id: "regulamin",
      title: "Regulamin korzystania z Motka",
      blocks: Object.freeze([
        Object.freeze({ type: "paragraph", text: "Motek jest bezpłatnym, prywatnym narzędziem udostępnianym wyłącznie zaproszonym osobom. Służy do prowadzenia prywatnego magazynu włóczek i przeglądania neutralnych informacji o wzorach." }),
        Object.freeze({ type: "list", items: Object.freeze([
          "Użytkownik chroni hasło i nie udostępnia konta innym osobom.",
          "Zabronione jest naruszanie prawa, bezpieczeństwa Motka oraz praw innych osób.",
          "Operator może zablokować konto w razie nadużycia albo zagrożenia bezpieczeństwa.",
          "Użytkownik może wylogować się i usunąć konto także bez zaakceptowania nowej wersji regulaminu.",
        ]) }),
        Object.freeze({ type: "notice", text: "Motek jest udostępniany bez gwarancji nieprzerwanej dostępności. Odpowiedzialność operatora jest ograniczona wyłącznie w zakresie dozwolonym przez bezwzględnie obowiązujące prawo." }),
      ]),
    }),
    Object.freeze({
      id: "prywatnosc",
      title: "Prywatność i przetwarzanie danych",
      blocks: Object.freeze([
        Object.freeze({ type: "paragraph", text: "Administratorem danych jest [IMIĘ I NAZWISKO OPERATORA], kontakt: [E-MAIL KONTAKTOWY]. Informacja o prywatności jest przekazywana użytkownikowi i nie stanowi zgody będącej podstawą całego przetwarzania." }),
        Object.freeze({ type: "list", items: Object.freeze([
          "Motek przetwarza adres e-mail, identyfikator konta, znaczniki czasu, dane magazynu włóczek, ciasteczko sesji i podstawowe logi bezpieczeństwa.",
          "Dane służą utworzeniu i zabezpieczeniu konta, świadczeniu funkcji Motka, obsłudze żądań użytkownika oraz ochronie przed nadużyciami.",
          "Po potwierdzeniu usunięcia konta aktywne dane konta, profil i magazyn są usuwane; terminy kopii i logów są publikowane dopiero po potwierdzeniu ustawień dostawców.",
          "Użytkownik może żądać dostępu, sprostowania, usunięcia, ograniczenia i innych praw wynikających z właściwych przepisów.",
        ]) }),
      ]),
    }),
    Object.freeze({
      id: "prawa-autorskie",
      title: "Prawa autorskie i katalog wzorów",
      blocks: Object.freeze([
        Object.freeze({ type: "paragraph", text: "Prawa do autorskiego kodu, interfejsu, własnych grafik, tekstów i marki Motek przysługują operatorowi albo właściwym uprawnionym. Dostęp do aplikacji nie przenosi tych praw na użytkownika." }),
        Object.freeze({ type: "list", items: Object.freeze([
          "Bez zgody nie wolno kopiować, rozpowszechniać, odsprzedawać ani wykorzystywać chronionych elementów Motka w innych produktach, z zastrzeżeniem ustawowych wyjątków.",
          "Biblioteki, czcionki, ikony i inne elementy zewnętrzne zachowują własne licencje.",
          "Prawa do wzorów, instrukcji, zdjęć, schematów i chronionych opisów pozostają przy ich autorach.",
          "Katalog pokazuje wyłącznie neutralne metadane, autora lub źródło i link; nie przechowuje treści PDF ani szczegółowych instrukcji.",
        ]) }),
      ]),
    }),
  ]),
});
```

Do powyższych bloków dodać osobne akapity dla tworzenia i rozwiązania umowy, reklamacji, zmiany dokumentu, podstaw prawnych każdego celu, potwierdzonej listy dostawców i transferów oraz konkretnej retencji. Wartości dostawców i retencji muszą pochodzić z zatwierdzonego `data/legal-data-providers.json`; przy stanie `unverified` dokument pozostaje draftem zablokowanym przez Task 6.

- [ ] **Step 4: Dodać moduł do kontroli składni i uruchomić GREEN**

W `package.json` dopisać `node --check legal-document.js` do `scripts.check`.

Run: `node --check legal-document.js`; `node --test test/legal-document.test.js`

Expected: PASS.

- [ ] **Step 5: Utworzyć checkpoint zadania**

```powershell
git add -f legal-document.js test/legal-document.test.js package.json
git commit -m "feat: define canonical legal document"
```

### Task 2: Polityka treści katalogu i manifest audytu

**Files:**
- Create: `pattern-content-policy.js`
- Create: `test/pattern-content-policy.test.js`
- Create: `scripts/build-pattern-content-audit.js`
- Create: `data/pattern-content-audit.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: `data/patterns-import.json` i `data/pattern-manual-overrides.json`.
- Produces: `validatePatternAuditManifest(records, manifest)` i `toPublicationFields(entry)`.

- [ ] **Step 1: Napisać testy fail-closed manifestu**

```js
test("odrzuca rekord bez decyzji audytowej", () => {
  assert.throws(
    () => validatePatternAuditManifest([{ source_filename: "a.pdf" }], { records: [] }),
    /a\.pdf.*decyzji audytowej/,
  );
});

test("ukryty rekord PDF nie przechowuje treści źródłowej", () => {
  const result = validatePatternAuditManifest(
    [{ source_filename: "a.pdf" }],
    { audit_version: "1.0", records: [{ source_filename: "a.pdf", status: "hidden", source_kind: "pdf", fields: [] }] },
  );
  assert.equal(result.records[0].status, "hidden");
});

test("publikacja wymaga decyzji dla każdego publikowanego pola", () => {
  assert.throws(() => validatePatternAuditManifest(
    [{ source_filename: "demo" }],
    { audit_version: "1.0", records: [{ source_filename: "demo", status: "published", source_kind: "synthetic", fields: [] }] },
  ), /podstawy pola/);
});
```

- [ ] **Step 2: Potwierdzić RED**

Run: `node --test test/pattern-content-policy.test.js`

Expected: FAIL z brakiem modułu.

- [ ] **Step 3: Zaimplementować czystą politykę**

`pattern-content-policy.js` ma:

```js
const PUBLICATION_STATUSES = new Set(["published", "hidden"]);
const ALLOWED_BASES = new Set(["neutral_fact", "independent_summary", "synthetic"]);

function toPublicationFields(entry) {
  return {
    publication_status: entry.status,
    content_audit_version: entry.audit_version,
    content_audited_at: entry.audited_at,
    official_source_url: entry.official_source_url ?? null,
  };
}
```

Walidator musi wymagać dokładnie jednej decyzji dla każdego `source_filename`, odrzucać dodatkowe nieznane rekordy, pola `evidence`, `excerpt`, `instruction`, `pdf_text` oraz publikację bez podstawy każdego wyjściowego pola.

- [ ] **Step 4: Wygenerować bezpieczny manifest startowy**

`scripts/build-pattern-content-audit.js` ma czytać bieżący import i generować wpis dla każdego rekordu. `source_kind === "synthetic"` może otrzymać `published` tylko po potwierdzeniu fixture; każdy rekord PDF otrzymuje `hidden`, `description: null`, `official_source_url: null`, `fields: []`. Skrypt ma odmówić nadpisania istniejącego manifestu bez flagi `--replace`.

Run: `node scripts/build-pattern-content-audit.js`

Expected: `data/pattern-content-audit.json` ma decyzję dla wszystkich 106 rekordów, bez treści PDF.

- [ ] **Step 5: Uruchomić testy i kontrolę danych**

Run: `node --test test/pattern-content-policy.test.js test/pattern-catalog-data.test.js`

Expected: PASS; liczba decyzji odpowiada liczbie rekordów importu.

- [ ] **Step 6: Utworzyć checkpoint zadania**

```powershell
git add pattern-content-policy.js test/pattern-content-policy.test.js scripts/build-pattern-content-audit.js data/pattern-content-audit.json package.json
git commit -m "feat: add fail-closed pattern content audit"
```

### Task 3: Status publikacji katalogu w Supabase

**Files:**
- Create: migracja wygenerowana przez `npx supabase migration new add_pattern_publication_audit`
- Create: `supabase/tests/database/pattern_publication.test.sql`
- Modify: `supabase/tests/database/migration_replay.test.sql`
- Modify: `test/migration.test.js`

**Interfaces:**
- Produces: `patterns.publication_status`, `content_audit_version`, `content_audited_at`, `official_source_url`; nullable `description`.
- Consumers: importer i API katalogu.

- [ ] **Step 1: Napisać pgTAP dla nowego kontraktu**

Test ma sprawdzić:

```sql
select col_is_null('public', 'patterns', 'description');
select throws_ok(
  $$ update public.patterns set publication_status = 'published', content_audit_version = null $$,
  '23514'
);
```

Dodać przypadki: domyślne `pending_review`, dozwolone `pending_review|published|hidden`, publikacja wymaga wersji i czasu audytu, rekord PDF bez potwierdzonego źródła pozostaje nieopublikowany.

- [ ] **Step 2: Potwierdzić RED na lokalnej bazie**

Run: `npm run test:db`

Expected: FAIL, ponieważ kolumny i ograniczenia jeszcze nie istnieją.

- [ ] **Step 3: Wygenerować i wypełnić migrację**

Run: `npx supabase migration new add_pattern_publication_audit`

Migracja ma wykonać:

```sql
alter table public.patterns alter column description drop not null;
alter table public.patterns add column publication_status text not null default 'pending_review';
alter table public.patterns add column content_audit_version text;
alter table public.patterns add column content_audited_at timestamptz;
alter table public.patterns add column official_source_url text;
alter table public.patterns add constraint patterns_publication_status_check
  check (publication_status in ('pending_review', 'published', 'hidden'));
alter table public.patterns add constraint patterns_published_audit_check
  check (publication_status <> 'published' or
    (content_audit_version is not null and content_audited_at is not null));
```

Istniejące rekordy pozostają `pending_review`, więc po wdrożeniu są automatycznie niewidoczne.

- [ ] **Step 4: Uruchomić replay i testy**

Run: `npm run test:db`; `node --test test/migration.test.js`

Expected: PASS.

- [ ] **Step 5: Utworzyć checkpoint zadania**

```powershell
git add -- ':(glob)supabase/migrations/*_add_pattern_publication_audit.sql' supabase/tests/database/pattern_publication.test.sql supabase/tests/database/migration_replay.test.sql test/migration.test.js
git commit -m "db: add audited pattern publication status"
```

### Task 4: Bezpieczne generowanie i import katalogu

**Files:**
- Modify: `scripts/extract-pattern-candidates.py`
- Modify: `scripts/build-pattern-import.py`
- Modify: `scripts/import-patterns.js`
- Modify: `data/patterns-import.json`
- Modify: `test/pattern-catalog-data.test.js`
- Modify: `test/import-patterns.test.js`

**Interfaces:**
- Consumes: `data/pattern-content-audit.json`.
- Produces: import zawierający wyłącznie neutralne pola oraz status audytu.

- [ ] **Step 1: Dodać failing test generatora**

Test ma potwierdzić, że wynik nie zawiera `evidence`, fragmentów PDF ani automatycznej frazy `Instrukcja wykonania`, pozwala na `description: null` i ma status dla każdego rekordu.

Run: `node --test test/pattern-catalog-data.test.js`

Expected: FAIL na bieżącym `patterns-import.json`.

- [ ] **Step 2: Wyłączyć generowanie twórczych opisów**

W `extract-pattern-candidates.py` usunąć wywołanie `infer_description()` z produkcyjnego rekordu. W `build-pattern-import.py` usunąć wymóg niepustego opisu i połączyć rekord z decyzją manifestu po `source_filename`.

Rekord wynikowy ma zawierać:

```json
{
  "description": null,
  "publication_status": "hidden",
  "content_audit_version": "1.0",
  "content_audited_at": "2026-08-09T00:00:00Z",
  "official_source_url": null
}
```

- [ ] **Step 3: Zabezpieczyć importer**

Przed `.upsert()` importer ma wywołać `validatePatternAuditManifest`. Brak decyzji, `pending_review` w pliku wykonawczym albo pole wewnętrznego dowodu kończy proces przed zapisem. Dodać nowe kolumny do payloadu.

- [ ] **Step 4: Zregenerować plik i uruchomić testy**

Run: `python scripts/build-pattern-import.py`; `node --test test/pattern-catalog-data.test.js test/import-patterns.test.js`

Expected: PASS; rekordy PDF są `hidden`, a tylko jawnie potwierdzone dane syntetyczne mogą być `published`.

- [ ] **Step 5: Utworzyć checkpoint zadania**

```powershell
git add scripts/extract-pattern-candidates.py scripts/build-pattern-import.py scripts/import-patterns.js data/patterns-import.json test/pattern-catalog-data.test.js test/import-patterns.test.js
git commit -m "fix: remove protected content from pattern import"
```

### Task 5: Filtrowanie API i bezpieczna karta wzoru

**Files:**
- Modify: `server.js`
- Modify: `server/pattern-routes.js`
- Modify: `app.js`
- Modify: `test/server.test.js`
- Modify: `test/pattern-routes.test.js`
- Modify: `test/design-regression.test.js`

**Interfaces:**
- Produces: API zwraca tylko `publication_status=published` i publiczne `officialSourceUrl`.
- Excludes: `source_filename`, hashe, manifest oraz pola audytowe.

- [ ] **Step 1: Napisać failing test filtra serwera**

Atrapa query buildera ma zapisać wywołanie:

```js
assert.deepEqual(filters, [["publication_status", "published"]]);
assert.equal(response.items[0].source_filename, undefined);
assert.equal(response.items[0].content_audit_version, undefined);
```

- [ ] **Step 2: Potwierdzić RED**

Run: `node --test test/server.test.js test/pattern-routes.test.js`

Expected: FAIL, ponieważ API nie filtruje statusu.

- [ ] **Step 3: Dodać filtr i mapowanie publiczne**

Zastosować `.eq("publication_status", "published")` zarówno do count, jak i pobrania strony. Publiczny DTO może zawierać `officialSourceUrl`, lecz nie techniczne źródło ani dane audytu.

- [ ] **Step 4: Obsłużyć pusty opis w UI**

Renderer ma utworzyć akapit opisu tylko dla niepustego `pattern.description`. Link źródłowy renderować przez `textContent`, z `rel="noopener noreferrer"`, tylko dla poprawnego `https:` URL.

- [ ] **Step 5: Uruchomić testy**

Run: `node --test test/server.test.js test/pattern-routes.test.js test/design-regression.test.js`

Expected: PASS.

- [ ] **Step 6: Utworzyć checkpoint zadania**

```powershell
git add server.js server/pattern-routes.js app.js test/server.test.js test/pattern-routes.test.js test/design-regression.test.js
git commit -m "fix: expose only audited pattern metadata"
```

### Task 6: Rejestr dostawców i twarda bramka produkcyjna

**Files:**
- Create: `data/legal-data-providers.json`
- Create: `legal-publication-policy.js`
- Create: `scripts/check-legal-publication.js`
- Create: `test/legal-publication-policy.test.js`
- Create: `test/legal-readiness.test.js`
- Modify: `server.js`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `validateLegalPublication({ legalDocument, providers, patternAudit, deploymentEnvironment })`.
- Produces: `npm run legal:check` oraz produkcyjny fail-closed podczas startu/readiness.

- [ ] **Step 1: Utworzyć wersjonowany manifest w stanie roboczym**

`data/legal-data-providers.json` ma zawierać wpisy `supabase`, `railway` i `cloudflare-turnstile` z polami:

```json
{
  "id": "supabase",
  "role": "hosting bazy danych i uwierzytelnianie",
  "data_categories": ["konto", "magazyn włóczek", "logi uwierzytelniania"],
  "flows": ["rejestracja", "logowanie", "zapis danych użytkownika"],
  "processing_location_or_transfer": "unverified",
  "retention": "unverified",
  "retention_confirmed_at": null,
  "evidence": [],
  "operator_verified_at": null
}
```

Stan `unverified` jest celowy i ma blokować produkcję do ręcznej, udokumentowanej kontroli operatora.

- [ ] **Step 2: Napisać failing test bramki**

```js
test("produkcja odrzuca placeholdery i niepotwierdzonych dostawców", () => {
  const result = validateLegalPublication({
    legalDocument: CURRENT_LEGAL_DOCUMENT,
    providers,
    patternAudit,
    deploymentEnvironment: "production",
  });
  assert.equal(result.ready, false);
  assert.match(result.errors.join(" "), /operator\.name|supabase\.retention/);
});
```

Walidator nie może umieszczać wartości danych operatora w komunikatach.

- [ ] **Step 3: Zaimplementować politykę i CLI**

`validateLegalPublication` wylicza wynik z pól; nie przyjmuje `ready: true`. Produkcja wymaga prawdziwego operatora i e-maila, pełnego dostawcy z dowodami i datami, kompletnego manifestu katalogu oraz braku `pending_review` w publikowanym zestawie. Środowisko lokalne może działać jako draft, ale `npm run legal:check` kończy się kodem 1 i listą nazw brakujących pól.

- [ ] **Step 4: Podłączyć CI i start produkcyjny bez kolizji z obcymi testami**

Dodać `legal:check` do `package.json`. Nie nadpisywać lokalnych zmian w `test/deployment-policy.test.js`; utworzyć osobny `test/legal-readiness.test.js`. W `server.js` uruchomić politykę obok istniejącej walidacji deploymentu wyłącznie dla `DEPLOYMENT_ENV=production`.

W CI uruchomić test polityki, nie wymagać gotowości produkcyjnej draftu:

```yaml
- name: Test legal publication policy
  run: node --test test/legal-publication-policy.test.js test/legal-readiness.test.js
```

- [ ] **Step 5: Uruchomić weryfikację**

Run: `node --test test/legal-publication-policy.test.js test/legal-readiness.test.js`; `npm run check`; `npm run lint`

Expected: testy PASS; jawne `npm run legal:check` raportuje stan `not ready`, dopóki operator nie uzupełni prawdziwych danych i dowodów.

- [ ] **Step 6: Utworzyć checkpoint zadania**

```powershell
git add data/legal-data-providers.json legal-publication-policy.js scripts/check-legal-publication.js test/legal-publication-policy.test.js test/legal-readiness.test.js server.js package.json .github/workflows/ci.yml
git commit -m "config: block incomplete legal publication"
```

### Task 7: Dokumentacja i końcowa kontrola pakietu

**Files:**
- Modify: `README.md`
- Modify: `SPEC.md`
- Modify: `docs/PATTERN-CATALOG.md`
- Modify: `CHANGELOG.txt`

**Interfaces:**
- Consumes: gotowe kontrakty katalogu i bramki.
- Produces: instrukcję audytu, interpretację statusów oraz jawny stan `not ready`.

- [ ] **Step 1: Opisać model publikacji katalogu**

W `docs/PATTERN-CATALOG.md` opisać trzy statusy, zakaz treści PDF, manifest audytu, bezpieczną procedurę ponownej publikacji i komendę `npm run legal:check`.

- [ ] **Step 2: Zaktualizować dokumentację produktu**

README i SPEC mają mówić, że API pokazuje tylko zaudytowane neutralne metadane, a dokument prawny jest wersjonowany. CHANGELOG ma odnotować ukrycie niezaudytowanych rekordów i bramkę produkcyjną.

- [ ] **Step 3: Uruchomić pełną weryfikację**

Run: `npm run check`; `npm run lint`; `npm run format:check`; `npm run test:db`; `git diff --check`

Expected: wszystkie kontrole PASS. `npm run legal:check` może nadal celowo kończyć się `not ready`, jeśli operator nie uzupełnił danych — ten wynik należy udokumentować, a nie obchodzić.

- [ ] **Step 4: Sprawdzić zakres zmian**

Run: `git status --short`; `git diff --stat`

Expected: brak niezwiązanych zmian w checkpointach tego planu; wcześniejsze zmiany użytkownika pozostają zachowane i niestage’owane.

- [ ] **Step 5: Utworzyć checkpoint dokumentacji**

```powershell
git add README.md SPEC.md docs/PATTERN-CATALOG.md CHANGELOG.txt
git commit -m "docs: document legal publication safeguards"
```

## Completion Gate

Plan jest wykonany, gdy wszystkie obecne rekordy mają decyzję `hidden` albo `published`, API nie zwraca rekordów niezaudytowanych, import nie tworzy treści na podstawie PDF, a produkcja jest automatycznie blokowana do czasu uzupełnienia operatora i potwierdzonych danych dostawców. Nie wykonywać zdalnej migracji ani importu bez odrębnej zgody użytkownika.
