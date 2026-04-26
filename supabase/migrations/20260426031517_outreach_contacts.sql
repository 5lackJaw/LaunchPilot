create table if not exists public.outreach_contacts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  email text,
  publication text,
  url text,
  score numeric(5, 4) not null check (score >= 0 and score <= 1),
  status text not null default 'identified' check (
    status in ('identified', 'drafted', 'pending_review', 'sent', 'opened', 'replied', 'converted', 'suppressed', 'failed')
  ),
  last_contact_at timestamptz,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, url)
);

create index if not exists outreach_contacts_product_status_score_idx
  on public.outreach_contacts (product_id, status, score desc, created_at desc);

drop trigger if exists set_outreach_contacts_updated_at on public.outreach_contacts;

create trigger set_outreach_contacts_updated_at
  before update on public.outreach_contacts
  for each row execute procedure public.set_updated_at();

alter table public.outreach_contacts enable row level security;

create policy "outreach_contacts_select_own_product"
  on public.outreach_contacts
  for select
  using (
    exists (
      select 1
      from public.products
      where products.id = outreach_contacts.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "outreach_contacts_insert_own_product"
  on public.outreach_contacts
  for insert
  with check (
    exists (
      select 1
      from public.products
      where products.id = outreach_contacts.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "outreach_contacts_update_own_product"
  on public.outreach_contacts
  for update
  using (
    exists (
      select 1
      from public.products
      where products.id = outreach_contacts.product_id
        and products.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.products
      where products.id = outreach_contacts.product_id
        and products.user_id = (select auth.uid())
    )
  );
