

# Change "Recap & Follow-up Email" to "Generate Call Notes" Only

## Overview

The current button generates both a recap email AND internal CRM notes. Since users don't use the email feature (they use the Sales Coach instead), we'll simplify this to only generate call notes. This will:
- Speed up generation (simpler AI task)
- Simplify the UI (no email editing complexity)
- Focus on what users actually use

---

## Implementation Plan

### 1. Update the Button Label and Icon

**File**: `src/pages/calls/CallDetailPage.tsx`

Change the button from:
- **Icon**: `Mail` → `FileText`
- **Label**: "Recap & Follow-up Email" → "Generate Call Notes"
- **Dialog title**: "Recap & Follow-up Email" → "Call Notes"

### 2. Refactor the SalesAssetsGenerator Component

**File**: `src/components/calls/SalesAssetsGenerator.tsx`

**Remove entirely:**
- All email-related state: `subjectLine`, `emailBody`, `copiedEmail`, `copiedSubject`, `emailViewMode`, `editInstructions`, `isEditing`
- Email validation logic: `missingLinks`, `unreplacedPlaceholders`, `REQUIRED_LINKS`, `PLACEHOLDERS`
- AI email editor: `handleAIEdit`, `quickSuggestions`, `editRecapEmail` import
- Email formatting utilities: `formatForOutlook`, `REP_PLACEHOLDERS`
- The entire "Recap Email" Card UI section
- The "Copy Email Body" button and related copy functions

**Keep and simplify:**
- Internal notes state: `internalNotes`, `copiedNotes`
- Notes generation from API
- Notes edit/preview tabs
- Notes copy functionality

**Update the initial CTA:**
- Change title: "Generate Follow-Up Assets" → "Generate Call Notes"
- Change description: Remove email mention
- Change button text: "Generate Recap Email & Notes" → "Generate Call Notes"

### 3. Update the Edge Function

**File**: `supabase/functions/generate-sales-assets/index.ts`

**Option A (Minimal Change)**: Keep the edge function generating both, but only use the notes in the frontend. The email will still be generated but ignored.

**Option B (Cleaner - Recommended)**: Update the edge function to only generate notes:
- Update `SALES_ASSETS_TOOL` to remove `recap_email` from properties and required
- Update `COPYWRITER_SYSTEM_PROMPT` to focus only on CRM notes (remove all email instructions)
- Remove email validation functions: `validateEmailLinks`, `validateEmailQuality`
- Remove `REQUIRED_LINKS` and `OPTIONAL_LINKS` constants
- Update the response structure to return only `internal_notes_markdown`

I recommend **Option B** as it reduces AI token usage, speeds up generation, and keeps the codebase clean.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/calls/CallDetailPage.tsx` | Update button icon (Mail → FileText), label, and dialog title |
| `src/components/calls/SalesAssetsGenerator.tsx` | Remove ~300 lines of email-related code, simplify to notes-only UI |
| `supabase/functions/generate-sales-assets/index.ts` | Remove email generation from AI prompt and tool schema |

---

## Technical Details

### Updated SalesAssetsGenerator Structure (Simplified)

The component will have a cleaner structure:

```text
┌────────────────────────────────────────────┐
│  "Generate Call Notes" Button (Initial)    │
│  - Icon: Sparkles                          │
│  - CTA to trigger generation               │
└────────────────────────────────────────────┘
          ↓ After generation
┌────────────────────────────────────────────┐
│  Internal CRM Notes Card                   │
│  ├─ Re-generate button                     │
│  ├─ Edit/Preview Tabs                      │
│  ├─ Textarea (Edit mode)                   │
│  ├─ Markdown preview (Preview mode)        │
│  ├─ "Copy Notes (Rich Text)" button        │
│  └─ "Save Changes" button (if modified)    │
└────────────────────────────────────────────┘
```

### Updated AI Tool Schema

```javascript
const CALL_NOTES_TOOL = {
  type: "function",
  function: {
    name: "generate_call_notes",
    description: "Generate internal CRM notes based on the call transcript",
    parameters: {
      type: "object",
      properties: {
        internal_notes_markdown: {
          type: "string",
          description: "CRM-ready internal notes in markdown format..."
        }
      },
      required: ["internal_notes_markdown"]
    }
  }
};
```

### Updated System Prompt Focus

Remove all email instructions and focus entirely on generating comprehensive CRM notes with:
- Call Summary
- Key Discussion Points
- Next Steps
- Critical Gaps/Unknowns
- Competitor Intel
- Deal Health

---

## Result

1. **Faster generation** - AI only needs to generate notes, not email + notes
2. **Simpler UI** - No email editing, validation warnings, or AI editor
3. **Cleaner codebase** - Remove ~300 lines of unused email code
4. **Better UX** - Users get exactly what they need without distractions

