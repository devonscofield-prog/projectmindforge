

# Refine Sales Coach System Prompt for More Nuanced Responses

## Problem

The current system prompt explicitly encourages repetitive empathy phrases:
- Line 98: `"Start responses by briefly acknowledging their question or concern ("That's a tough one..." or "I get it, this is frustrating...")"`
- Line 91: `"Supportive first, then direct - always acknowledge the rep's situation before offering advice"`

These instructions cause the model to default to the same handful of generic openers ("I totally get it", "That's a tough one", etc.) across nearly every response.

## Changes

**File:** `supabase/functions/sales-coach-chat/index.ts` (lines 88-122)

Replace the system prompt's personality and communication sections with more varied, context-aware guidance:

**Key adjustments:**

1. **Remove the explicit filler phrases** -- no more example phrases like "That's a tough one" or "I get it" that the model parrots.

2. **Replace with variety instruction** -- tell the model to vary its openings based on what the rep actually said (reference specifics from their message, not generic empathy).

3. **Add an anti-repetition rule** -- explicitly instruct the model to never repeat the same opening pattern across consecutive responses.

4. **Keep the supportive tone** but make it situational -- acknowledge only when genuinely warranted (e.g., a frustrating deal situation), not as a reflexive opener on every message.

**Updated prompt sections (summary of changes):**

- "Supportive first, then direct" becomes "Match your tone to the moment -- be direct when they need clarity, supportive when they're struggling, and energized when there's momentum"
- Remove the line that says to start with "That's a tough one..." and replace with: "Jump into the substance quickly. If acknowledgment is warranted, reference something specific they said rather than using generic phrases like 'I totally get it' or 'That's a tough one.'"
- Add: "Never open two consecutive responses the same way. Vary your style -- sometimes lead with a question, sometimes with a direct suggestion, sometimes with a relevant observation from their account data."

No other files need changes -- this is entirely a prompt refinement in the edge function.

