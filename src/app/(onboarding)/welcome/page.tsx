"use client";

/**
 * /welcome — the first authenticated screen a new account sees.
 *
 * TWO steps, and the second one is the point:
 *
 *   1. connect    — ConnectStep collects EITHER an @handle or a written description,
 *                   and creates the draft audience row.
 *   2. calibrate  — CalibrationFlow runs the real pipeline against that draft, inline.
 *
 * Why the wait lives here, blocking, instead of in the background (owner call, 2026-08-02):
 * calibration is a measured ~128s, but it is not a blank one. The spine draws calibration's three
 * real phases and, seconds in, the creator's own avatar, follower count and video covers — their
 * material, on screen, roughly two minutes before the audience it produces. Deferring it would buy
 * an instant entry and hand them a product whose every card reads "Not tested yet", which is
 * exactly the disconnect this flow exists to close.
 *
 * ⚠️ The calibrate stage is LOCAL state, deliberately not persisted to `creator_profiles.
 * onboarding_step`. Restoring into it on reload would remount CalibrationFlow with autoStart and
 * fire a SECOND Apify scrape against a metered account. A reload mid-run returns to step 1.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Audience } from "@/lib/audience/audience-types";
import { SENTINEL_IDS } from "@/lib/audience/audience-repo";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { ConnectStep, type Door } from "@/components/onboarding/connect-step";
import { CalibrationFlow } from "@/components/audience/calibration-flow";
import { WaitQuestions } from "@/components/onboarding/wait-questions";
import { CONCEPT_V8_ENABLED } from "@/lib/flags/concept-v8";
import { LaneQuestion } from "@/components/onboarding/lane-question";
import { LaneReveal } from "@/components/onboarding/lane-reveal";
import type { LaneShelf } from "@/lib/surfaces/lane-drops";
import { track } from "@/lib/analytics/funnel-events";
import { cn } from "@/lib/utils";

/** The two real steps. The indicator counts these — it is progress, not decoration. */
const STEPS = ["connect", "calibrate"] as const;
type Stage = (typeof STEPS)[number];

