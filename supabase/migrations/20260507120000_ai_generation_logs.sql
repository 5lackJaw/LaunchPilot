create table if not exists public.ai_generation_logs (
  id uuid primary key default gen_random_uuid(),
  usage_event_id uuid references public.ai_usage_events(id) on delete set null,
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  task_class text not null,
  provider text not null check (provider in ('anthropic', 'gemini', 'openai')),
  model text not null,
  status text not null check (status in ('succeeded', 'failed')),
  system_text text,
  prompt_text text,
  response_text text,
  error_message text,
  input_tokens integer,
  output_tokens integer,
  cached_input_tokens integer,
  estimated_cost_usd numeric(10, 6),
  actual_cost_usd numeric(10, 6),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_generation_logs_user_created_idx
  on public.ai_generation_logs (user_id, created_at desc);

create index if not exists ai_generation_logs_product_created_idx
  on public.ai_generation_logs (product_id, created_at desc);

create index if not exists ai_generation_logs_usage_event_idx
  on public.ai_generation_logs (usage_event_id);

alter table public.ai_generation_logs enable row level security;

create policy "ai_generation_logs_select_own"
  on public.ai_generation_logs
  for select
  to authenticated
  using (user_id = (select auth.uid()));
