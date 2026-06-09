-- Add unique constraint to name if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'technical_categories_name_key') THEN
        ALTER TABLE public.technical_categories ADD CONSTRAINT technical_categories_name_key UNIQUE (name);
    END IF;
END $$;

-- Add sort_order if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'technical_categories' AND column_name = 'sort_order') THEN
        ALTER TABLE public.technical_categories ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;
END $$;

-- Seed initial categories
INSERT INTO public.technical_categories (name, sort_order)
VALUES 
  ('Técnico de Som', 10),
  ('Iluminação', 20),
  ('Telão', 30)
ON CONFLICT (name) DO UPDATE SET sort_order = EXCLUDED.sort_order;
