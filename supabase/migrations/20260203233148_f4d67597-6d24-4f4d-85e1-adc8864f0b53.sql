-- ============================================================================
-- Microsoft Graph Integration Tables
-- Phase 1: OAuth Foundation
-- ============================================================================

-- 1. ms_graph_connections - User OAuth Tokens
CREATE TABLE public.ms_graph_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Token storage (encrypted at rest by Supabase)
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  
  -- Microsoft identity
  ms_user_id TEXT NOT NULL,
  ms_email TEXT,
  ms_display_name TEXT,
  
  -- Connection metadata
  scopes TEXT[] NOT NULL,
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_user_ms_connection UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.ms_graph_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ms_graph_connections
CREATE POLICY "Users can view own MS connection"
  ON public.ms_graph_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own MS connection"
  ON public.ms_graph_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own MS connection"
  ON public.ms_graph_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own MS connection"
  ON public.ms_graph_connections FOR DELETE
  USING (auth.uid() = user_id);

-- 2. ms_calendar_events - Synced Meeting Metadata
CREATE TABLE public.ms_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Microsoft identifiers
  ms_event_id TEXT NOT NULL,
  ms_meeting_id TEXT,
  
  -- Event details
  subject TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location TEXT,
  is_online_meeting BOOLEAN DEFAULT false,
  organizer_email TEXT,
  attendees JSONB,
  
  -- Transcript sync status
  transcript_synced BOOLEAN DEFAULT false,
  linked_call_id UUID REFERENCES public.call_transcripts(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_user_ms_event UNIQUE(user_id, ms_event_id)
);

-- Enable RLS
ALTER TABLE public.ms_calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ms_calendar_events
CREATE POLICY "Users can view own MS events"
  ON public.ms_calendar_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own MS events"
  ON public.ms_calendar_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own MS events"
  ON public.ms_calendar_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own MS events"
  ON public.ms_calendar_events FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for efficient lookups
CREATE INDEX idx_ms_calendar_events_user_start 
  ON public.ms_calendar_events(user_id, start_time DESC);
  
CREATE INDEX idx_ms_calendar_events_meeting_id 
  ON public.ms_calendar_events(ms_meeting_id) 
  WHERE ms_meeting_id IS NOT NULL;

-- 3. ms_graph_sync_log - Audit Trail
CREATE TABLE public.ms_graph_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL,
  items_synced INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ms_graph_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy for sync logs
CREATE POLICY "Users can view own MS sync logs"
  ON public.ms_graph_sync_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own MS sync logs"
  ON public.ms_graph_sync_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for efficient log retrieval
CREATE INDEX idx_ms_graph_sync_log_user_created 
  ON public.ms_graph_sync_log(user_id, created_at DESC);

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_ms_graph_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to connections table
CREATE TRIGGER update_ms_graph_connections_updated_at
  BEFORE UPDATE ON public.ms_graph_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ms_graph_updated_at();

-- Apply trigger to calendar events table
CREATE TRIGGER update_ms_calendar_events_updated_at
  BEFORE UPDATE ON public.ms_calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ms_graph_updated_at();