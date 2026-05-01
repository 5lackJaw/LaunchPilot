create policy "products_delete_own"
  on public.products
  for delete
  to authenticated
  using (user_id = (select auth.uid()));
