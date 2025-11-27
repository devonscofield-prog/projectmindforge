-- Add DELETE policy for admins on ai_call_analysis
CREATE POLICY "Admins can delete analysis"
ON public.ai_call_analysis
FOR DELETE
USING (has_role(auth.uid(), 'admin'::user_role));