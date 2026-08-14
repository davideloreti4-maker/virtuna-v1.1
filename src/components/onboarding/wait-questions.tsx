"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { createLogger } from "@/lib/logger";

/**
 * WaitQuestions — the three grounding answers the scrape cannot produce, asked inside the
 * ~128s calibration wait that already exists on /welcome.
 *
 * WHY THREE, AND WHY THESE THREE. The 10-card `ProfileInterviewModal` was mounted only on
 * `content-form.tsx`, which was reachable only through `/analyze`, which became a bare
 * `redirect('/home')` on 2026-07-18. It has been un-openable since — `profile_interview_seen_at`
 * carries 3 stamps, the last on 2026-05-31, and that emptiness has been read as creators
 * declining to answer. They were never asked. `ONBOARDING-FUNNEL-DESIGN.md` §7 rules the
 * replacement: "fold goal · stage · pain into the wait, infer everything else from the scrape."
 *
 * The cut survives two filters, applied to all ten cards:
 *   - does any generative skill READ it? Six of the ten columns (`content_style`,
 *     `cuts_per_second`, `reference_creators`, `posting_frequency`, `time_of_day_aware`,
 *     `pain_points`) are absent from `ProfileRow`, the type whose docstring is "only the columns
 *     the role-map reads" — the video pipeline is their only consumer.
 *   - can the CALIBRATION SCRAPE infer it? Niche, platforms, past wins and flops all fall out of
 *     the account read, and `writing_voice_description` is already backfilled from the audience's
 *     auto-derived `creator_persona`. Asking for them spends the creator's attention on data we
 *     are about to measure anyway.
 * `primary_goal` passes both. `creator_stage` is implied by follower count but not equal to it —
 * a large dormant account is not "established" in the sense the role-map means. `pain_points`
 * fails the first filter and is kept anyway, on the design ruling: no skill reads it, and it is
 * the only field that says what to build next. Do not cite it as engine grounding.
 *
 * ⚠️ NO SUBMIT BUTTON, BY CONSTRUCTION. This block lives inside a wait that ends on its own and
 * unmounts it. Anything held in local state until a submit press would be discarded the moment
 * calibration finished — silently, and most often for the creator who typed the longest answer.
 * Every answer is written the moment it is given.
 *
 * ⚠️ WRITES GO THROUGH THE API ROUTE, NEVER THE SUPABASE CLIENT. The retired interview store
 * called `.from("creator_profiles").update(...)` directly, so its free text reached
 * `formatCreatorContext`'s prompt block without passing `sanitizeText` — the control-character
 * and `<<<USER_CONTENT>>>` delimiter strip that exists to keep a pasted answer from escaping its
 * data fence. `pain_points` is free text. PATCH is the only correct path.
 */

const log = createLogger({ module: "wait-questions" });

const ENDPOINT = "/api/profile/creator-profile";

export type CreatorGoal = "growth" | "engagement" | "brand_deals" | "conversion";
export type CreatorStage = "new" | "growing" | "established";

/** Labels are the creator's words for the enum, not the enum. Values match `creatorProfilePatchSchema`. */
const GOALS: ReadonlyArray<{ id: CreatorGoal; label: string }> = [
  { id: "growth", label: "Growth" },
  { id: "engagement", label: "Engagement" },
  { id: "brand_deals", label: "Brand deals" },
  { id: "conversion", label: "Conversion" },
];

const STAGES: ReadonlyArray<{ id: CreatorStage; label: string }> = [
  { id: "new", label: "New creator" },
  { id: "growing", label: "Growing" },
  { id: "established", label: "Established" },
];

/** Matches the `pain_points` cap in `creatorProfilePatchSchema` — the server rejects longer. */
const PAIN_MAX = 500;

type Patch = Record<string, unknown>;

export interface WaitQuestionsProps {
  className?: string;
}

