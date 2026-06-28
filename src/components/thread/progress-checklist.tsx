'use client';

/**
 * ProgressChecklist — the transient SSE-stage-driven progress SPINE (Plan 05-04; premium
 * thread PR-2 refinement).
 *
 * Premium-thread reframe (the most-watched surface — our skills have real latency, so this
 * must read like Perplexity/Claude/Cursor): a connected vertical SPINE of pipeline stages.
 *  - pending = muted label + hollow node; the connecting line is empty.
 *  - active  = bright label + terracotta node (pulsing center dot) + a static value-narrating
 *              sub-detail line; the line above it is half-filled.
 *  - done    = cream label + a filled cream node with a ✓; the line above it is fully filled.
 *
 * Sub-detail (copy-floor §2, decision 2a — static now): renders `stage.detail ?? STAGE_COPY[name]`
 * — one honest line describing the stage's JOB (never a fabricated live count). The optional
 * `detail` field is the FILED ENGINE ASK seam: when the backend later streams a true live status
 * on the stage SSE event, it shows through automatically; until then it degrades to the static map.
 *
 * Dosage: terracotta appears ONLY on the active (live) node — earned. Done checks are cream,
 * NEVER coral. Matte: the active pulse is an opacity breathe, NOT a box-shadow glow ring.
 *
 * EPHEMERAL — renders while isStreaming; the thread view replaces it with the card group on
 * completion. NOT a registered block (D-02: transient UI, not persisted).
 */

export interface StageState {
  name: string;
  status: 'pending' | 'active' | 'done';
  /**
   * Optional live per-stage status (FILED ENGINE ASK, deferred — copy-floor §4). When the
   * backend streams a `detail` on the stage SSE event it renders here; absent, the spine falls
   * back to the static STAGE_COPY descriptor. Additive/optional — no backend change required now.
   */
  detail?: string;
}

export interface ProgressChecklistProps {
  stages: StageState[];
}

/**
 * Static value-narrating sub-detail per REAL stage name (the names the skill routes emit, from
 * the per-skill route handlers under src/app/api/tools). Describes the stage's job; honest,
 * calm on long/stalled waits.
 */
const STAGE_COPY: Record<string, string> = {
  Resolving: 'Pulling the video + transcript',
  Decoding: 'Mapping what made the original work',
  Adapting: 'Rewriting it for your audience',
  Generating: 'Drafting against your audience',
  'Self-judge': 'Filtering for the strongest angles',
  'Simulating your audience': 'Reacting with each of your 10 reactors',
  Ranking: 'Sorting strongest-first vs your baseline',
  'Pulling outliers': 'Finding what overperformed in your niche',
  'Scoring for your audience': 'Reacting with your 10 reactors',
};

export function ProgressChecklist({ stages }: ProgressChecklistProps) {
  if (stages.length === 0) return null;

  return (
    <div aria-live="polite" aria-label="Skill run progress" className="flex flex-col">
      {stages.map((stage, index) => (
        <StageRow
          key={stage.name}
          stage={stage}
          index={index}
          isLast={index === stages.length - 1}
        />
      ))}
    </div>
  );
}

// ── StageRow ───────────────────────────────────────────────────────────────────

interface StageRowProps {
  stage: StageState;
  index: number;
  isLast: boolean;
}

function StageRow({ stage, index, isLast }: StageRowProps) {
  const { name, status } = stage;
  // Sub-detail shows on the ACTIVE step only (calm — one moving line, not a wall).
  const sub = status === 'active' ? stage.detail ?? STAGE_COPY[name] ?? null : null;
  // The connecting line below this node fills with progress: done → full, active → half.
  const fill = status === 'done' ? '100%' : status === 'active' ? '50%' : '0%';

  return (
    <div
      className="flex gap-3 reading-reveal"
      style={{ animationDelay: `${index * 0.06}s` }}
      aria-label={`${name}: ${status}`}
    >
      {/* Rail — node + connecting spine line. */}
      <div className="flex flex-col items-center">
        <StageNode status={status} />
        {!isLast && (
          <div className="relative my-1 w-[2px] flex-1 min-h-[14px] overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="absolute inset-x-0 top-0 rounded-full transition-[height] duration-500 ease-[var(--ease-out-cubic)]"
              style={{ height: fill, backgroundColor: 'var(--color-cream-secondary)' }}
            />
          </div>
        )}
      </div>

      {/* Body — label + (active-only) static sub-detail. */}
      <div className="min-w-0 flex-1 pb-3">
        <p
          className="text-sm font-medium leading-snug transition-colors duration-300"
          style={{
            color:
              status === 'done'
                ? 'var(--color-cream-secondary)'
                : status === 'active'
                ? 'var(--color-foreground)'
                : 'var(--color-cream-muted)',
            opacity: status === 'pending' ? 0.6 : 1,
          }}
        >
          {name}
        </p>
        {sub && (
          <p className="mt-1 text-[12.5px] leading-snug text-foreground-muted">{sub}</p>
        )}
      </div>
    </div>
  );
}

// ── StageNode ───────────────────────────────────────────────────────────────────

function StageNode({ status }: { status: StageState['status'] }) {
  if (status === 'done') {
    // Filled cream node + dark ✓ (cream, NEVER coral — UI-SPEC §Color).
    return (
      <span
        className="grid h-4 w-4 shrink-0 place-items-center rounded-full"
        style={{ backgroundColor: 'var(--color-cream)' }}
        aria-hidden="true"
      >
        <span
          className="text-[10px] font-bold leading-none"
          style={{ color: 'var(--color-background)' }}
        >
          ✓
        </span>
      </span>
    );
  }

  if (status === 'active') {
    // Terracotta ring + pulsing center dot — the ONE live/accent moment (matte: opacity
    // breathe, no glow halo).
    return (
      <span
        className="grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 border-accent"
        aria-hidden="true"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse motion-reduce:animate-none" />
      </span>
    );
  }

  // pending — hollow muted node.
  return (
    <span
      className="h-4 w-4 shrink-0 rounded-full border"
      style={{ borderColor: 'var(--color-cream-muted)', opacity: 0.4 }}
      aria-hidden="true"
    />
  );
}
