# Local SQLite Files Gitignore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent local SQLite WAL and shared-memory files in `data/` from being added to Git.

**Architecture:** Extend the existing database section of `.gitignore` with four narrowly scoped patterns. Verify the new patterns directly and confirm that project-owned Codex configuration remains visible to Git.

**Tech Stack:** Git, `.gitignore`, PowerShell

## Global Constraints

- Ignore only SQLite helper files under `data/`.
- Do not ignore `.codex/`, `AGENTS.override.md`, `test/codex-agent-config.test.js`, or `docs/superpowers/`.
- Preserve every existing `.gitignore` rule.

---

### Task 1: Ignore local SQLite helper files

**Files:**
- Modify: `.gitignore`
- Test: Git ignore-rule checks

**Interfaces:**
- Consumes: Existing `data/*.sqlite` and `data/*.db` ignore rules.
- Produces: Four additional ignore patterns scoped to `data/`.

- [ ] **Step 1: Add the four SQLite helper-file patterns**

Add below the existing SQLite journal rules:

```gitignore
data/*.sqlite-wal
data/*.sqlite-shm
data/*.db-wal
data/*.db-shm
```

- [ ] **Step 2: Verify the new patterns**

Run:

```powershell
git check-ignore -v data/example.sqlite-wal data/example.sqlite-shm data/example.db-wal data/example.db-shm
```

Expected: all four paths are reported with their matching `.gitignore` lines.

- [ ] **Step 3: Confirm project-owned Codex files remain visible**

Run:

```powershell
git check-ignore .codex/config.toml AGENTS.override.md test/codex-agent-config.test.js
```

Expected: no paths are reported and the command exits with code `1`, meaning none of these files is ignored.

- [ ] **Step 4: Review the focused diff**

Run:

```powershell
git diff --check -- .gitignore
git diff -- .gitignore
```

Expected: no whitespace errors and only four new ignore rules in `.gitignore`.

- [ ] **Step 5: Save a Git checkpoint after user approval**

```powershell
git add .gitignore docs/superpowers/specs/2026-08-02-gitignore-local-sqlite-files-design.md docs/superpowers/plans/2026-08-02-gitignore-local-sqlite-files.md
git commit -m "chore: ignore local SQLite helper files"
```
