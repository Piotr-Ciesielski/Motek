# Motek — informacje prawne, prywatność i prawa autorskie

Data projektu: 9 sierpnia 2026
Status: projekt zaakceptowany produktowo, przed planem wdrożenia

## 1. Cel

Motek otrzyma czytelną stronę „Informacje prawne”, która opisuje zasady korzystania z aplikacji, przetwarzanie danych oraz prawa autorskie. Rozwiązanie jest przeznaczone dla bezpłatnego, prywatnego narzędzia udostępnianego ograniczonej grupie zaproszonych osób.

Dokument ma odpowiadać rzeczywistemu działaniu aplikacji. Nie będzie kopią regulaminu PinLab. Przed udostępnieniem użytkownikom treść wymaga uzupełnienia danych operatora i zalecanej kontroli prawnej.

## 2. Operator i placeholdery

Operatorem Motka i administratorem danych jest osoba prywatna. Do czasu podania danych w treści zostaną użyte jednoznaczne placeholdery:

- `[IMIĘ I NAZWISKO OPERATORA]`,
- `[E-MAIL KONTAKTOWY]`.

Publikacja dokumentu z placeholderami na środowisku dostępnym użytkownikom ma być zablokowana testem lub kontrolą wdrożeniową. Dokument nie może zostać uznany za gotowy do produkcji przed zastąpieniem placeholderów prawdziwymi danymi.

## 3. Forma i dostępność

Powstanie jedna strona `/informacje-prawne` z trzema wyraźnymi sekcjami:

1. Regulamin korzystania z Motka.
2. Prywatność i przetwarzanie danych.
3. Prawa autorskie i zasady katalogu wzorów.

Strona będzie dostępna bez logowania. Otrzyma spis treści, datę obowiązywania i jednoznaczny numer wersji. Będzie czytelna na komputerze i telefonie oraz przystosowana do wydruku albo zapisania jako PDF z przeglądarki.

Link „Informacje prawne” pojawi się:

- w stopce aplikacji,
- przy formularzu rejestracji,
- na ekranie konta,
- na ekranie ponownej akceptacji po zmianie dokumentu.

## 4. Treść regulaminu

Regulamin opisze:

- bezpłatny i prywatny charakter Motka,
- dostęp wyłącznie dla zaproszonych osób,
- zasady zakładania, zabezpieczenia i niedzielenia konta,
- zakres usługi: prywatny magazyn włóczek i katalog neutralnych informacji o wzorach,
- zakaz korzystania niezgodnego z prawem, naruszania bezpieczeństwa i praw innych osób,
- możliwość odmowy utworzenia konta lub odebrania dostępu,
- możliwość natychmiastowej blokady w przypadku nadużycia albo zagrożenia bezpieczeństwa,
- sposób samodzielnego usunięcia konta,
- brak gwarancji nieprzerwanej dostępności i bezbłędnego działania,
- ograniczenie odpowiedzialności tylko w zakresie dozwolonym przez bezwzględnie obowiązujące prawo,
- możliwość zakończenia działania Motka z uprzedzeniem i czasem na zapisanie danych, jeśli będzie to praktycznie możliwe,
- kontakt e-mailowy oraz prosty tryb zgłaszania problemów i reklamacji.

### 4.1. Dostęp na zaproszenie

Samo opisanie Motka jako narzędzia dla zaproszonych osób nie jest wystarczające. Rejestracja będzie wymagać ważnego, jednorazowego zaproszenia wystawionego przez operatora dla konkretnego adresu e-mail.

Zaproszenie będzie zawierać losowy sekret przechowywany przez system wyłącznie w postaci skrótu, przypisany adres e-mail, termin wygaśnięcia oraz informację o wykorzystaniu. Serwer atomowo zarezerwuje zaproszenie przed utworzeniem konta: baza danych dopuści dokładnie jedno zwycięskie żądanie, nawet jeśli kilka prób nastąpi równocześnie. Po ukończeniu rejestracji rezerwacja zostanie trwale powiązana z kontem; kontrolowany błąd może ją zwolnić wyłącznie w sposób, który nie pozwala dwóm kontom wykorzystać tego samego zaproszenia. Ponowne użycie, zmiana adresu, wygaśnięcie albo odwołanie zaproszenia spowodują odrzucenie rejestracji.

Pierwsza implementacja nie wymaga rozbudowanego panelu administracyjnego. Operator może tworzyć i odwoływać zaproszenia za pomocą bezpiecznego, udokumentowanego narzędzia administracyjnego. Wysyłanie zaproszeń do osób pozostaje działaniem operatora; aplikacja nie będzie samodzielnie wysyłać wiadomości bez osobnego projektu i zgody.

