-- Drop the existing policy with the 90-day restriction
DROP POLICY IF EXISTS "Reps can view own transcripts" ON public.call_transcripts;

-- Create new policy without the date restriction
-- Reps can now view all their own calls regardless of date
CREATE POLICY "Reps can view own transcripts" 
ON public.call_transcripts 
FOR SELECT 
USING (
  auth.uid() = rep_id 
  AND deleted_at IS NULL
);