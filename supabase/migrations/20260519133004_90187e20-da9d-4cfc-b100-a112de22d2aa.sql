-- Verifica se a política já existe e a recria para garantir que está correta
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Garante que RLS está ativado
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
