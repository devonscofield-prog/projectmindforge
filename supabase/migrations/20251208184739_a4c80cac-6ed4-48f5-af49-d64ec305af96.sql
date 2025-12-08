-- Enhancement 5: Add dedicated detected_call_type column to ai_call_analysis
-- This enables easy filtering like "Show all reconnect calls"

ALTER TABLE public.ai_call_analysis
ADD COLUMN IF NOT EXISTS detected_call_type TEXT;

-- Create index for filtering by call type
CREATE INDEX IF NOT EXISTS idx_ai_call_analysis_detected_call_type 
ON public.ai_call_analysis(detected_call_type) 
WHERE detected_call_type IS NOT NULL;