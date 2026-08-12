# C2/C3 hardening — specyfikacja

## Cel

Domknąć lokalną część gotowości przedprodukcjnej bez dodawania usług,
zmiany architektury ani włączania ustawień produkcyjnych wymagających
dostępu do paneli Cloudflare lub Railway.

## Zakres

1. Rozszerzyć testy odpowiedzi HTTP o obecne nagłówki bezpieczeństwa:
   `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`,
   `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` i
   `Cross-Origin-Resource-Policy`.
2. Dodać alert Prometheus dla nagłego wzrostu odrzuceń Auth z limitera
   aplikacyjnego. Alert będzie oparty o istniejącą metrykę z zamkniętą etykietą
   `operation`; nie będzie próbował mierzyć 429 generowanych przez Nginx.
3. Uzupełnić runbook o ręczne czynności operatorskie: Cloudflare proxied DNS,
   ukrycie originu Railway, TLS Full (strict), WAF/rate limiting, brak cache dla
   API/Auth, alerty i weryfikację `/internal/metrics`.

## Poza zakresem

- brak zmian DNS, Cloudflare, Railway i Supabase;
- brak HSTS przed potwierdzeniem wszystkich produkcyjnych domen i subdomen;
- brak Cloudflare Access, dopóki workflow regresji nie obsługuje service-tokenów;
- brak nowych zależności, usług, migracji i zmian limitów Auth.

## Kryteria akceptacji

- testy wykrywają brak lub osłabienie któregokolwiek wymaganego nagłówka;
- alert ma określony próg, czas trwania i opis reakcji operatora;
- runbook rozdziela fakty potwierdzone lokalnie od czynności wymagających panelu
  dostawcy;
- `npm run check`, `npm run lint`, `npm run format:check` i `git diff --check`
  przechodzą;
- nie są dodawane sekrety ani nieśledzone pliki użytkownika.
