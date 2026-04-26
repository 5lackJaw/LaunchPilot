create table if not exists public.external_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (
    provider in (
      'ghost',
      'wordpress',
      'webflow',
      'reddit',
      'hacker_news',
      'google_search_console',
      'plausible',
      'resend',
      'outreach_email'
    )
  ),
  credentials_encrypted text,
  scopes text[] not null default '{}'::text[],
  status text not null default 'pending' check (status in ('pending', 'connected', 'revoked', 'error')),
  metadata jsonb not null default '{}'::jsonb,
  last_validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists external_connections_user_id_provider_idx
  on public.external_connections (user_id, provider);

drop trigger if exists set_external_connections_updated_at on public.external_connections;

create trigger set_external_connections_updated_at
  before update on public.external_connections
  for each row execute procedure public.set_updated_at();

alter table public.external_connections enable row level security;

create policy "external_connections_select_own"
  on public.external_connections
  for select
  using (user_id = (select auth.uid()));

create policy "external_connections_insert_own"
  on public.external_connections
  for insert
  with check (user_id = (select auth.uid()));

create policy "external_connections_update_own"
  on public.external_connections
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
