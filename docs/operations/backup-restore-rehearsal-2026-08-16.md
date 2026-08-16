# Backup i próba odtworzenia Motka — 2026-08-16

## Zakres i bezpieczeństwo

Za zgodą operatora wykonano świeży, odczytowy eksport produkcyjnego projektu
Supabase `vueotocjsgzosqzhcish`. Produkcja nie była modyfikowana. Eksport objął
osobno schemat i dane dla `public`, `private`, `auth` oraz `storage` — łącznie
osiem plików SQL.

Jawne pliki zostały spakowane i zaszyfrowane Windows DPAPI w zakresie bieżącego
konta Windows. Pakiet pozostaje poza repozytorium:

- artefakt: `C:\Users\Kisiel\AppData\Local\Motek\backups\motek-production-full-backup-2026-08-16.dpapi.zip`;
- rozmiar: `41 734 B`;
- SHA-256 pakietu: `50BB1716563AE97C7B761482722B541819ADF576AE8E8ADEECF4B86A0BDD4A83`;
- odszyfrowanie kontrolne i zgodność hashy ośmiu plików: `PASS`;
- jawne pliki restore i katalogi tymczasowe po weryfikacji: usunięte.

W kopii nie zapisano haseł połączeniowych ani kluczy produkcyjnych.

## Odczyt źródła

Kontrolne liczności produkcji w chwili eksportu:

| Zakres | Liczność |
|---|---:|
| `auth.users` | 2 |
| `auth.identities` | 1 |
| `auth.sessions` | 62 |
| `public.profiles` | 2 |
| `public.yarns` | 10 |
| `public.patterns` | 15 |
| `private.yarn_store_versions` | 2 |
| `private.auth_recovery_grants` | 0 |
| `storage.buckets` | 0 |
| `storage.objects` | 0 |

## Izolowany restore

Odtworzenie wykonano w nowym, lokalnym stacku Supabase z GoTrue, na osobnych
portach i bez połączenia zwrotnego do produkcji. Zgodność środowiska została
potwierdzona obecnością `auth.users.is_sso_user` oraz zdrowiem GoTrue HTTP 200.

Schemat zarządzanego Auth pozostał bazowym schematem świeżego stacku; załadowano
do niego eksport danych Auth. Schematy i dane `public/private` oraz dane
`storage` zostały załadowane z kopii. Wynik liczności cel → źródło był zgodny:

`2/1/62`, `2/10/15/2`, Storage `0/0`.

Dodatkowo:

- hashe haseł istniały dla obu odtworzonych użytkowników;
- zdrowie GoTrue: `PASS`;
- syntetyczna rejestracja i logowanie: `PASS`;
- jednorazowe konto syntetyczne usunięto: `PASS`;
- po teście usunięto stack, wolumeny i jawne pliki.

Bezpośredni import schematu Auth do zwykłego PostgreSQL zatrzymał się na
braku `auth.users.is_sso_user`; jest to potwierdzenie, że dla Auth wymagany
jest zgodny stack Supabase/GoTrue, a nie obejście produkcyjnego schematu.

## Werdykt

**Backup/restore: PASS warunkowy.** Punkt odtworzenia jest świeży, zaszyfrowany
i odtwarzalny dla obecnego stanu produkcji, w tym pustego Storage. Produkcja
pozostaje nietknięta. Wynik nie jest zgodą na migrację, zmianę ledgeru ani
wdrożenie produkcyjne; te czynności wymagają osobnych bram i zgód.
