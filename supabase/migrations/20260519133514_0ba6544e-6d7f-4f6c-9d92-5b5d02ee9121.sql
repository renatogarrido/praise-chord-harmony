-- Drop existing policies if they might conflict
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Create a robust policy for users to see their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Ensure RLS is enabled
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
