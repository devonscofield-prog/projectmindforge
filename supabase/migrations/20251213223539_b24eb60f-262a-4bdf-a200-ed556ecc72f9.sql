-- Remove unique constraint on (user_id, prospect_id) to allow multiple sessions per prospect
ALTER TABLE public.sales_coach_sessions DROP CONSTRAINT IF EXISTS sales_coach_sessions_user_id_prospect_id_key;

-- Add new columns for multi-session support
ALTER TABLE public.sales_coach_sessions 
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Set initial titles for existing sessions
UPDATE public.sales_coach_sessions 
SET title = 'Conversation from ' || to_char(created_at, 'Mon DD, YYYY')
WHERE title IS NULL;

-- Create index for efficient querying of active sessions
CREATE INDEX IF NOT EXISTS idx_sales_coach_sessions_user_prospect_active 
ON public.sales_coach_sessions(user_id, prospect_id, is_active);