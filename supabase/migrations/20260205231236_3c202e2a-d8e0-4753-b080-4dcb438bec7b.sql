
-- Fix #1: Tighten product_knowledge RLS to admins/managers only
DROP POLICY IF EXISTS "Authenticated users can view product knowledge" ON public.product_knowledge;
CREATE POLICY "Admins and managers can view product knowledge" ON public.product_knowledge
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "Authenticated users can view product knowledge chunks" ON public.product_knowledge_chunks;
CREATE POLICY "Admins and managers can view product knowledge chunks" ON public.product_knowledge_chunks
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Fix #4: Add CHECK constraints for input length limits
ALTER TABLE public.rep_task_templates
  ADD CONSTRAINT chk_template_title_length CHECK (char_length(title) <= 200),
  ADD CONSTRAINT chk_template_description_length CHECK (char_length(description) <= 1000);

ALTER TABLE public.account_follow_ups
  ADD CONSTRAINT chk_followup_title_length CHECK (char_length(title) <= 200),
  ADD CONSTRAINT chk_followup_description_length CHECK (char_length(description) <= 2000);
