

# Show Default Prompts on SDR Manager Coaching Page

## Problem
SDR Managers currently see an empty state saying "No custom prompts yet. The system uses default prompts" but have no way to see what those defaults actually are. To customize grading, they must write a prompt from scratch.

## Solution
Replace the empty state with a "Default Prompts" section that displays all three default prompts (Splitter, Filter, Grader) as read-only cards. Each card will include:
- A friendly label (e.g., "Call Grading Criteria" instead of "grader")
- A short description of what the agent does
- The full default prompt text (collapsed by default, expandable)
- A **"Customize"** button that pre-fills the create form with the default prompt text, so managers can make small tweaks instead of starting from scratch

When a manager already has a custom prompt for a given agent, that default card will show a subtle "Overridden" badge.

## Changes

### 1. Define default prompt data in `SDRManagerCoaching.tsx`

Add a constant mapping the three agent keys to their friendly names, descriptions, and default prompt text (copied from the edge functions as static strings):

| Agent Key | Friendly Name | Description |
|-----------|--------------|-------------|
| `grader` | Call Grading Criteria | Controls how each call is scored across 5 dimensions (opener, engagement, objection handling, appointment setting, professionalism) and assigns an overall letter grade |
| `filter` | Call Classification | Determines how transcript segments are categorized (conversation, voicemail, hangup, internal, reminder) and which count as meaningful calls |
| `splitter` | Transcript Splitting | Controls how a full-day dialer transcript is split into individual call segments based on timestamp gaps, greeting patterns, and speaker changes |

### 2. Show default prompts section

When no custom prompts exist (or even alongside custom prompts), display a "System Defaults" section with collapsible cards for each agent. Each card:
- Shows the friendly name as the title and the description below it
- Has a collapsible area (using Collapsible from Radix) showing the full prompt text in a read-only monospace block
- Has a "Customize" button that opens the create form pre-populated with that agent's default text and a suggested name like "Custom Grading Criteria"

### 3. Pre-fill create form from defaults

When "Customize" is clicked:
- Set `showCreate` to true
- Pre-fill `newPrompt` with `agent_key`, a default `prompt_name`, and the full `system_prompt` text from the default
- The manager can then tweak a few lines and hit "Create"

### 4. Show "Overridden" status

If the manager's team already has an active custom prompt for a given agent key, the default card shows a green "Overridden by: [prompt name]" badge to clarify that the default is not being used.

## Files Modified

| File | Change |
|------|--------|
| `src/pages/sdr-manager/SDRManagerCoaching.tsx` | Add default prompts constant, render default prompt cards with Collapsible, add "Customize" button logic, show override status |

No database or edge function changes needed -- the defaults are embedded as constants in the UI (mirroring what's in the edge functions).

