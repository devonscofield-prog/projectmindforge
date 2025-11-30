-- Add DELETE policy for managers to delete their own coaching sessions
CREATE POLICY "Managers can delete own coaching sessions"
ON public.coaching_sessions
FOR DELETE
TO authenticated
USING (auth.uid() = manager_id);