
# Plan: Fix Training Navigation and Admin Roleplay Access

## Problems Identified

1. **ManagerTrainingDashboard has no navigation** - Unlike other training pages, it's missing the `<AppLayout>` wrapper, so there's no sidebar/header for navigation
2. **RoleplaySession has no way back** - This page is intentionally minimal for immersive calls, but the "Back" button only works when session is idle/ended
3. **MobileHeader missing training titles** - Routes like `/manager/training` return "StormWind" instead of proper page titles
4. **No direct "Practice Roleplay" link for admins** - Admins can access `/training` (per route permissions), but there's no sidebar link to practice roleplay themselves

---

## Implementation

### Change 1: Add AppLayout to ManagerTrainingDashboard
**File:** `src/pages/training/ManagerTrainingDashboard.tsx`

Wrap the entire component in `<AppLayout>` to provide sidebar navigation:

```tsx
import { AppLayout } from '@/components/layout/AppLayout';

export default function ManagerTrainingDashboard() {
  // ... existing code ...
  
  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        {/* existing content */}
      </div>
    </AppLayout>
  );
}
```

### Change 2: Add AppLayout to RoleplaySession
**File:** `src/pages/training/RoleplaySession.tsx`

Wrap the component in `<AppLayout>` for consistent navigation. The sidebar can still collapse during the session:

```tsx
import { AppLayout } from '@/components/layout/AppLayout';

// In the return statement:
return (
  <AppLayout>
    <div className="min-h-screen bg-background">
      {/* existing content */}
    </div>
  </AppLayout>
);
```

### Change 3: Add Training Routes to MobileHeader
**File:** `src/components/layout/MobileHeader.tsx`

Add training route titles to the `routeTitles` map:

```tsx
const routeTitles: Record<string, string> = {
  // ... existing routes ...
  
  // Training routes
  '/training': 'Training',
  '/training/history': 'Training History',
  '/training/progress': 'My Progress',
  '/manager/training': 'Training Center',
};
```

Also handle dynamic training routes:
```tsx
if (pathname.match(/\/training\/roleplay\/[^/]+/)) return 'Practice Session';
if (pathname.match(/\/training\/session\/[^/]+/)) return 'Session Review';
```

### Change 4: Add "Practice Roleplay" Link for Admins
**File:** `src/components/layout/AppLayout.tsx`

Add a second item to the Training group in `adminNavGroups` for admins to practice themselves:

```tsx
{
  label: 'Training',
  items: [
    { href: '/manager/training', label: 'Training Center', icon: GraduationCap },
    { href: '/training', label: 'Practice Roleplay', icon: Mic },
  ],
}
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/training/ManagerTrainingDashboard.tsx` | Wrap in `<AppLayout>` for sidebar navigation |
| `src/pages/training/RoleplaySession.tsx` | Wrap in `<AppLayout>` for consistent navigation |
| `src/components/layout/MobileHeader.tsx` | Add training route titles and dynamic route handling |
| `src/components/layout/AppLayout.tsx` | Add "Practice Roleplay" link for admins to the Training group |

---

## Result

After these changes:
- **ManagerTrainingDashboard** will have full sidebar navigation like all other pages
- **RoleplaySession** will have the sidebar available (collapsed by default during calls)
- **MobileHeader** will show proper page titles for all training routes
- **Admins** will see both "Training Center" (to manage trainees) and "Practice Roleplay" (to test the AI agents themselves) in the sidebar
