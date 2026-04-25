create table if not exists public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  item_type text not null check (
    item_type in (
      'content_draft',
      'community_reply',
      'directory_package',
      'outreach_email',
      'positioning_update',
      'weekly_recommendation'
    )
  ),
  source_entity_type text,
  source_entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'skipped', 'auto_executed', 'failed')
  ),
  ai_confidence numeric(5, 4) check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  impact_estimate text not null default 'medium' check (impact_estimate in ('low', 'medium', 'high')),
  review_time_estimate_seconds integer check (review_time_estimate_seconds is null or review_time_estimate_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists inbox_items_product_status_created_at_idx
  on public.inbox_items (product_id, status, created_at desc);

create index if not exists inbox_items_source_entity_idx
  on public.inbox_items (source_entity_type, source_entity_id)
  where source_entity_type is not null and source_entity_id is not null;

drop trigger if exists set_inbox_items_updated_at on public.inbox_items;

create trigger set_inbox_items_updated_at
  before update on public.inbox_items
  for each row execute procedure public.set_updated_at();

alter table public.inbox_items enable row level security;

create policy "inbox_items_select_own_product"
  on public.inbox_items
  for select
  using (
    exists (
      select 1
      from public.products
      where products.id = inbox_items.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "inbox_items_insert_own_product"
  on public.inbox_items
  for insert
  with check (
    exists (
      select 1
      from public.products
      where products.id = inbox_items.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "inbox_items_update_own_product"
  on public.inbox_items
  for update
  using (
    exists (
      select 1
      from public.products
      where products.id = inbox_items.product_id
        and products.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.products
      where products.id = inbox_items.product_id
        and products.user_id = (select auth.uid())
    )
  );

create table if not exists public.inbox_item_events (
  id uuid primary key default gen_random_uuid(),
  inbox_item_id uuid not null references public.inbox_items(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  event_type text not null check (
    event_type in ('created', 'approved', 'rejected', 'skipped', 'auto_executed', 'failed')
  ),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists inbox_item_events_item_created_at_idx
  on public.inbox_item_events (inbox_item_id, created_at desc);

create index if not exists inbox_item_events_product_created_at_idx
  on public.inbox_item_events (product_id, created_at desc);

alter table public.inbox_item_events enable row level security;

create policy "inbox_item_events_select_own_product"
  on public.inbox_item_events
  for select
  using (
    exists (
      select 1
      from public.products
      where products.id = inbox_item_events.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "inbox_item_events_insert_own_product"
  on public.inbox_item_events
  for insert
  with check (
    exists (
      select 1
      from public.products
      where products.id = inbox_item_events.product_id
        and products.user_id = (select auth.uid())
    )
  );
