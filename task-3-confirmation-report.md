# Task 3 — testy potwierdzenia rejestracji

## Zakres

- Test przechodzi przez rzeczywisty endpoint rejestracji, a następnie używa pary tokenów wydanej przez fake Supabase podczas tego signup.
- Potwierdzenie tej pary zwraca `200`, dane potwierdzonego użytkownika i trzy ciasteczka sesji.
- Ponowne użycie tej samej pary nadal zwraca neutralne `400` bez ujawniania stanu tokenu.
- Osobna, wygasła para tokenów zwraca takie samo neutralne `400`.

## Weryfikacja

- `node --test test/server.test.js test/auth.test.js` — 39 testów przeszło, 0 błędów.
- `npm run check` — 246 testów przeszło, 0 błędów; kontrole składni również zakończone powodzeniem.

## Poza zakresem lokalnej weryfikacji

- Fake Supabase nie potwierdza dostarczenia rzeczywistej wiadomości e-mail ani zachowania tokenów generowanych przez zewnętrzną usługę Supabase Auth.
- Nie weryfikowano przepływu w przeglądarce po kliknięciu linku z e-maila ani zewnętrznej weryfikacji CAPTCHA.
