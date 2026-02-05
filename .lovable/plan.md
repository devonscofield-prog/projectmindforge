
# Admin Sales Coach Chat History Feature

## Overview
Create a new admin page that allows administrators to view Sales Coach chat history for all users. This will help identify prompt patterns, evaluate AI outputs, and find areas for improvement.

## What You'll Get

### New Admin Page: Sales Coach History
- A dedicated page at `/admin/sales-coach` accessible from the admin sidebar
- Filter and search by user, date range, or prospect
- View complete conversation threads with user prompts and AI responses
- See usage statistics (total conversations, messages per user, etc.)

### Session Viewer Sheet
- Click on any session to open a detailed view
- Shows the full conversation with proper formatting
- Displays metadata: user name, account/prospect, timestamps
- Export capability for sharing insights

## Technical Approach

### 1. API Layer
Create new functions to fetch sessions with user and prospect details:
- `fetchAllAdminCoachSessions()` - Get all sessions across users with pagination
- `fetchAdminCoachSessionStats()` - Aggregate usage statistics

### 2. Database Query
The existing RLS policy already allows admin access:
```sql
CREATE POLICY "Admins can view all coaching sessions"
  ON public.sales_coach_sessions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role));
```

### 3. New Components
| Component | Description |
|-----------|-------------|
| `AdminSalesCoachHistory.tsx` | Main page with filters and session list |
| `CoachSessionViewerSheet.tsx` | Side panel to view full conversation |
| `CoachSessionStatsCard.tsx` | Usage statistics display |

### 4. Navigation
Add to admin sidebar under "Coaching" section:
- Route: `/admin/sales-coach`
- Label: "Coach History"
- Icon: MessageSquare (matching the coach theme)

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/pages/admin/AdminSalesCoachHistory.tsx` | Create - Main page |
| `src/components/admin/CoachSessionViewerSheet.tsx` | Create - Conversation viewer |
| `src/api/adminSalesCoachSessions.ts` | Create - Admin API functions |
| `src/hooks/useAdminCoachSessions.ts` | Create - React Query hook |
| `src/components/layout/AppLayout.tsx` | Modify - Add nav item |
| `src/App.tsx` | Modify - Add route |

## UI Features

### Session List View
- Tabular display with columns: User, Account, Last Message Preview, Date, Message Count
- Filters: User dropdown, date picker, search by content
- Pagination for large datasets
- Sortable columns

### Conversation Viewer
- User messages styled distinctly from AI responses
- Markdown rendering for AI responses
- Copy conversation button
- Timestamps for each message

### Statistics Dashboard
- Total sessions across all users
- Average messages per conversation
- Most active users
- Most discussed accounts
- Conversation trends over time

## Implementation Sequence

1. Create admin API functions with proper typing
2. Build the session list page with filters
3. Add the conversation viewer sheet
4. Integrate statistics cards
5. Wire up navigation and routing
6. Test admin access with RLS policies
