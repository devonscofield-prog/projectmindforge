-- Create sdr_team_invites table for shareable signup links
CREATE TABLE IF NOT EXISTS sdr_team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES sdr_teams(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  invite_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_uses INTEGER,
  times_used INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies for sdr_team_invites
ALTER TABLE sdr_team_invites ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage all team invites"
  ON sdr_team_invites FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- SDR Managers can manage invites for their own teams
CREATE POLICY "SDR managers can view own team invites"
  ON sdr_team_invites FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sdr_teams
      WHERE sdr_teams.id = sdr_team_invites.team_id
      AND sdr_teams.manager_id = auth.uid()
    )
  );

CREATE POLICY "SDR managers can create invites for own teams"
  ON sdr_team_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sdr_teams
      WHERE sdr_teams.id = sdr_team_invites.team_id
      AND sdr_teams.manager_id = auth.uid()
    )
  );

CREATE POLICY "SDR managers can update own team invites"
  ON sdr_team_invites FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sdr_teams
      WHERE sdr_teams.id = sdr_team_invites.team_id
      AND sdr_teams.manager_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sdr_teams
      WHERE sdr_teams.id = sdr_team_invites.team_id
      AND sdr_teams.manager_id = auth.uid()
    )
  );

-- Allow anonymous/public read of active invites (for signup page validation)
-- This is limited to just checking if a token is valid
CREATE POLICY "Anyone can read active invites by token"
  ON sdr_team_invites FOR SELECT
  TO anon
  USING (is_active = true);
