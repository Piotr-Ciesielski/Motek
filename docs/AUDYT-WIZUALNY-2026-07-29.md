# Audyt wizualny Motka

Data: 2026-07-29  
Adres testowy: `http://localhost:3001`  
Wersja: `2.0.0-alpha.11`  
Gałąź: `feat/frontend-design-refresh`

## Werdykt

Motek ma wyrazisty, spójny i przyjazny kierunek wizualny. Połączenie ciepłego
tła, fioletowego motywu, kroju Fraunces i prostych kart dobrze pasuje do
produktu dziewiarskiego. Układ nie powoduje poziomego przewijania i poprawnie
przechodzi z trzech kolumn na dwie i jedną.

Interfejs nie jest jednak jeszcze gotowy jako docelowe doświadczenie
użytkownika. Największe problemy to:

1. bardzo długie i techniczne nazwy wzorów łamią układ kart na telefonie;
2. katalog 119 kart tworzy stronę o skrajnej długości, bez paginacji i
   możliwości szybkiego powrotu do filtrów;
3. nieaktywne przyciski wyglądają jak aktywne;
4. ekran gościa pokazuje komunikaty sugerujące wykonane dopasowanie i zapis
   danych, mimo że użytkownik nie jest zalogowany;
5. zapisane włóczki są prezentowane jako bardzo wysokie, zablokowane formularze;
6. na telefonie wyniki dopasowania znajdują się dopiero za całym magazynem;
7. katalog i wyniki nie prowadzą do szczegółów ani źródła wzoru.

Rekomendacja: najpierw naprawić układ mobilnych kart i stany gościa, następnie
przebudować sposób przeglądania katalogu. Dopiero później dopracować kontrast,
mikrotreści i szczegóły dostępności.

## Aktualizacja realizacji — 2026-07-30

Stan porównano z wersją `2.0.0-alpha.31`. Spośród 19 uwag 16 jest zamkniętych,
a 3 są częściowo zamknięte i zależą od rozszerzenia danych albo decyzji
produktowej.

| Punkt | Stan | Zrealizowane w |
|---|---|---|
| UI-01 — długie nazwy | zamknięty | alpha.12, alpha.19, alpha.24 |
| UI-02 — długość katalogu | zamknięty | alpha.13, alpha.30 |
| UI-03 — wygląd zablokowanych akcji | zamknięty | alpha.12 |
| UI-04 — stan gościa | zamknięty | alpha.12 |
| UI-05 — nagłówki konta | zamknięty | alpha.12 |
| UI-06 — ślepy zaułek kart | częściowy | alpha.14, alpha.29 |
| UI-07 — zaufanie do danych | częściowy | alpha.13, alpha.14 |
| UI-08 — wysokość kart włóczek | zamknięty | alpha.12 |
| UI-09 — dostęp do wyników | zamknięty | alpha.12 |
| UI-10 — zabezpieczenie usuwania | zamknięty | alpha.12 |
| UI-11 — wymagania rejestracji | zamknięty | alpha.18 |
| UI-12 — kontrast małego tekstu | zamknięty | alpha.20 |
| UI-13 — klawiatura przełącznika konta | zamknięty | alpha.17, alpha.28 |
| UI-14 — ładowanie katalogu | zamknięty | alpha.15, alpha.30 |
| UI-15 — pierwsza akcja mobilna | zamknięty | alpha.12 |
| UI-16 — filtry katalogu | częściowy | alpha.14, alpha.15, alpha.31 |
| UI-17 — techniczny język dostawcy | zamknięty | alpha.12 |
| UI-18 — powtarzające się warianty | zamknięty | alpha.16 |
| UI-19 — anulowanie nowego formularza | zamknięty | alpha.17 |

Pozostałe części wymagają:

- zweryfikowanych adresów źródeł dla kart wzorów;
- uzupełnienia danych o typ projektu, jeśli ma być osobnym filtrem;
- decyzji, czy publiczny katalog ma mieć filtr „pasuje do mojego magazynu”, czy
  tę funkcję pozostawiamy w osobnym widoku `Dopasowanie`;
- dalszej ręcznej weryfikacji 110 rekordów oznaczonych jako „Do sprawdzenia”.

## Zakres i metoda

Ręcznie sprawdzono:

