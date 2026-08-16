# Obsługa limitu wysyłki resetu hasła — specyfikacja

## Cel

Użytkownik ma otrzymać jasną informację, gdy Supabase odrzuci kolejną
wiadomość resetującą z powodu przekroczenia limitu wysyłki. Obecnie backend
ukrywa ten przypadek pod ogólnym statusem HTTP 503.

## Zakres

- Rozpoznać błąd Supabase `over_email_send_rate_limit` oraz odpowiadający mu
  status 429.
- Zwrócić z endpointu resetu hasła status HTTP 429 i generyczny komunikat:
  „Przekroczono limit prób resetu hasła. Odczekaj jakiś czas i spróbuj
  ponownie później.”
- Zachować dotychczasowy ogólny komunikat 503 dla pozostałych błędów wysyłki.
- Dodać test regresyjny backendu.

## Poza zakresem

- Zmiana limitów Supabase lub konfiguracji CAPTCHA.
- Pokazywanie dokładnego czasu odblokowania.
- Zmiana mechanizmu wysyłki wiadomości lub treści e-maila.

## Kryteria akceptacji

1. Błąd `over_email_send_rate_limit` daje odpowiedź 429 z powyższym
   komunikatem.
2. Inny błąd Supabase nadal daje odpowiedź 503 z dotychczasowym komunikatem.
3. Testy lokalne przechodzą bez ujawniania adresu e-mail, tokenów ani innych
   danych wrażliwych.
