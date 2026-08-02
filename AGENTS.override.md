## Zespół subagentów Motka

Zespół jest wymagany, gdy zadanie ma co najmniej dwie niezależne części albo gdy niezależna recenzja istotnie zmniejsza ryzyko. Proste, jednoplikowe zadania o niskim ryzyku koordynator może wykonać bez uruchamiania pełnego zespołu, z proporcjonalną weryfikacją.

- `motek_explorer` mapuje kod, zależności, ryzyka i wymagane testy; działa tylko do odczytu,
- `motek_worker` wykonuje małą, wyraźnie ograniczoną zmianę i uruchamia testy,
- `motek_reviewer` niezależnie sprawdza wymagania, regresje, bezpieczeństwo i kompletność testów; działa tylko do odczytu.

Domyślna kolejność to analityk → wykonawca → recenzent. Niezależne prace tylko do odczytu mogą działać równolegle. Zapisy mogą być równoległe wyłącznie gdy zakresy plików są jawnie rozłączne; nigdy nie zlecaj równoległych zapisów do tych samych plików. Istotne uwagi recenzenta wracają do tego samego wykonawcy, a następnie podlegają ponownej recenzji.

Przed delegowaniem koordynator wybiera najbezpieczniejszy tryb uprawnień sesji nadrzędnej potrzebny w bieżącym etapie. Nigdy nie deleguj tego zespołu z trybu Full Access, Yolo ani równoważnego trybu nieograniczonego. Nie włączaj sieci, aplikacji/connectorów ani integracji zewnętrznych dla subagentów bez konkretnej wcześniejszej zgody użytkownika.

Nadrzędne ustawienia runtime mogą zastąpić `sandbox_mode` z pliku agenta. Jeśli sesja nadrzędna przyznaje `workspace-write`, deklaracja tylko do odczytu dla `motek_explorer` i `motek_reviewer` jest instrukcją behawioralną, a nie twardą granicą techniczną. Preferuj etap analizy i recenzji tylko do odczytu. Gdy klient obsługuje zmianę trybu nadrzędnego między turami, przyznaj `workspace-write` wyłącznie na czas etapu implementacji i tylko w zakresie potrzebnym `motek_worker`.

Główny agent pozostaje odpowiedzialny za zakres, zachowanie istniejących zmian, końcową weryfikację i wspólne podsumowanie dla użytkownika. Operacje zewnętrzne, publikacje, zdalne migracje, import wykonawczy i wdrożenia zawsze wymagają wcześniejszej zgody użytkownika.

------------------------------------------------------------------------

## Combined commit and GitHub push workflow

After completing and verifying a meaningful unit of work, propose one
combined approval for saving the checkpoint locally and publishing it to
GitHub.

Use a clear question such as:

> „Zapisać commit i wysłać go do GitHub?"

When Codex asks this combined commit-and-push question and the user
answers `tak`, that response authorizes the following coherent sequence
for the current verified package:

1.  stage only the files belonging to the approved package,
2.  create the proposed Git commit,
3.  push the current branch to its configured `origin` branch without
    force,
4.  fetch or otherwise refresh the remote reference when needed,
5.  verify that local `HEAD` and `origin/<current-branch>` point to the
    same commit,
6.  confirm whether the working directory is clean.

Do not ask the user to run `git push` manually when Codex can execute it
safely.

If the user approves only the commit, create the commit but do not push.
If the user explicitly asks to keep changes local, do not publish them.

Treat force push, history rewriting, pushing to a different branch, and
publishing unexpected commits as separate high-risk actions requiring
their own explicit approval.

Use the persistent Windows OpenSSH agent and the Git-configured Windows
OpenSSH client for authentication. Do not start a separate temporary
Git Bash SSH agent, because the two agents do not share unlocked keys
and may ask for the passphrase twice.

If the persistent agent does not currently contain the required key,
explain that one interactive passphrase entry is needed to unlock it.
Never request or handle the passphrase in chat.

After a successful push, report:

-   the commit identifier and message,
-   the branch published to GitHub,
-   whether local Git and GitHub are synchronized,
-   whether any uncommitted local changes remain.

------------------------------------------------------------------------
