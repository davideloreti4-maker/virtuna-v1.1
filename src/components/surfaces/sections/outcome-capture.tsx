"use client";

/**
 * OutcomeCapture — the flywheel's "measure" entry point on /start (FLYWHEEL-01).
 *
 * Closes the loop: a creator who pre-tested ideas here, then posted one, pastes the
 * posted link → POST /api/outcomes/signature scrapes the real public metrics, builds a
 * realized disposition signature, and reconciles it against the PINNED prediction for
 * this audience (feeding the recalibration flywheel).
 *
 * ATTRIBUTION (v1, owner-approved 2026-07-06): predictions are pinned audience-scoped +
 * rank-1 (no per-card id yet), so this reconciles against the audience's latest
 * un-realized prediction — hence the audience-level copy ("your people"), never a
 * per-idea claim. The recalibration confidence gate (N≥5) is built to tolerate this
 * coarseness; precise per-post receipts arrive with per-card pin ids + the loop-receipt
 * UI (follow-ups).
 *
 * Honesty spine: on success we do NOT fabricate a "predicted vs actual" number here (the
 * done event returns only ids) — the comparison surfaces in the loop once the receipt UI
 * lands. Any scrape / no-prediction failure shows honest copy, never a faked result.
 */

import { useState } from "react";
import { useOutcomeSignature } from "@/hooks/queries/use-outcome-signature";

/** A real audience UUID (or null=General) is the only valid pin/reconcile key — presets
 *  (non-UUID) aren't persisted, so they can't carry a pinned prediction. Mirrors start-page. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function OutcomeCapture({
  audienceId,
  audienceLabel = "your audience",
}: {
  /** The active audience id (UUID) or null=General — must match the pinned prediction's audience. */
  audienceId: string | null;
  /** Human label for the honest audience-scoped copy ("how <label> actually reacted"). */
  audienceLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const { capture, isCapturing, isDone, error, statusMessage, reset } = useOutcomeSignature();

  // Presets (non-UUID) coerce to null (General) so the request validates; a preset pre-test
  // simply won't have a matching pinned prediction (honest no-match error if so).
  const audienceKey = audienceId && UUID_PATTERN.test(audienceId) ? audienceId : null;

  const canSubmit = url.trim().length > 0 && !isCapturing;

  const submit = () => {
    if (!canSubmit) return;
    void capture({ audience_id: audienceKey, posted_url: url.trim() });
  };

  const startOver = () => {
    reset();
    setUrl("");
    setOpen(false);
  };

  return (
    <div className="mt-3 rounded-2xl border border-white/[0.06] bg-[#221f1d] px-4 py-3">
      {isDone ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground">Locked in.</p>
            <p className="mt-0.5 text-[12px] leading-snug text-foreground-muted">
              Maven read the real numbers and compared them to what {audienceLabel} predicted —
              the read lands in your loop.
            </p>
          </div>
          <button
            type="button"
            onClick={startOver}
            className="shrink-0 text-[12px] text-foreground-muted underline-offset-2 hover:underline"
          >
            Add another
          </button>
        </div>
      ) : open ? (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] leading-snug text-foreground-muted">
            Paste the link to the post — we&apos;ll check how {audienceLabel} actually reacted
            vs the prediction.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="https://www.tiktok.com/@you/video/…"
              disabled={isCapturing}
              className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-[#1a1917] px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-foreground-muted/60 focus:border-white/20 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="shrink-0 rounded-lg bg-white/[0.08] px-3 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-white/[0.12] disabled:opacity-40"
            >
              {isCapturing ? "Reading…" : "See how it did"}
            </button>
          </div>
          {isCapturing && statusMessage && (
            <p className="text-[12px] text-foreground-muted">{statusMessage}</p>
          )}
          {error && (
            <p className="text-[12px] leading-snug text-[var(--color-warning)]">{error}</p>
          )}
          {!isCapturing && (
            <button
              type="button"
              onClick={startOver}
              className="self-start text-[11px] text-foreground-muted hover:underline"
            >
              Cancel
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="text-[13px] text-foreground-muted">
            <span className="text-foreground">Posted a pre-tested idea?</span> See how your
            people actually reacted.
          </span>
          <span className="shrink-0 text-[13px] text-foreground">Add the link →</span>
        </button>
      )}
    </div>
  );
}
