CREATE OR REPLACE FUNCTION public.can_view_schedule(_uid uuid, _church text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    or (
      _church is not null
      and _church is not distinct from public.user_church_name(_uid)
    )
$function$;