# Motek — header auth i uproszczone Konto

## Status

Kierunek zatwierdzony przez właściciela produktu 2026-08-08. Implementacja jeszcze się nie rozpoczęła.

## Cel

Zastąpić email użytkownika w prawym górnym rogu jednoznacznym przyciskiem sesji oraz uprościć zalogowany widok Konta tak, aby najważniejsze informacje i akcje były widoczne bez powtarzania copy, a destrukcyjne usunięcie konta zajmowało mniej miejsca.

## Zatwierdzone decyzje

### Header

- W `app-header__actions` kolejność od lewej do prawej: przełącznik trybu jasnego/ciemnego, przycisk sesji.
- Stan niezalogowany: przycisk ma tekst `Zaloguj`.
- Kliknięcie `Zaloguj` przełącza na widok `Konto`, pokazuje formularz logowania i ustawia fokus na polu e-mail.
- Po poprawnym logowaniu aplikacja przechodzi od razu do widoku `Magazyn`.
- Stan zalogowany: przycisk ma tekst `Wyloguj` i nie pokazuje adresu e-mail.
- Kliknięcie `Wyloguj` wykonuje istniejące `POST /api/auth/logout` natychmiast. Zachowujemy istniejące ostrzeżenie o niezapisanych zmianach w magazynie.
- Po udanym wylogowaniu aplikacja pokazuje `Konto` z formularzem logowania; sesja, stan idle timeout i stany prywatnych widoków są czyszczone przez istniejący przepływ `renderAuthState`.
- Przycisk ma aktualny `aria-label` i stan dostępności zgodny z tekstem; email nie trafia już do headera ani do jego tooltipa.

### Zalogowany widok Konta

Docelowa hierarchia panelu:

```text
Twoje konto
Zalogowano jako: user@example.com

[ Wyloguj się z tego urządzenia ]

[ Usuń konto                                      ▸ ]
```

- Usuwamy eyebrow `Konto` nad tytułem w stanie zalogowanym.
- Tytuł pozostaje `Twoje konto`.
- Pozostaje dokładnie jedna informacja o adresie: `Zalogowano jako: {email}` — z dwukropkiem po `jako`.
- Nie renderujemy dodatkowego końcowego komunikatu `Zalogowano.` jako stałego elementu panelu.
- Istniejący przycisk wylogowania na stronie Konta pozostaje dostępny jako dodatkowa, jawna akcja bezpieczeństwa.

### Strefa usuwania konta

- Zamiast dużego stale rozwiniętego formularza używamy natywnej, dostępnej sekcji disclosure (`details`/`summary`) domyślnie zamkniętej.
- Zamknięty stan pokazuje tylko tytuł `Usuń konto`, krótkie ostrzeżenie i wskaźnik rozwinięcia.
- Po rozwinięciu pozostają bez zmian: pole hasła, pole `USUŃ KONTO`, informacja o nieodwracalności, komunikaty błędów/sukcesu i przycisk `Usuń konto bezpowrotnie`.
- Zamknięcie sekcji nie czyści wpisanych wartości; czyszczenie nadal następuje przy zmianie sesji zgodnie z obecnym `renderAuthState`.
- Sekcja zachowuje kontrast ostrzegawczy, widoczny focus, obsługę klawiatury i `prefers-reduced-motion`.
- Nie zmieniamy endpointu `DELETE /api/account`, ponownego uwierzytelnienia, frazy potwierdzającej ani komunikatów bezpieczeństwa poza usunięciem powtórzeń wizualnych.

## Przepływ stanu

1. `renderAuthState({ authenticated: false })` ukrywa `authLoggedIn`, ustawia header action na `Zaloguj` i kieruje prywatne widoki do `Konto`.
2. Kliknięcie header action w stanie niezalogowanym wywołuje istniejący `showAuthForm(loginForm)`, `setActiveView("account")` i fokus pola e-mail.
3. Sukces `POST /api/auth/login` odświeża sesję, ustawia header action na `Wyloguj` i przechodzi do `Magazyn`.
4. Kliknięcie header action w stanie zalogowanym wywołuje ten sam kontrolowany logout co przycisk Konta, a po sukcesie wraca do `Konto`.
5. `renderAuthState` ustawia podsumowanie konta tylko w panelu Konta i nie kopiuje adresu do headera.

## Granice i zachowane funkcje

- Nie zmieniamy API, cookies, sesji, idle timeoutu, Turnstile ani autoryzacji.
- Nie dodajemy modala ani nowej biblioteki UI.
- Nie zmieniamy logiki Magazynu, Dopasowania i Katalogu poza przejściem po logowaniu/wylogowaniu.
- Nie usuwamy istniejącego mechanizmu ostrzegania przed utratą niezapisanych zmian.

## Dostępność i responsywność

- Kolejność klawiatury odpowiada kolejności wizualnej: motyw → sesja.
- Oba przyciski headera zachowują minimum 44×44 px i widoczny `:focus-visible`.
- `summary` ma czytelny stan otwarty/zamknięty oraz nie polega wyłącznie na kolorze.
- Na mobile akcja sesji nie wypycha nawigacji i nie powoduje poziomego overflow.
- Animacja disclosure jest wyłączona dla `prefers-reduced-motion: reduce`.

## Kryteria akceptacji

1. Niezalogowany header pokazuje `Zaloguj` po prawej stronie przełącznika motywu i nie pokazuje emaila.
2. Kliknięcie `Zaloguj` otwiera Konto, formularz logowania i fokusuje e-mail.
3. Poprawne logowanie prowadzi do Magazynu, a header pokazuje `Wyloguj`.
4. Kliknięcie `Wyloguj` kończy sesję natychmiast i pokazuje Konto z formularzem logowania.
5. Zalogowane Konto ma tytuł `Twoje konto`, jedną linię `Zalogowano jako: ...` i nie ma stałego `Zalogowano.` na dole.
6. Strefa usuwania konta jest domyślnie zwinięta, po otwarciu zachowuje pełny bezpieczny przepływ.
7. Jasny i ciemny motyw oraz szerokości 1440, 1024, 768 i 390 px przechodzą testy layoutu i nie mają poziomego overflow.
