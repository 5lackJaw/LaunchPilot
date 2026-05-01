create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  task_class text not null,
  provider text not null check (provider in ('anthropic', 'gemini', 'openai')),
  model text not null,
  input_tokens integer,
  output_tokens integer,
  cached_input_tokens integer,
  estimated_cost_usd numeric(10, 6),
  actual_cost_usd numeric(10, 6),
  status text not null default 'succeeded' check (status in ('succeeded', 'failed', 'blocked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_user_period_idx
  on public.ai_usage_events (user_id, created_at desc);

create index if not exists ai_usage_events_product_period_idx
  on public.ai_usage_events (product_id, created_at desc);

create index if not exists ai_usage_events_task_provider_idx
  on public.ai_usage_events (task_class, provider, model);

alter table public.ai_usage_events enable row level security;

create policy "ai_usage_events_select_own"
  on public.ai_usage_events
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "ai_usage_events_insert_own"
  on public.ai_usage_events
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create table if not exists public.ai_budget_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  billing_period_start date not null,
  billing_period_end date not null,
  plan_tier text not null check (plan_tier in ('free', 'launch', 'growth')),
  soft_budget_usd numeric(10, 2) not null,
  hard_budget_usd numeric(10, 2) not null,
  used_estimated_usd numeric(10, 4) not null default 0,
  used_actual_usd numeric(10, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id, billing_period_start)
);

create index if not exists ai_budget_ledger_user_period_idx
  on public.ai_budget_ledger (user_id, billing_period_start desc);

create index if not exists ai_budget_ledger_product_period_idx
  on public.ai_budget_ledger (product_id, billing_period_start desc);

drop trigger if exists set_ai_budget_ledger_updated_at on public.ai_budget_ledger;

create trigger set_ai_budget_ledger_updated_at
  before update on public.ai_budget_ledger
  for each row execute procedure public.set_updated_at();

alter table public.ai_budget_ledger enable row level security;

create policy "ai_budget_ledger_select_own"
  on public.ai_budget_ledger
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "ai_budget_ledger_insert_own"
  on public.ai_budget_ledger
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "ai_budget_ledger_update_own"
  on public.ai_budget_ledger
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
