

# Fix Splitter Chunk Label Confusing the AI Model

## Problem
When a transcript is split into 2 chunks, the user message sent to the AI includes "(chunk 1/2)" which causes the model to refuse processing -- it thinks it needs chunk 2/2 to do its job. The model returned:
```
"error": "Chunked transcript received (1/2). Please provide chunk 2/2..."
```

## Solution
Modify the user message in `runSplitterOnChunk` to NOT tell the model it's receiving a partial chunk. Instead, present each chunk as a standalone section of the transcript. This way the model processes whatever text it receives without worrying about missing parts.

## Changes

### 1. Update user prompt in `supabase/functions/sdr-process-transcript/index.ts`
- **Line 452**: Change the user message from:
  `"Here is the full-day SDR dialer transcript (chunk 1/2). Split it into individual segments:"`
  to something like:
  `"Here is a section of an SDR dialer transcript. Split it into individual call segments:"`
- The chunk label will still be used in internal logging (line 458, agentName) but removed from the prompt the model sees
- Keep the `chunkLabel` variable for logging purposes only

### 2. Reset the failed transcript
- Set transcript `3fdfa46b-4cc9-4507-888a-d2d7e6324ad9` back to `pending` status so it reprocesses with the fixed prompt

### 3. Deploy
- Redeploy the `sdr-process-transcript` edge function

## Expected Result
Each chunk will be presented to the model as an independent transcript section. The model will split it into segments without complaining about missing parts. The deduplication logic already handles merging overlapping results across chunks.

