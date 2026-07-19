'use client';

/**
 * The RUN CAPSULE — the one presentation every skill execution gets, wherever it starts
 * (composer skill mode, the chat agent's own dispatch, an in-thread field submit).
 *
 *   [label line — what's running, for whom]     ← while live
 *   [progress spine — the skill's real plan]    ← while live (ProgressChecklist)
 *   [✓ receipt — collapsed step history]        ← after completion (SkillProgress)
 *
 * SKILL_RUN_META is the single registry behind it: a future skill adds one entry (label +
 * done-line + plan) and inherits the whole run presentation. The per-skill thread views already
 * render this grammar via <ThreadIntro> + <SkillProgress>; this capsule brings the SAME grammar
 * to the chat-agent thread and the in-thread fields, which until now showed an unlabeled spine
 * (chat) or a bare spinner (fields) — the wait existed, but nothing said WHAT was running.
 *
 * Honesty (copy-floor §2): the label describes INPUTS only (the skill + the audience). Plans
 * must match what each pipeline really emits — no fictional steps.
 */

import { ProgressChecklist, SkillProgress, STAGE_PLANS, type StageState } from './progress-checklist';

export interface SkillRunMeta {
  /** Present-tense label while the run is live, e.g. "Writing hooks". */
  running: string;
  /** The collapsed receipt line after completion, e.g. "Ran your audience". */
  done: string;
  /**
   * The skill's canonical ordered stage plan (names MUST match the runner's real onStage
   * emissions — see STAGE_PLANS). Empty ⇒ the spine grows from live events (legacy shape).
   */
  plan: string[];
}

/**
 * The registry: skill display key → run presentation. Keys match `SkillTool.skillKey` (the
 * chat `dispatch` event) and the in-thread field actions (SKILL_CAPABILITIES).
 */
export const SKILL_RUN_META: Record<string, SkillRunMeta> = {
  ideas: { running: 'Finding ideas', done: 'Ran your audience', plan: STAGE_PLANS.ideas },
  hooks: { running: 'Writing hooks', done: 'Ran your audience', plan: STAGE_PLANS.hooks },
  script: { running: 'Writing your script', done: 'Ran your audience', plan: STAGE_PLANS.script },
  remix: { running: 'Reworking the video', done: 'Reworked for your audience', plan: STAGE_PLANS.remix },
  explore: { running: 'Scanning for outliers', done: 'Scored for your audience', plan: STAGE_PLANS.explore },
  // The in-thread field runs (their routes emit no stages; the fields derive honest
  // client-side stages — see input-request-block.tsx).
  read: { running: 'Reading it past your audience', done: 'Read by your audience', plan: [] },
  account: { running: 'Reading your account', done: 'Read your account', plan: [] },
  test: { running: 'Testing your video', done: 'Tested against your audience', plan: [] },
};

export interface SkillRunCapsuleProps {
  /**
   * The running skill's display key (from the chat `dispatch` event / the field's action).
   * Null ⇒ a skill is running but the client doesn't know which (legacy stream without the
   * dispatch frame) — the capsule stays unlabeled and grows the spine from live events.
   */
  skill: string | null;
  /** Live stage events, in emit order (cleared per dispatch by the stream hook). */
  stages: StageState[];
  /** True while THIS run is still producing (spine); false ⇒ the collapsed receipt. */
  isRunning: boolean;
  /** The audience the run is aimed at — named on the label line ("for Bootstrapped Founders"). */
  audienceLabel?: string;
}

export function SkillRunCapsule({ skill, stages, isRunning, audienceLabel }: SkillRunCapsuleProps) {
  const meta = skill ? SKILL_RUN_META[skill] : undefined;
  // Nothing ran and nothing is running → render nothing (a pure-chat turn / a rehydrate).
  if (!isRunning && stages.length === 0) return null;

  // With a known skill the FULL plan renders from the first frame (the wait is legible);
  // unknown skill → live emit order, exactly the legacy chat spine.
  const plan = meta && meta.plan.length > 0 ? meta.plan : stages.map((s) => s.name);

  if (isRunning) {
    return (
      <div className="flex flex-col gap-2.5" aria-live="polite" aria-atomic="false">
        {meta && (
          <p className="reading-reveal text-[13px] font-medium text-foreground-secondary">
            {meta.running}
            {audienceLabel ? (
              <span className="text-foreground-muted"> — for {audienceLabel}</span>
            ) : null}
          </p>
        )}
        <ProgressChecklist stages={stages} plan={plan} />
      </div>
    );
  }

  return (
    <SkillProgress
      stages={stages}
      plan={plan}
      isStreaming={false}
      summaryLabel={meta?.done ?? 'Ran the skill'}
    />
  );
}
