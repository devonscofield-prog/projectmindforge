
# Plan: Seahawks Login Celebration & Default Theme

## Overview

Add a temporary "GO SEAHAWKS" celebration message when users log in, with a fun celebratory animation, and change the default color scheme from "deep-gold" to "seattle-seahawks" for all users.

---

## Implementation Details

### 1. Create Celebration Overlay Component

**New File:** `src/components/ui/login-celebration.tsx`

Create a full-screen celebration overlay component that:
- Displays "GO SEAHAWKS" in large, animated text
- Uses Seahawks colors (Action Green #69BE28 and Navy #002244)
- Includes celebratory animations (confetti-style particles, bounce effects)
- Auto-dismisses after 2-3 seconds with a fade-out transition
- Can be dismissed early by clicking

```tsx
// Key features:
- Full-screen overlay with backdrop blur
- Large "GO SEAHAWKS" text with bounce animation
- Football emoji decorations (🏈)
- Animated gradient background in Seahawks colors
- Confetti/sparkle particles effect
- Smooth fade-out after delay
```

### 2. Add Confetti Animation CSS

**File:** `src/index.css`

Add new keyframe animations for the celebration:

```css
/* Confetti falling animation */
@keyframes confetti-fall {
  0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}

/* Bounce-in text animation */
@keyframes bounce-in {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}

/* Pulse glow effect */
@keyframes seahawks-glow {
  0%, 100% { text-shadow: 0 0 20px rgba(105, 190, 40, 0.8); }
  50% { text-shadow: 0 0 40px rgba(105, 190, 40, 1), 0 0 60px rgba(0, 34, 68, 0.8); }
}
```

### 3. Trigger Celebration on Login

**File:** `src/pages/Auth.tsx`

Modify the authentication flow to:
1. Show the celebration overlay when login completes (before redirect)
2. Wait for animation to finish before navigating to dashboard

```tsx
// Add state
const [showCelebration, setShowCelebration] = useState(false);

// In the redirect effect - before navigating:
if (user && role && !isRecoveryMode && !recoveryComplete && !isEnteringOTP && !sessionToken) {
  setIsFinishingSignIn(false);
  setShowCelebration(true); // Show celebration first
  
  // Navigate after celebration completes
  setTimeout(() => {
    const redirectPath = role === 'admin' ? '/admin' : role === 'manager' ? '/manager' : '/rep';
    navigate(redirectPath, { replace: true });
  }, 2500); // Wait for celebration animation
}

// Render celebration overlay when showCelebration is true
```

### 4. Change Default Color Scheme to Seattle Seahawks

**File:** `src/hooks/useColorScheme.ts`

Update the default from 'deep-gold' to 'seattle-seahawks':

```tsx
// Line 89: Change default
return 'seattle-seahawks'; // Previously: 'deep-gold'
```

**File:** `src/lib/colorSchemeInit.ts`

Update the initialization default:

```tsx
// Line 17: Change default theme class
document.documentElement.classList.add('theme-seattle-seahawks'); // Previously: 'theme-deep-gold'
```

---

## Component Design: LoginCelebration

```text
┌────────────────────────────────────────────┐
│  🏈    ✨    🎉    ✨    🏈                │
│                                            │
│         ░░░░░░░░░░░░░░░░░░░░               │
│         ░  GO SEAHAWKS!  ░                 │
│         ░░░░░░░░░░░░░░░░░░░░               │
│          (bouncing, glowing)               │
│                                            │
│         Welcome back, [Name]!              │
│                                            │
│  🏈    ✨    🎉    ✨    🏈                │
│                                            │
│  [Falling confetti in green/navy colors]  │
└────────────────────────────────────────────┘
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/ui/login-celebration.tsx` | Create | New celebration overlay component |
| `src/index.css` | Modify | Add confetti and bounce animation keyframes |
| `src/pages/Auth.tsx` | Modify | Trigger celebration on successful login |
| `src/hooks/useColorScheme.ts` | Modify | Change default to 'seattle-seahawks' |
| `src/lib/colorSchemeInit.ts` | Modify | Change initialization default |

---

## Technical Notes

1. **Animation Duration**: The celebration displays for 2.5 seconds total:
   - 0.5s bounce-in animation for text
   - 1.5s display time with glow pulse
   - 0.5s fade-out

2. **Performance**: 
   - Use CSS animations (GPU-accelerated) for smooth performance
   - Limit confetti particles to ~20 elements
   - Use `will-change` hints for animated elements

3. **Accessibility**:
   - Respect `prefers-reduced-motion` - skip animations if user prefers
   - Ensure text remains readable against background
   - Allow early dismissal via click or Escape key

4. **Existing Users**: 
   - Users who have already set a color scheme preference will keep their choice
   - Only new users (no localStorage value) will default to Seahawks

---

## Expected Result

When a user logs in:
1. "Completing sign-in..." spinner shows briefly
2. Full-screen Seahawks celebration appears with "GO SEAHAWKS!" bouncing into view
3. Confetti particles fall in Action Green and Navy Blue colors
4. After 2.5 seconds, celebration fades out
5. User is redirected to their role-appropriate dashboard
6. The Seahawks color scheme is applied (green primary, navy accents)

New users will automatically see the Seahawks theme; existing users keep their saved preference.
