-- Bezpośredni dostęp do sekwencji nie może omijać wersjonowanych RPC.
revoke all privileges on sequence public.yarns_id_seq
from public, anon, authenticated;
