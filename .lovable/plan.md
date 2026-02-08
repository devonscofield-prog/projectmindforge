
# Make the Complete Button More Obvious on My Tasks Page

## Change

Update the "mark complete" button in `RepTasks.tsx` (line 565) from a barely-visible ghost icon to a clearly styled button with a green border, green icon color, and a light green background on hover.

## Technical Details

**File:** `src/pages/rep/RepTasks.tsx` (line 565)

**Current:** `variant="ghost"` with `className="h-8 w-8 p-0 shrink-0"` and the icon uses `text-muted-foreground hover:text-green-500`

**New:** `variant="outline"` with `className="h-8 w-8 p-0 shrink-0 border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 hover:text-green-700 dark:hover:text-green-300"` -- remove the inline icon color classes since the button itself will carry the green color.

Also apply the same treatment to the matching button in the `PendingFollowUpsWidget.tsx` (line ~232) for consistency across both the dashboard widget and the full tasks page.