export function WaitQuestions({ className }: WaitQuestionsProps): React.JSX.Element {
  const [goal, setGoal] = React.useState<CreatorGoal | null>(null);
  const [stage, setStage] = React.useState<CreatorStage | null>(null);
  const [pain, setPain] = React.useState("");

  /**
   * Failed writes, keyed by column so two failures cannot overwrite each other and a retry
   * re-sends every one. A save that stores nothing and says nothing is the failure mode this
   * codebase has paid for repeatedly; the remedy is visible, not blocking.
   */
  const [failed, setFailed] = React.useState<Record<string, Patch>>({});

  /** The last value actually persisted, so a blur with nothing new does not re-write it. */
  const savedPain = React.useRef("");

  async function send(patch: Patch): Promise<boolean> {
    try {
      const res = await fetch(ENDPOINT, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Persist one answer. Never throws, never blocks — calibration is running underneath. */
  async function save(key: string, patch: Patch): Promise<void> {
    const ok = await send(patch);
    setFailed((prev) => {
      if (ok) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: patch };
    });
    if (!ok) log.warn("answer not persisted", { key });
  }

  /**
   * Stamp the profile as ASKED, once, before any answer exists.
   *
   * This is what makes `profile_interview_seen_at` readable. Stamping on the first ANSWER instead
   * would leave a creator who was shown the questions and skipped them indistinguishable from one
   * who never saw them — reproducing exactly the misreading this block exists to end.
   *
   * The ref is set synchronously before the request, so React StrictMode's double-invoked mount
   * effect cannot send it twice. It is deliberately never reset on cleanup: a reset would restore
   * the double-send in dev, which is the bug the guard is for.
   */
  const stamped = React.useRef(false);
  React.useEffect(() => {
    if (stamped.current) return;
    stamped.current = true;
    // Bookkeeping, not the creator's answer — a failure here must not raise "Not saved" at them.
    void send({});
  }, []);

  function pickGoal(next: CreatorGoal): void {
    setGoal(next);
    void save("primary_goal", { primary_goal: next });
  }

  function pickStage(next: CreatorStage): void {
    setStage(next);
    void save("creator_stage", { creator_stage: next });
  }

  function commitPain(): void {
    const trimmed = pain.trim();
    if (trimmed === savedPain.current) return;
    if (trimmed.length === 0) return;
    savedPain.current = trimmed;
    void save("pain_points", { pain_points: trimmed });
  }

  function retryFailed(): void {
    const pending = Object.entries(failed);
    for (const [key, patch] of pending) void save(key, patch);
  }

  const hasFailure = Object.keys(failed).length > 0;

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          While that runs — three things the scrape can&apos;t tell us
        </p>
        <p className="text-xs text-foreground-muted">
          Optional. Every answer saves as you give it.
        </p>
      </div>

      <Question label="What are you optimising for?">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Goal">
          {GOALS.map(({ id, label }) => (
            <Chip
              key={id}
              label={label}
              selected={goal === id}
              onClick={() => pickGoal(id)}
            />
          ))}
        </div>
      </Question>

      <Question label="Where are you today?">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Stage">
          {STAGES.map(({ id, label }) => (
            <Chip
              key={id}
              label={label}
              selected={stage === id}
              onClick={() => pickStage(id)}
            />
          ))}
        </div>
      </Question>

      <Question label="What's getting in your way right now?" htmlFor="wait-pain">
        <textarea
          id="wait-pain"
          value={pain}
          onChange={(e) => setPain(e.target.value)}
          onBlur={commitPain}
          maxLength={PAIN_MAX}
          rows={2}
          placeholder="Hooks land but nobody watches past 3 seconds…"
          className={cn(
            "w-full resize-none rounded-[8px] border border-white/[0.06] bg-transparent px-3 py-2",
            "text-sm text-foreground placeholder:text-foreground-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
          )}
        />
      </Question>

      {hasFailure && (
        <button
          type="button"
          onClick={retryFailed}
          className={cn(
            "self-start rounded-[8px] border border-warning/20 bg-warning/5 px-3 py-1.5",
            "text-xs text-foreground-secondary transition-colors hover:bg-warning/10",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
          )}
        >
          Not saved — retry
        </button>
      )}
    </div>
  );
}

function Question({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-xs text-foreground-secondary">
          {label}
        </label>
      ) : (
        <p className="text-xs text-foreground-secondary">{label}</p>
      )}
      {children}
    </div>
  );
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "h-9 rounded-[8px] border px-3 text-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]",
        selected
          ? "border-white/[0.12] bg-white/[0.08] text-foreground"
          : "border-white/[0.06] bg-transparent text-foreground-secondary hover:bg-white/[0.04]"
      )}
    >
      {label}
    </button>
  );
}
