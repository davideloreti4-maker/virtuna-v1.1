-- =========================================================================
-- funnel_events: WHERE did this event come from?
--
-- ── The defect ─────────────────────────────────────────────────────────────
-- The table records event, session, user and payload — and nothing about the
-- host. Dev shares PROD's Supabase project (one project, both environments),
-- so every `npm run dev` page load, every Playwright probe and every
-- `npm run start` audit writes into the same table as a real visitor.
--
-- Measured 2026-08-13: 320 `start_landed` events across 257 sessions, and
-- there is no column that can tell which of them came from a browser that was
-- not on this laptop. The number is therefore unusable — not "approximate",
-- unusable, because the contamination is unbounded and not estimable after the
-- fact. That is the whole top of the funnel.
--
-- ── Why two columns and not one ────────────────────────────────────────────
-- `origin` is the Host header: `localhost:3016` vs `virtuna-v11.vercel.app`.
-- That alone answers "is this real traffic", which is the blocking question.
--
-- `path` is the pathname the beacon fired from, taken from the Referer. It is
-- free at the same call site and answers a question that is currently also
-- unanswerable: WHICH surface emitted an event. Several events are emitted
-- from more than one place (`checkout_open` has two call sites), and one of
-- this session's findings was that four declared events are emitted only from
-- components no route mounts — a fact that took a code audit to establish and
-- that this column would have shown directly.
--
-- ── Both are SERVER-DERIVED, never client-supplied ─────────────────────────
-- Same rule the route already applies to user_id: "a client-supplied user_id
-- is an attribution forgery waiting to happen." These are read off the request
-- headers in POST /api/funnel and are not accepted from the body, so a caller
-- cannot label its own traffic as production.
--
-- ── Nullable, and no backfill ──────────────────────────────────────────────
-- Every existing row predates the instrumentation and its origin is genuinely
-- unknown. NULL says exactly that. Backfilling a guess would launder the
-- contamination this column exists to expose, so: rows before this migration
-- are NULL and must be excluded from any traffic claim, not assumed.
-- =========================================================================

ALTER TABLE public.funnel_events
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS path   text;

COMMENT ON COLUMN public.funnel_events.origin IS
  'Host header of the beacon request, server-derived (e.g. "virtuna-v11.vercel.app", "localhost:3015"). NULL = recorded before 2026-08-13, origin unknown — exclude from traffic claims, do not assume production.';

COMMENT ON COLUMN public.funnel_events.path IS
  'Pathname the event fired from, server-derived from Referer. NULL when the header is absent or unparseable.';

-- Traffic questions are all "real events of type X over a window", so origin
-- leads: it is the filter every honest query applies before anything else.
CREATE INDEX IF NOT EXISTS funnel_events_origin_event_created_idx
  ON public.funnel_events (origin, event, created_at DESC);
