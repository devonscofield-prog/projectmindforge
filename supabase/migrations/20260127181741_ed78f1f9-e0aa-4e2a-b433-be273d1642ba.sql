-- Fix prospects.heat_score constraint mismatch
-- The Deal Heat scoring system uses 0-100 scale, but the old constraint limited to 1-10

-- Drop the old 1-10 constraint
ALTER TABLE public.prospects 
DROP CONSTRAINT IF EXISTS prospects_heat_score_check;

-- Add new 0-100 constraint to match Deal Heat scoring system
ALTER TABLE public.prospects 
ADD CONSTRAINT prospects_heat_score_check 
CHECK ((heat_score >= 0) AND (heat_score <= 100));