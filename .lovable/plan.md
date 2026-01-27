

# Plan: Add Training Navigation for Admins

## Summary
Add training navigation links to the admin sidebar and mobile bottom nav so admins can easily access the Training Center to manage trainees and optionally practice roleplay themselves.

---

## Current State
- **Routes**: Admins already have access to `/training` and `/manager/training` routes
- **Sidebar**: Admin navigation groups have NO training links
- **Mobile**: Admin mobile nav has NO training link (only Home, Accounts, Coaching, Transcripts)

---

## Implementation

### Change 1: Add Training to Admin Sidebar Navigation
**File:** `src/components/layout/AppLayout.tsx`

Add a new "Training" group to `adminNavGroups` (after the "Coaching" group, around line 81):

```typescript
const adminNavGroups = [
  // ... existing groups ...
  {
    label: 'Coaching',
    items: [
      { href: '/admin/coaching', label: 'Coaching Trends', icon: TrendingUp },
      { href: '/admin/playbook', label: 'Sales Playbook', icon: BookOpen },
      { href: '/admin/competitors', label: 'Competitor Intel', icon: Swords },
    ],
  },
  // NEW: Training group
  {
    label: 'Training',
    items: [
      { href: '/manager/training', label: 'Training Center', icon: GraduationCap },
    ],
  },
  // ... rest of groups ...
];
```

This adds a dedicated "Training" section that links to the Manager Training Dashboard where admins can oversee all trainee progress.

### Change 2: Add Training to Admin Mobile Bottom Nav
**File:** `src/components/layout/MobileBottomNav.tsx`

Update the admin nav items to include Training (replacing or adding to the 4-item limit):

**Option A - Replace Transcripts with Training:**
```typescript
const navItems = role === 'admin' 
  ? [
      { href: '/admin', label: 'Home', icon: LayoutDashboard },
      { href: '/admin/accounts', label: 'Accounts', icon: UserCheck },
      { href: '/admin/coaching', label: 'Coaching', icon: TrendingUp },
      { href: '/manager/training', label: 'Training', icon: GraduationCap },
    ]
```

**Option B - Keep existing + add Training (5 items):**
```typescript
const navItems = role === 'admin' 
  ? [
      { href: '/admin', label: 'Home', icon: LayoutDashboard },
      { href: '/admin/accounts', label: 'Accounts', icon: UserCheck },
      { href: '/admin/coaching', label: 'Coaching', icon: TrendingUp },
      { href: '/admin/transcripts', label: 'Transcripts', icon: FileText },
      { href: '/manager/training', label: 'Training', icon: GraduationCap },
    ]
```

*Recommendation: Option A is cleaner for mobile (4 items fits better), and Transcripts is still accessible via the sidebar. Training is more action-oriented for quick mobile access.*

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/layout/AppLayout.tsx` | Add "Training" group to `adminNavGroups` with link to `/manager/training` |
| `src/components/layout/MobileBottomNav.tsx` | Add Training link to admin mobile nav items |

---

## Result

After this change:
- **Desktop**: Admins will see a "Training" section in the sidebar with a "Training Center" link
- **Mobile**: Admins will have a Training icon in the bottom nav for quick access
- Admins can easily oversee trainee progress and manage the roleplay training system

