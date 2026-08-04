# Project Documentation Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ujednolicić dokumentację Motka z rzeczywistą konfiguracją stagingu i produkcji po wdrożeniu Railway, Supabase Production, Cloudflare DNS/WAF oraz ręcznego release'u produkcji.

**Architecture:** Dokumentacja operacyjna pozostanie w głównych plikach `README.md` i `SPEC.md`, a szczegóły wdrożeniowe i procedury regresji zostaną uzupełnione w istniejącej specyfikacji Railway/Cloudflare oraz planie wdrożeniowym. Nie zapisujemy sekretów ani tokenów; dokumentujemy tylko nazwy zmiennych, zakresy i bezpieczne procedury.

**Tech Stack:** Markdown, Railway CLI/dashboard, Cloudflare DNS, Supabase, GitHub Actions.

## Global Constraints

- Nie umieszczać wartości sekretów, tokenów, haseł, JWT ani kluczy API w dokumentacji.
- Produkcja Railway używa gałęzi `main` i ręcznego deployu; staging używa gałęzi `staging` i automatycznego deployu.
- Produkcja korzysta z Supabase projektu `Motek Production`; staging pozostaje odseparowany.
- Cloudflare DNS/WAF jest przed domeną `rysia.org`; rekordy weryfikacyjne Railway muszą być utrzymywane w Cloudflare.
- Limit bezczynności sesji wynosi 2 godziny (`AUTH_IDLE_TIMEOUT_SECONDS=7200`).

### Task 1: Inventory and documentation map

**Files:**
- Read: `README.md`, `SPEC.md`, `docs/superpowers/specs/2026-08-03-railway-cloudflare-production-design.md`, `docs/superpowers/plans/2026-08-03-railway-cloudflare-regression-deployment.md`
- Modify: none

- [x] **Step 1: Compare documented and verified deployment state**

  Confirm Railway environment names, branches, domains, health endpoint, Supabase separation, Cloudflare nameservers, and manual production trigger without printing secrets.

- [x] **Step 2: Record required documentation edits**

  Produce a focused list of stale or missing instructions before editing.

### Task 2: Update user-facing project documentation

**Files:**
- Modify: `README.md`
- Modify: `SPEC.md`

- [x] **Step 1: Document environments and deployment ownership**

  Add the verified staging/production split, public URLs, branch policy, automatic versus manual deployment behavior, and rollback/release checks.

- [x] **Step 2: Document configuration without secrets**

  List required Railway and Supabase variable names, Turnstile configuration, 2-hour idle timeout, HTTPS/secure cookies, and where each secret is stored.

- [x] **Step 3: Document operational smoke checks**

  Include `/health/release`, HTTPS, authentication, pattern matching, yarn inventory, profile, CAPTCHA, logout/idle timeout, and data-isolation checks.

### Task 3: Update deployment and regression runbook

**Files:**
- Modify: `docs/superpowers/specs/2026-08-03-railway-cloudflare-production-design.md`
- Modify: `docs/superpowers/plans/2026-08-03-railway-cloudflare-regression-deployment.md`

- [x] **Step 1: Align Cloudflare and Railway DNS procedure**

  Document the Railway custom nameservers `darwin.ns.cloudflare.com` and `ruth.ns.cloudflare.com`, proxied CNAME/flattening records, Railway TXT verification records, pending/propagation verification, and SSL mode expectations.

- [x] **Step 2: Align manual production release procedure**

  Document Railway dashboard `Deploy Latest Commit` and `railway redeploy --from-source` for production, with production auto-deploy disabled and staging auto-deploy enabled.

- [x] **Step 3: Align post-deploy regression procedure**

  Document staging-first and production smoke/regression gates, evidence to capture, and the rule that production is not promoted automatically.

### Task 4: Validate and publish the documentation checkpoint

**Files:**
- Modify: only files confirmed in Tasks 2–3

- [x] **Step 1: Run Markdown and repository consistency checks**

  Run `git diff --check`, existing documentation checks if available, and targeted searches for stale branches, domains, and unsafe secret examples.

- [x] **Step 2: Review the final diff**

  Ensure unrelated untracked user files remain untouched and no secret values are included.

- [ ] **Step 3: Commit and push**

  Stage only the documentation files from this plan, create `docs: align deployment runbooks with production setup`, push the current branch to `origin`, refresh the remote reference, and verify local/remote commit equality.
