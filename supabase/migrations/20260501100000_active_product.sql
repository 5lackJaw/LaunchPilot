alter table public.users
  add column if not exists current_product_id uuid references public.products(id) on delete set null;

create index if not exists users_current_product_id_idx
  on public.users (current_product_id);

create or replace function public.validate_current_product_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.current_product_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.products
    where products.id = new.current_product_id
      and products.user_id = new.id
  ) then
    raise exception 'current_product_id must belong to the same user';
  end if;

  return new;
end;
$$;

drop trigger if exists users_validate_current_product_owner on public.users;
create trigger users_validate_current_product_owner
  before insert or update of current_product_id on public.users
  for each row
  execute function public.validate_current_product_owner();
