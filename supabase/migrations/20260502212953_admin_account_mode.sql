alter table public.users
  add column if not exists admin_account_mode text;

alter table public.users
  drop constraint if exists users_admin_account_mode_check;

alter table public.users
  add constraint users_admin_account_mode_check
  check (admin_account_mode is null or admin_account_mode in ('free', 'launch', 'growth', 'god'));