## 5. Prywatność i retencja danych

Sekcja prywatności opisze co najmniej:

- tożsamość i kontakt administratora danych,
- dane konta: adres e-mail, dane uwierzytelniające przechowywane przez dostawcę uwierzytelniania, identyfikator konta i znaczniki czasu,
- dane magazynu włóczek zapisane przez użytkownika,
- ciasteczko sesji, ustawienia interfejsu przechowywane lokalnie oraz podstawowe logi bezpieczeństwa,
- cele i podstawy prawne przetwarzania,
- dostawców infrastruktury i ich role,
- ewentualne przekazywanie danych poza Europejski Obszar Gospodarczy oraz stosowane zabezpieczenia, jeżeli występuje,
- prawa użytkownika i sposób zgłoszenia żądania,
- zasady usuwania konta i danych.

Docelowy model retencji:

- aktywne konto, profil i magazyn włóczek są usuwane po potwierdzeniu usunięcia konta,
- ewentualne kopie techniczne wygasają zgodnie z cyklem dostawcy, docelowo nie później niż po 30 dniach,
- podstawowe logi bezpieczeństwa są przechowywane maksymalnie 90 dni,
- dłuższe przechowywanie jest możliwe tylko, gdy wymaga tego prawo albo ochrona przed konkretnymi roszczeniami.

Terminy 30 i 90 dni nie mogą zostać opublikowane jako gwarancja przed potwierdzeniem ustawień i rzeczywistych możliwości Railway, Cloudflare, Supabase oraz pozostałych używanych usług. Jeśli infrastruktura nie pozwala ich dotrzymać, należy najpierw zmienić konfigurację albo opisać prawdziwe terminy.

Przed publikacją powstanie jawna lista dostawców i przepływów danych. Dla każdego dostawcy trzeba wskazać rolę, zakres danych, lokalizację lub zasady transferu, rzeczywisty okres retencji oraz źródło potwierdzające te informacje. Właścicielem końcowej kontroli będzie operator Motka. Brak potwierdzenia któregokolwiek obowiązkowego pola zablokuje publikację produkcyjnej wersji dokumentu.

## 6. Prawa autorskie Motka

W stopce znajdzie się nota:

> © 2026 Motek — [IMIĘ I NAZWISKO OPERATORA]. Wszelkie prawa zastrzeżone.

Pełna sekcja praw autorskich wyjaśni, że:

- prawa do autorskiego kodu Motka, interfejsu, własnych grafik, tekstów i marki przysługują operatorowi albo właściwym uprawnionym,
- dostęp do aplikacji nie przenosi praw własności intelektualnej na użytkownika,
- bez zgody nie wolno kopiować, rozpowszechniać, odsprzedawać ani wykorzystywać chronionych elementów Motka w innych produktach,
- zakazy nie ograniczają ustawowych wyjątków, których regulamin nie może wyłączyć,
- biblioteki, czcionki, ikony i inne komponenty zewnętrzne pozostają objęte własnymi licencjami.

Przed publikacją należy przeprowadzić inwentaryzację zewnętrznych elementów i potwierdzić, że nota nie przypisuje operatorowi praw należących do innych osób.

## 7. Katalog wzorów

Motek może przechowywać i prezentować wyłącznie neutralne dane identyfikacyjne i techniczne, w szczególności:

- nazwę wzoru,
- autora lub źródło,
- rodzaj projektu,
- wymagane materiały i ilości,
- rozmiar, poziom trudności i inne parametry techniczne,
- link do legalnego źródła.

Motek nie będzie importować ani publikować:

- szczegółowych instrukcji wykonania,
- twórczych opisów,
- schematów, wykresów i zdjęć,
- treści plików PDF ani ich przeróbek,
- twórczego układu treści przejętego z chronionego materiału.

Prawa do wzorów i chronionych materiałów pozostają przy ich autorach. Obecność pozycji w katalogu nie oznacza przeniesienia praw, własności wzoru ani oficjalnej współpracy z jego autorem. Nazwy i znaki są używane wyłącznie informacyjnie, w sposób, który nie sugeruje przynależności do Motka.

Import powinien rejestrować źródło danych i podlegać kontroli, która odrzuca chronione treści.

### 7.1. Obowiązkowa kontrola istniejącego katalogu

Przed publikacją informacji prawnych i przed dalszym importem trzeba skontrolować wszystkie istniejące rekordy katalogu, w tym pola opisowe przygotowane na podstawie lokalnych plików PDF. Rekord nie może pozostać dostępny tylko dlatego, że został dodany przed wprowadzeniem nowych zasad.

