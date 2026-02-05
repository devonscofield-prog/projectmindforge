
# Comprehensive Edge Function Diagnostic & Fix Plan

## Problem Identified

Your app has multiple edge functions failing with `Bundle generation timed out` errors. This is because many functions are using outdated import specifiers (`https://esm.sh/...` and `https://deno.land/x/...`) that cause slow dependency resolution during deployment.

We already fixed this for `roleplay-session-manager` and `sales-coach-chat` - the same fix is needed across all other edge functions.

## Affected Edge Functions

After auditing the codebase, here are all functions that need their imports updated:

| Function | Current Imports | Status |
|----------|-----------------|--------|
| `analyze-call/index.ts` | `esm.sh/@supabase/supabase-js@2` | Needs fix |
| `admin-transcript-chat/index.ts` | `esm.sh/@supabase/supabase-js@2` | Needs fix |
| `reanalyze-call/index.ts` | `esm.sh/@supabase/supabase-js@2` | Needs fix |
| `calculate-deal-heat/index.ts` | `esm.sh/@supabase/supabase-js@2` | Needs fix |
| `chunk-transcripts/index.ts` | `esm.sh/@supabase/supabase-js@2`, `deno.land/x/zod` | Needs fix |
| `generate-call-follow-up-suggestions/index.ts` | `esm.sh/@supabase/supabase-js@2` | Needs fix |
| `submit-call-transcript/index.ts` | `esm.sh/@supabase/supabase-js@2` | Needs fix |
| `sales-assistant-chat/index.ts` | `esm.sh/@supabase/supabase-js@2`, `deno.land/x/zod` | Needs fix |
| `_shared/pipeline.ts` | `esm.sh/@supabase/supabase-js@2` | Needs fix |
| `_shared/agent-factory.ts` | `deno.land/x/zod`, `esm.sh/@supabase/supabase-js@2` | Needs fix |

## Root Cause

The `esm.sh` and `deno.land/x` registries can be slow/unreliable, causing Supabase's bundler to timeout during deployment. The `npm:` specifier is more efficient because it uses Deno's built-in npm compatibility layer.

## Solution

Update all import statements from:
```typescript
// Old (slow, unreliable)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
```

To:
```typescript
// New (fast, stable)
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
```

## Implementation Plan

### Phase 1: Core Analysis Pipeline (Highest Priority)
Fix the call analysis flow that's currently broken:

1. **`analyze-call/index.ts`** - Update Supabase import
2. **`_shared/pipeline.ts`** - Update Supabase import  
3. **`_shared/agent-factory.ts`** - Update Supabase and Zod imports
4. **`reanalyze-call/index.ts`** - Update Supabase import
5. **`calculate-deal-heat/index.ts`** - Update Supabase import
6. **`generate-call-follow-up-suggestions/index.ts`** - Update Supabase import

### Phase 2: Secondary Functions
Fix remaining user-facing features:

7. **`admin-transcript-chat/index.ts`** - Update Supabase import
8. **`chunk-transcripts/index.ts`** - Update Supabase and Zod imports
9. **`submit-call-transcript/index.ts`** - Update Supabase import
10. **`sales-assistant-chat/index.ts`** - Update Supabase and Zod imports

### Phase 3: Deploy All Functions
After updating imports, deploy all affected functions to ensure they're using the new efficient imports.

## Technical Details

### Import Changes Summary

For each file, the change is simple - replacing the import URLs:

```text
Before: import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
After:  import { createClient } from "npm:@supabase/supabase-js@2";

Before: import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
After:  import { z } from "npm:zod@3.23.8";

Before: import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
After:  import { SupabaseClient } from "npm:@supabase/supabase-js@2";
```

### Expected Outcome
- All edge functions will deploy successfully without timeout errors
- Call analysis will work again
- Transcript chat will work again
- Follow-up suggestions will generate properly

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/analyze-call/index.ts` | Line 13: Update import |
| `supabase/functions/_shared/pipeline.ts` | Line 17: Update import |
| `supabase/functions/_shared/agent-factory.ts` | Lines 7-8: Update both imports |
| `supabase/functions/reanalyze-call/index.ts` | Line 1: Update import |
| `supabase/functions/calculate-deal-heat/index.ts` | Line 1: Update import |
| `supabase/functions/generate-call-follow-up-suggestions/index.ts` | Line 9: Update import |
| `supabase/functions/admin-transcript-chat/index.ts` | Line 1: Update import |
| `supabase/functions/chunk-transcripts/index.ts` | Lines 1-2: Update both imports |
| `supabase/functions/submit-call-transcript/index.ts` | Line 1: Update import |
| `supabase/functions/sales-assistant-chat/index.ts` | Lines 1-2: Update both imports |
