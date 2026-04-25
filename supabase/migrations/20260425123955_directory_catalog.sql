create table if not exists public.directories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  url text not null check (url ~* '^https?://'),
  categories text[] not null default '{}',
  submission_method text not null check (submission_method in ('auto_supported', 'manual', 'assisted')),
  avg_da integer check (avg_da is null or (avg_da >= 0 and avg_da <= 100)),
  avg_traffic_tier text not null default 'unknown' check (avg_traffic_tier in ('low', 'medium', 'high', 'unknown')),
  review_time_days integer check (review_time_days is null or review_time_days >= 0),
  free_tier_available boolean not null default true,
  paid_tier_price integer check (paid_tier_price is null or paid_tier_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists directories_url_idx on public.directories (url);
create index if not exists directories_active_name_idx on public.directories (active, name);

drop trigger if exists set_directories_updated_at on public.directories;

create trigger set_directories_updated_at
  before update on public.directories
  for each row execute procedure public.set_updated_at();

alter table public.directories enable row level security;

create policy "directories_select_active"
  on public.directories
  for select
  to authenticated
  using (active = true);

create table if not exists public.directory_submissions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  directory_id uuid not null references public.directories(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'live', 'rejected', 'skipped', 'failed')),
  listing_payload jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  live_url text,
  notes text,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, directory_id)
);

create index if not exists directory_submissions_product_status_idx
  on public.directory_submissions (product_id, status, updated_at desc);

drop trigger if exists set_directory_submissions_updated_at on public.directory_submissions;

create trigger set_directory_submissions_updated_at
  before update on public.directory_submissions
  for each row execute procedure public.set_updated_at();

alter table public.directory_submissions enable row level security;

create policy "directory_submissions_select_own_product"
  on public.directory_submissions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.products
      where products.id = directory_submissions.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "directory_submissions_insert_own_product"
  on public.directory_submissions
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.products
      where products.id = directory_submissions.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "directory_submissions_update_own_product"
  on public.directory_submissions
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.products
      where products.id = directory_submissions.product_id
        and products.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.products
      where products.id = directory_submissions.product_id
        and products.user_id = (select auth.uid())
    )
  );

insert into public.directories (
  name,
  url,
  categories,
  submission_method,
  avg_da,
  avg_traffic_tier,
  review_time_days,
  free_tier_available,
  paid_tier_price
) values
  ('Product Hunt', 'https://www.producthunt.com', array['launch', 'startup'], 'manual', 91, 'high', 7, true, null),
  ('BetaList', 'https://betalist.com', array['startup', 'beta'], 'manual', 70, 'medium', 21, true, null),
  ('AlternativeTo', 'https://alternativeto.net', array['software', 'alternatives'], 'assisted', 86, 'high', 14, true, null),
  ('SaaSHub', 'https://www.saashub.com', array['saas', 'software'], 'assisted', 73, 'medium', 10, true, null),
  ('Indie Hackers Products', 'https://www.indiehackers.com/products', array['indie', 'startup'], 'manual', 80, 'medium', 5, true, null)
on conflict (url) do update set
  name = excluded.name,
  categories = excluded.categories,
  submission_method = excluded.submission_method,
  avg_da = excluded.avg_da,
  avg_traffic_tier = excluded.avg_traffic_tier,
  review_time_days = excluded.review_time_days,
  free_tier_available = excluded.free_tier_available,
  paid_tier_price = excluded.paid_tier_price,
  active = true;