Kontrola obejmie:

- źródło i podstawę wykorzystania każdego pola,
- usunięcie cytatów, twórczych opisów, instrukcji i układu treści przejętego z PDF,
- zastąpienie opisów wyłącznie neutralnymi, samodzielnie sformułowanymi metadanymi, jeżeli są potrzebne,
- zmianę schematu danych, jeśli obecne wymagane pole `description` wymusza przechowywanie chronionej treści,
- zapis wyniku audytu oraz blokadę publikacji rekordu o nieustalonym statusie.

Testy przyszłego importera nie zastępują tej jednorazowej remediacji. Wdrożenie części prawnej nie jest kompletne, dopóki istniejący katalog nie przejdzie audytu albo nie zostanie czasowo ukryty.

## 8. Wersjonowana akceptacja regulaminu

Rejestracja wymaga niezaznaczonego domyślnie checkboxa „Akceptuję Regulamin korzystania z Motka” z linkiem do aktualnej wersji dokumentu. Sam interfejs nie jest wystarczającym zabezpieczeniem — serwer również odrzuci rejestrację bez ważnej akceptacji.

Informacja o prywatności zostanie przedstawiona obok jako obowiązek informacyjny, a nie jako zgoda będąca podstawą całego przetwarzania. Komunikat potwierdzi udostępnienie informacji przed rejestracją, lecz baza prawna każdego celu przetwarzania zostanie opisana osobno. Historia akceptacji dotyczy regulaminu; system może oddzielnie zapisać wersję udostępnionej informacji o prywatności jako dowód jej przekazania, bez nazywania tego zgodą.

Każda akceptacja zapisze:

- identyfikator użytkownika,
- numer zaakceptowanej wersji,
- czas akceptacji zapisany przez serwer.

Historia akceptacji będzie przechowywana w oddzielnej tabeli. Kolejna akceptacja utworzy nowy wpis, zamiast nadpisywać poprzedni.

Tabela akceptacji będzie obsługiwana wyłącznie przez zaufaną logikę serwera. Użytkownik nie będzie mógł bezpośrednio tworzyć, edytować ani usuwać wpisów przez klienta Supabase. Czas akceptacji nada serwer lub baza danych. Para użytkownik–wersja będzie unikalna, a ponowienie tego samego żądania nie utworzy duplikatu. Reguły dostępu do danych zablokują zmianę zaakceptowanej wersji i czasu po zapisaniu.

Po istotnej zmianie dokumentu użytkownik po zalogowaniu zobaczy ekran ponownej akceptacji. Do czasu jej udzielenia konto będzie miało dostęp tylko do:

- strony informacji prawnych,
- mechanizmu akceptacji,
- wylogowania,
- usunięcia konta.

Ograniczenie zostanie wymuszone także przez serwer, aby nie można go było ominąć bezpośrednim wywołaniem interfejsu programistycznego.

Reguły dostępu do prywatnych tabel i funkcji bazy danych, w szczególności magazynu włóczek, również sprawdzą akceptację aktualnej wersji regulaminu. Ważna sesja bez aktualnej akceptacji nie pozwoli na odczyt ani zapis chronionych danych bezpośrednio przez klienta Supabase. Wyjątki pozostaną ograniczone do operacji niezbędnych do zaakceptowania regulaminu, wylogowania i usunięcia konta.

Historia akceptacji zostanie usunięta wraz z kontem, chyba że konkretny zapis musi być czasowo zachowany z powodu trwającego sporu albo obowiązku prawnego.

### 8.1. Bezpieczna rejestracja wieloetapowa

Utworzenie użytkownika w systemie uwierzytelniania i zapis danych aplikacji nie tworzą jednej transakcji. Dlatego serwer zastosuje bezpieczny, możliwy do ponowienia proces:

1. weryfikuje zaproszenie, adres e-mail i aktualną wersję regulaminu,
2. atomowo rezerwuje ważne zaproszenie dla tej próby rejestracji,
3. tworzy konto w stanie bez normalnego dostępu,
4. zapisuje profil, akceptację i wykorzystanie zaproszenia przez zaufaną logikę,
5. dopiero po powodzeniu wszystkich wymaganych zapisów aktywuje dostęp.

Jeśli etap po utworzeniu konta nie powiedzie się, konto pozostaje zablokowane. Ponowienie żądania bezpiecznie kończy brakujące kroki albo kontrolowany proces usuwa niekompletne konto. Żaden błąd częściowy nie może dać dostępu bez prawidłowej akceptacji i ważnego zaproszenia.

