-- Ensure the table has the correct permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.technical_categories TO authenticated;
GRANT ALL ON public.technical_categories TO service_role;

-- Enable RLS if not already enabled
ALTER TABLE public.technical_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Allow admins and leaders to manage technical categories" ON public.technical_categories;

-- Create a policy that allows authenticated users with management roles to perform all actions
CREATE POLICY "Allow admins and leaders to manage technical categories" 
ON public.technical_categories 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'lider_nacional', 'lider_estadual', 'lider_local')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'lider_nacional', 'lider_estadual', 'lider_local')
  )
);

-- Also allow all authenticated users to view categories
DROP POLICY IF EXISTS "Allow all authenticated users to view technical categories" ON public.technical_categories;
CREATE POLICY "Allow all authenticated users to view technical categories" 
ON public.technical_categories 
FOR SELECT 
TO authenticated 
USING (true);
