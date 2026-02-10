

# Fix: Prevent AI Persona from Breaking Character During Screen Share

## Problem
When you share your screen during a roleplay session, the AI persona (e.g., Marcus Chen) sees screenshots of **your browser** -- which includes the training app's own UI (session timers, "Roleplay Session" headers, coaching labels, transcript panels, etc.). This meta-context leaks into the conversation and causes the AI to break character, switching from "prospect" to "training helper."

## Solution (Two-Part)

### Part 1: Add a prompt-level "blindfold" for app chrome

Strengthen the vision section in the persona system prompt (`roleplay-session-manager`) with an explicit instruction to **ignore any training/coaching UI elements** visible in screenshots and treat all screen content purely as a product being demoed.

Add to `buildVisionSection()`:

```
META-UI BLINDFOLD:
The screen images may contain UI elements from the rep's own tools 
(timers, transcript panels, session controls, coaching labels, 
recording indicators, "training" or "roleplay" text). 

You MUST completely ignore these elements. They are NOT part of the 
product being demoed to you. Pretend they do not exist. 

NEVER reference, acknowledge, or respond to:
- Any text containing "roleplay", "training", "coaching", "session"
- Timer displays, microphone indicators, or call controls
- Transcript panels or chat logs
- Any UI that appears to be a wrapper around the main content

Focus ONLY on the product/application content area being demonstrated.
If the entire screen appears to be a training tool, say: 
"I can't really see your product clearly -- can you pull that up?"
```

### Part 2: Crop out the app chrome from screenshots

Update `ScreenCapture` to accept an optional crop region, and in `RoleplaySession.tsx`, configure it to capture only the **shared screen content** rather than the full browser window (which includes the roleplay UI overlay).

However, `getDisplayMedia` already captures only the **selected** screen/window/tab -- so the issue only occurs when the rep shares the **same tab** containing the roleplay app. The more robust fix is:

- After `screenCapture.start()`, check if the captured stream's video track label suggests it's the same browser tab, and if so, show a warning toast: "Tip: Share a different window or tab with your demo content for the best experience."
- Add a short text annotation to each frame sent to the AI, reminding it: "This is a screenshot of the rep's product demo. Evaluate as a prospect."

### Part 3: Annotate each frame with role context

In `RoleplaySession.tsx`, when sending each screen frame via `conversation.item.create`, add a brief text content item alongside the image to anchor the AI's role:

```typescript
content: [
  {
    type: 'input_text',
    text: `[Screen share frame: The rep is showing you their product. 
     Evaluate what you see as a prospect. Ignore any overlay UI.]`
  },
  {
    type: 'input_image',
    image_url: `data:image/jpeg;base64,${base64Frame}`
  }
]
```

This per-frame text reminder acts as a "role anchor" that counteracts any meta-UI the AI sees in the screenshot.

## Technical Details

### File 1: `supabase/functions/roleplay-session-manager/index.ts`
- In `buildVisionSection()` (~line 608-631): Append the "META-UI BLINDFOLD" block that instructs the AI to ignore training/coaching/session UI elements in screenshots.

### File 2: `src/pages/training/RoleplaySession.tsx`
- In `startScreenShare()` (~line 502-525): 
  - Add a text content item alongside each image frame to anchor the prospect role.
  - After capture starts, check the video track label and show a warning toast if the user appears to be sharing the current tab.

### File 3: `src/utils/ScreenCapture.ts`
- No changes needed -- the capture utility itself is fine; the issue is in how the frames are contextualized.

## Expected Outcome
- The AI persona will stay in character even when screenshots contain the training app's UI
- Per-frame text anchoring reinforces the prospect role with every screenshot
- Users get a helpful nudge to share a different window/tab for the best experience