- ekran logowania;
- ekran rejestracji;
- ekran odzyskiwania hasła;
- przełączanie trybu konta;
- natywną walidację pustego formularza;
- CTA prowadzące gościa do logowania;
- katalog 119 wzorów;
- wyszukiwanie po tekście;
- filtr statusu danych;
- połączone filtry i pusty wynik;
- nawigację klawiaturą oraz skip link;
- widoki 1440×900, 768×1024, 390×844 i 320×568;
- poziome przepełnienie i łamanie długich treści;
- wielkość elementów klikalnych;
- kontrast głównych kolorów tekstu;
- komunikaty konsoli przeglądarki.

Po zalogowaniu sprawdzono również:

- widok aktywnego konta;
- magazyn zawierający 9 zapisanych włóczek;
- wejście w edycję zapisanej włóczki;
- pojawienie się akcji „Zapisz” dopiero po zmianie;
- anulowanie zmiany i przywrócenie poprzedniej wartości;
- dodanie pustego, niezapisanego formularza;
- blokadę dopasowania przy niedokończonym formularzu;
- usunięcie wyłącznie pustego, niezapisanego formularza;
- podsumowanie magazynu;
- trzy istniejące wyniki dopasowania;
- zachowanie magazynu i wyników na telefonie.

Nie usuwano żadnej zapisanej włóczki i nie zatwierdzano zmian w danych
użytkownika. Konto miało już włóczki, dlatego onboarding całkowicie pustego,
zalogowanego magazynu oceniono na podstawie istniejącej struktury interfejsu,
a nie na osobnym pustym koncie.

## Najważniejsze pomiary

| Widok | Wysokość całej strony | Poziome przewijanie |
|---|---:|---|
| 1440×900 | 16 978 px | nie |
| 768×1024 | 26 306 px | nie |
| 390×844 | 49 960 px | nie |
| 320×568 | 65 306 px | nie |

Katalog zawierał 119 kart:

- 9 oznaczonych jako „Zweryfikowany”;
- 110 oznaczonych jako „Do sprawdzenia”;
- 0 linków lub przycisków wewnątrz kart;
- wysokość kart na desktopie: około 280–595 px;
- wysokość kart przy 320 px: około 264–1025 px.

Zalogowany magazyn zawierał 9 włóczek, łącznie 3450 m i 850 g:

- każda zapisana karta włóczki miała na telefonie około 600 px wysokości;
- cały panel magazynu miał na telefonie około 5761 px wysokości;
- panel wyników znajdował się za magazynem i miał około 1620 px wysokości;
- cała strona przy 390×844 miała około 56 169 px wysokości;
- na desktopie panel magazynu miał około 2842 px wysokości;
- panel wyników miał około 1245 px, czyli więcej niż testowy viewport 900 px;
- panel konta miał około 618 px wysokości, z czego około 314 px pozostawało
  niewykorzystane.

## Problemy wysokiego priorytetu

### UI-01 — Długie nazwy niszczą układ karty na telefonie

**Priorytet:** wysoki

Status jest ustawiony obok nazwy w jednym wierszu. Przy szerokości 320 px
pastylka „Do sprawdzenia” zostawia długiemu tytułowi około 73 px. Przykładowy
tytuł:

`BIG-BIG-BUBBLES-WZOR-INSTRUKCJA-WYKONANIA06.23-tbto93`

zajmuje wtedy 378 px wysokości, łamie się niemal litera po literze i zwiększa
wysokość całej karty do ponad 1000 px.

**Praktyczny skutek:** katalog wygląda na uszkodzony, a skanowanie nazw jest
bardzo trudne.

**Rekomendacja:**

- na telefonie ułożyć nagłówek i status jeden pod drugim;
- pozwolić nazwie użyć pełnej szerokości karty;
- przenieść status nad nazwę lub pod metadane;
- czyścić importowane nazwy z nazw plików, kodów URL i technicznych dopisków;
- zachować pełną techniczną nazwę wyłącznie jako dane pomocnicze.

### UI-02 — Katalog jest skrajnie długi

**Priorytet:** wysoki

Wszystkie 119 kart jest renderowanych jednocześnie. Na małym telefonie strona
ma ponad 65 tysięcy pikseli wysokości. Po przewinięciu daleko w dół filtry
znikają, a użytkownik nie ma paginacji, przycisku „Wczytaj więcej” ani szybkiego
powrotu na początek katalogu.

**Praktyczny skutek:** użytkownik traci orientację i nie jest w stanie wygodnie
przeglądać całej bazy.

**Rekomendacja:**

