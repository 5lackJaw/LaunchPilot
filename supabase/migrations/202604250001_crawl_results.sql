create table if not exists public.crawl_results (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  crawl_job_id uuid not null references public.crawl_jobs(id) on delete cascade,
  source_url text not null check (source_url ~* '^https?://'),
  final_url text check (final_url is null or final_url ~* '^https?://'),
  http_status integer check (http_status is null or (http_status >= 100 and http_status <= 599)),
  page_title text,
  meta_description text,
  h1 text,
  extracted_signals jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists crawl_results_product_id_created_at_idx
  on public.crawl_results (product_id, created_at desc);

create unique index if not exists crawl_results_crawl_job_id_idx
  on public.crawl_results (crawl_job_id);

alter table public.crawl_results enable row level security;

create policy "crawl_results_select_own_product"
  on public.crawl_results
  for select
  using (
    exists (
      select 1
      from public.products
      where products.id = crawl_results.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "crawl_results_insert_own_product"
  on public.crawl_results
  for insert
  with check (
    exists (
      select 1
      from public.products
      where products.id = crawl_results.product_id
        and products.user_id = (select auth.uid())
    )
  );
