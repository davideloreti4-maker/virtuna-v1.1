-- =========================================================================
-- The funnel's event sink — ONBOARDING-FUNNEL-DESIGN.md §8
--
-- `lib/analytics/funnel-events.ts` has existed since the funnel was designed,
-- and its own header says the quiet part: "THERE IS NO SINK YET. track()
-- buffers in memory and logs in dev. Nothing leaves the browser." Its only
-- call sites are in `components/offer/walkthrough/`, which §0b RETIRED as the
-- funnel's demo. So `checkout_paid` — the one number the whole design is
-- judged on — has never been emitted, and the funnel cannot be debugged at
-- all. This table is the sink.
--
-- ── Why user_id is NULLABLE and ON DELETE SET NULL ──────────────────────────
-- The first event in the funnel (`demo_view`) fires before any session exists,
-- so a NOT NULL user_id would drop the denominator of the only ratio that
-- matters. And `api/cron/reap-anonymous` deletes anonymous users by design —
-- with ON DELETE CASCADE the funnel would erase its own history every time the
-- reaper ran, leaving a conversion rate computed over survivors only. The
-- events outlive the identity they were recorded against; that is the point.
--
-- ── Why session_id carries the journey, not user_id ─────────────────────────
-- A /go visitor is anonymous at `demo_view` and identified at `trial_converted`
-- (§0b② links the email onto the SAME anon user, but only after checkout).
-- Stitching on user_id alone would split one journey across two identities, or
-- none. session_id is client-minted, persisted, and survives that transition,
-- so `demo_view → checkout_paid` is answerable with one GROUP BY.
--
-- ── RLS: enabled with NO policies ───────────────────────────────────────────
-- Deliberate, and the same shape the corpus tables use. Writes arrive through
-- POST /api/funnel on the SERVICE client, which bypasses RLS; reads are
-- analysis-time and admin-only. No policy means no client can read another
-- visitor's journey, and none needs to.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.funnel_events (
  id          bigserial PRIMARY KEY,
  event       text        NOT NULL,
  session_id  uuid        NOT NULL,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  payload     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- The three derived numbers in §8 are all "count event A then event B over a
-- window", so (event, created_at) is the shape every one of them scans.
CREATE INDEX IF NOT EXISTS funnel_events_event_created_idx
  ON public.funnel_events (event, created_at DESC);

-- Journey reconstruction for a single visitor — the diagnostic view.
CREATE INDEX IF NOT EXISTS funnel_events_session_idx
  ON public.funnel_events (session_id, created_at);

ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.funnel_events IS
  'Onboarding funnel events (DESIGN §8). Written by POST /api/funnel via the service client. RLS on, no policies: service-role writes, admin-only reads.';
