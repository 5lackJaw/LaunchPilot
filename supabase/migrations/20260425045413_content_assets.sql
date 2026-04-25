create table if not exists public.content_assets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  brief_version integer not null check (brief_version > 0),
  type text not null check (type in ('article', 'comparison', 'faq', 'changelog', 'positioning_copy')),
  title text not null,
  body_md text not null default '',
  target_keyword text,
  meta_title text,
  meta_description text,
  status text not null default 'draft' check (
    status in ('draft', 'pending_review', 'approved', 'published', 'rejected', 'failed', 'archived')
  ),
  published_url text,
  ai_confidence numeric(5, 4) check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_assets_product_status_created_at_idx
  on public.content_assets (product_id, status, created_at desc);

create index if not exists content_assets_product_keyword_idx
  on public.content_assets (product_id, target_keyword)
  where target_keyword is not null;

drop trigger if exists set_content_assets_updated_at on public.content_assets;

create trigger set_content_assets_updated_at
  before update on public.content_assets
  for each row execute procedure public.set_updated_at();

alter table public.content_assets enable row level security;

create policy "content_assets_select_own_product"
  on public.content_assets
  for select
  using (
    exists (
      select 1
      from public.products
      where products.id = content_assets.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "content_assets_insert_own_product"
  on public.content_assets
  for insert
  with check (
    exists (
      select 1
      from public.products
      where products.id = content_assets.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "content_assets_update_own_product"
  on public.content_assets
  for update
  using (
    exists (
      select 1
      from public.products
      where products.id = content_assets.product_id
        and products.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.products
      where products.id = content_assets.product_id
        and products.user_id = (select auth.uid())
    )
  );
