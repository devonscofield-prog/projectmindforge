-- Add UPDATE policy for reps to update their own analysis records
CREATE POLICY "Reps can update own analysis" 
ON public.ai_call_analysis 
FOR UPDATE 
USING (auth.uid() = rep_id AND deleted_at IS NULL)
WITH CHECK (auth.uid() = rep_id);

-- Add UPDATE policy for managers to update team analysis records
CREATE POLICY "Managers can update team analysis" 
ON public.ai_call_analysis 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'manager'::user_role) 
  AND is_manager_of_user(auth.uid(), rep_id) 
  AND deleted_at IS NULL
)
WITH CHECK (
  has_role(auth.uid(), 'manager'::user_role) 
  AND is_manager_of_user(auth.uid(), rep_id)
);

-- Add UPDATE policy for admins
CREATE POLICY "Admins can update all analysis" 
ON public.ai_call_analysis 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));