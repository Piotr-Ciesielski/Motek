-- Data API i każdy przyszły endpoint profilu przyjmują wyłącznie krótkie adresy avatarów.
alter table public.profiles
  drop constraint if exists profiles_avatar_url_length_check;

alter table public.profiles
  add constraint profiles_avatar_url_length_check
  check (avatar_url is null or char_length(avatar_url) <= 2048);
