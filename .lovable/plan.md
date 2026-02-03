

# Minimal-Permission Microsoft Graph Integration Architecture

## Overview

This plan outlines a **least-privilege** integration with Microsoft Graph API, requesting only the specific scopes needed for:
1. **Teams Meeting Transcript Auto-Import** - Eliminating manual transcript pasting
2. **Calendar Integration** - Pre-call briefings and meeting detection

## Requested Permissions (Minimal Scope)

| Scope | Type | Purpose | Justification |
|-------|------|---------|---------------|
| `User.Read` | Delegated | Display name, SSO | Required for any Graph integration |
| `Calendars.Read` | Delegated | Read calendar events | Pre-call prep, meeting detection |
| `OnlineMeetings.Read` | Delegated | Read Teams meeting details | Access meeting transcripts |
| `offline_access` | Delegated | Refresh tokens | Maintain persistent connection |

**What We Explicitly Do NOT Request:**
- `Mail.Read` - No email access in this minimal scope
- `Mail.ReadWrite` / `Calendars.ReadWrite` - No write access
- `Files.Read` - No OneDrive/SharePoint access
- `Directory.Read.All` - No org-wide directory access
- Any **Application** permissions - Per-user consent only

---

## Technical Architecture

### Component Overview

```text
+------------------+     +----------------------+     +------------------+
|   User Browser   |     |   Lovable Cloud      |     |  Microsoft 365   |
|   (React App)    |     |   (Edge Functions)   |     |  (Graph API)     |
+------------------+     +----------------------+     +------------------+
        |                         |                          |
        |  1. Click "Connect"     |                          |
        +------------------------>|                          |
        |                         |  2. Generate auth URL    |
        |<------------------------+                          |
        |                         |                          |
        |  3. Redirect to Microsoft login                    |
        +------------------------------------------------------->
        |                         |                          |
        |  4. User consents       |                          |
        |<-------------------------------------------------------+
        |                         |                          |
        |  5. Callback with code  |                          |
        +------------------------>|                          |
        |                         |  6. Exchange for tokens  |
        |                         +------------------------->|
        |                         |<-------------------------+
        |                         |  7. Store encrypted      |
        |                         |                          |
        |  8. Connection success  |                          |
        |<------------------------+                          |
```

---

## Database Schema

### New Tables

#### 1. `ms_graph_connections` - User OAuth Tokens

```sql
CREATE TABLE ms_graph_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Token storage (encrypted at rest by Supabase)
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  
  -- Microsoft identity
  ms_user_id TEXT NOT NULL,          -- Microsoft user object ID
  ms_email TEXT,                      -- Microsoft email for display
  ms_display_name TEXT,               -- Microsoft display name
  
  -- Connection metadata
  scopes TEXT[] NOT NULL,             -- Granted scopes for audit
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_user_connection UNIQUE(user_id)
);

-- RLS: Users can only access their own connection
ALTER TABLE ms_graph_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connection"
  ON ms_graph_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connection"
  ON ms_graph_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connection"
  ON ms_graph_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own connection"
  ON ms_graph_connections FOR DELETE
  USING (auth.uid() = user_id);
```

#### 2. `ms_calendar_events` - Synced Meeting Metadata

```sql
CREATE TABLE ms_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Microsoft identifiers
  ms_event_id TEXT NOT NULL,
  ms_meeting_id TEXT,                 -- Teams meeting ID (if online)
  
  -- Event details (metadata only, not full body)
  subject TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location TEXT,
  is_online_meeting BOOLEAN DEFAULT false,
  organizer_email TEXT,
  attendees JSONB,                    -- [{email, name, response}]
  
  -- Transcript sync status
  transcript_synced BOOLEAN DEFAULT false,
  linked_call_id UUID REFERENCES call_transcripts(id),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_user_event UNIQUE(user_id, ms_event_id)
);

-- RLS: Users can only see their own events
ALTER TABLE ms_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own events"
  ON ms_calendar_events FOR SELECT
  USING (auth.uid() = user_id);

-- Index for efficient meeting lookups
CREATE INDEX idx_ms_calendar_events_user_start 
  ON ms_calendar_events(user_id, start_time DESC);
  
CREATE INDEX idx_ms_calendar_events_meeting_id 
  ON ms_calendar_events(ms_meeting_id) 
  WHERE ms_meeting_id IS NOT NULL;
```

