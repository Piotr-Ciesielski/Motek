# Ignorowanie lokalnych plików SQLite — projekt zmiany

## Cel

Zapobiec przypadkowemu dodaniu do Git lokalnych plików pomocniczych tworzonych przez SQLite w katalogu `data/`.

## Zakres

- Dodać reguły dla plików `*.sqlite-wal`, `*.sqlite-shm`, `*.db-wal` i `*.db-shm` wyłącznie w katalogu `data/`.
- Zachować w Git konfigurację zespołu agentów: `.codex/`, `AGENTS.override.md` i `test/codex-agent-config.test.js`.
- Zachować w Git dokumentację `docs/superpowers/`.
- Nie zmieniać pozostałych reguł `.gitignore`.

## Weryfikacja

Użyć `git check-ignore -v` dla przykładowych plików pomocniczych SQLite oraz potwierdzić, że pliki konfiguracji agentów nie są ignorowane.
