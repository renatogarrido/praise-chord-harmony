-- Ensure 'role' column exists in profiles
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE public.profiles ADD COLUMN role public.app_role DEFAULT 'user';
    END IF;
END $$;

-- Update profiles with existing roles from user_roles
UPDATE public.profiles p
SET role = ur.role
FROM public.user_roles ur
WHERE p.id = ur.user_id;

-- Update handle_new_user function to be more robust and handle specific admin emails
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  is_admin_email BOOLEAN;
BEGIN
  -- Check if email is one of the designated admin emails
  is_admin_email := (NEW.email IN ('renato.garrido@corecodeweb.com.br', 'renato.garrido@corecodesolutions.com.br'));

  -- Insert into profiles with role
  INSERT INTO public.profiles(id, full_name, role)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    CASE WHEN is_admin_email THEN 'admin'::public.app_role ELSE 'user'::public.app_role END
  );

  -- Insert into user_roles
  INSERT INTO public.user_roles(user_id, role) 
  VALUES (
    NEW.id, 
    CASE WHEN is_admin_email THEN 'admin'::public.app_role ELSE 'user'::public.app_role END
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "user_roles_read_own" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create clear, simple policies for user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can do everything on user_roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create clear, simple policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Ensure the specific user is admin in both tables RIGHT NOW
UPDATE public.user_roles SET role = 'admin' WHERE user_id = '63aa47a7-5f67-4258-b5dc-88e101a7926e';
UPDATE public.profiles SET role = 'admin' WHERE id = '63aa47a7-5f67-4258-b5dc-88e101a7926e';

-- Also insert if not exists (just in case)
INSERT INTO public.user_roles (user_id, role)
SELECT '63aa47a7-5f67-4258-b5dc-88e101a7926e', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = '63aa47a7-5f67-4258-b5dc-88e101a7926e');
