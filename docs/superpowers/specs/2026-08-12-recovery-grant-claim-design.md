# Specyfikacja: atomowe zajmowanie grantu odzyskiwania hasła

Data: 2026-08-12  
Status: do akceptacji przed implementacją

## Cel

Zabezpieczyć endpoint `POST /api/auth/password` przed równoległym użyciem
tego samego jednorazowego linku odzyskiwania hasła.

Praktyczny efekt: jeden grant może doprowadzić najwyżej do jednej próby
zmiany hasła. Drugie równoległe żądanie zostanie odrzucone zanim wywoła
`auth.updateUser`.

## Ustalenia z analizy

Obecny przepływ jest następujący:

1. serwer sprawdza sesję i podpisane ciasteczko grantu;
2. serwer wywołuje `auth.updateUser({ password })`;
3. dopiero po udanej zmianie hasła wywołuje
   `consume_auth_recovery_grant`.

`consume_auth_recovery_grant` jest atomowe na poziomie bazy, ale działa za
późno. Dwa żądania mogą przejść krok 1 i oba zmienić hasło, zanim jedno z
nich zużyje grant.

## Rozważone warianty

### Wariant A — pozostawić obecny przepływ

Najmniejsza zmiana, ale nie usuwa wyścigu. Odrzucony.

### Wariant B — claim/release w istniejącym modelu grantu (rekomendowany)

Nowa, addytywna migracja doda znacznik zajęcia oraz dwa ściśle ograniczone
RPC. Serwer zajmie grant przed `updateUser`, zwolni go wyłącznie po błędzie
zmiany hasła, a po sukcesie zużyje tak jak obecnie.

Zalety:

- atomowa ochrona przed równoległym `updateUser`;
- mała zmiana w istniejącej architekturze;
- brak potrzeby używania klucza `service_role` w ścieżce żądania;
- kompatybilność z obecnym prywatnym magazynem grantów i RLS;
- migracja może zostać przetestowana lokalnie i wdrożona niezależnie.

Koszt: jeśli proces zakończy się po zmianie hasła, ale przed zużyciem
grantu, grant pozostanie zajęty do wygaśnięcia. Hasło będzie już zmienione,
a użytkownik może zalogować się nowym hasłem lub rozpocząć nowy proces
odzyskiwania. Nie tworzy to ponownej możliwości użycia starego grantu.

### Wariant C — uprzywilejowana, serwerowa zmiana hasła

Przenieść zmianę hasła do przepływu używającego bezpośrednio
administracyjnego API Auth. Zmniejsza to liczbę kroków po stronie klienta,
ale wymaga ostrożnego zarządzania `service_role`, zmienia granicę zaufania
i jest nieproporcjonalne do obecnej prostej, niskokosztowej architektury.

## Projekt rekomendowany

### Baza danych

Nowa migracja, wykonywana po
`20260807150000_reconcile_yarn_acl_and_recovery.sql`, wykona wyłącznie
zmiany addytywne:

- doda `claimed_at timestamptz` do
  `private.auth_recovery_grants`;
- doda `public.claim_auth_recovery_grant(grant_jti text) returns boolean`;
- doda `public.release_auth_recovery_grant(grant_jti text) returns boolean`;
- zmieni `consume_auth_recovery_grant`, tak aby zużycie było możliwe tylko
  dla wcześniej zajętego, niezużytego i niewygasłego grantu;
- odbierze domyślne uprawnienia i nada `execute` wyłącznie roli
  `authenticated`, tak jak przy istniejących RPC.

`claim_auth_recovery_grant` wykona jeden atomowy `update` z warunkami:

- `auth.uid()` jest właścicielem grantu;
- hash `grant_jti` pasuje;
- grant nie jest zużyty;
- grant nie wygasł;
- `claimed_at is null`.

Zwróci `true`, gdy dokładnie jeden wiersz został zajęty, i `false` w
przeciwnym razie. Równoległe żądania będą serializowane przez blokadę
wiersza wynikającą z `update`.

