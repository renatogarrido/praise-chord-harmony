-- First, let's make sure the role is correct for the user
UPDATE public.user_roles 
SET role = 'admin' 
WHERE user_id = '63aa47a7-5f67-4258-b5dc-88e101a7926e';

-- Drop existing policies that might be causing recursion or access issues
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin manage roles" ON public.user_roles;

-- Create a clean and simple policy for reading roles
-- This policy allows any authenticated user to read their own role
CREATE POLICY "user_roles_read_own" 
ON public.user_roles 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Create a policy for admins to manage all roles
-- We'll use a slightly different approach to avoid recursion if needed, 
-- but for SELECT the one above is most important for the user to see their own status.
CREATE POLICY "user_roles_admin_all" 
ON public.user_roles 
FOR ALL 
TO authenticated 
USING (
  (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'admin'
);
