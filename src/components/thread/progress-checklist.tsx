'use client';

/**
 * ProgressChecklist — the transient SSE-stage-driven progress SPINE (Plan 05-04; premium
 * thread PR-2 refinement; EVIDENCE pass 2026-07-31).
 *
 * Premium-thread reframe (the most-watched surface — our skills have real latency, so this
 * must read like Perplexity/Claude/Cursor): a connected vertical SPINE of pipeline stages.
 *  - pending = muted label + hollow node; the connecting line is empty.
 *  - active  = bright label + terracotta node (pulsing center dot) + a value-narrating
 *              sub-detail line + a LIVE SECOND COUNT; the line below it carries a flowing pulse.
 *  - done    = cream label + a filled cream node with a ✓ + the step's MEASURED duration; the
 *              line above it is fully filled.
 *
 * THREE THINGS MAKE THE WAIT LEGIBLE, and all three are measured or retrieved, never invented:
 *
 *  1. THE PLAN (`plan`) — the whole pipeline up front, so the creator can see where they are.
 *  2. THE CLOCK — the active step counts real seconds, and a finished step keeps the duration it
 *     actually took. Every premium agent surface does this (Claude's "Thought for 12s", Cursor's
 *     per-step stamps) for the same reason: an unquantified wait feels broken at 20s, a quantified
 *     one still feels fine at 90s. Nothing is predicted — the clock only ever reports the past.
 *  3. THE EVIDENCE (`evidence`) — the artifacts the engine actually touched, shown under the step
 *     using them: the proven outlier videos a grounded run is drafting against, the post remix just
 *     resolved, the keyframes the Test extractor is cutting. See run-evidence.tsx; the payload is
 *     built server-side from real rows (lib/tools/evidence.ts) and renders nothing when absent.
 *
 * Sub-detail (copy-floor §2, decision 2a): renders `stage.detail ?? STAGE_COPY[name]` — one honest
 * line describing the stage's JOB (never a fabricated live count). The optional `detail` field is
 * the FILED ENGINE ASK seam: when the backend streams a true live status on the stage SSE event it
 * shows through automatically; until then it degrades to the static map.
 *
 * Dosage: terracotta appears ONLY on the active (live) node — earned. Done checks are cream,
 * NEVER coral. Matte: the active pulse is an opacity breathe, NOT a box-shadow glow ring.
 *
 * EPHEMERAL — renders while isStreaming; the thread view replaces it with the card group on
 * completion. NOT a registered block (D-02: transient UI, not persisted).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { RunEvidenceRail } from './run-evidence';
import type { RunEvidence } from '@/lib/tools/evidence';

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
  /**
   * The artifacts this run has touched so far, rendered under the ACTIVE step (the "what the
   * engine is working with right now" slot). Absent/null ⇒ nothing renders and the spine is
   * byte-identical to its pre-evidence shape.
   */
  evidence?: RunEvidence | null;
  /**
   * Render each step's MEASURED duration beside its name. Default `true` — a bare spine (the
   * one-row `SingleStageWait` fields) has no other clock, so its single stamp IS the run clock.
   *
   * `SkillProgress` passes `false` while the run is live, because its surface head owns the one
   * clock: four tabular stamps down the right edge of a live spine compete with each other and
   * with the label, and reference tools (Claude, ChatGPT, Cursor) all show exactly one. The
   * per-step durations are not discarded — they reappear in the EXPANDED receipt, where they are
   * information rather than noise.
   */
  showElapsed?: boolean;
  /**
   * Reports a step's true duration the moment it freezes, so a container can keep it after the
   * spine unmounts. `StageRow` state dies when the run collapses to its receipt; this is what lets
   * the expanded receipt still show what each step actually took.
   */
  onMeasured?: (name: string, ms: number) => void;
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
  'Finding proven outliers': [
    'Searching what already overperformed',
    'Measuring each against its baseline',
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

export function ProgressChecklist({
  stages,
  plan,
  evidence,
  showElapsed = true,
  onMeasured,
}: ProgressChecklistProps) {
  // With a plan → render the whole pipeline up front (seed pending, overlay live status).
  // Without → legacy: render only the live stages in emit order.
  const rows = plan && plan.length > 0 ? mergePlan(plan, stages) : stages;
  if (rows.length === 0) return null;

  // The evidence rail hangs off the step CURRENTLY running — that is the "what the engine is
  // working with right now" slot, and it is where a retrieved artifact means the most (the
  // outliers land during grounding but matter while `Generating` drafts against them). With no
  // active row (the final beat, everything done) it falls to the last row rather than vanishing.
  const activeIdx = rows.findIndex((s) => s.status === 'active');
  const evidenceIdx = activeIdx === -1 ? rows.length - 1 : activeIdx;

  return (
    <div aria-live="polite" aria-label="Skill run progress" className="flex flex-col">
      {rows.map((stage, index) => (
        <StageRow
          key={stage.name}
          stage={stage}
          index={index}
          isLast={index === rows.length - 1}
          evidence={index === evidenceIdx ? evidence ?? null : null}
          showElapsed={showElapsed}
          onMeasured={onMeasured}
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
  evidence?: RunEvidence | null;
  showElapsed?: boolean;
  onMeasured?: (name: string, ms: number) => void;
}

/**
 * The step's own clock — live seconds while it runs, its true duration once it lands.
 *
 * Measured, never modelled: the value is always `now − whenThisRowWentActive`, so a step that
 * never went active (a plan step replayed as done on a reloaded turn, a pending step) reports
 * NOTHING and the row shows no stamp. That distinction is the honesty line — a reconstructed
 * receipt must not wear a duration nobody timed.
 *
 * Ticks once a second: the display is whole seconds, so anything faster is re-rendering for
 * nothing on the app's most-watched surface.
 */
function useStageClock(
  status: StageState['status'],
  onFreeze?: (ms: number) => void,
): number | null {
  const startedAtRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  // Held in a ref so a caller passing an inline closure cannot restart the clock on every render.
  // Synced in its own effect rather than during render — writing a ref mid-render is unsafe under
  // concurrent rendering (and react-hooks/refs rejects it). useRef seeds it for the first pass.
  const onFreezeRef = useRef(onFreeze);
  useEffect(() => {
    onFreezeRef.current = onFreeze;
  });

  useEffect(() => {
    if (status === 'active') {
      const t0 = Date.now();
      startedAtRef.current = t0;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- starting the clock IS the effect
      setElapsedMs(0);
      const id = setInterval(() => setElapsedMs(Date.now() - t0), 1000);
      return () => {
        clearInterval(id);
        // The LAST step never gets to observe its own `done`: the run settles and SkillProgress
        // swaps the whole spine for its receipt in the same render, so this row unmounts while
        // still active and its duration was silently lost. Report what we timed on the way out.
        // This is a measurement, not a claim of completion — the receipt only DISPLAYS a duration
        // for a step the settled `stages` array independently marks done.
        if (startedAtRef.current !== null) {
          onFreezeRef.current?.(Date.now() - startedAtRef.current);
        }
      };
    }
    if (status === 'done' && startedAtRef.current !== null) {
      // Freeze the REAL duration. The interval's last tick can be up to a second stale, and a
      // 2.6s step that reads "2s" forever is a small lie told on every single run.
      const total = Date.now() - startedAtRef.current;
      startedAtRef.current = null;
      setElapsedMs(total);
      // Hand the true duration to the container BEFORE this row can unmount (the spine is replaced
      // by its receipt the moment the run settles), so the expanded receipt can still show it.
      onFreezeRef.current?.(total);
    }
    return undefined;
  }, [status]);

  return elapsedMs;
}

/** 800 → "0.8s", 2600 → "2.6s", 14200 → "14s". Sub-10s keeps a decimal; past that it is noise. */
function formatDuration(ms: number): string {
  const s = ms / 1000;
  return s < 10 ? `${Math.round(s * 10) / 10}s` : `${Math.round(s)}s`;
}

function StageRow({
  stage,
  index,
  isLast,
  evidence,
  showElapsed = true,
  onMeasured,
}: StageRowProps) {
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

  const elapsedMs = useStageClock(
    status,
    onMeasured ? (ms) => onMeasured(name, ms) : undefined,
  );
  // When this step carries EVIDENCE, the rail's own headline is the sub-line. Rendering both put
  // "Drafting angles against your audience" directly above "Drafting against 3 proven videos" —
  // the same sentence twice, the second one the only one carrying proof.
  const sub =
    isActive && !evidence ? stage.detail ?? rotation[subIdx % rotation.length] ?? null : null;
  const isDone = status === 'done';
  // A stamp is worth showing once there is a whole second in it. Below that it flickers on and
  // off between renders and reads as jitter rather than as information.
  const stamp =
    showElapsed && elapsedMs !== null && elapsedMs >= 1000 ? formatDuration(elapsedMs) : null;

  return (
    <div
      className="flex gap-2.5 reading-reveal"
      style={{ animationDelay: `${index * 0.06}s` }}
      aria-label={`${name}: ${status}`}
    >
      {/* Rail — node + connecting spine line, at HAIRLINE weight. The filled leg is what reads as
          "this step is finished" now that the ✓ is gone: done → a solid cream fill; active → a soft
          cream pulse traveling DOWN it (energy flowing toward the next step); pending → bare rail. */}
      <div className="flex w-3.5 shrink-0 flex-col items-center">
        <StageNode status={status} />
        {!isLast && (
          <div className="relative my-1 w-px flex-1 min-h-[12px] overflow-hidden bg-white/[0.06]">
            {isDone && (
              <div
                className="absolute inset-0 reading-reveal"
                // Deliberately BELOW --color-cream-secondary: a completed leg is a settled fact,
                // not something to re-read. The live row is the only thing at full strength.
                style={{ backgroundColor: 'rgba(236, 231, 222, 0.40)' }}
              />
            )}
            {isActive && <div className="spine-flow absolute inset-x-0 top-0 h-full" />}
          </div>
        )}
      </div>

      {/* Body — label row (name + measured stamp), the active-only sub-detail, and the evidence
          rail. The ACTIVE label shimmers (the "working now" cue); done/pending are solid cream. */}
      {/* Tight resting rhythm; only the LIVE row breathes. A 4-step plan with a sub-detail and an
          evidence rail was a tall block at a uniform pb-3. */}
      <div className={cn('min-w-0 flex-1', isActive ? 'pb-[11px]' : 'pb-[7px]')}>
        <div className="flex items-baseline gap-2">
          <p
            className={cn(
              'min-w-0 text-body font-medium leading-snug transition-colors duration-300',
              // The shimmer is the liveness cue, and with the per-step ✓ gone it is carrying more:
              // it is what Claude and ChatGPT actually use to say "working on this one".
              status === 'active' && 'text-shimmer',
            )}
            style={{
              color:
                status === 'done'
                  ? // FINISHED WORK RECEDES. It used to brighten to cream-secondary, which made a
                    // column of completed steps the loudest thing on screen for the whole run.
                    'var(--color-cream-muted)'
                  : status === 'active'
                  ? undefined // text-shimmer owns the fill
                  : 'var(--color-cream-muted)',
              opacity: status === 'pending' ? 0.55 : 1,
            }}
          >
            {name}
          </p>
          {stamp && (
            <span
              className="shrink-0 text-micro tabular-nums leading-none text-foreground-muted/60"
              data-testid="stage-elapsed"
            >
              {stamp}
            </span>
          )}
        </div>
        {sub && (
          // key={subIdx} remounts the line each rotation → a soft fade between phrases.
          <p
            key={subIdx}
            className="proof-resolve mt-1 text-label leading-snug text-foreground-muted"
          >
            {sub}
          </p>
        )}
        {evidence && <RunEvidenceRail evidence={evidence} className="mt-2.5" />}
      </div>
    </div>
  );
}

// ── StageNode ───────────────────────────────────────────────────────────────────

/**
 * A single 7px mark that MORPHS between pending → active → done.
 *
 * THE ✓ IS GONE, deliberately. A filled cream disc with a check was the loudest thing on the
 * screen, on every completed step, for the whole run — while the creator's own retrieved covers
 * sat underneath it in 12px grey. Neither Claude nor ChatGPT marks a finished step with a check:
 * both let the step go quiet and let the block collapse. Completion here is carried by the FILLED
 * RAIL LEG above the node (StageRow) plus the label receding to muted.
 *
 * The three states separate by FILL vs OUTLINE, not by brightness — at 7px a brightness delta is
 * invisible, and "done" has to be unmistakably different from "pending" at a glance:
 *  - pending: hollow — a 1px inset ring at 16% cream.
 *  - active:  solid coral. The ONE accent moment in the whole spine (matte opacity breathe, never
 *             a box-shadow glow ring).
 *  - done:    solid cream at 55%, with a brief scale pop as it lands.
 */
function StageNode({ status }: { status: StageState['status'] }) {
  const isDone = status === 'done';
  const isActive = status === 'active';

  return (
    <span
      className={cn(
        'mt-[5px] h-[7px] w-[7px] shrink-0 rounded-full transition-all duration-[400ms] ease-[var(--ease-out-cubic)]',
        isActive && 'animate-stage-breathe',
        isDone && 'animate-node-land',
      )}
      style={{
        backgroundColor: isActive
          ? 'var(--color-accent)'
          : isDone
          ? 'rgba(236, 231, 222, 0.55)'
          : 'transparent',
        boxShadow: isActive || isDone ? 'none' : 'inset 0 0 0 1px rgba(236, 231, 222, 0.16)',
      }}
      aria-hidden="true"
    />
  );
}

// ── SkillProgress ────────────────────────────────────────────────────────────────

export interface SkillProgressProps {
  stages: StageState[];
  plan: string[];
  isStreaming: boolean;
  /** Summary receipt label shown after completion, e.g. "Ran your audience". */
  summaryLabel: string;
  /** Live artifacts for the in-flight spine (see ProgressChecklist.evidence). */
  evidence?: RunEvidence | null;
  /** Present-tense label in the surface head while the run is live, e.g. "Writing hooks". */
  runningLabel?: string;
  /**
   * Past-tense verb phrase for the MEASURED receipt (`SkillRunMeta.took`): `${tookLabel} 0:32`.
   * Only used when this component actually timed the run — see useRunClock.
   */
  tookLabel?: string;
}

/**
 * The RUN's own wall clock — one number for the whole operation, which is what every reference
 * agent surface shows (Claude "Thought for 12s", Cursor's single elapsed).
 *
 * Measured, never modelled, and the honesty line is the same as the per-step clock's: it starts
 * only when THIS component observes the run streaming. A rehydrated turn replays its plan as done
 * without ever having streamed, so it never starts, returns null, and the receipt falls back to a
 * step count. A reconstructed receipt must not wear a duration nobody timed.
 *
 * Ticks once a second — the display is whole seconds, and this is the app's most-watched surface.
 */
function useRunClock(isStreaming: boolean): number | null {
  const startedAtRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  useEffect(() => {
    if (isStreaming) {
      const t0 = Date.now();
      startedAtRef.current = t0;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- starting the clock IS the effect
      setElapsedMs(0);
      const id = setInterval(() => setElapsedMs(Date.now() - t0), 1000);
      return () => clearInterval(id);
    }
    if (startedAtRef.current !== null) {
      // Freeze the REAL total. The interval's last tick can be nearly a second stale.
      const total = Date.now() - startedAtRef.current;
      startedAtRef.current = null;
      setElapsedMs(total);
    }
    return undefined;
  }, [isStreaming]);

  return elapsedMs;
}

/** 32_000 → "0:32", 126_000 → "2:06". Minutes:seconds — a run total, not a step duration. */
function formatTotal(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * The run surface — one bordered plane that holds the whole operation, so the collapse at the end
 * has something to collapse INTO.
 *
 * Its fill is a 2% whisper rather than --color-surface-thread: the result cards below it use that
 * tone, and the process should read as SUBORDINATE to the output, not as another card of equal
 * weight. The head carries the run's name and the single clock.
 */
function RunSurface({
  title,
  right,
  children,
}: {
  title: string;
  right?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02]">
      <div className="flex items-center gap-2 px-3.5 pb-2 pt-3">
        <span
          className="text-body font-medium leading-none"
          style={{ color: 'var(--color-cream-secondary)' }}
        >
          {title}
        </span>
        {right && (
          <span
            className="ml-auto shrink-0 text-label tabular-nums leading-none text-foreground-muted"
            data-testid="run-elapsed"
          >
            {right}
          </span>
        )}
      </div>
      <div className="px-3.5 pb-3">{children}</div>
    </div>
  );
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
export function SkillProgress({
  stages,
  plan,
  isStreaming,
  summaryLabel,
  evidence,
  runningLabel,
  tookLabel,
}: SkillProgressProps) {
  const [expanded, setExpanded] = useState(false);
  // Per-step durations, lifted out of the rows so they survive the spine's unmount at collapse.
  const [durations, setDurations] = useState<Record<string, number>>({});
  const onMeasured = useCallback((name: string, ms: number) => {
    setDurations((d) => (d[name] === ms ? d : { ...d, [name]: ms }));
  }, []);
  const totalMs = useRunClock(isStreaming);

  if (isStreaming) {
    return (
      <RunSurface
        title={runningLabel ?? summaryLabel}
        right={totalMs !== null && totalMs >= 1000 ? formatTotal(totalMs) : null}
      >
        <ProgressChecklist
          stages={stages}
          plan={plan}
          evidence={evidence}
          // The head owns the one clock — see ProgressChecklistProps.showElapsed.
          showElapsed={false}
          onMeasured={onMeasured}
        />
      </RunSurface>
    );
  }

  // Completed run: show the collapsed receipt. No stage history (rehydrate) → render nothing.
  if (stages.length === 0) return null;

  // "Generated in 0:32" ONLY when this component timed the run. A reloaded turn replays its plan
  // as done having measured nothing, and keeps the honest step-count receipt instead.
  const measured = totalMs !== null && totalMs >= 1000;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="reading-reveal group inline-flex w-fit items-center gap-2 self-start rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-body transition-colors hover:border-white/[0.10] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring)]"
        aria-expanded={expanded}
        aria-label={`${summaryLabel} — ${plan.length} steps. ${expanded ? 'Collapse' : 'Expand'} the steps.`}
        data-testid="run-receipt"
      >
        {/* The completion mark is a quiet cream dot, matching a done node on the spine — NOT the
            filled ✓ disc this used to be. Reference tools give a finished run one calm line. */}
        <span
          className="h-[7px] w-[7px] shrink-0 rounded-full"
          style={{ backgroundColor: 'rgba(236, 231, 222, 0.55)' }}
          aria-hidden="true"
        />
        <span
          className="font-medium transition-colors group-hover:text-foreground"
          style={{ color: 'var(--color-cream-secondary)' }}
        >
          {summaryLabel}
        </span>
        {measured && tookLabel ? (
          <span className="tabular-nums text-foreground-muted/70" data-testid="run-elapsed">
            · {formatTotal(totalMs)}
          </span>
        ) : (
          <>
            <span className="text-foreground-muted/60">·</span>
            <span className="text-foreground-muted/60">{plan.length} steps</span>
          </>
        )}
        {/* --text-label, not --text-micro: at 10px this glyph is 5px wide and reads as another
            separator dot rather than as the pill's one disclosure affordance. */}
        <span
          className="text-label leading-none text-foreground-muted/60 transition-transform duration-300"
          style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
          aria-hidden="true"
        >
          ▸
        </span>
      </button>

      {/* Expanded = the steps with what each one ACTUALLY took. This is the only place the
          per-step durations appear, and the reason they were taken off the live spine: here they
          are information, there they were four tabular numbers competing down the right edge. */}
      {expanded && (
        <div className="reading-reveal flex flex-col gap-2 pb-1 pl-1 pt-0.5">
          {plan.map((name) => {
            // Show a duration only where we BOTH timed the step and know it completed. The
            // unmount-path measurement above cannot tell a finished step from an aborted one;
            // the settled stage list can.
            const completed = stages.some((s) => s.name === name && s.status === 'done');
            const ms = completed ? durations[name] : undefined;
            return (
              <div key={name} className="flex items-baseline gap-2.5">
                <span
                  className="h-[7px] w-[7px] shrink-0 translate-y-[-1px] rounded-full"
                  style={{ backgroundColor: 'rgba(236, 231, 222, 0.55)' }}
                  aria-hidden="true"
                />
                <span className="text-body leading-none text-foreground-muted">{name}</span>
                {ms !== undefined && ms >= 1000 && (
                  <span
                    className="ml-auto shrink-0 text-micro tabular-nums leading-none text-foreground-muted/55"
                    data-testid="stage-elapsed"
                  >
                    {formatDuration(ms)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