`release_auth_recovery_grant` wyzeruje `claimed_at` tylko dla tego samego
właściciela i grantu, gdy grant nadal jest niezużyty. Zwróci informację,
czy zwolniono dokładnie jeden wiersz.

Nie będziemy zmieniać istniejącej migracji `reconcile` ani przywracać
historycznych migracji ze stagingu. Nie będzie też zdalnego uruchamiania
migracji bez osobnej zgody.

### Serwer

W `POST /api/auth/password` kolejność będzie następująca:

1. sprawdzenie sesji, hasła, ciasteczek i podpisu grantu;
2. ustanowienie sesji klienta Supabase;
3. wywołanie `claim_auth_recovery_grant`;
4. odrzucenie żądania, jeśli claim zwróci błąd lub `false`;
5. wywołanie `auth.updateUser`;
6. przy błędzie `updateUser` próba `release_auth_recovery_grant`, a potem
   odpowiedź 400;
7. po sukcesie wywołanie istniejącego `consume_auth_recovery_grant`;
8. globalne wylogowanie i wyczyszczenie ciasteczek.

Jeśli zużycie grantu nie powiedzie się po udanej zmianie hasła, serwer nie
zwolni grantu. Zapobiega to ponownej próbie zmiany hasła tym samym linkiem.
Zostanie zwrócony błąd 503, a sytuacja będzie logowana bez ujawniania
sekretów. To jest świadomy kompromis między bezpieczeństwem a pełną
atomowością operacji, której nie da się uzyskać między Supabase Auth i
prywatną tabelą w jednym lokalnym transakcyjnym wywołaniu.

### Kontrakt błędów

- brak lub nieważny grant: obecny komunikat 400;
- grant zajęty, zużyty lub wygasły: bez ujawniania szczegółów odpowiedź
  400 dla nieprawidłowego linku;
- błąd RPC claim/release/consume: odpowiedź 503, bez ujawniania danych
  wewnętrznych;
- błąd zmiany hasła: odpowiedź 400, grant zostaje zwolniony.

## Testy przed implementacją

Testy serwera w `test/server.test.js` powinny sprawdzić:

1. poprawną sekwencję `claim -> updateUser -> consume`;
2. odrzucenie żądania, gdy claim zwróci `false`, bez wywołania
   `updateUser`;
3. zwolnienie grantu po błędzie `updateUser`;
4. brak zwolnienia po udanej zmianie hasła i błędzie consume;
5. równoległe żądania, z których tylko jedno może wywołać `updateUser`;
6. zachowanie istniejących ograniczeń ciasteczka, użytkownika i wygaśnięcia.

Testy SQL/local DB powinny sprawdzić:

1. atomowość dwóch równoległych claimów;
2. brak możliwości claim przez innego użytkownika;
3. brak możliwości consume bez wcześniejszego claim;
4. możliwość release tylko dla niezużytego grantu;
5. dokładne uprawnienia `authenticated` do nowych RPC.

Najpierw zostaną dodane testy, które początkowo mają nie przejść. Dopiero
potem powstanie migracja i zmiana serwera.

## Zakres poza tą zmianą

- brak wdrożenia do Supabase lub Railway;
- brak zmiany wersji alpha;
- brak zmian w legal acceptance, RLS magazynu włóczek i nawigacji mobilnej;
- brak przywracania historycznych migracji stagingu;
- brak użycia `service_role` w żądaniu użytkownika.

## Kryteria akceptacji

Zmiana będzie gotowa do przeglądu, gdy:

- testy wykażą, że równoległy grant może wykonać najwyżej jedno
  `updateUser`;
- nieudana zmiana hasła nie blokuje grantu;
- udana zmiana hasła nie pozwala na ponowne użycie grantu;
- migracja jest addytywna i lokalnie weryfikowalna;
- `npm run check`, testy bazy, formatowanie i kontrola diffu przejdą;
- nie wykonano żadnej zdalnej migracji ani wdrożenia.
