
# Plan: Move Deal Heat Analysis Above Products Discussed

## Summary
Reorder the Call Detail page so that the **Deal Heat Analysis** card appears above the **Products Discussed** section, giving it more prominence in the page hierarchy.

## Current Layout Order
1. Breadcrumb Navigation
2. Header
3. Call Information card
4. Recap & Follow-up Email button
5. Coaching Card (AI coaching synthesis)
6. **Products Summary** (currently here)
7. CallAnalysisLayout containing:
   - Hero Section (scores, summary, participants)
   - **Deal Heat Card** (currently buried here)
   - Tabbed Interface (Behavior, Strategy, Hazards)
8. Legacy Analysis Results
9. Raw Transcript (collapsible)
10. Sales Coach Chat

## New Layout Order
1. Breadcrumb Navigation
2. Header
3. Call Information card
4. Recap & Follow-up Email button
5. Coaching Card (AI coaching synthesis)
6. **Deal Heat Analysis** (moved up)
7. **Products Summary** (moved down)
8. CallAnalysisLayout (without Deal Heat Card)
9. Legacy Analysis Results
10. Raw Transcript (collapsible)
11. Sales Coach Chat

---

## Implementation

### Step 1: Render DealHeatCard directly in CallDetailPage.tsx
**File:** `src/pages/calls/CallDetailPage.tsx`

Add the DealHeatCard component directly in CallDetailPage, between the CoachingCard and CallProductsSummary:

```tsx
// After CoachingCard (line 510)
{transcript.analysis_status === 'completed' && analysis?.analysis_coaching && (
  <CoachingCard data={analysis.analysis_coaching} />
)}

// NEW: Deal Heat Card - rendered before Products
{transcript.analysis_status === 'completed' && analysis && (
  <DealHeatCard
    transcript={transcript.raw_text}
    strategyData={analysis.analysis_strategy}
    behaviorData={analysis.analysis_behavior}
    metadataData={analysis.analysis_metadata}
    existingHeatData={analysis.deal_heat_analysis}
    callId={transcript.id}
  />
)}

// Products Summary (existing)
<CallProductsSummary callId={id!} prospectId={transcript.prospect_id} isOwner={isOwner} />
```

Also add the necessary import at the top of the file:
```tsx
import { DealHeatCard } from '@/components/calls/DealHeatCard';
```

### Step 2: Remove DealHeatCard from CallAnalysisLayout.tsx
**File:** `src/components/calls/CallAnalysisLayout.tsx`

Remove the DealHeatCard render (lines 692-700) from CallAnalysisLayout since it's now handled at the page level.

Remove these lines:
```tsx
{/* Deal Heat Card - Always Visible */}
<DealHeatCard
  transcript={transcript.raw_text}
  strategyData={strategyData}
  behaviorData={behaviorData}
  metadataData={metadataData}
  existingHeatData={dealHeatData}
  callId={transcript.id}
/>
```

Also remove the unused import:
```tsx
import { DealHeatCard } from './DealHeatCard';
```

And remove the unused `dealHeatData` from the parsed data since it's no longer used in this component.

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/calls/CallDetailPage.tsx` | Add DealHeatCard import and render it above Products |
| `src/components/calls/CallAnalysisLayout.tsx` | Remove DealHeatCard render and cleanup unused imports/variables |

---

## Result

After this change, the Deal Heat Analysis will appear directly below the Coaching Card and above Products Discussed, giving it the prominent placement it deserves as a key deal health indicator.
