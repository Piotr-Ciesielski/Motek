# Rejestracja z adresem e-mail jako loginem

## Cel

Ograniczyć ilość danych zbieranych przy zakładaniu konta i uprościć logowanie. Formularz nie będzie zbierał imienia i nazwiska, a adres e-mail podany przy rejestracji będzie jednocześnie loginem użytkownika.

## Zakres zachowania

- Formularz rejestracji zawiera jedno pole identyfikatora opisane dokładnie jako `Login (Twój e-mail)` oraz pole hasła.
- Pole identyfikatora ma walidację adresu e-mail, normalizuje wartość przez przycięcie spacji i zamianę na małe litery.
- Backend używa tej samej znormalizowanej wartości jako `email` dla Supabase Auth oraz jako `login` w `public.profiles`.
- Logowanie i odzyskiwanie hasła nadal przyjmują adres e-mail.
- Aplikacja nie wyświetla ani nie odczytuje imienia i nazwiska.

## Zmiana danych w Supabase

Nowa migracja SQL:

1. Ustawia `profiles.login` na znormalizowany adres z `profiles.email` dla istniejących rekordów.
2. Synchronizuje `profiles.email` i `profiles.login` z adresem w `auth.users`, który jest źródłem prawdy dla konta.
3. Zastępuje dotychczasowe ograniczenie loginu regułą adresu e-mail oraz zgodności `login = email`.
4. Aktualizuje funkcje tworzenia i synchronizacji profilu tak, aby nowy profil nie zapisywał imienia i zmiana e-maila aktualizowała jednocześnie login.
5. Usuwa możliwość bezpośredniej zmiany loginu przez rolę `authenticated`, ponieważ login ma zawsze wynikać z e-maila.
6. Usuwa kolumnę `public.profiles.full_name`.
7. Usuwa klucz `full_name` z `auth.users.raw_user_meta_data` istniejących użytkowników.

Kolumna `profiles.login` pozostaje w schemacie dla kompatybilności z istniejącym kodem i profilem aplikacji, ale przechowuje wyłącznie tę samą wartość co `profiles.email`.

## Przepływ rejestracji

1. Przeglądarka wysyła `login` oraz `password` do `/api/auth/register`.
2. Serwer normalizuje `login` jako adres e-mail.
3. Serwer wywołuje `auth.signUp` z `email` równym znormalizowanemu loginowi oraz metadanymi zawierającymi ten sam login.
4. Trigger Supabase tworzy profil z identycznymi wartościami `login` i `email`.
5. Po potwierdzeniu adresu użytkownik loguje się tym samym adresem.

## Obsługa istniejących kont

Migracja zachowuje istniejące konta i ich możliwość logowania przez adres e-mail. Dotychczasowe wartości loginów zostaną zastąpione adresami e-mail. Dane `full_name` zostaną usunięte zarówno z tabeli profili, jak i z metadanych Auth; tej operacji na danych nie będzie można odtworzyć z samej bazy.

## Testowanie

- testy normalizacji akceptują e-mail jako login i odrzucają dawny format loginu;
- test rejestracji potwierdza, że jeden e-mail trafia do Auth jako e-mail i login;
- test odpowiedzi użytkownika nie zawiera `fullName`;
- testy istniejących przepływów logowania, resetu hasła i sesji pozostają zielone;
- sprawdzenie składni JavaScript i pełny zestaw testów;
- weryfikacja migracji SQL oraz jej kolejności względem istniejących migracji.

## Poza zakresem

- zmiana adresu e-mail przez interfejs użytkownika;
- zmiana zasad haseł;
- usuwanie innych danych profilu, takich jak avatar lub historia magazynu;
- przebudowa całej tabeli `profiles`.
