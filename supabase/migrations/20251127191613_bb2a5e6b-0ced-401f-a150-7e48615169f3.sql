-- Add foreign key constraints to call_transcripts
ALTER TABLE public.call_transcripts 
  ADD CONSTRAINT fk_call_transcripts_rep_id 
  FOREIGN KEY (rep_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.call_transcripts 
  ADD CONSTRAINT fk_call_transcripts_manager_id 
  FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add foreign key constraints to ai_call_analysis
ALTER TABLE public.ai_call_analysis 
  ADD CONSTRAINT fk_ai_call_analysis_call_id 
  FOREIGN KEY (call_id) REFERENCES public.call_transcripts(id) ON DELETE CASCADE;

ALTER TABLE public.ai_call_analysis 
  ADD CONSTRAINT fk_ai_call_analysis_rep_id 
  FOREIGN KEY (rep_id) REFERENCES public.profiles(id) ON DELETE CASCADE;