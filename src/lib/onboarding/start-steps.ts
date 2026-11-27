/**
 * start-steps.ts — /start's steps (funnel spec §3.2): platform → niche → goal → account, one question per
 * screen. Pure. A visitor may go back to any step, never past the first question not yet answered: an
 * address or a stored step that names a later one shows that question instead. The bar counts the three
 * questions; the account step has none.
 */
import { isStartStep, nicheAnswered, START_STEPS, type StartAnswers, type StartStep } from "./answers";

export const QUESTION_COUNT = 3;

const indexOf = (step: StartStep): number => START_STEPS.indexOf(step);

/** The first step whose question is not answered; the account step once all three are. */
export function firstOpenStep(a: StartAnswers): StartStep {
  if (a.platforms.length === 0) return "platform";
  if (!nicheAnswered(a)) return "niche";
  if (!a.goal) return "goal";
  return "account";
}

/** The step to show: the one asked for when it is not past the first open one; else the first open one. */
export function resolveStep(requested: StartStep | null, a: StartAnswers): StartStep {
  const open = firstOpenStep(a);
  if (requested === null) return open;
  return indexOf(requested) <= indexOf(open) ? requested : open;
}

/** `?step=` as a step, or null. */
export function stepParamOf(value: unknown): StartStep | null {
  return isStartStep(value) ? value : null;
}

export function previousStep(step: StartStep): StartStep | null {
  const i = indexOf(step);
  return i > 0 ? (START_STEPS[i - 1] ?? null) : null;
}

export function nextStep(step: StartStep): StartStep | null {
  const i = indexOf(step);
  return i < START_STEPS.length - 1 ? (START_STEPS[i + 1] ?? null) : null;
}

/** The bar's filled segments: 1 to 3 on the questions; null on the account step (no bar). */
export function barOf(step: StartStep): number | null {
  return step === "account" ? null : indexOf(step) + 1;
}

export const startHref = (step: StartStep): string => `/start?step=${step}`;
