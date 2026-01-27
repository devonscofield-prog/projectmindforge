
# Plan: Force Seahawks Theme on Every Login

## Overview

Modify the login flow so that **every time a user logs in**, their color scheme is reset to `seattle-seahawks`. This ensures all existing users (regardless of their previous preference) see the Seahawks theme after login. Users can still change their theme afterward, but the next login will reset it back to Seahawks.

---

## Implementation Approach

The cleanest approach is to reset the localStorage theme value when the `LoginCelebration` component mounts. This ensures:
1. The theme is set before the celebration animation plays (so colors match)
2. It happens exactly once per login
3. The logic is co-located with the celebration feature

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/ui/login-celebration.tsx` | Add effect to reset localStorage and apply Seahawks theme on mount |

---

## Technical Details

### LoginCelebration Component Changes

Add a `useEffect` at the top of the component that:
1. Sets `localStorage.setItem('mindforge-color-scheme', 'seattle-seahawks')`
2. Updates the document root class to apply the theme immediately
3. Removes any other theme classes first

```tsx
// Add this effect near the top of the component
useEffect(() => {
  // Force Seahawks theme on every login
  const STORAGE_KEY = 'mindforge-color-scheme';
  const validSchemes = ['electric-blue', 'deep-gold', 'power-red', 'seattle-seahawks', 'pink-rose', 'uw-huskies'];
  
  // Update localStorage
  localStorage.setItem(STORAGE_KEY, 'seattle-seahawks');
  
  // Apply theme class immediately
  const root = document.documentElement;
  validSchemes.forEach(scheme => {
    root.classList.remove(`theme-${scheme}`);
  });
  root.classList.add('theme-seattle-seahawks');
}, []); // Only on mount
```

---

## User Experience Flow

1. User enters credentials and clicks "Sign In"
2. Auth succeeds, `LoginCelebration` component mounts
3. **On mount**: localStorage is set to `seattle-seahawks`, theme class is applied
4. Celebration animation plays with Seahawks colors
5. User redirects to dashboard with Seahawks theme active
6. User can change theme in Settings if desired
7. **Next login**: Theme resets to Seahawks again

---

## Why This Approach

- **Minimal code changes**: Single effect in one file
- **Reliable timing**: Runs before animation, ensuring visual consistency
- **No side effects**: Only affects logged-in users at login time
- **Preserves user choice**: Users can still pick their preferred theme after login
- **Clear intent**: The reset is tied to the celebration, making the connection obvious

---

## Expected Behavior After Implementation

| Scenario | Result |
|----------|--------|
| Existing user with "deep-gold" theme logs in | Theme resets to Seahawks |
| New user logs in | Theme is Seahawks (unchanged from current) |
| User changes to "pink-rose" after login | Theme stays pink-rose until next login |
| User logs in again | Theme resets to Seahawks |