export default function WelcomePage() {
  const router = useRouter();
  const store = useOnboardingStore();
  const { step, _isHydrated, _hydrate } = store;

  // Local — see the header note on why this is not persisted.
  const [stage, setStage] = useState<Stage>("connect");
  const [draft, setDraft] = useState<Audience | null>(null);
  const [prefill, setPrefill] = useState<{ handle?: string; description?: string }>({});
  const [door, setDoor] = useState<Door>("personal");

  // ── The day-0 lanes branch (v8 Phase 5) — flag-gated, describe-door only ─────────
  // Local, for the same reason `stage` is: restoring into it on reload would re-enter a
  // branch whose submit costs adapt + Flash calls. A reload returns to step 1.
  const [lanesOpen, setLanesOpen] = useState(false);
  const [shelves, setShelves] = useState<LaneShelf[] | null>(null);
  const [lanesBusy, setLanesBusy] = useState(false);
  const [lanesError, setLanesError] = useState<string | null>(null);

  // Hydrate store on mount
  useEffect(() => {
    if (!_isHydrated) {
      _hydrate();
    }
  }, [_isHydrated, _hydrate]);

  // CR-05: Ensure user is authenticated, hydrate from Supabase, and only
  // insert the creator_profiles row if it is genuinely missing. An unmount
  // guard prevents store writes against a now-unmounted consumer if the
  // user navigates away mid-effect. We deliberately read first, then insert
  // only on miss — the previous `upsert(..., { ignoreDuplicates: true })`
  // was a no-op on every existing-row mount but still ate a network round
  // trip on each visit.
  //
  // WR-02: log a warning when `dbStep` is neither "connect" nor "completed"
  // so any stale value left behind by a legacy/in-flight writer is
  // observable rather than silently coerced.
  useEffect(() => {
    if (!_isHydrated) return;
    let unmounted = false;

    async function initOnboarding() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (unmounted) return;

      if (!user) {
        router.replace("/");
        return;
      }

      // Read first — avoid the round-trip + write on every mount for users
      // whose row already exists.
      const { data: profile } = await supabase
        .from("creator_profiles")
        .select("onboarding_step, onboarding_completed_at, tiktok_handle")
        .eq("user_id", user.id)
        .maybeSingle();
      if (unmounted) return;

      if (profile?.onboarding_completed_at) {
        router.replace("/home");
        return;
      }

      if (!profile) {
        // First-time visitor — create the bootstrap row.
        await supabase
          .from("creator_profiles")
          .insert({ user_id: user.id, onboarding_step: "connect" });
        if (unmounted) return;
        return;
      }

      // Restore state from DB if available — defense-in-depth: any DB value
      // outside the narrowed "connect" | "completed" union coerces back to
      // "connect" so the store cannot enter an unrepresentable state even if
      // a legacy row escaped the migration UPDATE in Plan 02-01.
      const dbStep = profile.onboarding_step as string | null;
      if (dbStep && dbStep !== store.step) {
        if (dbStep === "connect" || dbStep === "completed") {
          store.setStep(dbStep);
        } else {
          console.warn(
            "[welcome] coercing unknown onboarding_step to 'connect':",
            dbStep
          );
          store.setStep("connect");
        }
      }
      if (profile.tiktok_handle && !store.tiktokHandle) {
        store.setTiktokHandle(profile.tiktok_handle);
      }

      // ── Adopt whatever a previous, interrupted attempt already produced ──────────────
      //
      // Leaving /welcome mid-calibration does NOT stop the run. The calibrate route does all
      // of its work and all of its writes inside the SSE stream's start(), nothing cancels it,
      // and `send` simply swallows frames once the client is gone — so a user who reloads at
      // t=60s of a ~128s scrape still gets their audience written at t=128s.
      //
      // Without this check the page would then ask for the handle again and spend a SECOND
      // Apify scrape (on a $5/mo capped account) to rebuild an audience that already exists,
      // leaving a duplicate row behind it. Onboarding's job is done the moment a calibrated
      // audience exists; finding one is a reason to finish, not to start over.
      try {
        const res = await fetch("/api/audiences");
        if (unmounted || !res.ok) return;
        const { audiences } = (await res.json()) as { audiences?: Audience[] };
        if (unmounted || !audiences?.length) return;

        // ⚠️ OWNERSHIP FIRST, then calibration. `/api/audiences` does not return only the
        // user's rows: it also serves the virtual constants — GENERAL_AUDIENCE, the two
        // PRESET_AUDIENCES and the two GENERAL_TEMPLATES — which never touch the DB and carry
        // `user_id: "__virtual__"`. Two of those templates ship a runnable persona panel by
        // design, and they are `is_general: false`.
        //
        // So `!is_general && personas.length > 0` matched "Analyst Panel" for an account that
        // owned nothing at all, and EVERY new signup was stamped onboarded ~9s after creating
        // its account and dropped on /home uncalibrated — the exact state this flow exists to
        // prevent. Found live on numenmachines.com 2026-08-04; the account never saw the form.
        //
        // `personas.length` IS the app's calibrated test (select-persona-targets.ts:111) — it
        // is just not an OWNERSHIP test, and this branch needs both. SENTINEL_IDS is the
        // repo's own answer to "is this a real row", already used by four other call sites.
        const owned = audiences.filter((a) => !SENTINEL_IDS.has(a.id));

        const calibrated = owned.find(
          (a) => !a.is_general && (a.personas?.length ?? 0) > 0,
        );
        if (calibrated) {
          // Adopting an interrupted attempt has to select it too, for the same reason the
          // normal exit does — this path is how a user who reloaded mid-scrape finishes, and
          // landing them on General would waste the scrape they already paid for.
          //
          // Routed through `finishOnboarding` rather than repeating its two lines: they were
          // already byte-identical, and this is a REAL completion — a user who sat out the wait
          // across a reload — so it must reach `calibrate_done` like every other exit. Duplicated
          // here it would have been the one finish the funnel could not see.
          await finishOnboarding(calibrated); // → the redirect effect lands them on /home
          return;
        }

        // Only a DRAFT survived (created, never calibrated). Adopt it so a retry PATCHes that
        // row instead of minting a fresh one on every interrupted attempt.
        const pending = owned.find((a) => !a.is_general);
        if (pending && !unmounted) setDraft(pending);
      } catch {
        /* best-effort — a failed lookup just means the normal first-run path */
      }
    }

    void initOnboarding();
    return () => {
      unmounted = true;
    };
  }, [_isHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect into the app when onboarding completes. /dashboard was sunset (D-25) and
  // middleware 308s it to /home — going there directly saves every new account a pointless
  // extra hop on its first navigation.
  useEffect(() => {
    if (_isHydrated && step === "completed") {
      router.replace("/home");
    }
  }, [step, _isHydrated, router]);

  /**
   * Every exit from calibration ends onboarding — success, thin-data fallback, or a failed
   * scrape. Completing on failure is deliberate: middleware bounces any authenticated user
   * without `onboarding_completed_at` back to /welcome, so NOT stamping it here would trap a
   * user whose account is private or whose scrape failed in a loop they cannot leave.
   * `completeOnboarding` also persists the handle we collected in step 1.
   *
   * ⚠️ SELECTING the audience is part of finishing, not a separate concern.
   *
   * Building the row was never the point — being TESTED against it is. `/home` seeds the
   * composer from `user_settings.last_audience_id` (via resolveUserAudience) and falls back to
   * General when that is unset, and until 2026-08-04 nothing in onboarding ever wrote it: the
   * four callers of PUT /api/settings/last-audience are all in-app surfaces the new user has
   * not reached yet. `CalibrationFlow` hands the calibrated audience to `onDone` and the call
   * site threw the argument away, so an account that had just sat through a ~176s scrape
   * landed on /home reading "Your audience — General", with its own audience sitting
   * unselected one screen away. Audited live on a production build; `user_settings` was empty.
   *
   * A skip passes nothing and stays General on purpose — a skip means there IS no calibrated
   * audience to select.
   */
  async function selectAudience(audience: Audience | null | undefined) {
    // The route takes a REAL uuid or null; virtual ids are not uuids and cannot satisfy the
    // audiences FK, so a sentinel must never reach it (see its own header).
    if (!audience || SENTINEL_IDS.has(audience.id)) return;
    try {
      await fetch("/api/settings/last-audience", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audienceId: audience.id }),
      });
    } catch {
      // Best-effort: a failed selection must not trap the user on /welcome. They land on
      // General and can switch, which is strictly better than not completing.
    }
  }

  /**
   * `calibrate_done` — the closing bracket of the ~128s wait `handle_submit` opens
   * (connect-step.tsx). Declared in FUNNEL_EVENTS since the funnel was designed and, until now,
   * emitted from nowhere, which left the single most likely real drop-off point in the product
   * completely unmeasured.
   *
   * ⚠️ It is emitted HERE rather than on `CalibrationFlow`'s `onDone`, and that placement is the
   * whole point. Every exit from calibration routes through this function — success, the
   * thin-data fallback, and a failed scrape — because middleware would otherwise trap an
   * uncalibrated account on /welcome forever (see the note above `selectAudience`). Instrumenting
   * only the success path would produce a completion rate of exactly 100% while people were being
   * dropped, which is worse than no metric: it would read as proof the wait is fine.
   *
   * So the event always fires and `calibrated` carries the outcome. A run that produced no
   * audience is a `calibrate_done` with `calibrated: false` — an honest completion of a step that
   * did not deliver, which is the number worth watching.
   */
  async function finishOnboarding(calibrated?: Audience) {
    track("calibrate_done", { calibrated: !!calibrated });
    await selectAudience(calibrated);
    await store.completeOnboarding();
  }

  /**
   * The recovery: a run that produced no audience sends them to the OTHER door rather than into
   * General. Without it the most likely first-run outcome — a new creator whose account is too
   * thin to read — ends onboarding in exactly the uncalibrated state this flow exists to prevent.
   *
   * The draft row travels with them and gets PATCHed, so switching doors does not strand one
   * audience row per attempt.
   */
  function switchDoor() {
    setDoor(prefill.handle ? "target" : "personal");
    setPrefill({});
    setStage("connect");
  }

  const recoveryAction = {
    label: prefill.handle
      ? "Describe your audience instead"
      : "Use my TikTok handle instead",
    onClick: switchDoor,
  };

  /**
   * Fire the lanes pipe (spec §4.2). ONE run at a time — the busy guard IS the debounce
   * (fire-on-demand law, SSOT §1). Nothing but this submit reaches the route; navigation
   * never does. A failure hands them back to the describe door rather than stranding them.
   */
  async function findLanes(answer: string) {
    if (lanesBusy) return;
    setLanesBusy(true);
    setLanesError(null);
    try {
      const res = await fetch("/api/surfaces/lanes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      });
      if (!res.ok) throw new Error("lanes failed");
      const { shelves: got } = (await res.json()) as { shelves: LaneShelf[] };
      if (got.length === 0) throw new Error("no lanes");
      setShelves(got);
    } catch {
      setLanesError("Couldn't find your lanes. Describe your audience instead.");
    } finally {
      setLanesBusy(false);
    }
  }

  /**
   * Picking a lane re-enters the EXISTING describe flow with the lane's own line as the
   * description, so onboarding still ends in a calibrated audience. The lane never
   * bypasses calibration and no second onboarding contract is created — which is the
   * whole reason this branch is additive rather than a fork.
   */
  function pickLane(shelf: LaneShelf) {
    setLanesOpen(false);
    setShelves(null);
    // `niche`, not `who` (owner call, carried since 2026-08-10). Both are real fields on the
    // synthesized lane, but only one is a DESCRIPTION: the schema defines `niche` as "the creator
    // niche this lane writes for" (<=12 words, and already what steers format adaptation), while
    // `who` is a posture shorthand capped at six lowercase words — "receipts, not vibes". Seeding
    // the audience description with the posture handed calibration a fragment that names no
    // subject, which is the one input this flow cannot do without.
    setPrefill({ description: shelf.lane.niche });
    setDoor("target");
  }

  const isCalibrating = stage === "calibrate" && draft !== null;

  if (!_isHydrated || step === "completed") {
    return (
      <div
        className="w-full max-w-[400px] rounded-[12px] border border-white/[0.06] px-8 py-10"
        style={{ backgroundColor: "var(--color-charcoal-chip)" }}
      >
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s) => (
            <div key={s} className="h-1.5 w-8 rounded-full bg-white/[0.1]" />
          ))}
        </div>
        <div className="space-y-4 animate-pulse">
          <div className="h-6 w-48 mx-auto rounded bg-white/[0.05]" />
          <div className="h-4 w-64 mx-auto rounded bg-white/[0.05]" />
          <div className="h-[42px] w-full rounded-[8px] bg-white/[0.05]" />
          <div className="h-11 w-full rounded-lg bg-white/[0.05]" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full rounded-[12px] border border-white/[0.06] px-8 py-10 transition-[max-width] duration-300",
        // The calibration stage carries an avatar row, a three-row spine and a cover grid —
        // it needs more room than a single input does.
        isCalibrating ? "max-w-[560px]" : "max-w-[400px]"
      )}
      style={{ backgroundColor: "var(--color-charcoal-chip)" }}
    >
      {/* Step indicator — two REAL steps now, so it measures something. */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {STEPS.map((s, i) => {
          const reached = i <= STEPS.indexOf(stage);
          return (
            <div
              key={s}
              className={cn(
                "h-1.5 w-8 rounded-full transition-colors",
                reached ? "bg-action" : "bg-white/[0.1]"
              )}
            />
          );
        })}
      </div>

      <div className="min-h-[320px]">
        {isCalibrating && draft ? (
          <CalibrationFlow
            audience={draft}
            autoStart
            prefillHandle={prefill.handle}
            prefillDescription={prefill.description}
            prefillPlatform={draft.platform}
            onDone={(calibrated) => void finishOnboarding(calibrated)}
            onSkip={() => void finishOnboarding()}
            secondaryAction={recoveryAction}
            /* The ~128s wait is the only stretch of onboarding where the creator has nothing to
               do, so it is where the three questions the scrape cannot answer are asked
               (ONBOARDING-FUNNEL-DESIGN.md §7). It costs no step and no extra screen: the wait was
               already being spent. `duringWait` is a slot, so the other two CalibrationFlow
               callers — /audience/new and the recalibrate panel — are untouched. */
            duringWait={<WaitQuestions />}
          />
        ) : lanesOpen && shelves ? (
          <LaneReveal shelves={shelves} onPick={pickLane} />
        ) : lanesOpen ? (
          <LaneQuestion
            onSubmit={(answer) => void findLanes(answer)}
            submitting={lanesBusy}
            error={lanesError}
          />
        ) : (
          <ConnectStep
            initialDoor={door}
            existingDraft={draft}
            {...(CONCEPT_V8_ENABLED ? { onNotSure: () => setLanesOpen(true) } : {})}
            onDraftReady={(created, p) => {
              setDraft(created);
              setPrefill(p);
              setStage("calibrate");
            }}
          />
        )}
      </div>
    </div>
  );
}
