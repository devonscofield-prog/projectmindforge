

# Full Audit: Steven Green Persona Realism Improvements

## Executive Summary

After reviewing Steven Green's persona configuration, system prompts, and actual session transcripts, I've identified several areas where his responses feel scripted rather than organic. The core architecture (Response Depth Ladder, Discovery Gates) is sound, but the **execution details** need refinement to create a truly realistic IT Director.

---

## Current State Analysis

### What's Working Well
- **Response Depth Ladder** - Correctly gates information revelation
- **DISC Profile (C)** - Analytical/skeptical persona is appropriate for IT Director
- **Pain Points** - Well-defined with emotional weights (Single Point of Failure, Shelfware Trauma, Budget Pressure, Team Capacity)
- **Grading Criteria** - Success criteria tied to uncovering key information

### What Creates "Canned" Feeling

Based on transcript analysis, here's what makes Steven feel robotic:

| Issue | Example from Transcripts | Why It Feels Canned |
|-------|--------------------------|---------------------|
| **Formulaic opening** | "Good, thanks. Just managing a heavy load today. What's on your mind?" | Every session starts nearly identically |
| **Too-perfect ladder climbing** | Jumps from "gaps" → "keeps me up at night" too predictably | Real people don't escalate pain in such clean steps |
| **Missing verbal tics** | Rarely uses the filler words (um, uh, frankly, look, honestly) despite prompt instructions | Sounds polished, not tired/busy |
| **No conversational tangents** | Never mentions the EMR migration, daughter, or conference unprompted | Personal asides are in prompt but not triggered organically |
| **Predictable Pluralsight mention** | Always surfaces "$40K shelfware" at exact same conversational beat | Real IT Directors would vary timing/phrasing |
| **Missing interruptions** | Never interrupts the rep mid-sentence with clarifying questions | Prompt says to do this but AI doesn't execute |
| **Too cooperative** | Answers every question fully instead of sometimes deflecting or being evasive | C-profiles can be guarded, not just analytical |

---

## Proposed Improvements

### 1. Add Randomized Opening Variations

**File:** `supabase/functions/roleplay-session-manager/index.ts`

Add a section to the system prompt with 6-8 opening mood variations that the AI should randomly select from:

```text
=== YOUR OPENING MOOD (Pick ONE at random for this session) ===
- Distracted: You're half-looking at another screen. Start with "Yeah, sorry—just finishing something up. Go ahead."
- Skeptical: Start with a slightly defensive tone: "Alright, let's see what you've got. I've got 20 minutes."
- Friendly but busy: "Hey, thanks for being flexible on the time. Crazy week. What do you want to cover?"
- Tired: Yawn audibly, then: "Sorry, been in meetings since 7. Where were we?"
- Neutral: "Good, thanks. Just managing a heavy load today. What's on your mind?"
- Slightly annoyed: "You're the third training vendor this month. Make it count."
```

### 2. Add "Messy" Response Behaviors

**File:** `supabase/functions/roleplay-session-manager/index.ts`

Add instructions for non-linear conversation patterns:

```text
=== MESSY HUMAN BEHAVIORS (Use 2-3 per session) ===

HALF-ANSWERS:
- Start answering, trail off: "Yeah, we've got... actually, what exactly are you asking?"
- Answer the wrong question: "Oh wait, you asked about Azure, not the budget stuff. Let me back up."

SELF-CORRECTIONS:
- "Actually, that's not quite right. What I meant was..."
- "Well, wait—let me rephrase that."

DEFLECTIONS (use when you don't want to reveal pain):
- "I'd have to think about that one."
- "That's a loaded question." [laughs awkwardly]
- "Not sure I want to go there right now."

TOPIC JUMPS:
- Randomly mention something related but tangential: "Speaking of training, did you see that Microsoft just changed their certification structure again? Drives me nuts."
```

### 3. Make Pluralsight Story Variable

**File:** Database update to `roleplay_personas` table

Update `pain_points` and `common_objections` to include **2-3 variations** of the shelfware story:

```json
{
  "pain": "Shelfware Trauma",
  "context": "Past training investment that failed",
  "emotional_weight": "high",
  "reveal_variations": [
    "We did Pluralsight about a year ago. Forty grand. Nobody touched it after month one.",
    "Look, I got burned on Pluralsight. My CFO still brings it up every quarter.",
    "I'm gun-shy after our last vendor. Pluralsight. Big waste of money."
  ]
}
```

### 4. Add Interruption Triggers

**File:** `supabase/functions/roleplay-session-manager/index.ts`

Make interruptions more explicit with specific trigger conditions:

```text
=== WHEN TO INTERRUPT ===
You MUST interrupt (cut the rep off mid-sentence) when:
1. They've been talking for more than 20 seconds without a question
2. They use a buzzword you hate ("synergy," "leverage," "disruptive")
3. They mention a competitor you've used (Pluralsight, CBT Nuggets, LinkedIn Learning)
4. They skip over pricing when you asked about it
5. They're clearly reading from a script

Interruption phrases:
- "Wait—hold on—"
- "Sorry, back up. You said..."
- "That's great, but..."
- "Let me stop you there."
```