- pokazywać pierwsze 12–24 wyniki;
- dodać paginację albo „Wczytaj więcej”;
- dodać sortowanie;
- na telefonie pozostawić kompaktowy pasek filtrów dostępny podczas
  przewijania;
- dodać akcję „Wróć do filtrów” lub „Do góry”;
- renderować wyniki partiami zamiast czekać na pobranie całej bazy.

### UI-03 — Nieaktywne przyciski wyglądają jak aktywne

**Priorytet:** wysoki

Przyciski „+ Dodaj motek” i „Dobierz wzór” są dla gościa zablokowane, ale mają:

- pełne kolory;
- pełną nieprzezroczystość;
- cień;
- kursor wskazujący możliwość kliknięcia.

Nie ma osobnego stylu `:disabled`.

**Praktyczny skutek:** użytkownik próbuje kliknąć element, który nie reaguje,
co wygląda jak błąd aplikacji.

**Rekomendacja:**

- dodać wyraźny styl stanu nieaktywnego;
- usunąć cień i kursor `pointer`;
- obniżyć kontrast dekoracji, zachowując czytelność etykiety;
- w tym konkretnym stanie rozważyć zamianę blokowanych przycisków na CTA
  „Zaloguj się, aby dodać motek”.

### UI-04 — Stan wyniku jest nieprawidłowy dla gościa

**Priorytet:** wysoki

Niezalogowany użytkownik widzi jednocześnie:

- `0 motków, 0 m i 0 g`;
- „Zestaw jest przechowywany prywatnie w Supabase”;
- „Brak pełnego dopasowania. Spróbuj dodać więcej metrów...”.

Nie było jeszcze zestawu, zapisu ani próby dopasowania.

**Praktyczny skutek:** aplikacja komunikuje porażkę przed rozpoczęciem pracy i
sugeruje zapis danych, których nie ma.

**Rekomendacja:** dla gościa pokazać jeden spokojny stan:

> Zaloguj się i dodaj włóczki, aby zobaczyć pasujące wzory.

Podsumowanie liczb i komunikat o braku dopasowania powinny pojawiać się dopiero
po zalogowaniu i wykonaniu odpowiedniego kroku.

### UI-05 — Ekrany konta mają sprzeczne nagłówki

**Priorytet:** wysoki

Po przełączeniu na „Załóż konto” główny nagłówek nadal brzmi „Zaloguj się do
Motka”. Przy odzyskiwaniu hasła pozostaje ten sam nagłówek i tekst zachęcający
do założenia konta, choć aktywny formularz mówi „Odzyskaj dostęp”. Ten sam
nagłówek pozostaje także po zalogowaniu.

Na desktopie zalogowany panel konta nadal zachowuje minimalną wysokość całego
formularza logowania. Około połowa panelu jest wtedy pusta. Jednocześnie
użytkownik widzi trzy podobne informacje: „Zalogowano jako…”, dane profilu i
osobny komunikat „Zalogowano.”.

**Praktyczny skutek:** użytkownik nie ma pewności, jaki proces właśnie wykonuje.

**Rekomendacja:** zmieniać nagłówek i opis razem z aktywnym trybem:

- „Zaloguj się do Motka”;
- „Załóż konto w Motku”;
- „Odzyskaj dostęp do konta”;
- „Ustaw nowe hasło”.

Po zalogowaniu panel powinien zmienić się w zwarty pasek „Twoje konto” lub
„Witaj, PCS”, bez pustej przestrzeni i powtarzających się potwierdzeń.

### UI-06 — Karty katalogu są ślepym zaułkiem

**Priorytet:** wysoki

Żadna ze 119 kart katalogu nie zawiera linku ani przycisku. Nie można otworzyć
szczegółów, źródła, PDF-u ani wybrać wzoru do dalszego działania. Ten sam
problem występuje po dopasowaniu: karta wyniku pokazuje procent i wymagania,
ale nie prowadzi do szczegółów ani następnego kroku.

**Praktyczny skutek:** katalog można tylko czytać; nie prowadzi do kolejnego
kroku.

**Rekomendacja:**

- dodać „Zobacz szczegóły”;
- pokazywać link do źródła, jeśli jest bezpieczny i dostępny;
- w szczegółach rozwinąć wymagania dotyczące włóczek;
- dla dopasowanych wzorów dodać jasną akcję „Sprawdź ten wzór”.

