create unique index if not exists crawl_jobs_one_active_per_product_idx
  on public.crawl_jobs (product_id)
  where status in ('queued', 'running');

create unique index if not exists brief_generation_jobs_one_active_per_product_idx
  on public.brief_generation_jobs (product_id)
  where status in ('queued', 'running');
