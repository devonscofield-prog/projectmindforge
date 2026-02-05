-- Create storage bucket for roleplay recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('roleplay-recordings', 'roleplay-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own recordings
CREATE POLICY "Users can upload their own recordings"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'roleplay-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to read their own recordings
CREATE POLICY "Users can read their own recordings"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'roleplay-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow admins/managers to read all recordings (via service role, no additional policy needed)
