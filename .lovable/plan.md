

# Get Roleplay Ready for New Reps

## What's Already Working
- 3 personas active (Marcus Chen/easy, Steven Green/medium, Dr. Patricia Okonkwo/hard)
- Full roleplay flow: briefing, live voice call, transcripts, grading, history, progress tracking
- Reps can access `/training` from the sidebar under "Resources > Practice Roleplay"
- WebRTC session type fix is deployed

## What Needs to Be Done

### 1. Fix Post-Login Redirect (Bug)
The `Auth.tsx` celebration handler (line 145) still uses a hardcoded ternary that always sends reps to `/rep`. The `getDashboardUrl()` helper already exists and handles this correctly. This isn't training-specific but ensures consistent routing.

### 2. Add "Training" to Rep Mobile Bottom Nav
Currently reps on mobile see: New Call, Tasks, Accounts. There's no way to reach the training module without opening the sidebar. Adding a Training link to the mobile bottom nav makes the feature discoverable for reps on phones/tablets.

### 3. Add First-Time Welcome Card for New Reps
When a rep opens the Training Dashboard with 0 completed sessions, show a dismissable guidance card explaining:
- Pick a persona and click "Start Practice"
- You'll get a briefing before the call
- The AI responds with real-time voice
- After the call, you'll receive a grade and feedback

Dismissed via "Got it" button, stored in localStorage so it only shows once.

### 4. Add "Start Here" Badge on Easy Persona
Highlight Marcus Chen (or whichever persona is easiest) with a "Recommended for new reps" badge when the user has 0 completed sessions. This removes the "which one do I pick first?" friction.

---

## Technical Details

| File | Change |
|------|--------|
| `src/pages/Auth.tsx` (line 145) | Replace hardcoded ternary with `getDashboardUrl(role)` |
| `src/components/layout/MobileBottomNav.tsx` | Add a Training nav item (`/training`, GraduationCap icon) to the rep nav array |
| `src/pages/training/TrainingDashboard.tsx` | Add dismissable welcome card (shown when `completed_sessions === 0` and not dismissed in localStorage). Add "Start Here" badge on the first easy-difficulty persona card for new users. |

No database or edge function changes required.
