drop policy if exists "users_select_own" on public.users;
drop policy if exists "users_update_own_limited" on public.users;

create policy "users_select_own"
  on public.users
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy "users_update_own_limited"
  on public.users
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "products_select_own" on public.products;
drop policy if exists "products_insert_own" on public.products;
drop policy if exists "products_update_own" on public.products;

create policy "products_select_own"
  on public.products
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "products_insert_own"
  on public.products
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "products_update_own"
  on public.products
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