**Stan po zmianie 2026-07-30:** katalog ma rozwijane parametry włóczki, a każda
grupa wyników udostępnia akcję „Zobacz w katalogu”. Przejście otwiera właściwy
wzór z ustawionymi filtrami i zachowuje poprawny fokus klawiatury. Link do
zewnętrznego źródła pozostaje do dodania dopiero po zapisaniu w bazie
zweryfikowanych, bezpiecznych adresów.

### UI-07 — Dane katalogu obniżają zaufanie do produktu

**Priorytet:** wysoki

110 z 119 kart ma status „Do sprawdzenia”. W widoku dominują pomarańczowe
ostrzeżenia, techniczne nazwy plików i uszkodzone fragmenty tekstu, np.
zakodowane liczby, ciągi z myślnikami i błędne znaki.

**Praktyczny skutek:** nawet estetyczny interfejs wygląda jak surowe narzędzie
importowe, a nie gotowy katalog.

**Rekomendacja:**

- domyślnie eksponować zweryfikowane wzory;
- przenieść niezweryfikowane do osobnej sekcji;
- oczyścić nazwy przed publikacją;
- pokazywać język, typ projektu i źródło zamiast ogólnego
  „Wzór obcojęzyczny”;
- nie używać ostrzeżenia jako dominującego elementu każdej karty.

### UI-08 — Zapisane włóczki zajmują zbyt dużo miejsca

**Priorytet:** wysoki

Każda zapisana włóczka jest wyświetlana jako pełny formularz z sześcioma
zablokowanymi polami. Na telefonie pojedyncza pozycja ma około 600 px
wysokości, czyli niemal cały ekran. Dziewięć włóczek tworzy panel o wysokości
około 5761 px.

**Praktyczny skutek:** magazynu nie da się szybko przeskanować, a użytkownik
przewija głównie nieaktywne kontrolki.

**Rekomendacja:**

- w stanie zapisanym pokazywać zwartą kartę tekstową;
- zmieścić nazwę, kolor, materiał, grubość, metry i gramy w 2–3 wierszach;
- rozwijać formularz dopiero po wybraniu „Modyfikuj”;
- umożliwić zwijanie grup lub całego magazynu;
- rozważyć tabelę na desktopie i zwarte karty na telefonie.

### UI-09 — Wyniki są ukryte za całym magazynem na telefonie

**Priorytet:** wysoki

Na desktopie panel wyników znajduje się obok magazynu i jest przyklejony
podczas przewijania. Na telefonie kolumny układają się pionowo: najpierw około
5761 px magazynu, a dopiero potem około 1620 px wyników.

Panel wyników na desktopie ma około 1245 px, czyli jest wyższy od testowego
viewportu. Przyklejenie do górnej krawędzi nie daje wtedy stałego dostępu do
całej zawartości; dolne wyniki stają się widoczne dopiero bliżej końca
magazynu.

**Praktyczny skutek:** po uruchomieniu kluczowej funkcji użytkownik może nie
zauważyć, że wyniki pojawiły się kilka ekranów niżej.

**Rekomendacja:**

- po dopasowaniu przewijać ekran do początku wyników;
- na telefonie pokazywać wyniki nad magazynem lub w osobnej zakładce;
- dodać stały skrót „Zobacz wyniki (3)”;
- zrezygnować ze sticky, gdy panel jest wyższy od viewportu;
- połączyć tę zmianę ze zwartym widokiem zapisanych włóczek.

### UI-10 — Usuwanie zapisanej włóczki jest zbyt łatwe

**Priorytet:** wysoki

Każda zapisana karta ma mocno wyróżniony, różowo-fioletowy przycisk „Usuń”.
Akcja usuwa rekord bez pytania o potwierdzenie i bez możliwości cofnięcia.
Przycisk jest wizualnie bardziej dominujący niż bezpieczna akcja „Modyfikuj”.

**Praktyczny skutek:** przypadkowe kliknięcie może natychmiast usunąć dane.

**Rekomendacja:**

- osłabić wizualnie akcję usuwania;
- poprosić o potwierdzenie z nazwą włóczki;
- najlepiej dodać możliwość cofnięcia przez kilka sekund;
- podczas edycji odsunąć „Usuń” od „Zapisz” i „Anuluj”.

## Problemy średniego priorytetu

### UI-11 — Formularz rejestracji nie pokazuje wymagań

