-- Add website column to prospects table
ALTER TABLE public.prospects
ADD COLUMN website text;

-- Add a comment for documentation
COMMENT ON COLUMN public.prospects.website IS 'Company website URL for account research';