
# Plan: Remove Hardcoded Entra ID Focus from Roleplay Personas

## Problem Analysis

The Steven Green roleplay session is overly focused on Entra ID integration because this technical context is **hardcoded** into the `roleplay-session-manager` edge function, not configured per persona.

### Current Issue Locations

| Line | Hardcoded Text | Problem |
|------|----------------|---------|
| 401 | "Hold on - does that work with Entra ID?" | Forced clarifying interruption |
| 531-536 | "YOUR CURRENT STACK" lists Azure AD/Entra ID, Intune, SCCM | Hardcoded IT environment |
| 539 | "Does this work with Entra ID for SSO?" | Forced product question |

These assumptions are injected into **every** IT Director persona, which isn't appropriate for all roleplay scenarios.

---

## Solution: Make Technical Stack Persona-Configurable

### Part 1: Database Schema Enhancement

Add a new `technical_environment` JSONB field to the `roleplay_personas` table that allows configuring:
- Current technology stack (optional)
- Integration questions the persona cares about (optional)
- Technical concerns (optional)

```sql
ALTER TABLE roleplay_personas 
ADD COLUMN technical_environment jsonb DEFAULT NULL;

COMMENT ON COLUMN roleplay_personas.technical_environment IS 
'Optional technical context: { stack: [], integration_questions: [], concerns: [] }';
```

### Part 2: Update the System Prompt Builder

Modify the `buildPersonaSystemPrompt` function to:

1. **Remove hardcoded Entra ID references** from the generic prompt sections
2. **Use persona-specific technical context** when available
3. **Fall back to generic, non-specific language** when no technical environment is configured

**Before (hardcoded):**
```typescript
// Line 401
- "Hold on - does that work with Entra ID?"

// Lines 531-536
YOUR CURRENT STACK (only reveal if asked):
- Azure AD (now Entra ID) for identity
- Intune for device management
...

// Line 539
- "Does this work with Entra ID for SSO?"
```

**After (configurable):**
```typescript
// Generic interruptions without specific tech
- "Wait, how does that integrate with what we have now?"
- "Is that compatible with our environment?"

// Only include CURRENT STACK section if persona has technical_environment configured
${persona.technical_environment?.stack?.length ? `
YOUR CURRENT STACK (only reveal if asked):
${persona.technical_environment.stack.map(s => `- ${s}`).join('\n')}
` : ''}

// Only include integration questions if configured
${persona.technical_environment?.integration_questions?.length ? `
QUESTIONS YOU'LL ASK ABOUT THEIR PRODUCT:
${persona.technical_environment.integration_questions.map(q => `- "${q}"`).join('\n')}
` : ''}
```

### Part 3: Update Steven Green's Persona (Optional)

If you want Steven Green to ask about specific technologies, you can configure his `technical_environment`:

```json
{
  "stack": [
    "Epic EMR for clinical workflows",
    "Windows 10 endpoints across 3 locations",
    "Active Directory on-prem"
  ],
  "integration_questions": [
    "Does this work with our AD setup?",
    "Any HIPAA compliance considerations?",
    "Can my techs access this from our network?"
  ]
}
```

Or leave it `NULL` to have Steven focus on business value rather than technical integrations.

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| New migration | Create | Add `technical_environment` column to `roleplay_personas` |
| `supabase/functions/roleplay-session-manager/index.ts` | Modify | Replace hardcoded Entra ID references with configurable logic |

---

## Expected Behavior After Fix

| Scenario | Before | After |
|----------|--------|-------|
| Steven Green session | Forces Entra ID questions | Business/ROI focused unless configured otherwise |
| Persona with `technical_environment` set | Same forced Entra ID | Uses configured stack and questions |
| Persona without `technical_environment` | Forced Entra ID | Generic integration language, no specific tech |

---

## Technical Details

### Changes to `roleplay-session-manager/index.ts`

**Line 401 - Replace specific clarifying interruption:**
```typescript
// Before
- "Hold on - does that work with Entra ID?"

// After  
- "Hold on - how does that work with what we already have?"
```

**Lines 528-542 - Make technical stack conditional:**
```typescript
// Only render if persona has technical_environment configured
const technicalStackSection = persona.technical_environment?.stack?.length ? `
=== TECHNICAL COMPATIBILITY CONCERNS ===
You need to know how anything integrates with your environment:

YOUR CURRENT STACK (only reveal if asked):
${persona.technical_environment.stack.map(s => `- ${s}`).join('\n')}

QUESTIONS YOU'LL ASK ABOUT THEIR PRODUCT:
${persona.technical_environment.integration_questions?.map(q => `- "${q}"`).join('\n') || '- "How does this integrate with our current setup?"'}
` : '';
```

This approach keeps the flexibility to add technical context when needed while removing the forced Entra ID focus for personas where it's not relevant.
