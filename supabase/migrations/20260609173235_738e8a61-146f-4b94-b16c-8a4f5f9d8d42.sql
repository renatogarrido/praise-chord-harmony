-- Criar função para updated_at se não existir
CREATE OR REPLACE FUNCTION public.update_updated_at_column() 
RETURNS TRIGGER AS $$ 
BEGIN 
  NEW.updated_at = now(); 
  RETURN NEW; 
END; 
$$ LANGUAGE plpgsql SET search_path = public;

-- Inserir categorias técnicas se não existirem
INSERT INTO public.instrument_categories (name)
SELECT name FROM (
  VALUES ('Som'), ('Iluminação'), ('Telão')
) AS t(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.instrument_categories WHERE name = t.name
);

-- Criar tabela para atribuições da equipe técnica
CREATE TABLE IF NOT EXISTS public.technical_team_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worship_schedule_id UUID NOT NULL REFERENCES public.worship_schedules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.instrument_categories(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(worship_schedule_id, user_id, category_id)
);

-- Habilitar RLS
ALTER TABLE public.technical_team_assignments ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.technical_team_assignments TO authenticated;
GRANT ALL ON public.technical_team_assignments TO service_role;

-- Políticas
CREATE POLICY "Users can view technical team assignments" 
ON public.technical_team_assignments FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Admins and leaders can manage technical team assignments" 
ON public.technical_team_assignments FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'lider_nacional', 'lider_estadual', 'lider_local')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'lider_nacional', 'lider_estadual', 'lider_local')
  )
);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_technical_team_assignments_updated_at ON public.technical_team_assignments;
CREATE TRIGGER update_technical_team_assignments_updated_at 
BEFORE UPDATE ON public.technical_team_assignments 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();