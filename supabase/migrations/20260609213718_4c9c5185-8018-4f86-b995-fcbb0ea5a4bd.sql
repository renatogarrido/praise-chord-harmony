ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS accepted_terms BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE;

-- Grant permissions (profiles table already has RLS enabled and policies)
-- The existing "Users can update own profile" policy should cover this, 
-- but let's make sure it's clear.
GRANT UPDATE (accepted_terms, terms_accepted_at) ON public.profiles TO authenticated;
