create table if not exists public.brief_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  steps jsonb not null default '[]'::jsonb,
  crawl_result_id uuid references public.crawl_results(id) on delete set null,
  marketing_brief_id uuid references public.marketing_briefs(id) on delete set null,
  error_message text,
  admin_override boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists brief_generation_jobs_product_id_created_at_idx
  on public.brief_generation_jobs (product_id, created_at desc);

create index if not exists brief_generation_jobs_product_status_idx
  on public.brief_generation_jobs (product_id, status, created_at desc);

drop trigger if exists set_brief_generation_jobs_updated_at on public.brief_generation_jobs;

create trigger set_brief_generation_jobs_updated_at
  before update on public.brief_generation_jobs
  for each row execute procedure public.set_updated_at();

alter table public.brief_generation_jobs enable row level security;

create policy "brief_generation_jobs_select_own_product"
  on public.brief_generation_jobs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.products
      where products.id = brief_generation_jobs.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "brief_generation_jobs_insert_own_product"
  on public.brief_generation_jobs
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.products
      where products.id = brief_generation_jobs.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "brief_generation_jobs_update_own_product"
  on public.brief_generation_jobs
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.products
      where products.id = brief_generation_jobs.product_id
        and products.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.products
      where products.id = brief_generation_jobs.product_id
        and products.user_id = (select auth.uid())
    )
  );
