-- =========================================================================
-- Atomic variants merge — fix the analysis_results.variants lost-update race.
--
-- Bug: four writers persist into the same `variants` JSONB blob — craft + apollo
-- (score run), remix.decode (remix run), and filmstrip_segments (filmstrip extract) —
-- each via read-modify-write (`SELECT variants` → spread → `UPDATE variants`). Those
-- flows run in SEPARATE requests and overlap on the same analysis row, so a writer's
-- stale read clobbers a sibling key written after its read committed (a classic lost
-- update). The `...current` spread only preserves siblings when reads/writes are
-- serialized — it does NOT under real concurrency.
--
-- Fix: each writer sends ONLY its own keys as a patch, and the merge happens inside a
-- single UPDATE. Postgres row-locking serializes concurrent UPDATEs on the same row
-- (READ COMMITTED re-reads the freshly-committed value), so every patch lands on top
-- of the previous one — no lost update, no read-modify-write window in app code.
--
-- Both functions pin search_path (advisor lint 0011) so this migration does not
-- reintroduce a mutable-search_path function.
-- =========================================================================

-- Recursive deep merge of two jsonb values.
--   • object ⨯ object  → keys unioned, shared object-keys merged recursively;
--   • otherwise (scalar/array/null-vs-value) → b wins when present, else a.
-- Deep (not the shallow `||`) so a `{remix:{decode}}` patch preserves remix.adapt /
-- remix.filmstrip siblings instead of replacing the whole `remix` object.
create or replace function public.jsonb_deep_merge(a jsonb, b jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when a is null or jsonb_typeof(a) <> 'object' then coalesce(b, a)
    when b is null or jsonb_typeof(b) <> 'object' then coalesce(b, a)
    else (
      select coalesce(
        jsonb_object_agg(
          key,
          case
            when (a ? key) and (b ? key)
                 and jsonb_typeof(a -> key) = 'object'
                 and jsonb_typeof(b -> key) = 'object'
              then public.jsonb_deep_merge(a -> key, b -> key)
            when b ? key then b -> key
            else a -> key
          end
        ),
        '{}'::jsonb
      )
      from (
        select k as key from jsonb_object_keys(a) as k
        union
        select k as key from jsonb_object_keys(b) as k
      ) keys
    )
  end
$$;

-- Atomically patch an analysis row's variants: variants := deep_merge(variants, patch).
-- p_user_id enforces V4 access control (CR-02) when non-null; the filmstrip extract job
-- (secret-auth, service client, no session user) passes null and keys on id alone,
-- exactly as before. Runs under the caller's rights (service client already has access);
-- deliberately NOT security definer — no privilege escalation.
create or replace function public.patch_analysis_variants(
  p_id text,
  p_patch jsonb,
  p_user_id uuid default null
)
returns void
language sql
set search_path = public, pg_temp
as $$
  update public.analysis_results
  set variants = public.jsonb_deep_merge(coalesce(variants, '{}'::jsonb), p_patch)
  where id = p_id
    and (p_user_id is null or user_id = p_user_id);
$$;
