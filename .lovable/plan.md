
# Add DRIP Email Strategy Prompt to Sales Coach

## Overview

Add a prominent, easy-to-see recommended prompt that helps users figure out which DRIP email makes the most sense to send based on the account's context and stage in the sales cycle.

---

## Placement Strategy

The prompt should be highly visible and positioned prominently. I'll add it as a **featured recommendation card** above the existing Quick Actions grid. This card will have a distinct visual treatment to draw attention and make it clear this is a recommended action.

---

## Visual Design

A highlighted card with:
- Gradient background to stand out from other elements
- Sparkle/Zap icon to indicate it's a smart recommendation
- Clear headline: "DRIP Email Strategy"
- Brief description explaining what it does
- Subtle "Recommended" badge

```
┌─────────────────────────────────────────────────────────┐
│  ⚡ DRIP Email Strategy                    Recommended  │
│  Get AI guidance on which DRIP email to send next       │
│  based on where this account is in the sales cycle.     │
└─────────────────────────────────────────────────────────┘
```

---

## The Prompt

The prompt will ask the Sales Coach to analyze the account context and recommend which DRIP email strategy makes sense:

```
"Based on this account's current status, engagement history, and where they are in the sales cycle, help me figure out which DRIP email I should send next. Consider their heat score, recent interactions, any pending follow-ups, and stakeholder engagement. Recommend a specific type of DRIP email (nurture, value-add, case study, check-in, etc.) and explain why it's the right choice for this moment. Then help me draft it."
```

---

## Implementation

### File: `src/components/prospects/SalesCoachChat.tsx`

**1. Add the DRIP Strategy Prompt Constant**

Add a new constant for the featured DRIP recommendation:

```typescript
const DRIP_STRATEGY_PROMPT = {
  id: 'drip-strategy',
  label: 'DRIP Email Strategy',
  description: 'Get AI guidance on which DRIP email to send next',
  prompt: "Based on this account's current status, engagement history, and where they are in the sales cycle, help me figure out which DRIP email I should send next. Consider their heat score, recent interactions, any pending follow-ups, and stakeholder engagement. Recommend a specific type of DRIP email (nurture, value-add, case study, check-in, re-engagement, etc.) and explain why it's the right choice for this moment. Then help me draft it.",
};
```

**2. Add Featured Recommendation Card**

Insert a new card component between the Account Pulse card and the Quick Actions grid (around line 759):

```tsx
{/* Featured DRIP Email Strategy Recommendation */}
<button
  className="w-full text-left relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-accent/10 to-primary/15 border border-primary/30 p-4 hover:border-primary/50 hover:from-primary/15 hover:via-accent/15 hover:to-primary/20 hover:scale-[1.01] hover:shadow-lg hover:shadow-primary/10 transition-all duration-200 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
  onClick={() => { setInput(DRIP_STRATEGY_PROMPT.prompt); inputRef.current?.focus(); }}
  disabled={isLoading || isRateLimited}
>
  <div className="flex items-start gap-3">
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-200">
      <Zap className="h-5 w-5 text-primary-foreground" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-semibold text-foreground">{DRIP_STRATEGY_PROMPT.label}</span>
        <Badge variant="secondary" className="text-[10px] bg-primary/15 text-primary border-0 px-1.5 py-0">
          Recommended
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        {DRIP_STRATEGY_PROMPT.description} based on where this account is in the sales cycle.
      </p>
    </div>
  </div>
</button>
```

---

## UI Layout After Change

```
┌───────────────────────────────────────────┐
│  Account Pulse Card (if data available)  │
├───────────────────────────────────────────┤
│  ⚡ DRIP Email Strategy [Recommended]     │  ← NEW
│  Get AI guidance on which DRIP email...   │
├───────────────────────────────────────────┤
│  [Prep for Call]    [Draft Email]         │
│  [Next Steps]       [Deal Status]         │
├───────────────────────────────────────────┤
│  [▼ Recap Emails dropdown]                │
├───────────────────────────────────────────┤
│  Recently Asked: ...                      │
├───────────────────────────────────────────┤
│  Welcome message with categories...       │
└───────────────────────────────────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/prospects/SalesCoachChat.tsx` | Add `DRIP_STRATEGY_PROMPT` constant, add featured recommendation card UI above Quick Actions grid |

---

## Result

1. **Highly visible** - Gradient card with distinct styling stands out immediately
2. **Clear purpose** - Label and description make it obvious what this does
3. **Recommended badge** - Signals this is a smart, suggested action
4. **Context-aware prompt** - The AI will analyze heat score, engagement history, and pending tasks to recommend the right DRIP email type
5. **End-to-end workflow** - Recommends the email type AND offers to draft it

