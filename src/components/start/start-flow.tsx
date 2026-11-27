"use client";

/**
 * /start (funnel spec §3.2, screens 2–5): one question per screen, then the account.
 *
 * - The answers live in local storage (`maven.start.v1`) until the account exists; a refresh resumes at the
 *   same step. The step is also in the address (`?step=`): going on pushes it, so the browser's Back walks the
 *   steps; the screen's own Back replaces it. An address or a stored step past the first unanswered question
 *   shows that question instead (`resolveStep`), and the address is corrected.
 * - Back on the first step goes to the landing page.
 * - Storage and the address exist only in the browser: the server and hydration's first pass draw the ground
 *   alone (`useInBrowser`), then the body reads both once, in its state's first value (no effect sets state).
 * - `start_step` once per step shown.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { track } from "@/lib/analytics/funnel-events";
import { answersOf, readStart, writeStart, type StartAnswers, type StartStep } from "@/lib/onboarding/answers";
import { browserStorage } from "@/lib/onboarding/browser-storage";
import { barOf, previousStep, resolveStep, startHref, stepParamOf } from "@/lib/onboarding/start-steps";

import { AccountStep, type StartAccount } from "./account-step";
import { GoalStep } from "./goal-step";
import { NicheStep } from "./niche-step";
import { PlatformStep } from "./platform-step";
import { StartHeader } from "./start-header";

const LANDING_HREF = "/";

const noSubscription = () => () => {};
/** True in the browser once hydrated; false on the server and in hydration's first pass. */
function useInBrowser(): boolean {
  return useSyncExternalStore(noSubscription, () => true, () => false);
}

const stepInAddress = (): StartStep | null => stepParamOf(new URLSearchParams(window.location.search).get("step"));

function firstVisit(): { answers: StartAnswers; step: StartStep } {
  const { step: storedStep, ...answers } = readStart(browserStorage("local"));
  return { answers, step: resolveStep(stepInAddress() ?? storedStep, answers) };
}

export function StartFlow({ account }: { account: StartAccount | null }) {
  const inBrowser = useInBrowser();
  return (
    <main className="min-h-dvh bg-background text-foreground">
      {inBrowser ? <StartBody account={account} /> : null}
    </main>
  );
}

function StartBody({ account }: { account: StartAccount | null }) {
  const router = useRouter();
  const [first] = useState(firstVisit);
  const [answers, setAnswers] = useState<StartAnswers>(first.answers);
  const [step, setStep] = useState<StartStep>(first.step);
  const latest = useRef(first.answers);
  const body = useRef<HTMLDivElement>(null);
  const shownStep = useRef(first.step);

  useEffect(() => {
    latest.current = answers;
  }, [answers]);

  // A step change (not the first render): the page back to the top and focus on the new step's title, so a
  // screen reader says the new screen instead of losing focus to the body with the old step's button.
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    window.scrollTo(0, 0);
    body.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, [step]);

  // The address says the step shown from the first paint on.
  useEffect(() => {
    window.history.replaceState(null, "", startHref(first.step));
  }, [first.step]);

  // The browser's Back and Forward between the steps this visit pushed.
  useEffect(() => {
    const onPop = () => {
      const next = resolveStep(stepInAddress(), latest.current);
      setStep(next);
      if (stepInAddress() !== next) window.history.replaceState(null, "", startHref(next));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    writeStart(browserStorage("local"), { ...answers, step });
  }, [answers, step]);

  useEffect(() => {
    track("start_step", { step });
  }, [step]);

  const go = (requested: StartStep, patch: Partial<StartAnswers>) => {
    const merged = answersOf({ ...answers, ...patch });
    const next = resolveStep(requested, merged);
    setAnswers(merged);
    setStep(next);
    window.history.pushState(null, "", startHref(next));
  };

  const back = () => {
    const previous = previousStep(step);
    if (previous === null) {
      router.push(LANDING_HREF);
      return;
    }
    setStep(previous);
    window.history.replaceState(null, "", startHref(previous));
  };

  return (
    <div ref={body} className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+28px)] md:min-h-0 md:py-16">
      <StartHeader onBack={back} filled={barOf(step)} />
      {step === "platform" ? <PlatformStep answers={answers} onDone={(patch) => go("niche", patch)} /> : null}
      {step === "niche" ? <NicheStep answers={answers} onDone={(patch) => go("goal", patch)} /> : null}
      {step === "goal" ? <GoalStep answers={answers} onDone={(patch) => go("account", patch)} /> : null}
      {step === "account" ? <AccountStep answers={answers} account={account} /> : null}
    </div>
  );
}
