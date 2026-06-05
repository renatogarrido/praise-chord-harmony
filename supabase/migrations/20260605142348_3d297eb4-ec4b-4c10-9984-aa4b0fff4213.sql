ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS instruments text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vocal_types text[] NOT NULL DEFAULT '{}';