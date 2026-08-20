# Motek — zasady pracy projektu

Komunikuj się po polsku, krótko i przez widoczny efekt. Najpierw poznaj wymaganie, stan Git, właściwe fragmenty dokumentacji i istniejące konwencje. Zachowuj kontrakty API, RLS, prywatność danych oraz limity 500 włóczek i 300 wzorów. Realizuj tylko uzgodniony zakres; nie mieszaj cudzych zmian, nie cofaj ich i nie porządkuj ich bez zgody.

## Zespół subagentów Motka

Zespół jest wymagany, gdy zadanie ma co najmniej dwie niezależne części albo gdy niezależna recenzja istotnie zmniejsza ryzyko. Proste, jednoplikowe zadania o niskim ryzyku można wykonać bez uruchamiania pełnego zespołu, z proporcjonalną weryfikacją. Domyślna kolejność to analityk → wykonawca → recenzent.

- `motek_explorer` mapuje kod, zależności, ryzyka i potrzebne testy; działa tylko do odczytu.
- `motek_worker` wprowadza małą, testowaną zmianę w jasno przypisanych plikach.
- `motek_reviewer` niezależnie sprawdza wymagania, regresje, bezpieczeństwo i kompletność testów; działa tylko do odczytu.

Niezależne prace tylko do odczytu mogą działać równolegle. Zapisy mogą być równoległe wyłącznie gdy zakresy plików są jawnie rozłączne; nigdy nie zlecaj równoległych zapisów do tych samych plików. Istotne uwagi recenzenta wracają do tego samego wykonawcy i wymagają ponownej recenzji.

Przed delegowaniem wybierz najbezpieczniejszy tryb uprawnień sesji nadrzędnej. Nigdy nie deleguj z trybu Full Access, Yolo ani równoważnego nieograniczonego. Nie włączaj subagentom sieci, aplikacji, connectorów ani integracji zewnętrznych bez konkretnej wcześniejszej zgody użytkownika. Nadrzędne ustawienia runtime mogą zastąpić `sandbox_mode`; przy `workspace-write` deklaracja tylko do odczytu dla explorer/reviewer jest instrukcją behawioralną, nie twardą granicą techniczną. Preferuj etapy tylko do odczytu, a `workspace-write` tylko dla etapu implementacji i `motek_worker`.

Subagenci nie odczytują `.env`, tokenów, kluczy ani ciasteczek i nie tworzą commitów. Operacje zewnętrzne, migracje, import wykonawczy, publikacje i wdrożenia wymagają wcześniejszej zgody użytkownika. Główny agent odpowiada za zakres, ochronę cudzej pracy, końcową weryfikację i wspólne podsumowanie.

## Implementacja i diagnoza

Przed zmianą zachowania najpierw przygotuj reprodukcję i test przed zmianą zachowania; następnie wprowadź najmniejszą uzasadnioną poprawkę. Przy błędzie przeczytaj pełny komunikat, sprawdź kod, konfigurację, logi i zależności, wskaż przyczynę, popraw bezpiecznie i ponownie sprawdź. Po nieudanych próbach raportuj fakty, wykonane kroki, przypuszczenie i rekomendację zamiast zgadywać.

Uruchamiaj testy zmienionego podsystemu. Dla SQL, Auth lub RLS wymagaj testów bazy danych. Przed zakończeniem uruchom `git diff --check` i odpowiedni końcowy check (np. `npm run check`), jeśli środowisko pozwala. Nie deklaruj sukcesu bez wyniku; wskaż osobno rzeczy sprawdzone, niesprawdzone oraz nieweryfikowalne. Logi adaptuj do ryzyka: zwięzłe dla prostych zadań, pełniejsze dla zmian danych, Auth lub RLS. Handoff do kolejnej roli zawiera cel, fakty, zmienione pliki, testy i otwarte ryzyka.

## Bezpieczny commit i GitHub

Po znaczącym, zweryfikowanym etapie i kontroli statusu Git zaproponuj jednoznacznie: „Zapisać commit i wysłać go do GitHub?”. Zgoda obejmuje tylko pliki należące do pakietu, commit, zwykły push bieżącej gałęzi, odświeżenie referencji oraz potwierdzenie zgodności `HEAD` z `origin/<gałąź>` i czystości katalogu. Jeśli użytkownik zatwierdzi wyłącznie commit, utwórz commit bez pushu. Jeśli wyraźnie każe zachować zmiany lokalnie, nie publikuj ich. Nie używaj force, nie przepisuj historii i nie publikuj nieoczekiwanych commitów bez osobnej wyraźnej zgody.

Do uwierzytelnienia używaj trwałego Windows OpenSSH agenta oraz klienta skonfigurowanego w Git; nie uruchamiaj tymczasowego agenta Git Bash. Jeśli klucz wymaga odblokowania, użytkownik wpisuje hasło interaktywnie — nigdy nie proś o niego ani go nie obsługuj w rozmowie. Po pushu raportuj identyfikator i wiadomość commita, gałąź, synchronizację z GitHub oraz pozostałe lokalne zmiany.
