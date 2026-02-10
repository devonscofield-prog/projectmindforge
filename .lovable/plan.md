
# Adjust Roleplay Persona Prompts to Match Real Sales Call Patterns

## Problem
After reviewing 20+ real Stormwind sales call transcripts, the AI personas are behaving too much like enterprise procurement buyers asking abstract technical questions about "sandboxes" and "integrations with current software." Real prospects are IT practitioners having casual, practical conversations about their specific training needs.

## Key Findings from Real Transcripts

**Who the prospects actually are:**
- Help desk techs, sysadmins, network engineers, small IT team leads
- Often individual contributors or managing 5-15 people
- Already using competitors (Pluralsight, LinkedIn Learning, KnowBe4, Udemy)
- Looking for Azure certs, Cisco Meraki, CompTIA Security+, Microsoft 365, cybersecurity

**How the conversations actually flow:**
- Casual, friendly openings ("How's your day going?", chitchat about weekends, weather)
- Prospect already spoke to an SDR/colleague, so there's warm context
- Reps share screen early (within 1-2 minutes) and walk through the platform
- Prospects ask practical questions: "Do you have VMware?", "What about HIPAA?", "How much per person?"
- Budget is straightforward: personal pay, small team budget, or manager approval -- NOT complex procurement
- Prospects mention their own tech (Meraki switches, Azure environment) naturally when discussing relevance
- Competitors come up casually: "We use Pluralsight right now", "We had LinkedIn Learning but dropped it"
- Calls are 10-25 minutes, conversational, low-pressure

**What's wrong with current prompts:**
- Too much enterprise buyer behavior (RFP processes, legal reviews, procurement teams)
- Overly guarded/adversarial posture for what are warm demo calls
- Technical questions focus on abstract "integration" rather than "do you cover my specific tech"
- Organizational reality section implies large bureaucratic processes
- Guard mode is too aggressive for prospects who already opted into this demo

## Changes

### File: `supabase/functions/roleplay-session-manager/index.ts`

#### 1. Update `buildRoleIdentitySection()` 
Change the framing from "protecting your time and budget" to reflect that this is a warm demo call the prospect chose to attend. They're curious but not yet sold.

#### 2. Update `buildGuardModeSection()`
Soften from "deflect everything for 3-5 minutes" to a more realistic posture: open to sharing what tech they use and what they need, but not immediately committing to next steps or budget numbers.

#### 3. Update `buildTechnicalEnvironmentSection()`
Replace abstract integration questions ("How does this integrate with our current setup?") with practical, grounded questions based on real transcripts:
- "Do you have anything for Meraki?" / "What about VMware?"
- "Does the certification prep include practice exams?"
- "How long are the live classes?"
- "Can I access the content on my own schedule?"
- "What's the difference between your on-demand and live courses?"

#### 4. Update `buildConversationBehaviorsSection()`
Add behaviors seen in real calls:
- Mention current training providers casually ("We use Pluralsight right now")
- Talk about specific technologies they work with day-to-day
- Ask about specific courses or certifications by name
- Mention team size and whether others might use it
- Share practical constraints ("I'd have to pay for this myself", "My manager would need to approve it")
- Occasionally go off-topic about work fires, busy days, industry news (VMware/Broadcom, AI changes)

#### 5. Update `buildOrganizationalReality` (inside `buildConversationBehaviorsSection`)
Replace the complex procurement/legal/RFP section with realistic buying behaviors:
- Small team budgets, not enterprise procurement
- Manager approval for modest purchases
- Some prospects pay out of pocket
- Net-30 billing, purchase orders for government/education
- Decision is often "Does this cover what I need?" not a multi-stakeholder evaluation

#### 6. Update `buildSessionTypeSection()`
Adjust the phase timing and behaviors:
- Phase 1 (Discovery): Rep asks about training needs, prospect shares their tech focus and role. Prospect is open and conversational, not guarded.
- Phase 2 (Demo): Rep shares screen within first few minutes (this is normal). Prospect asks practical questions about courses, labs, instructors, and certifications.
- Phase 3 (Objections): Should center on real objections from transcripts: "We already have Pluralsight", "My team won't actually use it", "I need HIPAA and you don't have it", "Is this entry-level or advanced?"
- Phase 4 (Close): Pricing discussion is straightforward (per person per year). Prospect may need to "run it by my manager" or "think about it."

#### 7. Update `buildProductUnderstandingSection()`
Make the prospect's product comprehension match real calls: they understand their own tech stack deeply but are genuinely learning about the Stormwind platform for the first time. They ask sincere (not skeptical) questions about features like ranges, AI learning customization, and live classes.

#### 8. Update `buildAbsoluteRulesSection()`
Adjust rules to reflect real call dynamics:
- Remove the overly adversarial "make them EARN your attention" framing
- Keep the prospect role integrity rules
- Add: "You chose to be on this call. You're interested but evaluating. Be honest about what you need."
- Adjust hedging to be less evasive and more practically noncommittal ("Let me think about it", "Send me the pricing")

#### 9. Update product knowledge injection context
Change the example questions from abstract ("So the Azure Range - does that include Kubernetes?") to match real prospect questions ("Do you have anything for Meraki?", "Is this just for certifications or can I do real-world practice?", "What's different from Pluralsight?")

## What stays the same
- DISC profile behaviors (personality variation is good)
- Pain point reveal ladder (progressive depth is good, just with more practical pain points)
- Opening mood randomization
- Filler words and messy human behaviors
- Objection triggers and interruption mechanics
- Screen share vision handling
- Session type structure (full sales call)
- Grading pipeline and weights

## Expected Outcome
AI personas will behave like real IT professionals attending a training platform demo: curious, practical, conversational, and evaluating based on whether the platform covers their specific tech needs -- rather than acting like enterprise procurement officers interrogating vendors about sandbox integrations.
