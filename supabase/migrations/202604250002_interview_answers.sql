create table if not exists public.interview_answers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  question_id text not null check (char_length(question_id) between 2 and 80),
  answer text not null check (char_length(answer) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, question_id)
);

create index if not exists interview_answers_product_id_updated_at_idx
  on public.interview_answers (product_id, updated_at desc);

drop trigger if exists set_interview_answers_updated_at on public.interview_answers;

create trigger set_interview_answers_updated_at
  before update on public.interview_answers
  for each row execute procedure public.set_updated_at();

alter table public.interview_answers enable row level security;

create policy "interview_answers_select_own_product"
  on public.interview_answers
  for select
  using (
    exists (
      select 1
      from public.products
      where products.id = interview_answers.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "interview_answers_insert_own_product"
  on public.interview_answers
  for insert
  with check (
    exists (
      select 1
      from public.products
      where products.id = interview_answers.product_id
        and products.user_id = (select auth.uid())
    )
  );

create policy "interview_answers_update_own_product"
  on public.interview_answers
  for update
  using (
    exists (
      select 1
      from public.products
      where products.id = interview_answers.product_id
        and products.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.products
      where products.id = interview_answers.product_id
        and products.user_id = (select auth.uid())
    )
  );
