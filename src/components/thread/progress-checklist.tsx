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

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

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
  /**
   * Canonical full ordered stage plan for the running skill (SEED). When provided, the spine
   * renders the WHOLE pipeline up front — every step visible as `pending`, the current one
   * `active` — instead of revealing steps one-at-a-time as the backend emits them. This is what
   * makes the wait legible (Perplexity/Claude "here's the plan, watch it progress") even though
   * the routes emit coarse stage transitions in a burst. Live `stages` overlay their real status
   * onto the plan; a plan step with no live event yet stays `pending`. Absent → legacy behavior
   * (render only the live stages, in emit order). See STAGE_PLANS below.
   */
  plan?: string[];
}

/**
 * Canonical ordered stage plans per skill — the SEED passed to ProgressChecklist so the full
 * pipeline is visible from the first frame. Names MUST match exactly what each route emits via
 * `send("stage", { name })` (src/app/api/tools/<skill>/route.ts) so live events overlay cleanly.
 */
export const STAGE_PLANS = {
  // Plans MUST match the REAL phase boundaries each runner emits via onStage (src/lib/tools/
  // runners/*). No fictional steps — the old "Self-judge" was dropped (S3′ removed the gate, so
  // it had no real duration and made the spine wait-then-flash).
  hooks: ['Generating', 'Simulating your audience', 'Ranking'],
  ideas: ['Generating', 'Simulating your audience', 'Ranking'],
  script: ['Generating', 'Simulating your audience'],
  remix: ['Resolving', 'Decoding', 'Adapting', 'Simulating your audience'],
  explore: ['Pulling outliers', 'Scoring for your audience'],
} satisfies Record<string, string[]>;

/**
 * Merge a canonical plan with the live stage events into the render list. Plan order is
 * authoritative; each step takes its live status if one has arrived, else `pending`. Before ANY
 * live active/done event lands, the first plan step shows `active` so the spine never opens as a
 * column of hollow dots.
 *
 * Live stages not in the plan slot by EMIT ORDER: ones that fired before any in-plan stage
 * PREPEND (in emit order), the rest append. Plans are static per skill, but a runner can emit a
 * conditional pre-stage the client can't predict — e.g. grounding's "Finding proven outliers"
 * (env-gated, runs BEFORE Generating). Blind appending drew that stage at the bottom of the
 * spine while it was the one actually running (caught in the 2026-07-12 flag-ON live verify).
 */
