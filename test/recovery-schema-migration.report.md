# Recovery schema migration — raport

## Zakres

- Dodano migrację `20260816131026_align_recovery_grant_primary_key.sql`.
- Rozszerzono test kontraktu `recovery-schema-migration.test.js`.
- Dodano pgTAP `auth_recovery_schema_alignment.test.sql`, wykonywany po replayu migracji.
- Nie zmieniono historycznej migracji `20260807150000_reconcile_yarn_acl_and_recovery.sql`, RPC ani `server.js`.

## Kontrakt migracji

- Wariant historyczny z kluczem głównym `grant_id` zmienia klucz główny na `jti_hash` i usuwa `grant_id`.
- Wariant mający już wyłącznie klucz główny `jti_hash` nie przebudowuje klucza.
- Przed zmianą sprawdzana jest obecność kolumn używanych przez RPC: `user_id`, `jti_hash`, `expires_at`, `used_at`, `created_at`, `claimed_at`.
- Dodawane i walidowane są ograniczenia `char_length(jti_hash) = 64` oraz `expires_at > created_at`.
- Jeżeli constraint o jednej z docelowych nazw już istnieje, migracja odczytuje jego rzeczywistą definicję przez `pg_get_constraintdef`. Definicja różna od wymaganego `CHECK` przerywa migrację wyjątkiem; brakujący constraint jest dodawany.
- Ograniczenia są dodawane jako `NOT VALID`, a następnie walidowane. Niezgodne dane zatrzymują walidację; migracja pozostaje transakcyjna i nie powinna pozostawić częściowej przebudowy.
- Plik nie zawiera poleceń zdalnych ani wykonania migracji.

## Kontrakt pgTAP po replayu

- Tabela `private.auth_recovery_grants` istnieje, nie ma kolumny `grant_id`, a jej jedynym kluczem głównym jest `jti_hash`.
- Oba CHECK są obecne, mają wymaganą definicję i są zwalidowane.
- Zachowane są wszystkie kolumny używane przez RPC: `user_id`, `jti_hash`, `expires_at`, `used_at`, `created_at`, `claimed_at`.
- Zachowany jest klientowy ACL: brak bezpośredniego `SELECT` dla `PUBLIC`, `anon` i `authenticated`; RPC są niedostępne dla `PUBLIC` i `anon`, a dostępne dla `authenticated`.

## Weryfikacja

- `node --test test/recovery-schema-migration.test.js` — 7 testów zakończonych powodzeniem.
- `node --check test/recovery-schema-migration.test.js` — zakończone powodzeniem.
- `git diff --check` — zakończone powodzeniem; Git wypisał wyłącznie ostrzeżenia końców linii dla istniejących, cudzych zmian poza zakresem.

## Ograniczenia

- Nie uruchamiano migracji ani nowego testu pgTAP na lokalnej, stagingowej lub produkcyjnej bazie.
- Nowy test pgTAP został uruchomiony po kontrolowanym lokalnym replayu:
  `node node_modules/supabase/dist/supabase.js db reset --local --yes`, a następnie
  `node node_modules/supabase/dist/supabase.js test db --local`.
- Wynik replayu: **10 plików, 275/275 testów PASS**. Obejmuje to 30/30 asercji
  nowego kontraktu recovery schema.
- Nie wykonywano `migration repair`, deployu ani żadnej operacji zdalnej.
