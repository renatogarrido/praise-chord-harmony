
-- Helpers for church/estadual scoping
create or replace function public.user_church_name(_uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select church_name from public.profiles where id = _uid
$$;

create or replace function public.user_estadual(_uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select c.estadual
  from public.profiles p
  join public.churches c on c.name = p.church_name
  where p.id = _uid
  limit 1
$$;

create or replace function public.can_view_schedule(_uid uuid, _church text)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.has_role(_uid, 'admin'::public.app_role) or
    public.has_role(_uid, 'lider_nacional'::public.app_role) or
    (public.has_role(_uid, 'lider_estadual'::public.app_role)
       and _church is not null
       and exists (
         select 1 from public.churches c
         where c.name = _church
           and c.estadual is not distinct from public.user_estadual(_uid)
       ))
    or (_church is not distinct from public.user_church_name(_uid))
$$;

create or replace function public.can_manage_schedule_church(_uid uuid, _church text)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.has_role(_uid, 'admin'::public.app_role) or
    public.has_role(_uid, 'lider_nacional'::public.app_role) or
    (public.has_role(_uid, 'lider_estadual'::public.app_role)
       and _church is not null
       and exists (
         select 1 from public.churches c
         where c.name = _church
           and c.estadual is not distinct from public.user_estadual(_uid)
       ))
    or (public.has_role(_uid, 'lider_local'::public.app_role)
        and _church is not null
        and _church is not distinct from public.user_church_name(_uid))
$$;

-- worship_schedules
drop policy if exists "manage schedules" on public.worship_schedules;
drop policy if exists "view schedules" on public.worship_schedules;

create policy "view schedules scoped" on public.worship_schedules
for select to authenticated
using (public.can_view_schedule(auth.uid(), church_name));

create policy "manage schedules scoped" on public.worship_schedules
for all to authenticated
using (public.can_manage_schedule_church(auth.uid(), church_name))
with check (public.can_manage_schedule_church(auth.uid(), church_name));

-- worship_schedule_assignments
drop policy if exists "view assignments" on public.worship_schedule_assignments;
drop policy if exists "manage assignments" on public.worship_schedule_assignments;

create policy "view assignments scoped" on public.worship_schedule_assignments
for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.worship_schedules s
    where s.id = schedule_id
      and public.can_view_schedule(auth.uid(), s.church_name)
  )
);

create policy "manage assignments scoped" on public.worship_schedule_assignments
for all to authenticated
using (
  exists (
    select 1 from public.worship_schedules s
    where s.id = schedule_id
      and public.can_manage_schedule_church(auth.uid(), s.church_name)
  )
)
with check (
  exists (
    select 1 from public.worship_schedules s
    where s.id = schedule_id
      and public.can_manage_schedule_church(auth.uid(), s.church_name)
  )
);

-- monthly_availability: managers read scoped by church/estadual
drop policy if exists "managers read availability" on public.monthly_availability;

create policy "managers read availability scoped" on public.monthly_availability
for select to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'lider_nacional'::public.app_role)
  or exists (
    select 1 from public.profiles p
    where p.id = monthly_availability.user_id
      and (
        (public.has_role(auth.uid(), 'lider_estadual'::public.app_role)
          and exists (
            select 1 from public.churches c
            where c.name = p.church_name
              and c.estadual is not distinct from public.user_estadual(auth.uid())
          ))
        or (public.has_role(auth.uid(), 'lider_local'::public.app_role)
            and p.church_name is not distinct from public.user_church_name(auth.uid()))
      )
  )
);