function mergePlan(plan: string[], live: StageState[]): StageState[] {
  const byName = new Map(live.map((s) => [s.name, s]));
  const anyLive = live.some((s) => s.status === 'active' || s.status === 'done');

  // Split off-plan live stages by whether they fired before the first in-plan live event.
  const firstPlanLiveIdx = live.findIndex((s) => plan.includes(s.name));
  const pre: StageState[] = [];
  const post: StageState[] = [];
  live.forEach((s, i) => {
    if (plan.includes(s.name)) return;
    if (firstPlanLiveIdx === -1 || i < firstPlanLiveIdx) pre.push(s);
    else post.push(s);
  });

  const planRows: StageState[] = plan.map((name, i) => {
    const l = byName.get(name);
    if (l) return l;
    // The "never open on hollow dots" seed only applies while nothing at all is live —
    // a live pre-stage (e.g. grounding) already gives the spine its active row.
    return { name, status: !anyLive && i === 0 ? 'active' : 'pending' };
  });

  return [...pre, ...planRows, ...post];
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

/**
 * Rotating sub-detail per stage — a long wait (hooks generation is ~50s) should feel alive and
 * informative, so the active step's sub-line cycles through honest sub-phases of the SAME job.
 * Every phrase describes real work the stage is doing (copy-floor §2: describe the JOB, never a
 * fabricated live count/metric). Falls back to the single STAGE_COPY line when a stage has no
 * rotation. A live `stage.detail` from the backend still overrides the rotation entirely.
 */
const STAGE_COPY_ROTATION: Record<string, string[]> = {
  // The video Read (/analyze) — the longest wait in the product (~2 min).
  'Fetching your video': [
    'Pulling the post',
    'Downloading the footage',
  ],
  'Watching it frame by frame': [
    'Watching it the way your audience would',
    'Marking where attention holds',
    'Finding the moment they drop',
  ],
  Generating: [
    'Drafting angles against your audience',
    'Pushing past the obvious openers',
    'Shaping each into a scroll-stopping line',
  ],
  'Self-judge': [
    'Filtering for the strongest angles',
    'Cutting the weak openers',
  ],
  'Simulating your audience': [
    'Reacting with each of your 10 reactors',
    'Weighing stop-scroll against skip',
    'Collecting their verbatim reactions',
  ],
  Ranking: [
    'Sorting strongest-first vs your baseline',
    'Settling the final order',
  ],
  Resolving: [
    'Pulling the video + transcript',
    'Reading the original',
  ],
  Decoding: [
    'Mapping what made the original work',
    'Isolating the mechanism',
  ],
  Adapting: [
    'Rewriting it for your audience',
    'Retuning the angle for your niche',
  ],
  'Pulling outliers': [
    'Finding what overperformed in your niche',
    'Measuring each against the baseline',
  ],
  'Scoring for your audience': [
    'Reacting with your 10 reactors',
    'Fitting each to your audience',
  ],
  // The in-thread field runs whose routes emit no stages (read = a single JSON POST, account = a
  // scrape): the field renders ONE active capsule row named for the job, and these honest
  // sub-phases keep the wait alive (copy-floor §2 — the JOB, never a fabricated count).
  'Reading it past your audience': [
    'Reacting with each of your reactors',
    'Weighing stop-scroll against skip',
    'Collecting their verbatim reactions',
  ],
  'Reading your account': [
    'Pulling your latest posts',
    'Finding what recurs across them',
  ],
};

export function ProgressChecklist({ stages, plan }: ProgressChecklistProps) {
  // With a plan → render the whole pipeline up front (seed pending, overlay live status).
  // Without → legacy: render only the live stages in emit order.
  const rows = plan && plan.length > 0 ? mergePlan(plan, stages) : stages;
  if (rows.length === 0) return null;

  return (
    <div aria-live="polite" aria-label="Skill run progress" className="flex flex-col">
      {rows.map((stage, index) => (
        <StageRow
          key={stage.name}
          stage={stage}
          index={index}
          isLast={index === rows.length - 1}
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
  const isActive = status === 'active';

  // Rotating sub-copy: while ACTIVE, cycle through this stage's honest sub-phases so a long wait
  // feels alive. A live backend `detail` overrides the rotation. Non-active steps show nothing.
  const rotation = STAGE_COPY_ROTATION[name] ?? (STAGE_COPY[name] ? [STAGE_COPY[name]] : []);
  const [subIdx, setSubIdx] = useState(0);

  useEffect(() => {
    // Rotate only while active with >1 phase. Each row mounts once (keyed by name) and starts at
    // subIdx 0 while pending, so no reset is needed on state change.
    if (!isActive || rotation.length <= 1) return;
    const id = setInterval(() => {
      setSubIdx((i) => (i + 1) % rotation.length);
    }, 2600);
    return () => clearInterval(id);
  }, [isActive, rotation.length]);

  const sub = isActive ? stage.detail ?? rotation[subIdx % rotation.length] ?? null : null;
  const isDone = status === 'done';

  return (
    <div
      className="flex gap-3 reading-reveal"
      style={{ animationDelay: `${index * 0.06}s` }}
      aria-label={`${name}: ${status}`}
    >
      {/* Rail — node + connecting spine line. The line below this node reads its state:
          done → a solid cream fill; active → a soft cream pulse traveling DOWN it (energy
          flowing toward the next step); pending → the bare faint rail. */}
      <div className="flex flex-col items-center">
        <StageNode status={status} />
        {!isLast && (
          <div className="relative my-1 w-[2px] flex-1 min-h-[14px] overflow-hidden rounded-full bg-white/[0.06]">
            {isDone && (
              <div
                className="absolute inset-0 rounded-full reading-reveal"
                style={{ backgroundColor: 'var(--color-cream-secondary)' }}
              />
            )}
            {isActive && <div className="spine-flow absolute inset-x-0 top-0 h-full rounded-full" />}
          </div>
        )}
      </div>

      {/* Body — label + (active-only) static sub-detail. The ACTIVE label shimmers (the
          "working now" cue); done/pending are solid cream tones. */}
      <div className="min-w-0 flex-1 pb-3">
        <p
          className={cn(
            'text-sm font-medium leading-snug transition-colors duration-300',
            status === 'active' && 'text-shimmer',
          )}
          style={{
            color:
              status === 'done'
                ? 'var(--color-cream-secondary)'
                : status === 'active'
                ? undefined // text-shimmer owns the fill
                : 'var(--color-cream-muted)',
            opacity: status === 'pending' ? 0.6 : 1,
          }}
        >
          {name}
        </p>
        {sub && (
          // key={subIdx} remounts the line each rotation → a soft fade between phrases.
          <p
            key={subIdx}
            className="proof-resolve mt-1 text-[12.5px] leading-snug text-foreground-muted"
          >
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ── StageNode ───────────────────────────────────────────────────────────────────

/**
 * A SINGLE persistent node that MORPHS between pending → active → done, so state changes
 * transition smoothly (color/fill/opacity) instead of hard-swapping three different elements.
 * The ring, the ✓, and the breathing center dot all coexist; only their opacity/color animate.
 *  - pending: faint hollow ring.
 *  - active:  terracotta ring + breathing terracotta dot (the ONE accent moment; matte breathe).
 *  - done:    filled cream disc + dark ✓ (cream, NEVER coral — UI-SPEC §Color).
 */
function StageNode({ status }: { status: StageState['status'] }) {
  const isDone = status === 'done';
  const isActive = status === 'active';

  const ringColor = isDone
    ? 'var(--color-cream-primary)'
    : isActive
    ? 'var(--color-accent)'
    : 'var(--color-cream-muted)';

  return (
    <span className="relative grid h-4 w-4 shrink-0 place-items-center" aria-hidden="true">
      {/* Ring / fill — one element, color+fill+opacity transition across all states. */}
      <span
        className="absolute inset-0 rounded-full border-2 transition-all duration-[450ms] ease-[var(--ease-out-cubic)]"
        style={{
          borderColor: ringColor,
          backgroundColor: isDone ? 'var(--color-cream-primary)' : 'transparent',
          opacity: status === 'pending' ? 0.4 : 1,
        }}
      />
      {/* Done check — fades in. */}
      <span
        className="relative text-[9px] font-bold leading-none transition-opacity duration-300"
        style={{ color: 'var(--color-background)', opacity: isDone ? 1 : 0 }}
      >
        ✓
      </span>
      {/* Active center dot — breathes ONLY while active (the animation drives opacity); on the
          other states the class drops and inline opacity:0 hides it. */}
      <span
        className={cn(
          'absolute h-1.5 w-1.5 rounded-full transition-opacity duration-300',
          isActive && 'animate-stage-breathe',
        )}
        style={{ backgroundColor: 'var(--color-accent)', opacity: isActive ? 1 : 0 }}
      />
    </span>
  );
}

// ── SkillProgress ────────────────────────────────────────────────────────────────

export interface SkillProgressProps {
  stages: StageState[];
  plan: string[];
  isStreaming: boolean;
  /** Summary receipt label shown after completion, e.g. "Ran your audience". */
  summaryLabel: string;
}

/**
 * The progress affordance the thread views mount: owns BOTH phases so the loading state has a
 * clean life-cycle (Claude/Perplexity pattern).
 *  - While streaming → the full live spine (ProgressChecklist, seeded plan).
 *  - After completion → the spine COLLAPSES into a single quiet receipt line
 *    ("✓ Ran your audience · N steps ⌄"), expandable to re-inspect the completed steps.
 *
 * The collapsed receipt only exists for a live run (stages are ephemeral — a pure rehydrate has
 * no stage history, so it renders nothing and the result cards stand alone).
 */
export function SkillProgress({ stages, plan, isStreaming, summaryLabel }: SkillProgressProps) {
  const [expanded, setExpanded] = useState(false);

  if (isStreaming) {
    return <ProgressChecklist stages={stages} plan={plan} />;
  }

  // Completed run: show the collapsed receipt. No stage history (rehydrate) → render nothing.
  if (stages.length === 0) return null;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="reading-reveal group flex items-center gap-2 self-start rounded-sm py-0.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10"
        aria-expanded={expanded}
        aria-label={`${summaryLabel} — ${plan.length} steps. ${expanded ? 'Collapse' : 'Expand'} the steps.`}
      >
        <CheckMini />
        <span
          className="font-medium transition-colors group-hover:text-foreground"
          style={{ color: 'var(--color-cream-secondary)' }}
        >
          {summaryLabel}
        </span>
        <span className="text-foreground-muted/60">·</span>
        <span className="text-foreground-muted/60">{plan.length} steps</span>
        <span
          className="ml-0.5 text-[10px] text-foreground-muted/50 transition-transform duration-300"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {/* Expanded = a clean compact checklist (NOT the heavy loading spine): a small cream check
          + the step name per row, indented under the summary. No connecting rail. */}
      {expanded && (
        <div className="reading-reveal flex flex-col gap-2 pb-1 pl-[26px] pt-2">
          {plan.map((name) => (
            <div key={name} className="flex items-center gap-2.5">
              <CheckMini />
              <span className="text-[13px] leading-none text-foreground-muted">{name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Small filled-cream check disc — the completed-step marker (matte, never coral). */
function CheckMini() {
  return (
    <span
      className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full"
      style={{ backgroundColor: 'var(--color-cream-primary)' }}
      aria-hidden="true"
    >
      <span
        className="text-[8px] font-bold leading-none"
        style={{ color: 'var(--color-background)' }}
      >
        ✓
      </span>
    </span>
  );
}
