

# Add Recap Email Dropdown to Sales Coach

## Overview

Add a new "Recap Emails" dropdown menu in the Sales Coach chat that provides specialized prompts for generating post-call recap emails. These emails leverage the full context of the recent call and are tailored for different audiences and purposes.

---

## Recap Email Types

I'll include the two you requested plus additional useful options:

### 1. Executive Summary Recap
**For**: Prospect to share with leadership
**Purpose**: Short, impactful summary the prospect can forward to their executives to build internal buy-in

```
"Write a post-call recap email for my prospect that includes a brief Executive Summary they can forward to their leadership team. Keep it professional and focused on the business value and outcomes we discussed."
```

### 2. Decision Maker Recap
**For**: Direct communication with decision makers/executives
**Purpose**: Concise, ROI-focused email that respects their time and speaks to strategic priorities

```
"Draft a recap email specifically for a decision maker or executive at this account. Keep it concise, lead with ROI and business outcomes, and include a clear next step. Executives are busy - make every word count."
```

### 3. Champion Enablement Recap
**For**: Your internal champion
**Purpose**: Arms your champion with talking points to sell internally

```
"Create a recap email for my champion at this account that includes key talking points they can use to advocate for us internally. Include a quick-reference summary of benefits and answers to likely objections from their colleagues."
```

### 4. Technical Stakeholder Recap
**For**: Technical buyers, IT, implementation teams
**Purpose**: Focuses on technical details, integration, and implementation discussed

```
"Write a recap email tailored for technical stakeholders at this account. Focus on the technical requirements, integration details, and implementation considerations we discussed. Include any technical next steps."
```

### 5. Multi-Thread Recap
**For**: Multiple stakeholders (CC several people)
**Purpose**: Comprehensive recap suitable for a broader audience with different interests

```
"Draft a comprehensive recap email that I can send to multiple stakeholders at this account. Structure it so different readers (executives, technical team, end users) can each find the information relevant to them. Include a clear summary at the top."
```

### 6. Next Steps Focused Recap
**For**: Driving action and accountability
**Purpose**: Short, action-oriented email that emphasizes commitments and deadlines

```
"Write a brief, action-focused recap email that emphasizes the specific next steps we agreed on, who owns each action item, and the timeline. Keep it short and scannable with a clear list of commitments from both sides."
```

---

## UI Design

### Placement
Add the Recap Emails dropdown alongside the existing Quick Action buttons, appearing as a special button with a dropdown arrow. It will be positioned in the Quick Actions grid area but styled distinctively.

### Visual Design
- Button with `Mail` icon and "Recap Emails" label with a `ChevronDown` indicator
- Uses existing `DropdownMenu` component from Radix UI
- Each menu item shows a brief label and a subtle description
- Clicking a menu item loads the prompt into the input field (consistent with recently updated behavior)

---

## Implementation

### File: `src/components/prospects/SalesCoachChat.tsx`

**1. Add Recap Email Prompts Constant**

```typescript
interface RecapEmailOption {
  id: string;
  label: string;
  description: string;
  prompt: string;
}

const RECAP_EMAIL_OPTIONS: RecapEmailOption[] = [
  {
    id: 'executive-summary',
    label: 'Executive Summary',
    description: 'For prospect to share with leadership',
    prompt: 'Write a post-call recap email for my prospect that includes a brief Executive Summary they can forward to their leadership team. Keep it professional and focused on the business value and outcomes we discussed.',
  },
  {
    id: 'decision-maker',
    label: 'Decision Maker',
    description: 'Concise email for C-suite/executives',
    prompt: 'Draft a recap email specifically for a decision maker or executive at this account. Keep it concise, lead with ROI and business outcomes, and include a clear next step. Executives are busy - make every word count.',
  },
  // ... additional options
];
```

**2. Add Dropdown in Quick Actions Area**

Modify the Quick Actions grid section (around line 707) to include the Recap Emails dropdown:

```tsx
{/* Quick Action Buttons + Recap Dropdown */}
<div className="space-y-2.5">
  <div className="grid grid-cols-2 gap-2.5">
    {QUICK_ACTIONS.map((action) => (
      // ... existing quick action buttons
    ))}
  </div>
  
  {/* Recap Emails Dropdown */}
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="outline"
        className="w-full h-auto py-3 justify-between bg-gradient-to-r from-blue-500/5 to-purple-500/5 border-primary/20 hover:border-primary/40 hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-purple-500/10"
        disabled={isLoading || isRateLimited}
      >
        <span className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <span className="font-medium">Recap Emails</span>
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-80">
      {RECAP_EMAIL_OPTIONS.map((option) => (
        <DropdownMenuItem
          key={option.id}
          className="flex flex-col items-start gap-0.5 py-2.5 cursor-pointer"
          onClick={() => { setInput(option.prompt); inputRef.current?.focus(); }}
        >
          <span className="font-medium text-sm">{option.label}</span>
          <span className="text-xs text-muted-foreground">{option.description}</span>
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/prospects/SalesCoachChat.tsx` | Add `RECAP_EMAIL_OPTIONS` constant, add Recap Emails dropdown in Quick Actions area |

---

## Result

1. **Dedicated recap section** - Clear, visible dropdown for post-call recap emails
2. **Audience-targeted options** - Six specialized recap types for different stakeholders
3. **Consistent behavior** - Prompts load into input field for review/editing before sending
4. **Context-aware** - Sales Coach has full call history and account context to generate relevant recaps
5. **Professional templates** - Prompts are designed to generate polished, purpose-driven emails

