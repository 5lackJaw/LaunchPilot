create table if not exists public.marketing_briefs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  version integer not null check (version > 0),
  tagline text not null default '',
  value_props jsonb not null default '[]'::jsonb,
  personas jsonb not null default '[]'::jsonb,
  competitors jsonb not null default '[]'::jsonb,
  keyword_clusters jsonb not null default '[]'::jsonb,
  tone_profile jsonb not null default '{}'::jsonb,
  channels_ranked jsonb not null default '[]'::jsonb,
  content_calendar_seed jsonb not null default '[]'::jsonb,
  launch_date date,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, version)
);

create index if not exists marketing_briefs_product_id_version_idx
  on public.marketing_briefs (product_id, version desc);

drop trigger if exists set_marketing_briefs_updated_at on public.marketing_briefs;

create trigger set_marketing_briefs_updated_at
  before update on public.marketing_briefs
  for each row execute procedure public.set_updated_at();

alter table public.marketing_briefs enable row level security;

create policy "marketing_briefs_select_own_product"
  on public.marketing_briefs
  for select
  using (
    exists (
      select 1
      from public.products
      where products.id = marketing_briefs.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "marketing_briefs_insert_own_product"
  on public.marketing_briefs
  for insert
  with check (
    exists (
      select 1
      from public.products
      where products.id = marketing_briefs.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "marketing_briefs_update_own_product"
  on public.marketing_briefs
  for update
  using (
    exists (
      select 1
      from public.products
      where products.id = marketing_briefs.product_id
        and products.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.products
      where products.id = marketing_briefs.product_id
        and products.user_id = (select auth.uid())
    )
  );

alter table public.products
  drop constraint if exists products_current_marketing_brief_id_fkey;

alter table public.products
  add constraint products_current_marketing_brief_id_fkey
  foreign key (current_marketing_brief_id)
  references public.marketing_briefs(id)
  on delete set null;
