

# Audio Upload Failure: Root Cause Analysis

## Summary

There are **two issues** preventing audio uploads:

1. **Missing storage INSERT policy** — The `call-audio` storage bucket has no RLS policy allowing users to upload files. SELECT and DELETE policies exist, but no INSERT policy. When the client-side code tries to upload via XHR to `/storage/v1/object/call-audio/...`, the request is silently rejected by RLS. This is why no edge function logs appear — the upload fails before `process-audio-upload` is ever called.

2. **Missing `updated_at` column on `ai_call_analysis`** — The Postgres logs show `column ai_call_analysis.updated_at does not exist`. The `getAudioAnalysis()` function in `src/api/audioAnalysis.ts` selects this column (line 201). This would cause errors when trying to retrieve analysis results later, but is secondary to the upload failure.

## Fix

### Step 1: Add storage INSERT policy for `call-audio` bucket
Create an RLS policy allowing authenticated users to upload files to their own folder (`user_id/` prefix):

```sql
CREATE POLICY "Users can upload own call audio"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'call-audio'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
```

### Step 2: Add `updated_at` column to `ai_call_analysis`
```sql
ALTER TABLE public.ai_call_analysis
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
```

### Step 3: Add UPDATE policy for `call-audio` (needed for overwrites)
```sql
CREATE POLICY "Users can update own call audio"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'call-audio'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
```

## Why No Error Was Visible

The client-side `uploadAudioFile()` function uses XHR to upload directly to storage. When storage RLS rejects the upload, it returns a 400/403 which the XHR error handler catches with a generic "Storage upload failed" message. The toast from the mutation hook shows "Failed to upload audio" but without clear indication that it's a permissions issue. The edge functions themselves never fire because the upload never succeeds.

## Files Modified
- One database migration (storage policies + `updated_at` column)
- No code changes needed

