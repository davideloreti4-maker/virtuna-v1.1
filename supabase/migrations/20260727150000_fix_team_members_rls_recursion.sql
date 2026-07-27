-- GET /api/team answered 500 for every signed-in user:
--   42P17  infinite recursion detected in policy for relation "team_members"
--
-- All three team_members policies (20260217200000_teams.sql) answered "which teams am I in?"
-- with a subquery ON team_members. Postgres applies row-level security to that inner SELECT
-- too, which re-enters the same policy, forever. The table could not be read at all.
--
-- `teams` was collateral: its SELECT policy subqueries team_members, so reading a team hit
-- team_members' RLS and recursed with it. Both tables were unreadable, which is the actual
-- shape of the 500 — the route's auto-create path INSERTs a team and asks for the id back,
-- and the RETURNING row was filtered by a policy that could only raise.
--
-- The fix is the standard one: move the lookup into a SECURITY DEFINER function. RLS is not
-- applied inside it, so there is no second entry into the policy and no recursion. The
-- functions take no arguments (or only the row's own team_id) and are hard-wired to
-- auth.uid()/auth.email(), so a caller cannot ask about anybody else — they expose strictly
-- what the policies already intended to expose. `search_path` is pinned because a
-- SECURITY DEFINER function that resolves names through the caller's search_path is an
-- privilege-escalation primitive.
--
-- Second bug, fixed in the same pass because the recursion was hiding it: the INSERT policy
-- required the user to ALREADY be an active owner/admin of the team they were inserting into.
-- Nobody can satisfy that for a team created one statement ago, so bootstrapping the first
-- membership row was impossible and /api/team would have minted an orphan team on every
-- request even after the recursion was cleared. The owner of a team may now add THEMSELVES
-- to it — that clause and no wider.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The teams this user belongs to (or has been invited to).
CREATE OR REPLACE FUNCTION public.current_user_team_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT tm.team_id
  FROM public.team_members tm
  WHERE (tm.user_id = (SELECT auth.uid()) OR tm.invited_email = (SELECT auth.email()))
    AND tm.status IN ('invited', 'active');
$$;

-- The teams this user can administer. Active membership only: an INVITED owner is not one yet.
CREATE OR REPLACE FUNCTION public.current_user_admin_team_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT tm.team_id
  FROM public.team_members tm
  WHERE tm.user_id = (SELECT auth.uid())
    AND tm.role IN ('owner', 'admin')
    AND tm.status = 'active';
$$;

-- Does this user own the team outright? The bootstrap check — true before any membership row
-- exists, which is the whole point.
CREATE OR REPLACE FUNCTION public.current_user_owns_team(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = p_team_id AND t.owner_id = (SELECT auth.uid())
  );
$$;

-- Not EXECUTE-to-PUBLIC by default. `anon` is granted deliberately: without it an anonymous
-- read raises 42501 instead of returning the empty set the policy intends (auth.uid() is null
-- for anon, so every one of these yields nothing).
REVOKE ALL ON FUNCTION public.current_user_team_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_admin_team_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_owns_team(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_team_ids() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_admin_team_ids() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_owns_team(uuid) TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- team_members — the recursion itself
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Team members can read team roster" ON public.team_members;
CREATE POLICY "Team members can read team roster"
  ON public.team_members FOR SELECT
  USING (team_id IN (SELECT public.current_user_team_ids()));

DROP POLICY IF EXISTS "Team owners/admins can insert members" ON public.team_members;
CREATE POLICY "Team owners/admins can insert members"
  ON public.team_members FOR INSERT
  WITH CHECK (
    team_id IN (SELECT public.current_user_admin_team_ids())
    -- Bootstrap: the owner of a brand-new team may add THEMSELVES. Without this the first
    -- membership row can never be written, because writing it is what would authorise it.
    OR (public.current_user_owns_team(team_id) AND user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Team owners/admins can update members" ON public.team_members;
CREATE POLICY "Team owners/admins can update members"
  ON public.team_members FOR UPDATE
  USING (team_id IN (SELECT public.current_user_admin_team_ids()))
  -- Explicit, not inherited: without it an admin could move a row to a team they do not
  -- administer, since an omitted WITH CHECK only re-checks the row as it was found.
  WITH CHECK (team_id IN (SELECT public.current_user_admin_team_ids()));

-- ---------------------------------------------------------------------------
-- teams — same lookup, same fix
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Team members can read their team" ON public.teams;
CREATE POLICY "Team members can read their team"
  ON public.teams FOR SELECT
  USING (
    id IN (SELECT public.current_user_team_ids())
    -- The owner, unconditionally. A team is INSERTed one statement before its membership row
    -- exists, and `INSERT ... RETURNING id` is filtered by this policy — so without the owner
    -- clause creating a team appears to fail even when the row is written.
    OR owner_id = (SELECT auth.uid())
  );
