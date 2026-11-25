-- =========================================================================
-- The edit tool's tables: grants narrowed to what is used (worker plan, Task 6)
--
-- Only the service role writes these tables (the app's service client and the
-- worker over PostgREST), and a signed-in creator reads their own rows through
-- RLS. Supabase's default grants also gave `anon` and `authenticated` every
-- privilege; RLS already refused them, but the advisor flagged the tables as
-- visible to `anon` in the GraphQL schema. So: nothing for `anon`, SELECT only
-- for `authenticated`. The service role bypasses both.
-- =========================================================================

REVOKE ALL ON TABLE public.edit_takes, public.edit_jobs FROM anon;
REVOKE ALL ON TABLE public.edit_takes, public.edit_jobs FROM authenticated;
GRANT SELECT ON TABLE public.edit_takes, public.edit_jobs TO authenticated;
