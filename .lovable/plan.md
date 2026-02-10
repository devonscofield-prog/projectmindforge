

# Redefine "Meaningful Conversation" for SDR Pipeline

## What Changes
The Filter agent's prompt currently requires 3-4 back-and-forth exchanges for a call to be considered "meaningful." The new definition: **any conversation where the SDR actually spoke with a prospect counts as meaningful** -- whether they declined, agreed to a meeting, or gave a quick brush-off.

## Changes

### 1. Update Filter Agent Prompt in `supabase/functions/sdr-process-transcript/index.ts` (lines 566-573)

Replace the current "meaningful" definition with:

```
## What counts as "meaningful" (is_meaningful = true):
A call is meaningful if it's a "conversation" type AND:
- The SDR actually spoke with a prospect (not a voicemail/machine)
- This includes prospects who declined, agreed to a meeting, gave a quick "not interested," or any other real human interaction
- Even a brief "no thanks" counts as meaningful -- the SDR reached a real person

NOT meaningful:
- Voicemails, hangups, internal chatter, and reminder calls
- Automated systems / IVR menus with no human contact
```

### 2. Reset and Reprocess
- Reset any currently failed/pending transcripts so they reprocess with the updated definition
- Redeploy the `sdr-process-transcript` edge function

### 3. No Frontend Changes Needed
The UI already displays "Meaningful Conversations" as a label -- the meaning just broadens. No code changes needed on the frontend.

## Impact
- More calls will be classified as meaningful and sent to the Grader for scoring
- Previously skipped "brief brush-off" calls will now get graded
- This gives SDR managers visibility into all prospect interactions, not just extended ones
