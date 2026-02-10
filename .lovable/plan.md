

# Fix: Splitter Agent Response Parsing

## Problem
The Splitter agent received a valid JSON response from OpenAI, but the response used a key name that wasn't anticipated. The code only checks for `parsed.segments`, `parsed.calls`, or a top-level array. The response came back with a key called `error` (seen in: `Splitter returned unexpected structure: error`), which means the AI model likely returned something like `{"error": "..."}` or used an unexpected wrapper key.

## Root Cause
Line 407-409 in `sdr-process-transcript/index.ts`:
```
const segments = parsed.segments || parsed.calls || (Array.isArray(parsed) ? parsed : null);
if (!segments || !Array.isArray(segments)) {
  throw new Error(`Splitter returned unexpected structure: ${Object.keys(parsed).join(', ')}`);
}
```
This only handles 3 key names. If the model wraps the array in any other key, it fails.

## Fix (in `supabase/functions/sdr-process-transcript/index.ts`)

### 1. Improve Splitter response extraction (line ~407)
Instead of checking a fixed list of keys, find the first array value in the parsed response:
```typescript
let segments: any[] | null = null;
if (Array.isArray(parsed)) {
  segments = parsed;
} else {
  // Try known keys first, then fall back to first array found
  for (const key of ['segments', 'calls', 'data', 'results']) {
    if (Array.isArray(parsed[key])) { segments = parsed[key]; break; }
  }
  if (!segments) {
    // Last resort: find any array value in the object
    for (const val of Object.values(parsed)) {
      if (Array.isArray(val) && val.length > 0) { segments = val as any[]; break; }
    }
  }
}
```

### 2. Add diagnostic logging before the error throw
Log the actual content returned so future debugging is easier:
```typescript
if (!segments) {
  console.error(`[sdr-pipeline] Splitter raw content: ${content.slice(0, 500)}`);
  throw new Error(...);
}
```

### 3. Apply the same fix to the Filter agent response parsing
The Filter agent (around line ~480) has the same rigid key-checking pattern and should get the same resilient extraction logic.

### 4. Reset the stuck transcript
Run SQL to set transcript `27214287-05fd-4112-8167-e67664b94078` back to `pending` so it can be reprocessed after deploying the fix.

## No other changes
- Prompts, model, timeouts, and retry logic stay the same
- Only the response parsing becomes more resilient
