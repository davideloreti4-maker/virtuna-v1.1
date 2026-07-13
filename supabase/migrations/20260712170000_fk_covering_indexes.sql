-- FK covering indexes (advisor unindexed_foreign_keys, 2026-07-12)
--
-- The 12 remaining unindexed-FK advisor INFOs after the 2026-07-11 hygiene
-- sweep (#231). Covering indexes are traffic-independent (they speed FK-side
-- lookups + parent-delete cascades regardless of usage stats), so they land
-- now; the ~40 unused_index DROP candidates stay parked until real traffic
-- proves them dead (many belong to not-yet-live commerce tables).
--
-- Column lists derived from pg_constraint on prod, not guessed.

create index if not exists idx_account_posts_pillar_id on public.account_posts (pillar_id);
create index if not exists idx_affiliate_links_deal_id on public.affiliate_links (deal_id);
create index if not exists idx_analysis_chats_user_id on public.analysis_chats (user_id);
create index if not exists idx_analysis_results_parent_id on public.analysis_results (parent_id);
create index if not exists idx_audiences_source_account_id on public.audiences (source_account_id);
create index if not exists idx_competitor_intelligence_user_id on public.competitor_intelligence (user_id);
create index if not exists idx_reconciliations_outcome_signature_id on public.reconciliations (outcome_signature_id);
create index if not exists idx_referral_conversions_referral_code on public.referral_conversions (referral_code);
create index if not exists idx_saved_items_thread_id on public.saved_items (thread_id);
create index if not exists idx_teams_owner_id on public.teams (owner_id);
create index if not exists idx_threads_active_audience_id on public.threads (active_audience_id);
create index if not exists idx_user_settings_last_audience_id on public.user_settings (last_audience_id);
