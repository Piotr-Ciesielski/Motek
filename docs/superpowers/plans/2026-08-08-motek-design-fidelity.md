# Motek — plan wierniejszego wdrożenia makiet Designs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development for execution. Wykonuj zadania kolejno, po każdym zadaniu uruchom testy i niezależny przegląd.

## Cel

Zbliżyć cztery działające widoki Motka do zatwierdzonych makiet PNG z `Designs/`, bez udawania funkcji, których obecna aplikacja nie posiada. Największa korekta dotyczy kompozycji: makiety pokazują szerokie, bezramowe powierzchnie z grafiką kota jako częścią hierarchii, a staging miał węższe karty, podział pionowy, większe promienie i cięższe cienie.

## Granice produktu

- Zachowujemy istniejące API, logowanie, odzyskiwanie konta, magazyn włóczek, dopasowanie, katalog wzorów, filtry, paginację i usuwanie konta.
- Nie dodajemy fikcyjnych projektów, powiadomień, metryk, filtrów włóczek ani zdjęć danych domenowych tylko po to, by wypełnić makietę.
- Używamy istniejących WebP w runtime; PNG z `Designs/` są wzorcem QA, nie nowym assetem produkcyjnym.
- Zachowujemy `data-view-target`, identyfikatory widoków i wszystkie hooki skryptów.

## Plan punkt po punkcie

### 1. Baseline i kontrakt wizualny (TDD)

- Zapisać aktualny stan branchu staging i macierz porównań 1486×1059 oraz 390×844.
- Rozszerzyć regresję CSS/DOM o kontrakt wspólnej powierzchni referencyjnej: pełna opacity grafik, brak pseudo-overlayu w Magazynie/Dopasowaniu, spójny crop 72% center, brak poziomego overflow.
- Dodać do raportu QA tabelę „makieta / staging / decyzja”, oddzielając różnice wizualne od brakujących funkcji domenowych.

### 2. Wspólna rama wizualna

- W `styles.css` wprowadzić jedną scoped warstwę `reference-surface` dla hero: szerokość bliższa makiecie, spokojne promienie około 16px, bez ciężkich cieni i bez pionowego rozdzielacza jako głównego motywu.
- Zachować pełną, katalogową ekspozycję obrazów w jasnym i ciemnym wariancie oraz istniejące alt/ARIA.
- Nie zmieniać logiki przełączania motywu ani nawigacji.

### 3. Magazyn — „półki pracowni”

- Przekształcić hero z izolowanej karty split do szerokiej kompozycji editorial: tekst, akcje i statystyki pozostają nad rzeczywistym obrazem, a obraz wychodzi do krawędzi powierzchni.
- Zachować onboarding, dodawanie/edycję/usuwanie włóczek i realne swatche; nie tworzyć atrap fotografii.
- Ustawić rytm sekcji, statystyk i listy bliżej makiety, z czytelnymi kartami nocnymi w dark mode.

### 4. Dopasowanie — „wariant ekspercki”

- Ujednolicić hero z Magazynem: szeroka grafika bez pasków i bez dodatkowego overlayu, tekst po lewej, kontrolki i wyniki w szerokim workspace poniżej.
- Uporządkować proporcje `matches-criteria`/`matches-results`, pozostawiając aktualny model dopasowania i wszystkie stany pusty/ładowanie/sukces/błąd.
- Nie dodawać makietowych filtrów ani zdjęć włóczek, których nie obsługuje backend.

### 5. Katalog — bliżej makiety bez zmiany katalogu wzorów

- Zachować wyszukiwanie, filtry, reset, rozwijanie kart i paginację, ale nadać hero i paskowi filtrów tę samą szeroką, spokojną hierarchię co makieta.
- Utrzymać istniejącą grafikę kota w obu motywach i cztery kolumny tylko tam, gdzie pozwala na to szerokość; na mobile przejść do jednej kolumny bez ścisku.
- Zostawić jasne/ciemne karty wzorów jako realny produkt, jasno dokumentując różnicę wobec makiety katalogu włóczek.

### 6. Konto — wizualna rama bez atrap dashboardu

- Przywrócić grafikę kota jako element kompozycji również przy zachowaniu realnego panelu auth/security, z kontrastową warstwą treści.
- Zachować logowanie, rejestrację, recovery i strefę usuwania konta; nie dodawać nieistniejących projektów i powiadomień.
- Dopasować powierzchnie, promienie, odstępy i hierarchię do makiety konta.

### 7. Responsywność i dostępność

- Sprawdzić 1440, 1024, 768 i 390 CSS px w obu motywach.
- Utrzymać 44px cele dotykowe, widoczny focus, `prefers-reduced-motion` i brak poziomego scrolla.
- Na mobile obraz ma pozostać czytelny, ale nie może wypychać treści ani zasłaniać kontrolek.

### 8. QA, staging i punkt kontrolny

- Uruchomić `npm run check`, lint i testy kontraktowe.
- Wykonać screenshoty stagingu dla czterech widoków w 1486×1059 i 390×844, porównać je z właściwymi PNG i zapisać wynik w `.audit/design-fidelity-2026-08-08/`.
- Poprawić znalezione rozjazdy i powtórzyć wizualną kontrolę; dopiero po stabilnym wyniku wdrożyć branch na `origin/staging` i sprawdzić health/release oraz brak błędów w konsoli.

## Kryteria ukończenia

1. Magazyn i Dopasowanie nie wyglądają jak węższe, ciężko obramowane karty; grafika jest pełnoekranową częścią hierarchii i ma taki sam treatment jak Katalog.
2. Katalog i Konto są bliższe makietom w szerokości, promieniach, odstępach i hierarchii, bez fałszywych danych.
3. Funkcjonalność i auth pozostają bez regresji.
4. Testy, staging QA i porównanie screenshotów są zapisane.

