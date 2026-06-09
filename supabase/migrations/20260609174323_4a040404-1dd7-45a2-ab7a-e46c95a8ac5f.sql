-- Create technical categories table
CREATE TABLE public.technical_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create technical roles table
CREATE TABLE public.technical_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.technical_categories(id) ON DELETE CASCADE,
    value TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.technical_categories TO authenticated;
GRANT ALL ON public.technical_categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.technical_roles TO authenticated;
GRANT ALL ON public.technical_roles TO service_role;

-- Enable RLS
ALTER TABLE public.technical_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_roles ENABLE ROW LEVEL SECURITY;

-- Simple policies
CREATE POLICY "Anyone can read technical categories" ON public.technical_categories FOR SELECT USING (true);
CREATE POLICY "Anyone can read technical roles" ON public.technical_roles FOR SELECT USING (true);

-- Insert initial data
DO $$
DECLARE
    cat_id UUID;
BEGIN
    INSERT INTO public.technical_categories (name, sort_order) VALUES ('Equipe Técnica', 1) RETURNING id INTO cat_id;
    
    INSERT INTO public.technical_roles (category_id, value, label, sort_order) VALUES
    (cat_id, 'tecnico_som', 'Técnico de Som', 1),
    (cat_id, 'iluminacao', 'Iluminação', 2),
    (cat_id, 'telao', 'Telão', 3);
END $$;
