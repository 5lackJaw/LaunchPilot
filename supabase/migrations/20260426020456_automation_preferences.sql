create table if not exists public.automation_preferences (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  channel text not null check (channel in ('content', 'community', 'directories', 'outreach')),
  trust_level integer not null default 1 check (trust_level in (1, 2, 3)),
  daily_auto_action_limit integer not null default 0 check (daily_auto_action_limit >= 0 and daily_auto_action_limit <= 50),
  review_window_hours integer not null default 24 check (review_window_hours >= 0 and review_window_hours <= 168),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, channel)
);

create index if not exists automation_preferences_product_channel_idx
  on public.automation_preferences (product_id, channel);

drop trigger if exists set_automation_preferences_updated_at on public.automation_preferences;

create trigger set_automation_preferences_updated_at
  before update on public.automation_preferences
  for each row execute procedure public.set_updated_at();

alter table public.automation_preferences enable row level security;

create policy "automation_preferences_select_own_product"
  on public.automation_preferences
  for select
  using (
    exists (
      select 1
      from public.products
      where products.id = automation_preferences.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "automation_preferences_insert_own_product"
  on public.automation_preferences
  for insert
  with check (
    exists (
      select 1
      from public.products
      where products.id = automation_preferences.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "automation_preferences_update_own_product"
  on public.automation_preferences
  for update
  using (
    exists (
      select 1
      from public.products
      where products.id = automation_preferences.product_id
        and products.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.products
      where products.id = automation_preferences.product_id
        and products.user_id = (select auth.uid())
    )
  );
