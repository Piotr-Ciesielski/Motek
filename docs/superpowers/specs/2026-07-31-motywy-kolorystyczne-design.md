# Motywy kolorystyczne Motka — projekt

**Data:** 2026-07-31  
**Status:** zatwierdzone przez właścicielkę produktu  
**Zakres:** frontend, preferencja użytkownika i warstwa tokenów CSS

## Cel

Motek ma oferować dwa kompletne warianty wyglądu:

- tryb jasny oparty na designie nr 4 — **Koloroterapia**;
- tryb ciemny oparty na designie nr 5 — **Nocny Motek**.

Oba warianty zachowują tę samą strukturę treści, komponentów i zachowania.
Różnią się paletą, kontrastem, powierzchniami, akcentami i stanami wizualnymi.

## Decyzje produktowe

1. Dostępne są dokładnie dwa tryby: `light` i `dark`.
2. Domyślnie aplikacja uruchamia się w trybie jasnym.
3. Preferencja jest zapisywana lokalnie w przeglądarce.
4. Preferencja nie jest zapisywana w Supabase i nie jest częścią danych konta.
5. Usunięcie konta nie musi usuwać preferencji wyglądu urządzenia.
6. Późniejsze zmiany palety odbywają się przez tokeny, bez przepisywania
   logiki komponentów.

## Warstwa tokenów

Style używają semantycznych zmiennych CSS, między innymi:

- tło strony i tło sekcji;
- powierzchnia karty i powierzchnia podniesiona;
- tekst główny, pomocniczy i odwrócony;
- obramowanie zwykłe, aktywne i błędu;
- akcent główny i akcent pomocniczy;
- kolory sukcesu, ostrzeżenia i błędu;
- cień, fokus i stany nieaktywne.

Wartości dla `light` odwzorowują „Koloroterapię”, a wartości dla `dark`
odwzorowują „Nocny Motek”. Komponenty nie zawierają bezpośrednich wartości
kolorów poza wyjątkami technicznymi, które nie są zależne od motywu.

## Przełączanie motywu

Stan motywu jest ustawiany na elemencie `html` przez `data-theme`.
Preferencja jest przechowywana pod jedną, wersjonowaną nazwą klucza
localStorage. Przy starcie mały skrypt odczytuje poprawną wartość przed
renderowaniem głównego interfejsu, aby uniknąć błysku jasnego wariantu.

Przełącznik:

- ma jednoznaczną nazwę dla czytnika ekranu;
- komunikuje aktualny stan przez `aria-pressed` albo równoważny mechanizm;
- działa klawiaturą i dotykiem;
- aktualizuje `color-scheme` dokumentu;
- nie powoduje przeładowania strony ani utraty formularzy.

## Integracja z aplikacją

Motyw jest inicjalizowany przed sprawdzeniem sesji i niezależnie od danych
Supabase. Widok konta udostępnia przełącznik zarówno gościowi, jak i osobie
zalogowanej. Sekcja usuwania konta korzysta z tych samych tokenów co reszta
interfejsu, ale zachowuje osobny, wyraźny styl ryzyka.

## Dostępność i responsywność

Dla obu motywów należy sprawdzić:

- kontrast tekstu, kontrolek i komunikatów;
- widoczność fokusu klawiatury;
- stany hover, focus, disabled, error i success;
- czytelność kart, formularzy i nawigacji przy powiększeniu;
- brak migotania podczas zmiany motywu;
- obsługę `prefers-reduced-motion` dla ewentualnej animacji przejścia.

## Testy

Należy sprawdzić:

- domyślny tryb jasny;
- przełączenie na ciemny i powrót do jasnego;
- zapis i odczyt preferencji po odświeżeniu;
- odporność na nieprawidłową wartość localStorage;
- zachowanie formularzy i aktywnego widoku przy przełączeniu;
- klawiaturę, czytnik ekranu i minimalny obszar dotyku;
- wizualnie oba designy na szerokości mobilnej i desktopowej.

## Poza zakresem

- trzeci tryb systemowy;
- synchronizacja motywu między urządzeniami;
- zmiana struktury ekranów lub przepływów biznesowych;
- automatyczna zmiana palety na podstawie pory dnia.
