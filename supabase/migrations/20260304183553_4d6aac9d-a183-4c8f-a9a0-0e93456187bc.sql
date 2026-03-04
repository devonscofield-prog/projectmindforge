-- Recover b4ca342f: analysis data exists, mark as completed
UPDATE call_transcripts SET analysis_status = 'completed', analysis_version = 'v2', updated_at = now() WHERE id = 'b4ca342f-97c2-4e1e-ba76-b1b368141247';

-- Recover 551846cc: no analysis data, reset to pending for re-processing
UPDATE call_transcripts SET analysis_status = 'pending', analysis_error = 'Auto-recovered from stuck processing state', updated_at = now() WHERE id = '551846cc-6550-431c-b3ba-9d5040ba4423';