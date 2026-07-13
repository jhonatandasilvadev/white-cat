create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists username text;

create table if not exists public.finance_months (
  user_id uuid not null references public.profiles(id) on delete cascade,
  year integer not null check (year between 2000 and 2200),
  month integer not null check (month between 1 and 12),
  salary numeric(14,2) not null default 0,
  expenses jsonb not null default '[]'::jsonb check (jsonb_typeof(expenses) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (user_id, year, month)
);

create index if not exists finance_months_user_id_idx on public.finance_months(user_id);
create index if not exists finance_months_period_idx on public.finance_months(year, month);
with duplicate_usernames as (
  select id, username,
    row_number() over (partition by lower(trim(username)) order by created_at, id) as occurrence
  from public.profiles
  where username is not null and trim(username) <> ''
)
update public.profiles as profile
set username = profile.username || '_' || left(profile.id::text, 8)
from duplicate_usernames
where profile.id = duplicate_usernames.id and duplicate_usernames.occurrence > 1;
create unique index if not exists profiles_username_unique_idx
on public.profiles (lower(username))
where username is not null and trim(username) <> '';

update public.profiles
set username = username || '_' || left(id::text, 8)
where lower(trim(coalesce(username, ''))) = 'john'
  and lower(coalesce(email, '')) <> 'jhonatandasilva.dev@gmail.com';

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, role)
  values (
    new.id,
    coalesce(new.email, ''),
    case
      when lower(coalesce(new.email, '')) = 'jhonatandasilva.dev@gmail.com' then 'john'
      else coalesce(nullif(trim(new.raw_user_meta_data ->> 'username'), ''), split_part(coalesce(new.email, 'usuario'), '@', 1))
    end,
    case
      when lower(coalesce(new.email, '')) = 'jhonatandasilva.dev@gmail.com' then 'admin'
      else 'user'
    end
  )
  on conflict (id) do update
  set email = excluded.email,
      username = case
        when excluded.role = 'admin' then 'john'
        else coalesce(nullif(excluded.username, ''), public.profiles.username)
      end,
      role = excluded.role;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, email, username, role)
select
  id,
  coalesce(email, ''),
  case
    when lower(coalesce(email, '')) = 'jhonatandasilva.dev@gmail.com' then 'john'
    else coalesce(nullif(trim(raw_user_meta_data ->> 'username'), ''), split_part(coalesce(email, 'usuario'), '@', 1))
  end,
  case
    when lower(coalesce(email, '')) = 'jhonatandasilva.dev@gmail.com' then 'admin'
    else 'user'
  end
from auth.users
on conflict (id) do update
set email = excluded.email,
    username = case
      when excluded.role = 'admin' then 'john'
      else coalesce(nullif(excluded.username, ''), public.profiles.username)
    end,
    role = excluded.role;

alter table public.profiles enable row level security;
alter table public.finance_months enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select private.is_admin()));

drop policy if exists "finance_select_own_or_admin" on public.finance_months;
create policy "finance_select_own_or_admin"
on public.finance_months for select to authenticated
using ((select auth.uid()) = user_id or (select private.is_admin()));

drop policy if exists "finance_insert_own" on public.finance_months;
create policy "finance_insert_own"
on public.finance_months for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "finance_update_own" on public.finance_months;
create policy "finance_update_own"
on public.finance_months for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "finance_delete_own" on public.finance_months;
create policy "finance_delete_own"
on public.finance_months for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.profiles from anon;
revoke all on public.finance_months from anon;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.finance_months to authenticated;
revoke all on schema private from public;
revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;
