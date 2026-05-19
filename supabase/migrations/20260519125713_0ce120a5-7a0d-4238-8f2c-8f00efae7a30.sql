-- Add a unique constraint to ensure a user has only one history entry per song
-- This allows us to use upsert and keep the history clean (only most recent access)
ALTER TABLE public.access_history 
ADD CONSTRAINT access_history_user_song_unique UNIQUE (user_id, song_id);