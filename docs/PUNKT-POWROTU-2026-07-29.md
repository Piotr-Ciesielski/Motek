# Punkt powrotu — Motek

Data zapisania: 2026-07-29

## Obecny etap

- Prace są prowadzone na gałęzi `feat/frontend-design-refresh`.
- Ostatni zapisany commit to `923a00f`:
  `docs: add complete visual audit`.
- Gałąź jest o jeden commit przed `origin/feat/frontend-design-refresh`.
- Pełny audyt publicznej i zalogowanej części aplikacji znajduje się w
  `docs/AUDYT-WIZUALNY-2026-07-29.md`.
- Audyt obejmuje widoki desktopowe i mobilne, konto, magazyn włóczek,
  edycję, dodawanie niezapisanego formularza, wyniki dopasowania, katalog,
  filtrowanie, klawiaturę i kontrast.
- W raporcie zapisano 19 problemów z priorytetami, pomiarami, rekomendacjami
  i kryteriami odbioru.
- Nie rozpoczęto jeszcze wdrażania poprawek wynikających z audytu.
- Podczas audytu nie zmieniono zapisanych danych użytkownika.

## Najważniejszy kierunek produktowy na następną sesję

Nie zaczynać od kosmetycznej korekty kolorów. Najpierw ustalić:

1. własny, rozpoznawalny świat wizualny Motka;
2. estetykę bliższą wysmakowanemu narzędziu dla pasjonatek dziewiarstwa niż
   produktowi technologicznemu;
3. nową architekturę informacji, która nie umieszcza konta, magazynu,
   dopasowania i całego katalogu na jednej bardzo długiej stronie;
4. sposób prezentacji zapisanych włóczek w zwartej formie;
5. szybki dostęp do wyników dopasowania;
6. paginację lub porcjowanie katalogu.

Przed większą przebudową uzgodnić z użytkownikiem widoczny kierunek produktu
i praktyczne konsekwencje proponowanego układu.

## Komentarz do zachowania w pełnym brzmieniu

> Obecny front jest poprawny i nowocześniejszy niż typowy panel
> administracyjny, ale nie jest jeszcze satysfakcjonujący dla grupy o wysokiej
> wrażliwości estetycznej.
>
> Największy problem nie leży w kolorach, lecz w tym, że aplikacja wygląda
> trochę jak kolorowy produkt technologiczny, a nie jak wysmakowane narzędzie
> dla pasjonatek dziewiarstwa. Różowo-fioletowo-pomarańczowe gradienty, szkło i
> mocne cienie dają efekt „startupowy”. Brakuje własnego, rozpoznawalnego świata
> Motka.
>
> Dodatkowo wszystkie funkcje są ułożone na jednej bardzo długiej stronie:
> konto, instrukcja, magazyn, dopasowanie i cały katalog. Przy kilkudziesięciu
> lub kilkuset włóczkach korzystanie z tego układu stanie się męczące.

## Pierwszy krok jutro

Rozpocząć od krótkiej decyzji projektowej:

- jaki charakter ma mieć Motek;
- jak podzielić aplikację na główne obszary;
- który ekran powinien być domyślnym miejscem pracy po zalogowaniu.

Następnie przygotować konkretną propozycję nowej struktury i kierunku
wizualnego przed rozpoczęciem implementacji.
