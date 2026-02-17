-- Teams and team members tables
-- Replaces localStorage team management

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Team',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  invited_email TEXT,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'removed')),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for looking up user's teams
CREATE INDEX idx_team_members_user_id ON team_members(user_id) WHERE status = 'active';
CREATE INDEX idx_team_members_team_id ON team_members(team_id);

-- RLS for teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can read their team"
  ON teams FOR SELECT
  USING (
    id IN (
      SELECT team_id FROM team_members
      WHERE (user_id = auth.uid() OR invited_email = auth.email())
      AND status IN ('invited', 'active')
    )
  );

CREATE POLICY "Team owners can update their team"
  ON teams FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Authenticated users can create teams"
  ON teams FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- RLS for team_members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can read team roster"
  ON team_members FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members AS tm
      WHERE (tm.user_id = auth.uid() OR tm.invited_email = auth.email())
      AND tm.status IN ('invited', 'active')
    )
  );

CREATE POLICY "Team owners/admins can insert members"
  ON team_members FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members AS tm
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
      AND tm.status = 'active'
    )
  );

CREATE POLICY "Team owners/admins can update members"
  ON team_members FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM team_members AS tm
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
      AND tm.status = 'active'
    )
  );
