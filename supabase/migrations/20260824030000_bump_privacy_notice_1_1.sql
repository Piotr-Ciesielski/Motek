-- Katalog aplikacji (legal-document.js) ogłasza prywatność 1.1; ledger bazy
-- musi mieć tę samą wersję bieżącą, bo finalizacja rejestracji wymaga zgodności.
update private.legal_document_versions
set is_current = false
where kind = 'privacy' and is_current;

insert into private.legal_document_versions
  (kind, version, effective_at, requires_acceptance, is_current)
values
  ('privacy', '1.1', date '2026-08-24', false, true);
