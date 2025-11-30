-- Add manager RLS policies for admin_transcript_selections
CREATE POLICY "Managers can manage own selections"
ON public.admin_transcript_selections
FOR ALL
USING (has_role(auth.uid(), 'manager'::user_role) AND auth.uid() = admin_id)
WITH CHECK (has_role(auth.uid(), 'manager'::user_role) AND auth.uid() = admin_id);

CREATE POLICY "Managers can view shared selections"
ON public.admin_transcript_selections
FOR SELECT
USING (has_role(auth.uid(), 'manager'::user_role) AND is_shared = true);

-- Add manager RLS policies for admin_chat_insights
CREATE POLICY "Managers can manage own insights"
ON public.admin_chat_insights
FOR ALL
USING (has_role(auth.uid(), 'manager'::user_role) AND auth.uid() = admin_id)
WITH CHECK (has_role(auth.uid(), 'manager'::user_role) AND auth.uid() = admin_id);

CREATE POLICY "Managers can view shared insights"
ON public.admin_chat_insights
FOR SELECT
USING (has_role(auth.uid(), 'manager'::user_role) AND is_shared = true);

-- Add manager RLS policies for admin_custom_presets
CREATE POLICY "Managers can manage own presets"
ON public.admin_custom_presets
FOR ALL
USING (has_role(auth.uid(), 'manager'::user_role) AND auth.uid() = admin_id)
WITH CHECK (has_role(auth.uid(), 'manager'::user_role) AND auth.uid() = admin_id);

CREATE POLICY "Managers can view shared presets"
ON public.admin_custom_presets
FOR SELECT
USING (has_role(auth.uid(), 'manager'::user_role) AND is_shared = true);