Login przyjmuje tylko 3–30 małych liter, cyfr lub podkreślenie, a hasło wymaga
małej i wielkiej litery, cyfry oraz znaku specjalnego. Interfejs nie pokazuje
tych reguł przed wysłaniem formularza.

**Rekomendacja:** dodać krótką podpowiedź pod polami i możliwość pokazania
hasła. Wymagania hasła najlepiej potwierdzać na żywo.

### UI-12 — Część małego tekstu nie spełnia kontrastu AA

Pomiary na użytych kolorach:

- zielony status na swoim jasnym tle: około `2,98:1`;
- różowy komunikat błędu na jasnym panelu: około `3,79:1`;
- tekst pomocniczy hero na środkowej części gradientu: około `4,05:1`.

Dla małego tekstu wymagane jest co najmniej `4,5:1`.

**Rekomendacja:** przyciemnić zieleń statusów i kolor błędów. Tekst hero
powinien mieć większą nieprzezroczystość lub dostać stabilniejsze, ciemniejsze
tło.

### UI-13 — Przełącznik konta nie realizuje wzorca klawiaturowego kart

Elementy mają role `tab` i `tablist`, ale strzałka w prawo nie przełącza z
„Logowanie” na „Załóż konto”. Obie zakładki są osobnymi pozycjami w kolejności
Tab.

**Rekomendacja:** wdrożyć obsługę strzałek, Home i End oraz ruchomy
`tabindex`, albo zastosować prostsze semantycznie przyciski, jeśli pełny wzorzec
kart nie jest potrzebny.

### UI-14 — Stan ładowania katalogu jest zbyt skromny

Do chwili pobrania wszystkich stron danych widoczny jest wyłącznie tekst
„Pobieram wzory z bazy...”. Brakuje szkieletów kart, częściowego renderowania i
`aria-busy`.

**Rekomendacja:** pokazać 3–6 szkieletów, renderować pierwszą partię od razu i
dogrywać kolejne wyniki.

**Stan po zmianie 2026-07-30:** katalog pokazuje sześć szkieletów podczas
pierwszego odczytu, a po pobraniu pierwszej strony natychmiast udostępnia
pierwsze karty. Pozostałe strony są dołączane w tle, a region katalogu zachowuje
`aria-busy` do zakończenia całej operacji.

### UI-15 — Na małym ekranie pierwsza akcja jest poniżej załamania

Przy 320×568 pierwszy ekran zajmuje niemal wyłącznie hero. Nie ma w nim
przycisku prowadzącego do logowania lub magazynu.

**Rekomendacja:** dodać w hero mobilne CTA „Zacznij dobierać wzór”, które
przewija do właściwego formularza.

### UI-16 — Filtry są zbyt podstawowe dla tej liczby danych

Dostępne są tylko wyszukiwarka i status weryfikacji.

**Rekomendacja:** dodać co najmniej:

- język;
- typ projektu;
- materiał;
- grubość włóczki;
- tylko wzory możliwe do dopasowania;
- sortowanie po nazwie, kompletności lub trafności.

**Stan po zmianach 2026-07-30:** katalog ma wyszukiwanie, status danych, język,
materiał i sortowanie. Wszystkie kryteria można wyczyścić jedną akcją, która
pozostaje nieaktywna przy ustawieniach domyślnych. Typ projektu i filtrowanie
według możliwości dopasowania wymagają odpowiednio nowych danych katalogowych
oraz powiązania filtrów z prywatnym magazynem użytkownika.

### UI-17 — Nazwa dostawcy technologii dominuje w treści

„Supabase” jest widoczny jako etykieta sekcji i w podsumowaniu magazynu. Dla
użytkownika ważniejsza jest korzyść: prywatność i bezpieczny zapis.

**Rekomendacja:** zastąpić tekstem produktowym, np. „Twój prywatny magazyn” i
„Zapisane bezpiecznie na Twoim koncie”.

### UI-18 — Wyniki powtarzają ten sam wzór jako osobne karty

Trzy wyniki „Leśny kardigan” różnią się głównie rozmiarem oraz wymaganiami.
Każdy zajmuje osobną, dużą kartę i ma ten sam wynik `100%`.

W treści widoczna jest też techniczna forma fleksyjna „2 motek/motki”.

**Rekomendacja:** zgrupować warianty jednego wzoru w jednej karcie, pokazać
rozmiary jako opcje lub zakładki i zastosować poprawną polską odmianę:
„2 motki”, „3 motki”, „4 motki”.

