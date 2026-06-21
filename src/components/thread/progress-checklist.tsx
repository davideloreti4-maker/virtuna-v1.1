'use client';

/**
 * ProgressChecklist — transient SSE-stage-driven progress UI (Plan 05-04, Task 3).
 *
 * Renders a Perplexity-style checklist of pipeline stages as they stream in.
 * Each row flips from pending → active → done as the SSE stage events arrive.
 *
 * Design contract (STUDIO-01 / D-02 / UI-SPEC):
 *  - pending  = muted label + outline dot (cream-muted color, opacity-50)
 *  - active   = muted label + pulse dot (cream-secondary, slightly brighter)
 *  - done     = cream-secondary label + coral-FREE ✓ (cream-secondary glyph, NOT coral)
 *  - aria-live="polite" for screen reader announcements
 *  - Calm motion via `.reading-reveal` class (0.42s fade-up) gated by prefers-reduced-motion
 *  - No new tokens — reuses established THEME-06 CSS variables
 *
 * This component is EPHEMERAL — it renders while isStreaming, and the thread view
 * replaces it with the final card group on completion. It is NOT a registered block
 * (D-02 Claude's discretion: transient UI, not persisted).
 *
 * Props:
 *  stages — the stages array from useHooksStream / useIdeasStream
 */

export interface StageState {
  name: string;
  status: 'pending' | 'active' | 'done';
}

export interface ProgressChecklistProps {
  stages: StageState[];
}

export function ProgressChecklist({ stages }: ProgressChecklistProps) {
  if (stages.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Skill run progress"
      className="flex flex-col gap-1"
    >
      {stages.map((stage, index) => (
        <StageRow key={stage.name} stage={stage} index={index} />
      ))}
    </div>
  );
}

// ── StageRow ───────────────────────────────────────────────────────────────────

interface StageRowProps {
  stage: StageState;
  /** Animation stagger index (reading-reveal delay). */
  index: number;
}

function StageRow({ stage, index }: StageRowProps) {
  const { name, status } = stage;

  return (
    <div
      className="flex items-center gap-2 reading-reveal"
      style={{ animationDelay: `${index * 0.06}s` }}
      aria-label={`${name}: ${status}`}
    >
      {/* Status indicator dot / checkmark */}
      <StatusGlyph status={status} />

      {/* Stage label */}
      <span
        className="text-sm font-semibold leading-snug transition-colors duration-300"
        style={{
          color: status === 'done'
            ? 'var(--color-cream-secondary)'       // cream-secondary — completed stage
            : status === 'active'
            ? 'var(--color-cream-secondary)'       // slightly brighter while active
            : 'var(--color-cream-muted)',           // muted while pending
          opacity: status === 'pending' ? 0.5 : 1,
        }}
      >
        {name}
      </span>
    </div>
  );
}

// ── StatusGlyph ───────────────────────────────────────────────────────────────

interface StatusGlyphProps {
  status: StageState['status'];
}

function StatusGlyph({ status }: StatusGlyphProps) {
  if (status === 'done') {
    // ✓ checkmark — cream-secondary, NEVER coral (UI-SPEC §Color)
    return (
      <span
        className="shrink-0 text-sm font-semibold leading-none"
        style={{ color: 'var(--color-cream-secondary)', width: 16, textAlign: 'center' }}
        aria-hidden="true"
      >
        ✓
      </span>
    );
  }

  if (status === 'active') {
    // Pulsing filled dot — cream-secondary at 70% opacity
    return (
      <span
        className="shrink-0 inline-flex items-center justify-center"
        style={{ width: 16, height: 16 }}
        aria-hidden="true"
      >
        <span
          className="inline-block rounded-full animate-pulse"
          style={{
            width: 6,
            height: 6,
            backgroundColor: 'var(--color-cream-secondary)',
            opacity: 0.7,
          }}
        />
      </span>
    );
  }

  // pending — outline dot (muted, 50% opacity)
  return (
    <span
      className="shrink-0 inline-flex items-center justify-center"
      style={{ width: 16, height: 16 }}
      aria-hidden="true"
    >
      <span
        className="inline-block rounded-full border"
        style={{
          width: 6,
          height: 6,
          borderColor: 'var(--color-cream-muted)',
          opacity: 0.4,
        }}
      />
    </span>
  );
}
