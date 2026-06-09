ALTER TABLE public.setlists ADD COLUMN church_name TEXT;
COMMENT ON COLUMN public.setlists.church_name IS 'Nome da igreja à qual este repertório pertence, permitindo o compartilhamento entre membros da mesma igreja.';

-- Atualiza a política de visualização para permitir que usuários vejam setlists da sua igreja
DROP POLICY IF EXISTS "Users can view their own setlists" ON public.setlists;
CREATE POLICY "Users can view their own or church setlists" ON public.setlists
    FOR SELECT
    USING (
        auth.uid() = user_id 
        OR 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.church_name = setlists.church_name
        )
    );

-- Garante permissões
GRANT UPDATE(church_name) ON public.setlists TO authenticated;
