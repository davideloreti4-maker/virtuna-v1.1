'use client';

/**
 * Run notices — the shared error + degrade blocks every skill run renders (2026-07-19
 * unification pass, same motive as card-primitives.tsx: five thread views carried byte-identical
 * hand-rolled copies of SkillRunError, and only hooks rendered RunWarnings at all, so a degrade
 * on any other skill was invisible at the glass).
 *
 *  - <SkillRunError>  — W2: the run failed. role="alert"; retry fires ONLY on tap, never render.
 *  - <RunWarnings>    — the `warning` SSE channel: a degrade is NOT a failure (the cards are real
 *                       and were charged), so this is a quiet role="status" note, never the alert.
 */

export interface SkillRunErrorProps {
  /** Re-invokes the run from the parent. Fires only on explicit tap (W2). */
  onRetry?: () => void;
  /** Accessible retry label, e.g. "Retry the hooks run". */
  retryLabel?: string;
  /** Override headline (default = the generation-skill copy). */
  headline?: string;
  /** Override body (default = the generation-skill copy). */
  body?: string;
}

export function SkillRunError({
  onRetry,
  retryLabel = 'Retry the run',
  headline = 'Couldn’t finish that run.',
  body = 'The generation or SIM-1 pass dropped out. Tap to retry — nothing was charged.',
}: SkillRunErrorProps) {
  return (
    <div
      className="rounded-xl border border-white/[0.06] px-4 py-3 flex flex-col gap-1"
      role="alert"
      aria-live="assertive"
    >
      <p className="text-sm font-semibold" style={{ color: 'var(--color-cream-secondary)' }}>
        {headline}
      </p>
      <p className="text-sm" style={{ color: 'var(--color-cream-muted)' }}>
        {body}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 text-sm font-medium self-start transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10"
          style={{ color: 'var(--color-cream-secondary)' }}
          aria-label={retryLabel}
        >
          Retry →
        </button>
      )}
    </div>
  );
}

export interface RunWarningsProps {
  /** The pipeline's own warning strings, verbatim. Caller guarantees length > 0. */
  warnings: string[];
}

export function RunWarnings({ warnings }: RunWarningsProps) {
  return (
    <div
      className="rounded-xl border border-white/[0.06] px-4 py-3 flex flex-col gap-1"
      role="status"
      aria-live="polite"
    >
      <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-cream-muted)' }}>
        Heads up — this run degraded
      </p>
      {warnings.map((w, i) => (
        <p key={i} className="text-sm" style={{ color: 'var(--color-cream-muted)' }}>
          {w}
        </p>
      ))}
    </div>
  );
}
