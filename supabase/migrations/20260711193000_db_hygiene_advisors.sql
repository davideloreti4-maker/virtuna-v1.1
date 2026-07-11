-- DB hygiene sweep driven by the Supabase advisors (2026-07-11).
--
-- §1 auth_rls_initplan ×39 — wrap auth.uid()/auth.email() in scalar subselects so they are
--    evaluated once per statement instead of once per row. Expressions otherwise verbatim
--    from pg_policies, so semantics are identical.
-- §2 multiple_permissive_policies ×3 — drop provably-redundant duplicates:
--    audiences_select_own / cpw_select_own duplicate their FOR ALL twins on the same role
--    with identical quals; niche_post_windows_no_user_writes is a PERMISSIVE false policy,
--    which adds nothing (permissive policies OR together; absent write policies already deny).
-- §3 rls_policy_always_true — drop the competitor_profiles client INSERT policy: every code
--    path that writes competitor_profiles goes through the service client (add, retry-scrape,
--    refresh cron, channel ingest), which bypasses RLS. waitlist's always-true INSERT stays:
--    that is the intentional public-funnel pattern.
-- §4 public_bucket_allows_listing — avatars: replace the bucket-wide SELECT policy with an
--    own-folder one. Public-URL rendering never touches RLS; the scoped SELECT keeps
--    /api/profile/avatar's user-client upsert working (ON CONFLICT DO UPDATE must read the
--    conflicting row, which lives in the user's own folder).
-- §5 function_search_path_mutable ×10 — pin search_path (extensions included so the vector
--    operators used by the match_* functions keep resolving).
-- §6 *_security_definer_function_executable — revoke client EXECUTE on the three server-only
--    RPCs; all call sites use the service client, whose explicit grant remains.
--
-- Left deliberately unchanged: the 4 RLS-enabled-no-policy engine tables (deny-all is the
-- intended state; service role writes them), unused/duplicate indexes (separate judgment
-- pass), and the auth-config items (leaked-password protection, MFA options) which are
-- dashboard settings, not SQL.

-- §1 — initplan rewrites -----------------------------------------------------------------

alter policy "account_posts_all_own" on public.account_posts
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "account_snapshots_all_own" on public.account_snapshots
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter policy "Users can create own affiliate links" on public.affiliate_links
  with check ((select auth.uid()) = user_id);
alter policy "Users can delete own affiliate links" on public.affiliate_links
  using ((select auth.uid()) = user_id);
alter policy "Users can update own affiliate links" on public.affiliate_links
  using ((select auth.uid()) = user_id);
alter policy "Users can view own affiliate links" on public.affiliate_links
  using ((select auth.uid()) = user_id);

alter policy "analysis_chats_insert_own" on public.analysis_chats
  with check ((user_id = (select auth.uid())) and (exists (select 1 from analysis_results
    where analysis_results.id = analysis_chats.analysis_id
      and analysis_results.user_id = (select auth.uid()))));
alter policy "analysis_chats_select_own" on public.analysis_chats
  using ((user_id = (select auth.uid())) and (exists (select 1 from analysis_results
    where analysis_results.id = analysis_chats.analysis_id
      and analysis_results.user_id = (select auth.uid()))));

alter policy "audiences_all_own" on public.audiences
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "connected_accounts_all_own" on public.connected_accounts
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "content_pillars_all_own" on public.content_pillars
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "cpw_upsert_own" on public.creator_persona_weights
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter policy "messages_insert_own" on public.messages
  with check (exists (select 1 from threads
    where threads.id = messages.thread_id and threads.user_id = (select auth.uid())));
alter policy "messages_select_own" on public.messages
  using (exists (select 1 from threads
    where threads.id = messages.thread_id and threads.user_id = (select auth.uid())));

