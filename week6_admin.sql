-- Week 6 database changes for CATCAPTION Admin.
alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_superadmin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_superadmin() from public;
grant execute on function public.is_superadmin() to authenticated;

drop policy if exists "superadmins can read all profiles" on public.profiles;
create policy "superadmins can read all profiles"
on public.profiles for select to authenticated
using (public.is_superadmin());

drop policy if exists "superadmins can create captions" on public.captions;
create policy "superadmins can create captions"
on public.captions for insert to authenticated
with check (public.is_superadmin());

drop policy if exists "superadmins can update captions" on public.captions;
create policy "superadmins can update captions"
on public.captions for update to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

drop policy if exists "superadmins can delete captions" on public.captions;
create policy "superadmins can delete captions"
on public.captions for delete to authenticated
using (public.is_superadmin());

drop policy if exists "superadmins can read votes" on public.votes;
create policy "superadmins can read votes"
on public.votes for select to authenticated
using (public.is_superadmin());

insert into public.profiles (id, is_superadmin)
select id, true
from auth.users
where email = 'bl3182@barnard.edu'
on conflict (id) do update set is_superadmin = true;
