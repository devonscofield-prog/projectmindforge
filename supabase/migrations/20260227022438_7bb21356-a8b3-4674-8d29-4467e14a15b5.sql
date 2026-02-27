
-- Recreate INSERT policy for call-audio
DROP POLICY IF EXISTS "Users can upload own call audio" ON storage.objects;
CREATE POLICY "Users can upload own call audio"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'call-audio'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Create UPDATE policy for call-audio
DROP POLICY IF EXISTS "Users can update own call audio" ON storage.objects;
CREATE POLICY "Users can update own call audio"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'call-audio'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Add missing updated_at column to ai_call_analysis
ALTER TABLE public.ai_call_analysis
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
