-- Add RLS policies for reps to manage transcript selections, insights, and presets

-- admin_transcript_selections: Let reps manage their own selections
CREATE POLICY "Reps can manage own selections"
ON public.admin_transcript_selections FOR ALL
USING (has_role(auth.uid(), 'rep'::user_role) AND auth.uid() = admin_id)
WITH CHECK (has_role(auth.uid(), 'rep'::user_role) AND auth.uid() = admin_id);

-- Let reps view shared selections
CREATE POLICY "Reps can view shared selections"
ON public.admin_transcript_selections FOR SELECT
USING (has_role(auth.uid(), 'rep'::user_role) AND is_shared = true);

-- admin_chat_insights: Let reps manage their own insights
CREATE POLICY "Reps can manage own insights"
ON public.admin_chat_insights FOR ALL
USING (has_role(auth.uid(), 'rep'::user_role) AND auth.uid() = admin_id)
WITH CHECK (has_role(auth.uid(), 'rep'::user_role) AND auth.uid() = admin_id);

-- Let reps view shared insights
CREATE POLICY "Reps can view shared insights"
ON public.admin_chat_insights FOR SELECT
USING (has_role(auth.uid(), 'rep'::user_role) AND is_shared = true);

-- admin_custom_presets: Let reps manage their own presets
CREATE POLICY "Reps can manage own presets"
ON public.admin_custom_presets FOR ALL
USING (has_role(auth.uid(), 'rep'::user_role) AND auth.uid() = admin_id)
WITH CHECK (has_role(auth.uid(), 'rep'::user_role) AND auth.uid() = admin_id);

-- Let reps view shared presets
CREATE POLICY "Reps can view shared presets"
ON public.admin_custom_presets FOR SELECT
USING (has_role(auth.uid(), 'rep'::user_role) AND is_shared = true);