

# Remove Login Celebration and Forced Seahawks Theme

## Changes

### 1. Delete the login celebration component
- Remove `src/components/ui/login-celebration.tsx` entirely

### 2. Remove usage of LoginCelebration from the auth flow
- Find and remove the `<LoginCelebration />` component wherever it's rendered (likely in the auth page or post-login flow)

### 3. Update `src/lib/colorSchemeInit.ts`
- Remove the hardcoded default of `theme-seattle-seahawks` when no theme is stored
- Either default to a neutral theme or keep whatever the user last selected (no forced override)

### 4. Clean up any imports
- Remove unused imports of `LoginCelebration` from any files that reference it

## What stays the same
- The color scheme system itself (users can still pick themes in settings)
- All other auth flow logic
- The theme toggle component

