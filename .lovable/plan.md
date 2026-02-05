
# Fix: Mass Edge Function Deployment Failure

## Problem
Almost ALL edge functions (41 of 43) are returning 404 (not deployed). Only `trigger-pending-analyses` and `roleplay-session-manager` survived the recent bulk import standardization changes. This means core features like call submission, analysis, coaching, admin operations, and more are completely broken for all users.

Ben Martin's error was caused by hitting one of these undeployed functions.

## Root Cause
The recent batch edit that standardized imports across 44+ files triggered a mass redeployment. The bundler timed out trying to process all functions simultaneously, leaving most functions undeployed.

## Fix: Force Redeploy All Functions

The code is correct -- bare imports match the centralized `deno.json` import map. The functions just need to be redeployed. This will be done in batches to avoid overwhelming the bundler:

### Batch 1 -- Critical User-Facing Functions
`submit-call-transcript`, `analyze-call`, `seed-demo-data`, `reanalyze-call`, `bulk-upload-transcripts`

### Batch 2 -- AI/Analysis Functions
`sales-coach-chat`, `sales-assistant-chat`, `admin-transcript-chat`, `chunk-transcripts`, `generate-call-follow-up-suggestions`

### Batch 3 -- Account & Coaching Functions
`account-research`, `competitor-research`, `generate-account-follow-ups`, `regenerate-account-insights`, `calculate-deal-heat`, `calculate-account-heat`

### Batch 4 -- Coaching & Training
`generate-coaching-trends`, `generate-coaching-chunk-summary`, `generate-aggregate-coaching-trends`, `roleplay-grade-session`, `roleplay-abandon-session`, `generate-agreed-next-steps`

### Batch 5 -- Admin & Auth Functions
`invite-user`, `delete-user`, `reset-user-password`, `admin-reset-mfa`, `reset-database`, `reset-test-passwords`, `set-user-password`

### Batch 6 -- Password Reset & Performance
`generate-password-reset-otp`, `verify-password-reset-otp`, `complete-password-reset`, `check-performance-alerts`, `send-performance-alert`, `analyze-performance`

### Batch 7 -- Remaining Functions
`edit-recap-email`, `generate-sales-assets`, `scrape-product-knowledge`, `process-product-knowledge`, `upload-product-knowledge`, `send-task-reminders`, `cleanup-stuck-sessions`

## Secondary Fix: Update CORS Headers

All 41 functions use the old short CORS `Access-Control-Allow-Headers` list. The Supabase client now sends additional headers that should be allowed. Each function's CORS headers will be updated to include the expanded set:

```
authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version
```

This will be done during the redeploy by making a small touch-edit to each function's CORS headers.

## Verification
After each batch deploys, the function will be tested with a curl call to confirm it responds (even if with 401/400 -- anything other than 404 means it's deployed).

## Files Modified
All 41 edge function `index.ts` files will have their CORS headers updated. No logic changes.