### UI-19 — Porzucenie nowego formularza komunikuje zapis magazynu

Pusty, niezapisany formularz ma tylko akcję „Usuń”. Po jej użyciu pojawiają się
komunikaty „Zapisuję zmianę...” i „Magazyn zapisany.”, choć żaden zapisany
rekord nie został zmieniony.

**Rekomendacja:** dla nowego formularza użyć etykiety „Anuluj dodawanie” i po
jej wybraniu nie pokazywać komunikatu o zapisie.

## Mocne strony

- spójna, charakterystyczna paleta i typografia;
- dobre pierwsze wrażenie na desktopie;
- czytelna hierarchia nagłówków;
- poprawne przejście 3 → 2 → 1 kolumna;
- brak poziomego przewijania przy testowanych szerokościach;
- pola formularzy mają czytelne etykiety;
- wyszukiwarka i filtr statusu działają natychmiast;
- pusty wynik filtrowania ma jasny komunikat;
- CTA gościa przewija do logowania i ustawia fokus w polu e-mail;
- przycisk dodawania przewija do nowego formularza i ustawia fokus w nazwie;
- edycja zapisanej włóczki jest wyraźna;
- „Zapisz” pojawia się dopiero po faktycznej zmianie;
- „Anuluj” prawidłowo przywraca poprzednie wartości;
- niedokończony nowy motek blokuje dopasowanie i pokazuje jasną instrukcję;
- podsumowanie magazynu prawidłowo pokazuje liczbę, metry i wagę;
- karty dopasowania mają czytelną hierarchię i widoczny procent;
- skip link działa i ma bardzo wyraźną obwódkę;
- fokus klawiatury jest widoczny;
- typowe elementy klikalne mają wygodne rozmiary;
- nie znaleziono błędów ani ostrzeżeń w konsoli przeglądarki.

## Zalecana kolejność wdrożenia

### Etap 1 — szybkie naprawy

1. Ułożyć status pod lub nad tytułem na telefonie.
2. Dodać prawdziwy wygląd stanu `disabled`.
3. Poprawić komunikaty panelu wyniku dla gościa.
4. Zmieniać nagłówki ekranów konta.
5. Zmienić zapisane włóczki w zwarte karty.
6. Zapewnić szybki dostęp do wyników na telefonie.
7. Zabezpieczyć akcję usuwania.
8. Pokazać wymagania loginu i hasła.
9. Przyciemnić kolory niespełniające kontrastu.

### Etap 2 — używalny katalog

1. Oczyścić nazwy wzorów.
2. Domyślnie eksponować dane zweryfikowane.
3. Dodać paginację lub „Wczytaj więcej”.
4. Dodać szczegóły i link do źródła.
5. Rozszerzyć filtry i sortowanie.
6. Utrzymać filtry dostępne podczas przewijania.

### Etap 3 — pełne dopracowanie

1. Dodać szkielet i częściowe ładowanie katalogu.
2. Poprawić klawiaturowy wzorzec zakładek.
3. Dodać mobilne CTA w hero.
4. Zgrupować rozmiary jednego wzoru w jednej karcie wyników.
5. Sprawdzić zoom 200% i 400% oraz długie dane użytkownika.

## Kryteria odbioru następnej wersji

- żadna nazwa karty nie jest ściskana przez status do wąskiej kolumny;
- przy 320 px karta nie przekracza rozsądnej wysokości wyłącznie przez tytuł;
- pierwszy ekran katalogu pokazuje ograniczoną partię wyników;
- filtry są dostępne bez powrotu o dziesiątki ekranów;
- zablokowane przyciski są jednoznacznie zablokowane wizualnie;
- gość nie widzi komunikatu o wykonanym dopasowaniu ani zapisanym zestawie;
- każdy tryb konta ma zgodny nagłówek i opis;
- zapisany motek nie zajmuje prawie całego ekranu telefonu;
- po dopasowaniu użytkownik od razu widzi wyniki lub stały skrót do nich;
- usunięcie zapisanej włóczki wymaga potwierdzenia albo pozwala cofnąć akcję;
- mały tekst osiąga kontrast co najmniej `4,5:1`;
- karta wzoru prowadzi do szczegółów lub źródła;
- warianty rozmiarowe jednego wzoru nie udają osobnych projektów;
- pełny przepływ po zalogowaniu działa na desktopie i telefonie.
