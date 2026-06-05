-- Drop policies that depend on profiles.role
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Recreate the self-update policy without role guard (role now lives only in user_roles)
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Update handle_new_user to stop writing to profiles.role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles(id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );

  INSERT INTO public.user_roles(user_id, role)
  VALUES (NEW.id, 'user'::public.app_role);

  RETURN NEW;
END;
$function$;

-- Drop the redundant role column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;