-- Ograniczenie funkcji triggerów do wywołania wewnętrznego przez PostgreSQL.
alter function public.handle_new_user() set search_path = '';
alter function public.sync_profile_email() set search_path = '';
alter function public.set_profiles_updated_at() set search_path = '';

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_profile_email() from public, anon, authenticated;
revoke execute on function public.set_profiles_updated_at() from public, anon, authenticated;
