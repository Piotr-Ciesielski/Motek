# Natychmiastowe usuwanie konta — projekt

**Data:** 2026-07-31  
**Status:** zatwierdzone przez właścicielkę produktu  
**Zakres:** konto użytkownika, dane prywatne i sesja

## Cel

Użytkownik może trwale usunąć konto Motka wraz ze wszystkimi własnymi danymi.
Operacja jest natychmiastowa i nie ma okresu odzyskiwania.

## Decyzje produktowe

1. Usunięcie konta jest bezpowrotne.
2. Operacja wymaga aktywnej sesji, ponownego podania hasła oraz wpisania
   dokładnej frazy `USUŃ KONTO`.
3. Dane prywatne użytkownika są usuwane razem z kontem.
4. Wspólny katalog wzorów nie jest usuwany.
5. Operacja nie ma automatycznego retry po niepewnej odpowiedzi sieciowej.

## Dane objęte usuwaniem

`public.profiles.id` oraz `public.yarns.user_id` wskazują na
`auth.users.id` z `on delete cascade`. Usunięcie użytkownika Auth usuwa więc
profil i prywatny magazyn włóczek. Każda przyszła tabela z danymi użytkownika
musi korzystać z tej samej zasady albo mieć jawnie opisaną procedurę usuwania.

Nie są usuwane:

- `public.patterns`, ponieważ katalog jest wspólny;
- dane techniczne niezbędne do działania systemu, o ile nie zawierają treści
  pozwalających odtworzyć dane użytkownika.

## Backend

Powstaje chroniony endpoint `DELETE /api/account`.

Backend:

1. wymaga aktywnej sesji;
2. sprawdza, czy fraza potwierdzająca jest dokładnie równa `USUŃ KONTO`;
3. weryfikuje ponownie hasło w Supabase Auth dla tego samego użytkownika;
4. wykonuje administracyjne usunięcie użytkownika przez klienta z kluczem
   `SUPABASE_SECRET_KEY`;
5. usuwa ciasteczka sesji po udanym usunięciu;
6. zwraca ogólny komunikat błędu bez sekretów i szczegółów infrastruktury.

Frontend nigdy nie otrzymuje klucza administracyjnego. Hasło jest przesyłane
wyłącznie do backendu przez istniejący mechanizm żądań JSON i nie jest logowane.
Produkcja wymaga HTTPS.

## Frontend

W widoku konta powstaje wyraźnie odseparowana sekcja ryzykownej operacji:

- opis skutków usunięcia;
- pole hasła z dostępną kontrolką pokaż/ukryj;
- pole dokładnej frazy potwierdzającej;
- przycisk aktywny dopiero po lokalnym spełnieniu podstawowych warunków;
- stan ładowania blokujący wielokrotne wysłanie;
- komunikat sukcesu i powrót do stanu gościa;
- zachowanie formularza przy błędzie połączenia.

Jeżeli odpowiedź sieciowa zostanie utracona po wysłaniu żądania, frontend nie
powtarza usunięcia automatycznie. Zamiast tego sprawdza sesję przy kolejnym
wejściu lub po ręcznym odświeżeniu.

## Ochrona żądania

Endpoint korzysta z istniejącej sesji HttpOnly, kontroli pochodzenia żądania
i limitów operacji uwierzytelnionych. Dodatkowe potwierdzenie hasłem chroni
przed usunięciem konta przez osobę, która uzyskała dostęp do aktywnej sesji.

## Testy

Należy sprawdzić:

- poprawne usunięcie konta, profilu i włóczek;
- pozostawienie katalogu wzorów;
- odmowę bez aktywnej sesji;
- odmowę przy błędnym haśle;
- odmowę przy błędnej frazie;
- brak możliwości podania innego identyfikatora użytkownika;
- brak sekretów i haseł w logach oraz odpowiedziach API;
- wyczyszczenie sesji po sukcesie;
- brak automatycznego ponowienia po utracie odpowiedzi;
- zachowanie interfejsu w obu motywach.

## Poza zakresem

- kosz i 30-dniowe odzyskiwanie;
- eksport danych przed usunięciem;
- usuwanie wspólnego katalogu wzorów;
- usuwanie kont administracyjnych przez interfejs zwykłego użytkownika.
