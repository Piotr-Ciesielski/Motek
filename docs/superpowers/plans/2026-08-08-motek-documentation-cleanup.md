# Motek documentation and post-release cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uaktualnić dokumentację do stanu alpha.39 oraz uporządkować pozostałości po wdrożeniu bez naruszania niezależnych, niezatwierdzonych zmian.

**Architecture:** Dokumentacja produktu pozostaje w README i CHANGELOG, a fakty operacyjne wdrożenia i QA trafiają do krótkiego rekordu w `docs/operations/`. Plan i raport są przechowywane w `docs/superpowers/`, żeby można było odtworzyć decyzje oraz dowody weryfikacji.

**Tech Stack:** Markdown, Git, Railway CLI, testy Node.js.

## Global Constraints

- Nie zmieniać kodu aplikacji ani konfiguracji wdrożenia.
- Nie usuwać worktree, branchy ani plików bez wcześniejszej identyfikacji i osobnej zgody użytkownika.
- Opisywać wyłącznie zweryfikowane fakty: wersję `2.0.0-alpha.39`, commit `1991f13`, staging `cf60ce6` i produkcyjny deployment `7b0b1f56`.
- Zachować istniejące linki i instrukcje operacyjne, korygując tylko nieaktualne wersje, SHA i procedury.

---

### Task 1: Aktualizacja dokumentacji produktu

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.txt`

- [ ] **Step 1: Zaktualizować wersję i stan środowisk**

  W README ustawić bieżącą wersję na `2.0.0-alpha.39`, opisać ręczne wdrożenie produkcji z repozytorium źródłowego oraz zachować rozdział staging/production.

- [ ] **Step 2: Dodać wpis alpha.39 do CHANGELOG**

  Wpisać faktyczne zmiany layoutu Żywej pracowni, spójność grafiki kota w obu motywach, pełną ekspozycję bez overlayów oraz naprawę rozjazdu produkcja–staging.

- [ ] **Step 3: Sprawdzić linki i formatowanie**

  Uruchomić `git diff --check` oraz wyszukać pozostałe odwołania do `alpha.38` w README i CHANGELOG.

### Task 2: Operacyjny rekord wdrożenia i QA

**Files:**
- Create: `docs/operations/production-release-2026-08-08.md`
- Modify: `docs/operations/design-fidelity-2026-08-08.md`

- [ ] **Step 1: Zapisać rekord produkcji**

  Udokumentować źródło (`origin/main` = `1991f13`), staging (`cf60ce6`), końcowy deployment Railway (`7b0b1f56`), healthcheck oraz fakt, że pierwsza próba z lokalnego uploadu wymagała redeployu `--from-source`.

- [ ] **Step 2: Uaktualnić macierz QA**

  Zastąpić stare SHA i nieaktualny opis branchu stagingu, zachować świadomie utrzymane różnice wobec makiet oraz dopisać kontrolę wersji zasobów w obu domenach.

- [ ] **Step 3: Zweryfikować dokumentację**

  Sprawdzić, że dokumenty nie obiecują fikcyjnych funkcji i zawierają tylko wyniki faktycznie wykonanych testów.

### Task 3: Porządki po pracy

**Files:**
- Inspect only: `.worktrees/*`, `.audit/`, `task-5-report.md`, `design-qa.md`, root worktree changes

- [ ] **Step 1: Zidentyfikować artefakty i worktree**

  Zebrać listę worktree, branchy i nieśledzonych plików; oddzielić artefakty użytkownika od tymczasowych plików agentów.

- [ ] **Step 2: Nie usuwać bez zgody**

  Przygotować listę kandydatów do usunięcia, ale nie wykonywać destrukcyjnych operacji w tej iteracji, ponieważ root worktree zawiera niezależne zmiany.

- [ ] **Step 3: Potwierdzić czystość pakietu dokumentacyjnego**

  Sprawdzić status czystego worktree `production-release` i upewnić się, że zmiany ograniczają się do planu oraz dokumentacji.
