-- Add missing FK constraints and RLS policies for SDR tables.

-- 1. Add FK constraint: sdr_daily_transcripts.uploaded_by → profiles(id)
ALTER TABLE public.sdr_daily_transcripts
  ADD CONSTRAINT sdr_daily_transcripts_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id);

-- 2. Add FK constraint: sdr_coaching_prompts.created_by → profiles(id)
ALTER TABLE public.sdr_coaching_prompts
  ADD CONSTRAINT sdr_coaching_prompts_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id);

-- 3. Add UPDATE/DELETE RLS policies for SDRs on their own transcripts.
--    SDRs can already SELECT and INSERT (from original migration) but
--    cannot update or delete their own transcripts.

CREATE POLICY "SDRs can update own transcripts"
  ON public.sdr_daily_transcripts FOR UPDATE
  USING (sdr_id = auth.uid())
  WITH CHECK (sdr_id = auth.uid());

CREATE POLICY "SDRs can delete own transcripts"
  ON public.sdr_daily_transcripts FOR DELETE
  USING (sdr_id = auth.uid());
