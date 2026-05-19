-- Primeiro, verificamos se a política já existe e a removemos para evitar duplicatas ou conflitos
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "view own roles" ON public.user_roles;

-- Criamos uma política clara e simples que permite a qualquer usuário autenticado ler suas próprias funções
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Garantimos que o RLS está habilitado
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