#### 3. `ms_graph_sync_log` - Audit Trail

```sql
CREATE TABLE ms_graph_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL,            -- 'calendar', 'transcript'
  status TEXT NOT NULL,               -- 'success', 'error', 'partial'
  items_synced INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Users can view their own sync logs
ALTER TABLE ms_graph_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync logs"
  ON ms_graph_sync_log FOR SELECT
  USING (auth.uid() = user_id);
```

---

## Edge Functions

### 1. `ms-graph-auth` - OAuth Flow Handler

**Purpose:** Handles the OAuth authorization code flow

**Endpoints:**
- `GET /authorize` - Generate Microsoft login URL
- `POST /callback` - Exchange code for tokens
- `DELETE /disconnect` - Revoke and remove connection

```text
Key Security Features:
├── State parameter with HMAC signature to prevent CSRF
├── PKCE (code_verifier/code_challenge) for secure token exchange
├── Tokens encrypted at rest in database
└── Immediate token validation after exchange
```

### 2. `ms-graph-sync` - Data Synchronization

**Purpose:** Fetches calendar events and meeting transcripts

**Operations:**
- `sync-calendar` - Pull upcoming meetings (next 7 days)
- `sync-transcript` - Fetch transcript for specific meeting
- `sync-past-meetings` - Backfill recent meetings (last 30 days)

```text
Rate Limiting:
├── 10 requests/minute per user for calendar sync
├── 5 requests/minute per user for transcript fetch
└── Exponential backoff on Graph API 429 responses
```

### 3. `ms-graph-token-refresh` - Token Management

**Purpose:** Background job to refresh expiring tokens

**Schedule:** Runs every 30 minutes via pg_cron

```text
Token Lifecycle:
├── Access tokens: 1 hour validity
├── Refresh tokens: 90 days validity
├── Auto-refresh when < 10 minutes remaining
└── Notify user if refresh fails (connection broken)
```

---

## Frontend Components

### 1. Settings Integration

**Location:** `src/pages/UserSettings.tsx`

New section: "Connected Services"

```text
┌─────────────────────────────────────────────────┐
│ Connected Services                              │
├─────────────────────────────────────────────────┤
│                                                 │
│ 🔗 Microsoft 365                                │
│    ┌──────────────────────────────────────────┐ │
│    │ ✓ Connected as john.doe@company.com     │ │
│    │   Last sync: 5 minutes ago               │ │
│    │                                          │ │
│    │ [Sync Now]  [Disconnect]                 │ │
│    └──────────────────────────────────────────┘ │
│                                                 │
│ Features enabled:                               │
│ ✓ Auto-import Teams meeting transcripts         │
│ ✓ Pre-call calendar briefings                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 2. Pre-Call Briefing Widget

**Location:** Rep Dashboard / Prospect Detail

```text
┌─────────────────────────────────────────────────┐
│ 📅 Upcoming: Meeting with Acme Corp             │
│    Today at 2:00 PM (in 45 minutes)             │
├─────────────────────────────────────────────────┤
│ Attendees:                                      │
│ • Sarah Johnson (CTO) - Final DM                │
│ • Mike Chen (VP Engineering) - Heavy Influencer │
│                                                 │
│ Last interaction: Discovery call on Jan 15     │
│ Heat Score: 72 (Warm)                           │
│                                                 │
│ [View Account] [Prepare for Call]               │
└─────────────────────────────────────────────────┘
```

### 3. Transcript Import UI

**Location:** Call submission flow

```text
┌─────────────────────────────────────────────────┐
│ Submit Call Transcript                          │
├─────────────────────────────────────────────────┤
│                                                 │
│ 📥 Import from Teams Meeting                    │
│    ┌──────────────────────────────────────────┐ │
│    │ Recent Teams Meetings:                   │ │
│    │                                          │ │
│    │ ○ Acme Corp Discovery - Jan 22, 2:00 PM  │ │
│    │ ○ Beta Inc Follow-up - Jan 21, 10:00 AM  │ │
│    │ ○ Gamma LLC Demo - Jan 20, 3:30 PM       │ │
│    │                                          │ │
│    │ [Import Selected]                        │ │
│    └──────────────────────────────────────────┘ │
│                                                 │
│ ─── OR ───                                      │
│                                                 │
│ 📝 Paste transcript manually                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Data Flow: Teams Transcript Import

