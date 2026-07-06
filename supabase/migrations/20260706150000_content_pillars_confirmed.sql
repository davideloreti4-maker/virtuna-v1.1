-- =========================================================================
-- Pillar confirm gate (propose→confirm, Move 2). The clustering job auto-creates
-- pillars with frozen names; `confirmed` tracks whether the creator has reviewed
-- them via the one-time "we found your themes — look right?" card. false until they
-- confirm (or rename/remove + confirm). Drives whether /start shows the card.
-- Existing rows default to false so already-clustered creators get the review once.
-- =========================================================================

ALTER TABLE public.content_pillars
  ADD COLUMN IF NOT EXISTS confirmed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.content_pillars.confirmed IS
  'True once the creator has reviewed the auto-clustered pillar via the propose→confirm card. Names stay frozen either way; confirm just dismisses the one-time review.';
