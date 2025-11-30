-- Add last_seen_at column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN last_seen_at timestamp with time zone DEFAULT now();

-- Update existing profiles to have a last_seen_at value
UPDATE public.profiles SET last_seen_at = updated_at WHERE last_seen_at IS NULL;