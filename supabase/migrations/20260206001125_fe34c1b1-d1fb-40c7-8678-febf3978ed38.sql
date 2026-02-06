-- Allow managers to view task templates of reps on their team
CREATE POLICY "Managers can view team rep templates"
ON public.rep_task_templates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN teams t ON p.team_id = t.id
    WHERE p.id = rep_task_templates.rep_id
      AND t.manager_id = auth.uid()
  )
);

-- Also allow managers to view template settings for their team reps
CREATE POLICY "Managers can view team rep template settings"
ON public.rep_task_template_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN teams t ON p.team_id = t.id
    WHERE p.id = rep_task_template_settings.rep_id
      AND t.manager_id = auth.uid()
  )
);