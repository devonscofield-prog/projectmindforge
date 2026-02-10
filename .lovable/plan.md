
# Remove Live Transcript Panel from Roleplay Sessions

## What changes
Remove the `RoleplayTranscriptPanel` component from the active roleplay session view and clean up the unused component file.

## Technical Details

### 1. `src/pages/training/RoleplaySession.tsx`
- Remove the import of `RoleplayTranscriptPanel`
- Remove the JSX block (~lines 1021-1027) that renders the transcript panel during connected/speaking/listening states
- Remove any state variables (`transcript`, `currentTranscript`) and related logic **only if** they are not used elsewhere (e.g., for post-session review or grading). If they feed into grading or session storage, keep the state but just stop rendering the panel.

### 2. `src/components/training/RoleplayTranscriptPanel.tsx`
- Delete this file entirely since it will no longer be used anywhere.