```text
Step 1: User connects Microsoft 365 (one-time)
        ├── OAuth flow in popup window
        ├── Tokens stored encrypted
        └── Calendar sync triggered

Step 2: User opens "Submit Call" form
        ├── Frontend queries ms_calendar_events
        ├── Shows recent Teams meetings with transcripts
        └── User selects meeting to import

Step 3: Import transcript
        ├── Edge function calls Graph API
        │   GET /me/onlineMeetings/{id}/transcripts
        ├── Fetches transcript content
        │   GET /me/onlineMeetings/{id}/transcripts/{id}/content
        ├── Extracts meeting metadata (attendees, duration)
        └── Pre-fills call submission form

Step 4: User reviews and submits
        ├── Account name auto-detected from meeting subject
        ├── Attendees mapped to stakeholders
        ├── Transcript sent through existing analyze-call pipeline
        └── ms_calendar_events.transcript_synced = true
```

---

## Security Measures

### Token Security

| Measure | Implementation |
|---------|----------------|
| Encryption at rest | Supabase AES-256 encrypted storage |
| Token isolation | RLS ensures users only access own tokens |
| Minimal storage | Only access + refresh tokens stored |
| Secure transmission | TLS 1.3 for all API calls |

### Access Control

| Measure | Implementation |
|---------|----------------|
| Per-user consent | Delegated permissions only |
| Scope validation | Verify granted scopes match requested |
| Token validation | Validate JWT signature on each use |
| Revocation support | Users can disconnect anytime |

### Audit Logging

All Microsoft Graph API calls are logged to `ms_graph_sync_log`:
- Sync operations (success/failure)
- Token refreshes
- Disconnection events

---

## Implementation Phases

### Phase 1: OAuth Foundation (Week 1)
- [ ] Create `ms_graph_connections` table with RLS
- [ ] Implement `ms-graph-auth` edge function
- [ ] Add "Connect Microsoft 365" button in Settings
- [ ] Token storage and refresh logic

### Phase 2: Calendar Sync (Week 2)
- [ ] Create `ms_calendar_events` table
- [ ] Implement `ms-graph-sync` for calendar
- [ ] Pre-call briefing widget on Rep Dashboard
- [ ] Upcoming meetings list component

### Phase 3: Transcript Import (Week 3)
- [ ] Extend `ms-graph-sync` for transcript fetching
- [ ] Integrate transcript import into call submission
- [ ] Auto-detect account name from meeting subject
- [ ] Map attendees to stakeholders

### Phase 4: Polish & Monitoring (Week 4)
- [ ] Error handling and user notifications
- [ ] Sync status indicators
- [ ] Admin visibility into connection health
- [ ] Performance monitoring integration

---

## Configuration Requirements

### Secrets Needed

| Secret Name | Purpose |
|-------------|---------|
| `MS_CLIENT_ID` | Azure AD application client ID |
| `MS_CLIENT_SECRET` | Azure AD application client secret |
| `MS_TENANT_ID` | Azure AD tenant ID (or "common" for multi-tenant) |

### Azure AD App Registration

1. Register application in Azure Portal
2. Add redirect URI: `https://wuquclmippzuejqbcksl.supabase.co/functions/v1/ms-graph-auth/callback`
3. Configure API permissions (delegated):
   - `User.Read`
   - `Calendars.Read`
   - `OnlineMeetings.Read`
   - `offline_access`
4. Generate client secret (store securely)

---

## IT Security Talking Points

When presenting this to IT:

1. **Read-only access** - We cannot modify calendars, send emails, or access files
2. **Per-user consent** - No admin consent required; each user authorizes individually
3. **Minimal data storage** - Only calendar metadata stored; transcripts flow through existing pipeline
4. **Easy revocation** - Users can disconnect at any time; IT can revoke via Azure Portal
5. **Full audit trail** - All API calls logged with user, timestamp, and operation type
6. **No email access** - Explicitly excluded from this minimal scope

This architecture provides the two highest-value use cases (transcript auto-import + calendar prep) while maintaining the smallest possible permission footprint.

