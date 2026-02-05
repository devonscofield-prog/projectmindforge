
# Fix "Failed to Create Task" Error

## Root Cause

The database has a check constraint on the `account_follow_ups` table that only allows these category values:
- `discovery`, `stakeholder`, `objection`, `proposal`, `relationship`, `competitive`

But the custom task creation dialog sends these newer categories:
- `phone_call`, `drip_email`, `text_message`, `follow_up_email`

The database rejects the insert, causing the "Failed to Create Task" error.

## Fix

Update the database check constraint to include all valid categories (both AI-generated and manual task categories).

### Database Migration
Drop the old constraint and create a new one that accepts all category values:

```sql
ALTER TABLE account_follow_ups DROP CONSTRAINT account_follow_ups_category_check;
ALTER TABLE account_follow_ups ADD CONSTRAINT account_follow_ups_category_check 
  CHECK (category = ANY (ARRAY[
    'discovery', 'stakeholder', 'objection', 'proposal', 
    'relationship', 'competitive',
    'phone_call', 'drip_email', 'text_message', 'follow_up_email'
  ]));
```

## Secondary Fix: Build Error

There is also a build error with `npm:zod@3.23.8` in `_shared/agent-factory.ts`. This needs to be reverted to use the `https://deno.land/x/zod` import or use a `deno.json` with the dependency listed. The simplest fix is to revert to the URL import for zod in edge functions since the `npm:` specifier requires additional Deno configuration.

### Files to modify:
- `supabase/functions/_shared/agent-factory.ts` -- revert zod import to URL-based
- `supabase/functions/chunk-transcripts/index.ts` -- revert zod import to URL-based  
- `supabase/functions/sales-assistant-chat/index.ts` -- revert zod import to URL-based
- `supabase/functions/sales-coach-chat/index.ts` -- revert zod import to URL-based

The zod imports should use:
```typescript
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
```

Note: The `npm:` specifier works for `@supabase/supabase-js` but not for `zod` without a `deno.json` configuration. The URL-based import for zod is reliable and does not cause timeout issues.
