-- Recover Bram's stuck call
UPDATE call_transcripts 
SET analysis_status = 'pending', 
    analysis_error = 'Auto-recovered: Edge Function killed during long Interrogator timeout (120s blocked Batch 2a)',
    updated_at = now()
WHERE id = '5d4c50b1-4faf-4707-a4e0-675e6ecfb590' 
  AND analysis_status = 'processing';