alter policy "os_all_own" on public.outcome_signatures
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "personal_teardowns_all_own" on public.personal_teardowns
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "planned_posts_all_own" on public.planned_posts
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter policy "projects_user_delete" on public.projects using (user_id = (select auth.uid()));
alter policy "projects_user_insert" on public.projects with check (user_id = (select auth.uid()));
alter policy "projects_user_read" on public.projects using (user_id = (select auth.uid()));
alter policy "projects_user_update" on public.projects
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy "rec_all_own" on public.reconciliations
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "saved_all_own" on public.saved_items
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "surface_reactions_all_own" on public.surface_reactions
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter policy "Team members can read team roster" on public.team_members
  using (team_id in (select tm.team_id from team_members tm
    where ((tm.user_id = (select auth.uid())) or (tm.invited_email = (select auth.email())))
      and tm.status = any (array['invited'::text, 'active'::text])));
alter policy "Team owners/admins can insert members" on public.team_members
  with check (team_id in (select tm.team_id from team_members tm
    where tm.user_id = (select auth.uid())
      and tm.role = any (array['owner'::text, 'admin'::text])
      and tm.status = 'active'::text));
alter policy "Team owners/admins can update members" on public.team_members
  using (team_id in (select tm.team_id from team_members tm
    where tm.user_id = (select auth.uid())
      and tm.role = any (array['owner'::text, 'admin'::text])
      and tm.status = 'active'::text));

alter policy "Authenticated users can create teams" on public.teams
  with check ((select auth.uid()) = owner_id);
alter policy "Team members can read their team" on public.teams
  using (id in (select team_members.team_id from team_members
    where ((team_members.user_id = (select auth.uid()))
        or (team_members.invited_email = (select auth.email())))
      and team_members.status = any (array['invited'::text, 'active'::text])));
alter policy "Team owners can update their team" on public.teams
  using (owner_id = (select auth.uid()));

alter policy "threads_insert_own" on public.threads with check (user_id = (select auth.uid()));
alter policy "threads_select_own" on public.threads using (user_id = (select auth.uid()));
alter policy "threads_update_own" on public.threads
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy "tracked_all_own" on public.tracked_accounts
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter policy "Users can insert own settings" on public.user_settings
  with check ((select auth.uid()) = user_id);
alter policy "Users can read own settings" on public.user_settings
  using ((select auth.uid()) = user_id);
alter policy "Users can update own settings" on public.user_settings
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- §2 — redundant permissive duplicates ---------------------------------------------------

drop policy "audiences_select_own" on public.audiences;
drop policy "cpw_select_own" on public.creator_persona_weights;
drop policy "niche_post_windows_no_user_writes" on public.niche_post_windows;

-- §3 — always-true client INSERT with no client call path --------------------------------

drop policy "Authenticated users can create competitor profiles" on public.competitor_profiles;

-- §4 — avatars: no more bucket-wide listing ----------------------------------------------

drop policy "Anyone can read avatars" on storage.objects;
create policy "Users can read own avatar folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars'::text
     and (select auth.uid())::text = (storage.foldername(name))[1]);

-- §5 — pin function search_path ----------------------------------------------------------

alter function public.prevent_wallet_transaction_mutation() set search_path = public, extensions, pg_temp;
alter function public.update_updated_at_column() set search_path = public, extensions, pg_temp;
alter function public.calculate_balance_after() set search_path = public, extensions, pg_temp;
alter function public.update_affiliate_links_updated_at() set search_path = public, extensions, pg_temp;
alter function public.update_user_settings_updated_at() set search_path = public, extensions, pg_temp;
alter function public.increment_creator_analysis_count(uuid) set search_path = public, extensions, pg_temp;
alter function public.match_corpus_videos(vector, integer, text, text, text) set search_path = public, extensions, pg_temp;
alter function public.match_scraped_videos(vector, integer, text, text, text) set search_path = public, extensions, pg_temp;
alter function public.match_shared_teardowns(vector, integer, text, text, text, text, text) set search_path = public, extensions, pg_temp;
alter function public.match_personal_teardowns(vector, uuid, integer, text, text, text) set search_path = public, extensions, pg_temp;

-- §6 — server-only RPCs: revoke client EXECUTE (service_role's explicit grant remains) ----

revoke execute on function public.compute_niche_percentiles(text, uuid, integer) from public, anon, authenticated;
revoke execute on function public.increment_creator_analysis_count(uuid) from public, anon, authenticated;
revoke execute on function public.waitlist_count() from public, anon, authenticated;
