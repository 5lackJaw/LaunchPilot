create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  plan_tier text not null default 'free' check (plan_tier in ('free', 'launch', 'growth')),
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users_select_own"
  on public.users
  for select
  using (id = auth.uid());

create policy "users_update_own_limited"
  on public.users
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  url text not null check (url ~* '^https?://'),
  status text not null default 'draft' check (status in ('draft', 'onboarding', 'active', 'paused', 'archived')),
  current_marketing_brief_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists products_user_id_created_at_idx
  on public.products (user_id, created_at desc);

alter table public.products enable row level security;

create policy "products_select_own"
  on public.products
  for select
  using (user_id = auth.uid());

create policy "products_insert_own"
  on public.products
  for insert
  with check (user_id = auth.uid());

create policy "products_update_own"
  on public.products
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
