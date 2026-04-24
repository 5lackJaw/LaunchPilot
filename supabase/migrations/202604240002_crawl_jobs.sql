create table if not exists public.crawl_jobs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  steps jsonb not null default '[]'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists crawl_jobs_product_id_created_at_idx
  on public.crawl_jobs (product_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_crawl_jobs_updated_at on public.crawl_jobs;

create trigger set_crawl_jobs_updated_at
  before update on public.crawl_jobs
  for each row execute procedure public.set_updated_at();

alter table public.crawl_jobs enable row level security;

create policy "crawl_jobs_select_own_product"
  on public.crawl_jobs
  for select
  using (
    exists (
      select 1
      from public.products
      where products.id = crawl_jobs.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "crawl_jobs_insert_own_product"
  on public.crawl_jobs
  for insert
  with check (
    exists (
      select 1
      from public.products
      where products.id = crawl_jobs.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "crawl_jobs_update_own_product"
  on public.crawl_jobs
  for update
  using (
    exists (
      select 1
      from public.products
      where products.id = crawl_jobs.product_id
        and products.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.products
      where products.id = crawl_jobs.product_id
        and products.user_id = (select auth.uid())
    )
  );
