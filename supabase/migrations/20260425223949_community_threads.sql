create table if not exists public.community_threads (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  platform text not null,
  thread_url text not null,
  thread_title text not null,
  thread_author_handle text,
  relevance_score numeric(5, 4) not null check (relevance_score >= 0 and relevance_score <= 1),
  pain_signal_score numeric(5, 4) not null check (pain_signal_score >= 0 and pain_signal_score <= 1),
  audience_fit_score numeric(5, 4) not null check (audience_fit_score >= 0 and audience_fit_score <= 1),
  recency_score numeric(5, 4) not null check (recency_score >= 0 and recency_score <= 1),
  reply_draft text,
  promotional_score numeric(5, 4) check (promotional_score is null or (promotional_score >= 0 and promotional_score <= 1)),
  status text not null default 'observed' check (
    status in ('observed', 'drafted', 'pending_review', 'approved', 'posted', 'skipped', 'blocked', 'failed')
  ),
  posted_at timestamptz,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, platform, thread_url)
);

create index if not exists community_threads_product_status_score_idx
  on public.community_threads (product_id, status, relevance_score desc, created_at desc);

drop trigger if exists set_community_threads_updated_at on public.community_threads;

create trigger set_community_threads_updated_at
  before update on public.community_threads
  for each row execute procedure public.set_updated_at();

alter table public.community_threads enable row level security;

create policy "community_threads_select_own_product"
  on public.community_threads
  for select
  using (
    exists (
      select 1
      from public.products
      where products.id = community_threads.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "community_threads_insert_own_product"
  on public.community_threads
  for insert
  with check (
    exists (
      select 1
      from public.products
      where products.id = community_threads.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "community_threads_update_own_product"
  on public.community_threads
  for update
  using (
    exists (
      select 1
      from public.products
      where products.id = community_threads.product_id
        and products.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.products
      where products.id = community_threads.product_id
        and products.user_id = (select auth.uid())
    )
  );