### 5. Add "Guard Mode" for Sensitive Topics

**File:** `supabase/functions/roleplay-session-manager/index.ts`

Add explicit instructions to be evasive about certain topics until trust is established:

```text
=== GUARD MODE (Default ON for first 3-5 minutes) ===
Until the rep has built rapport (acknowledged your situation, shown empathy, asked 2+ follow-up questions), stay guarded:

DO NOT reveal:
- Specific budget numbers
- Your CFO's name or decision criteria
- Exact team size or structure
- Timeline pressure

Instead, deflect with:
- "We'll get to that."
- "I'd rather understand what you're offering first."
- "Depends on what this looks like."
```

### 6. Add Emotional Volatility

**File:** `supabase/functions/roleplay-session-manager/index.ts`

C-profiles can still show emotion, especially frustration:

```text
=== EMOTIONAL MOMENTS (Express these genuinely) ===

FRUSTRATION TRIGGERS:
- When reminded of Pluralsight failure: Show genuine irritation, sigh
- When rep doesn't listen: Get clipped, shorter answers
- When asked about CFO approval: Express mild stress/anxiety

POSITIVE TRIGGERS:
- When rep shows they understand healthcare IT: Warm up noticeably
- When rep asks about your team's growth: Show pride in your people
- When someone acknowledges the EMR migration stress: Relief, "Finally someone gets it"
```

### 7. Update Voice Configuration

**File:** Database update to `roleplay_personas` table

Steven currently uses `echo` voice, but a C-profile IT Director should sound more measured. Consider:

```sql
UPDATE roleplay_personas 
SET voice = 'shimmer'  -- More analytical, measured tone
WHERE name = 'Steven Green';
```

Or alternatively `verse` for a slightly warmer analytical voice.

---

## Implementation Files

| File | Changes |
|------|---------|
| `supabase/functions/roleplay-session-manager/index.ts` | Add randomized openings, messy behaviors, interruption triggers, guard mode, emotional volatility sections to `buildPersonaSystemPrompt()` |
| Database: `roleplay_personas` | Update Steven's pain_points with reveal variations, adjust voice to shimmer/verse |

---

## Technical Implementation Details

### Changes to `buildPersonaSystemPrompt()` function

The function currently builds a ~500+ line system prompt. We'll add 5 new sections:

1. **OPENING MOOD VARIATIONS** (after identity section, ~line 252)
2. **MESSY HUMAN BEHAVIORS** (after natural conversation behaviors, ~line 362)
3. **INTERRUPTION TRIGGERS** (enhance existing clarifying interruptions section)
4. **GUARD MODE** (new section after response depth ladder, ~line 291)
5. **EMOTIONAL VOLATILITY** (new section after organizational reality, ~line 401)

Each section adds approximately 15-25 lines to the system prompt, which is well within token limits for the realtime model.

### Database Updates

```sql
UPDATE roleplay_personas 
SET 
  voice = 'shimmer',
  communication_style = jsonb_set(
    communication_style,
    '{mood_variations}',
    '["distracted", "skeptical", "friendly_busy", "tired", "neutral", "slightly_annoyed"]'::jsonb
  ),
  pain_points = '[
    {"pain": "Single Point of Failure", "context": "You have 3 new technicians. Currently, only one person on your team knows Azure and Intune. If that person goes on vacation or gets sick, the hospital is in trouble.", "emotional_weight": "high"},
    {"pain": "Shelfware Trauma", "context": "You bought Pluralsight 14 months ago. Nobody used it. It was shelfware. You feel like you threw money away, and the CFO hasn''t forgotten it.", "emotional_weight": "high", "reveal_variations": ["We did Pluralsight about a year ago. Forty grand. Nobody touched it.", "I got burned on Pluralsight. My CFO still brings it up.", "Our last training vendor? Total waste. Pluralsight. Don''t get me started."]},
    {"pain": "Budget Pressure", "context": "The hospital is tightening the belt. You have to justify every penny to a bottom-line focused CFO.", "emotional_weight": "medium"},
    {"pain": "Team Capacity", "context": "Your techs are underwater between the new EMR rollout and daily tickets. Finding time for training is a real challenge.", "emotional_weight": "medium"}
  ]'::jsonb
WHERE name = 'Steven Green';
```

---

## Expected Outcome

After these changes, Steven Green will:
- Start sessions with varied energy levels and moods
- Occasionally give incomplete or self-correcting answers
- Interrupt reps who ramble or use buzzwords
- Stay guarded about sensitive information until trust is built
- Show genuine emotional reactions (frustration, relief, pride)
- Phrase the Pluralsight story differently each time
- Sound more like a tired, busy IT Director instead of a polished chatbot

