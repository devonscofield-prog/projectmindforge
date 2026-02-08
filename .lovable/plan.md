

# Admin AI Assistant -- Context-Aware Chat

## Overview

A floating AI chat available on all admin pages that understands the current page context and can answer questions about any data in the app. It uses the existing OpenAI API (GPT-5.2) and follows the same architectural pattern as the Sales Assistant Chat.

## How It Works

The admin clicks a floating button (bottom-right corner, only visible to admins). A slide-out sheet opens with a chat interface. The assistant automatically knows which page the admin is on and fetches relevant data as context before responding.

## Architecture

### 1. Edge Function: `admin-assistant-chat`

**New file:** `supabase/functions/admin-assistant-chat/index.ts`

- Accepts `{ messages, page_context }` where `page_context` is the current route (e.g., `/admin/sales-coach`)
- Verifies the user is authenticated and has the `admin` role (via `user_roles` table)
- Rate-limited to 20 requests/minute per user
- Based on `page_context`, fetches relevant data from the database:

| Route | Data Fetched |
|-------|-------------|
| `/admin` (Dashboard) | User counts, team counts, call stats (7d), recent activity |
| `/admin/sales-coach` (Coach History) | Recent coach sessions with user names, session stats, usage trends |
| `/admin/history` (Call History) | Recent calls with analysis summaries, rep performance |
| `/admin/users` | User list with roles, team assignments, activity status |
| `/admin/teams` | Team structure, member counts, performance |
| `/admin/accounts` | Account overview, heat scores, pipeline values |
| `/admin/coaching` | Coaching trends, aggregate scores |
| `/admin/performance` | Performance metrics, alerts |
| Default | High-level app summary (user count, call count, team count) |

- System prompt instructs the AI it is an admin assistant with full visibility into the platform
- Calls OpenAI GPT-5.2 directly (matching existing pattern) with streaming
- Returns SSE stream

### 2. Frontend: Streaming API

**New file:** `src/api/adminAssistantChat.ts`

- `streamAdminAssistantChat({ messages, pageContext, onDelta, onDone, onError })`
- Follows the exact same SSE streaming pattern as `salesAssistant.ts`
- Sends auth token via Authorization header

### 3. Frontend: Chat Component

**New file:** `src/components/admin/AdminAssistantChat.tsx`

- Floating button (bottom-right) with a sheet/drawer that slides open
- Only renders when `role === 'admin'`
- Uses `useLocation()` to detect the current route and passes it as `page_context`
- Chat history with markdown rendering (ReactMarkdown)
- Session persistence in a new `admin_assistant_sessions` table
- Quick action suggestions based on current page context
- Typing indicator, rate-limit countdown, error handling

### 4. Database: Session Persistence

**New table:** `admin_assistant_sessions`

```text
id            uuid (PK, default gen_random_uuid())
user_id       uuid (FK to profiles.id, NOT NULL)
title         text
messages      jsonb (NOT NULL, default '[]')
page_context  text
created_at    timestamptz (default now())
updated_at    timestamptz (default now())
```

RLS policies:
- Admins can SELECT/INSERT/UPDATE/DELETE their own sessions (`auth.uid() = user_id` AND user has admin role)

### 5. Integration Point

**Modified file:** `src/components/layout/AppLayout.tsx`

- Import and render `<AdminAssistantChat />` inside the layout, conditionally when `role === 'admin'`
- The component self-manages its visibility via portal (same pattern as SalesAssistantChat)

## Key Design Decisions

- **Uses OpenAI directly** (not Lovable AI Gateway) to match the existing Sales Coach and Sales Assistant pattern, since `OPENAI_API_KEY` is already configured
- **Page-aware context fetching** happens server-side in the edge function so the admin doesn't need to manually specify what they're asking about
- **Reuses existing UI patterns** from SalesAssistantChat (floating button, Sheet, markdown rendering, session management)
- **Admin-only access** enforced both in the edge function (role check) and frontend (conditional render)

## Files Created/Modified

| File | Action |
|------|--------|
| `supabase/functions/admin-assistant-chat/index.ts` | Create |
| `src/api/adminAssistantChat.ts` | Create |
| `src/components/admin/AdminAssistantChat.tsx` | Create |
| `src/components/layout/AppLayout.tsx` | Modify (add AdminAssistantChat) |
| Database migration (admin_assistant_sessions table) | Create |

