create table if not exists public.traffic_snapshots (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  source_type text not null check (char_length(source_type) between 1 and 80),
  visits integer not null default 0 check (visits >= 0),
  conversions integer not null default 0 check (conversions >= 0),
  provenance jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create index if not exists traffic_snapshots_product_recorded_at_idx
  on public.traffic_snapshots (product_id, recorded_at desc);

create index if not exists traffic_snapshots_product_source_recorded_at_idx
  on public.traffic_snapshots (product_id, source_type, recorded_at desc);

alter table public.traffic_snapshots enable row level security;

create policy "traffic_snapshots_select_own_product"
  on public.traffic_snapshots
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.products
      where products.id = traffic_snapshots.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "traffic_snapshots_insert_own_product"
  on public.traffic_snapshots
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.products
      where products.id = traffic_snapshots.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "traffic_snapshots_update_own_product"
  on public.traffic_snapshots
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.products
      where products.id = traffic_snapshots.product_id
        and products.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.products
      where products.id = traffic_snapshots.product_id
        and products.user_id = (select auth.uid())
    )
  );

create table if not exists public.keyword_rank_snapshots (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  keyword text not null check (char_length(keyword) between 1 and 160),
  rank_position integer not null check (rank_position > 0),
  source text not null default 'manual' check (char_length(source) between 1 and 80),
  provenance jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create index if not exists keyword_rank_snapshots_product_recorded_at_idx
  on public.keyword_rank_snapshots (product_id, recorded_at desc);

create index if not exists keyword_rank_snapshots_product_keyword_recorded_at_idx
  on public.keyword_rank_snapshots (product_id, keyword, recorded_at desc);

alter table public.keyword_rank_snapshots enable row level security;

create policy "keyword_rank_snapshots_select_own_product"
  on public.keyword_rank_snapshots
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.products
      where products.id = keyword_rank_snapshots.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "keyword_rank_snapshots_insert_own_product"
  on public.keyword_rank_snapshots
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.products
      where products.id = keyword_rank_snapshots.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "keyword_rank_snapshots_update_own_product"
  on public.keyword_rank_snapshots
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.products
      where products.id = keyword_rank_snapshots.product_id
        and products.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.products
      where products.id = keyword_rank_snapshots.product_id
        and products.user_id = (select auth.uid())
    )
  );

create table if not exists public.weekly_briefs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  week_start date not null,
  summary_md text not null default '',
  recommendations jsonb not null default '[]'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (product_id, week_start)
);

create index if not exists weekly_briefs_product_week_start_idx
  on public.weekly_briefs (product_id, week_start desc);

alter table public.weekly_briefs enable row level security;

create policy "weekly_briefs_select_own_product"
  on public.weekly_briefs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.products
      where products.id = weekly_briefs.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "weekly_briefs_insert_own_product"
  on public.weekly_briefs
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.products
      where products.id = weekly_briefs.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "weekly_briefs_update_own_product"
  on public.weekly_briefs
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.products
      where products.id = weekly_briefs.product_id
        and products.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.products
      where products.id = weekly_briefs.product_id
        and products.user_id = (select auth.uid())
    )
  );
