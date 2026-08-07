# Status audytu bezpieczeństwa — 2026-08-07

Dokument opisuje stan zmian na zweryfikowanym środowisku staging. Nie oznacza
wdrożenia tych zmian na produkcję.

## Stan

Na stagingu zaadresowano i przetestowano punkty U-01–U-15, U-18, U-20, U-21
i U-23 z `AUDYT_SEC.md`. Obejmują one m.in. ochronę bezpośrednich mutacji
magazynu, recovery haseł, sesje i ciasteczka, race condition draftów,
walidację danych, limity, rate limiting oraz testy graniczne bazy.

Weryfikacja CI stagingu obejmuje 135 zakończonych sukcesem testów pgTAP oraz
regresję po wdrożeniu. Aktualny snapshot to `staging` / `62d0b84e` /
`2.0.0-alpha.39`.

## Częściowo zaadresowane

- **U-22** — zaktualizowano README, specyfikację i raport stagingu; pełne
  uporządkowanie wszystkich kontraktów i tabeli tras pozostaje do domknięcia.

## Otwarte

- **U-16** — akcja `supabase/setup-cli` nadal używa ruchomego taga `@v1`;
- **U-17** — obrazy pomocnicze w konfiguracji stagingu nie są wszędzie
  przypięte do digestów;
- **U-19** — `avatar_url` nie ma limitu długości egzekwowanego w bazie.

## Granica wdrożenia

Produkcja pozostaje na wcześniejszym commicie i nie została zmieniona.
Otwarte punkty należy zamknąć na osobnym pakiecie przed rozważeniem wdrożenia
produkcyjnego.