## 9. Jedno źródło aktualnej wersji

Numer i data aktualnej wersji dokumentu, treść pokazywana użytkownikowi oraz wersja wymagana przez serwer muszą być ze sobą jednoznacznie powiązane. Implementacja ma wykorzystywać jedno źródło konfiguracji albo automatyczny test zgodności, aby serwer nigdy nie przyjął zgody na inną wersję niż widoczna na stronie.

Zmiana treści prawnej wymagająca ponownej akceptacji musi prowadzić do świadomego podniesienia numeru wersji. Drobne poprawki językowe, które nie zmieniają praw i obowiązków, mogą zachować wersję, ale powinny być odnotowane w historii dokumentu.

## 10. Obsługa błędów

- Brak akceptacji podczas rejestracji zwraca jasny komunikat bez tworzenia konta.
- Nieaktualna wersja wysłana przez klienta jest odrzucana z informacją o potrzebie odświeżenia dokumentu.
- Jeżeli zapis akceptacji podczas rejestracji nie powiedzie się, konto nie może uzyskać normalnego dostępu; implementacja ma bezpiecznie dokończyć zapis albo wycofać niekompletny stan.
- Awaria ekranu ponownej akceptacji nie może odblokować chronionych funkcji.
- Niepowodzenie usunięcia danych jest raportowane użytkownikowi i logowane bez ujawniania danych wrażliwych.

## 11. Weryfikacja

Wdrożenie będzie wymagało testów potwierdzających:

- publiczną dostępność strony prawnej i poprawność linków,
- czytelność strony na telefonie i komputerze oraz wydruk bez elementów nawigacyjnych,
- odrzucenie rejestracji bez zaproszenia, po zmianie przypisanego adresu, po wygaśnięciu, odwołaniu i ponownym użyciu zaproszenia,
- atomowe wykorzystanie zaproszenia: przy równoległych próbach dokładnie jedna może utworzyć aktywne konto,
- brak możliwości rejestracji bez akceptacji,
- zapis właściwej wersji i czasu akceptacji,
- odrzucenie sfałszowanej albo nieaktualnej wersji,
- brak możliwości utworzenia, zmiany albo usunięcia wpisu akceptacji bezpośrednio przez klienta Supabase,
- brak bezpośredniego odczytu i zapisu prywatnych danych przez klienta Supabase przy ważnej sesji, ale nieaktualnej akceptacji regulaminu,
- idempotentne ponowienie rejestracji po częściowym błędzie oraz brak dostępu dla niekompletnego konta,
- ponowną akceptację po zmianie wersji,
- serwerową blokadę pozostałych funkcji do czasu zgody,
- zachowanie dostępu do usunięcia konta bez nowej zgody,
- usunięcie historii akceptacji wraz z kontem w zwykłym przypadku,
- brak placeholderów w produkcyjnej wersji dokumentu,
- kompletność listy dostawców, podstaw prawnych, przepływów danych, transferów i potwierdzonych okresów retencji,
- zgodność opublikowanych okresów retencji z udokumentowaną konfiguracją dostawców,
- wynik audytu każdego istniejącego rekordu katalogu albo skuteczne ukrycie rekordów oczekujących na kontrolę,
- brak importowania chronionej treści wzorów w zakresie objętym bieżącym importerem.

Publikacja produkcyjna otrzyma twardą bramkę sprawdzającą dane operatora, kontakt, pełną informację prywatności, listę dostawców, potwierdzone okresy retencji oraz zakończenie audytu katalogu. Samo ustawienie ręcznej flagi „gotowe” nie wystarczy bez powiązanych, wersjonowanych danych potwierdzających te kontrole.

## 12. Poza zakresem

Ten projekt nie obejmuje:

- płatności, subskrypcji ani warunków sprzedaży,
- publicznej rejestracji bez zaproszenia,
- publikowania plików PDF lub pełnych instrukcji wzorów,
- formalnej opinii prawnej zastępującej przegląd wykonany przez prawnika,
- automatycznego rozstrzygania, czy dowolny materiał zewnętrzny jest chroniony.

## 13. Kryteria akceptacji produktu

Rozwiązanie jest gotowe, gdy zaproszona osoba może przeczytać aktualne zasady przed rejestracją, świadomie je zaakceptować, później odnaleźć dokument, a system potrafi wykazać zaakceptowaną wersję. Prawa operatora Motka i autorów wzorów są opisane oddzielnie, bez przypisywania Motkowi cudzych praw. Usunięcie konta pozostaje możliwe również wtedy, gdy użytkownik nie akceptuje nowej wersji zasad.
