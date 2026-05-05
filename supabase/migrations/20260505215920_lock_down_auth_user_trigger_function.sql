revoke all on function public.handle_new_auth_user() from public;
revoke all on function public.handle_new_auth_user() from anon;
revoke all on function public.handle_new_auth_user() from authenticated;

grant execute on function public.handle_new_auth_user() to service_role;
grant execute on function public.handle_new_auth_user() to supabase_auth_admin;
