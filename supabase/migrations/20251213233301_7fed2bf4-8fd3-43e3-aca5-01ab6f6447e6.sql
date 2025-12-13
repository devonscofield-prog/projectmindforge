-- Add opportunity_link column to prospects table
ALTER TABLE public.prospects 
ADD COLUMN opportunity_link TEXT NULL;