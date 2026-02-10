

# Consolidate Session Types into a Single "Full Sales Call"

## Overview
Replace the 4 separate session types (Discovery, Demo, Objection Handling, Negotiation) with a single unified session type that covers the full sales cycle in one call. The AI persona will naturally progress through phases: discovery, demo, objections, and negotiation/close.

## API Feasibility
OpenAI's Realtime API has no hard session duration cap -- sessions persist as long as the WebRTC connection is active. 20-30 minute calls are fully supported with the current setup. No API changes needed.

## Changes

### 1. Edge Function: `supabase/functions/roleplay-session-manager/index.ts`
- Change the `sessionType` parameter to default to `'full_sales_call'` (keep accepting it for backward compat but ignore other values)
- Rewrite `buildSessionTypeSection()` with a single unified prompt instructing the persona to:
  - Start in discovery mode (guarded, asking qualifying questions back)
  - Transition to evaluating a demo when the rep starts presenting
  - Raise objections naturally throughout
  - Move into negotiation/close if the rep earns it
  - Maintain realistic pacing for a 20-30 minute conversation

### 2. Edge Function: `supabase/functions/roleplay-grade-session/index.ts`
- Add a new `full_sales_call` entry to `SESSION_TYPE_WEIGHTS` with balanced weights across all categories (e.g., discovery 0.20, objection_handling 0.25, rapport 0.20, closing 0.20, persona_adaptation 0.15)
- Keep legacy weights so old sessions still grade correctly

### 3. Component: `src/components/training/RoleplayBriefing.tsx`
- Remove the "Session Type" selector card entirely (no more 4-button grid)
- Remove `onChangeSessionType` prop
- Replace the session-type-specific tips with a single consolidated tips section covering the full call flow
- Update the start button text to "Start Sales Call"

### 4. Page: `src/pages/training/RoleplaySession.tsx`
- Remove the `sessionType` state variable; hardcode `'full_sales_call'` when creating the session
- Remove `onChangeSessionType` from the `RoleplayBriefing` props
- Update any UI text that references the session type (e.g., "Ready to start your discovery call" becomes "Ready to start your sales call")

### 5. Component: `src/components/training/PersonaBreakdownCard.tsx`
- Update session type stats display to handle `'full_sales_call'` label gracefully alongside legacy types

## What stays the same
- Custom Scenario selector (still available for adding extra challenges)
- Persona selection, DISC profiles, pain points, objections
- Screen sharing, audio recording, grading pipeline
- All existing session data in the database (backward compatible)
