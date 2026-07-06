-- =========================================================================
-- Harden function search_path — remediate `function_search_path_mutable` (×8).
--
-- Supabase security-advisor lint 0011: a function without a fixed `search_path`
-- resolves unqualified names against the CALLER's search_path at call time, so a
-- hostile search_path (e.g. an object shadowed in a temp schema) can hijack what an
-- unqualified name binds to — especially dangerous for the SECURITY DEFINER function
-- below, which runs with elevated privilege. Pinning search_path closes that vector.
-- Metadata-only change: the function BODIES are untouched (ALTER ... SET, not CREATE).
--
-- Per-function value was verified against each live body (2026-07-06):
--   • the two pgvector match_* functions keep `extensions` on the path for the `<=>`
--     operator + `vector` type — mirrors the already-hardened
--     match_trending_sound_by_audio (`public, extensions`);
--   • the rest only touch public tables / pg_catalog built-ins → `public, pg_temp`
--     (mirrors the already-hardened refresh_niche_post_windows).
--
-- ref: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
-- =========================================================================

-- pgvector similarity search — `extensions` is required for the <=> operator + vector type.
alter function public.match_corpus_videos(vector, integer, text, text, text)
  set search_path = public, extensions;
alter function public.match_scraped_videos(vector, integer, text, text, text)
  set search_path = public, extensions;

-- SECURITY DEFINER counter — pins the path while running under elevated privilege.
alter function public.increment_creator_analysis_count(uuid)
  set search_path = public, pg_temp;

-- wallet-ledger trigger fns (read public tables / RAISE only).
alter function public.calculate_balance_after()
  set search_path = public, pg_temp;
alter function public.prevent_wallet_transaction_mutation()
  set search_path = public, pg_temp;

-- generic `updated_at` triggers (touch only NEW + now()).
alter function public.update_affiliate_links_updated_at()
  set search_path = public, pg_temp;
alter function public.update_updated_at_column()
  set search_path = public, pg_temp;
alter function public.update_user_settings_updated_at()
  set search_path = public, pg_temp;
