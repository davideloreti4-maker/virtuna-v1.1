"use client";

/**
 * outcome-signature-form.tsx — Capture-outcome form (10-03 Task 3, FLYWHEEL-01).
 *
 * The NEW signature-based capture form (RESEARCH Open Q3): paste a posted URL → the
 * route scrapes public metrics, optionally folds in creator-supplied private signals,
 * builds a provenance-honest realized signature, and reconciles it against the pinned
 * prediction. The legacy score-delta `outcome-form.tsx` is left intact (no edits).
 *
 * Honesty spine (UI-SPEC §Color / §Copywriting):
 *  - Provenance tags ("from the post" public · "you added" supplied) are NEUTRAL cream — NEVER coral.
 *  - "Left blank = not counted (we never assume zero)." — a blank field is excluded, never zero-filled.
 *  - Success copy is "Outcome captured." with NO predicted-vs-actual headline delta
 *    (the flywheel reconciles signatures, not scores).
 *  - Accent (coral) touches ONLY the primary CTA + the input focus ring.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import {
  useOutcomeSignature,
  type CaptureSignalsInput,
} from "@/hooks/queries/use-outcome-signature";

interface OutcomeSignatureFormProps {
  /** The analysis the SIM ran under (pins the prediction to reconcile against). */
  analysisId?: string | null;
  /** The audience the SIM ran under. */
  audienceId?: string | null;
  /** Called after a successful capture. */
  onCaptured?: () => void;
}

// Flat-warm SSOT tokens (UI-SPEC §Color/§Spacing). Inter, 2 weights, accent only on CTA + focus ring.
const FIELD_LABEL =
  "block text-xs font-normal text-[var(--color-cream-muted)] mb-1";
const INPUT_CLASS =
  "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-charcoal-chip)] px-3 py-2 text-sm text-[var(--color-cream-primary)] placeholder:text-[var(--color-cream-muted)] focus:border-[var(--color-border-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";

/** Neutral cream provenance tag — NEVER coral (UI-SPEC §Color). */
function ProvenanceTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-2 inline-block rounded-[var(--radius-sm)] bg-[var(--color-charcoal-chip)] px-1.5 py-0.5 text-[11px] font-normal text-[var(--color-cream-muted)]">
      {children}
    </span>
  );
}

export function OutcomeSignatureForm({
  analysisId,
  audienceId,
  onCaptured,
}: OutcomeSignatureFormProps) {
  const [postedUrl, setPostedUrl] = useState("");
  const [showPrivate, setShowPrivate] = useState(false);
  const [saves, setSaves] = useState("");
  const [watchThrough, setWatchThrough] = useState("");
  const [linkClicks, setLinkClicks] = useState("");

  const { capture, statusMessage, isCapturing, error, isDone } =
    useOutcomeSignature();

  // Notify the parent once on the success transition (never during render).
  useEffect(() => {
    if (isDone) onCaptured?.();
  }, [isDone, onCaptured]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postedUrl.trim()) return;

    // A blank private field is OMITTED → excluded entirely (never zero-filled, Pitfall 3).
    const priv: NonNullable<CaptureSignalsInput["private"]> = {};
    if (saves.trim() !== "") priv.saves = Number(saves);
    if (watchThrough.trim() !== "") priv.watch_through_pct = Number(watchThrough);
    if (linkClicks.trim() !== "") priv.link_clicks = Number(linkClicks);

    // onCaptured fires via the isDone effect on the success path.
    void capture({
      analysis_id: analysisId ?? null,
      audience_id: audienceId ?? null,
      posted_url: postedUrl.trim(),
      private: Object.keys(priv).length > 0 ? priv : undefined,
    });
  };

  // Success: "Outcome captured." — NO predicted-vs-actual delta (flywheel reconciles signatures).
  if (isDone) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-charcoal-composer)] p-4">
        <Text size="sm" className="text-[var(--color-cream-primary)]">
          Outcome captured.
        </Text>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-charcoal-composer)] p-4 space-y-4"
    >
      <Text
        size="sm"
        className="font-semibold text-[var(--color-cream-primary)]"
      >
        Capture outcome
      </Text>

      {/* Posted video URL — the primary, low-friction path. */}
      <div>
        <label className={FIELD_LABEL} htmlFor="posted-url">
          Posted video URL
          <ProvenanceTag>from the post</ProvenanceTag>
        </label>
        <input
          id="posted-url"
          type="url"
          value={postedUrl}
          onChange={(e) => setPostedUrl(e.target.value)}
          placeholder="https://…"
          className={INPUT_CLASS}
          required
        />
        <Text
          size="sm"
          className="mt-1 text-[var(--color-cream-muted)]"
        >
          We&apos;ll pull public metrics (views, likes, comments, shares) from the
          post.
        </Text>
      </div>

      {/* Add private signals — collapsed optional section. */}
      <div>
        <button
          type="button"
          onClick={() => setShowPrivate((v) => !v)}
          className="text-xs font-normal text-[var(--color-cream-secondary)] hover:text-[var(--color-cream-primary)]"
        >
          {showPrivate ? "− " : "+ "}Add private signals (optional)
        </button>

        {showPrivate && (
          <div className="mt-3 space-y-3">
            <div>
              <label className={FIELD_LABEL} htmlFor="priv-saves">
                Saves
                <ProvenanceTag>you added</ProvenanceTag>
              </label>
              <input
                id="priv-saves"
                type="number"
                min="0"
                value={saves}
                onChange={(e) => setSaves(e.target.value)}
                placeholder="—"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={FIELD_LABEL} htmlFor="priv-watch">
                Watch-through %
                <ProvenanceTag>you added</ProvenanceTag>
              </label>
              <input
                id="priv-watch"
                type="number"
                min="0"
                max="100"
                value={watchThrough}
                onChange={(e) => setWatchThrough(e.target.value)}
                placeholder="—"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={FIELD_LABEL} htmlFor="priv-clicks">
                Link clicks
                <ProvenanceTag>you added</ProvenanceTag>
              </label>
              <input
                id="priv-clicks"
                type="number"
                min="0"
                value={linkClicks}
                onChange={(e) => setLinkClicks(e.target.value)}
                placeholder="—"
                className={INPUT_CLASS}
              />
            </div>

            {/* Honesty note — absent ≠ zero. */}
            <Text size="sm" className="text-[var(--color-cream-muted)]">
              Left blank = not counted (we never assume zero).
            </Text>
          </div>
        )}
      </div>

      {/* Scrape-fail error — generic copy, never echoes the URL. */}
      {error && (
        <Text size="sm" className="text-[var(--color-warning)]">
          Couldn&apos;t read that post. Check the URL is public, or add your metrics
          by hand below.
        </Text>
      )}

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isCapturing || postedUrl.trim() === ""}
      >
        {isCapturing
          ? (statusMessage ?? "Reading the post…")
          : "Capture outcome"}
      </Button>
    </form>
  );
}
