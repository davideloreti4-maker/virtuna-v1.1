"use client";

/**
 * SimulateDoorHost — the ＋ door, mounted once and opened from two places.
 *
 * This is the thing the lane exists to build: a creator brings their OWN hook, script, video file or
 * link, arms it on ⑤, and it becomes a row on the same board as everything a skill made. Until now
 * the only way onto that board was to generate something first.
 *
 * ONE MOUNT, TWO DOORS — and it has to be one mount, because the two doors live on surfaces that
 * cannot both reach it:
 *   - the board's ＋ ("Test something of your own"), in-thread, inside `AmbientOverviewRail`;
 *   - the Start card's SIMULATE DOOR, pre-thread, inside `AmbientStart`.
 * The pre-thread one settles it: on the empty home `railHost` is NULL (home-page-layout only mounts
 * the rail <aside> in thread mode), so the rail — and any intake living inside it — does not exist
 * yet. Both doors therefore call up to the composer, which renders this host over the surface.
 *
 * WHY THE SHEET IS A MODAL: `AmbientSimulate` un-`connected` already styles itself as a floating
 * 460px sheet (SHEET_STYLE, a 24/64 shadow). A cold bring is a separate deliberate act — the
 * composition law in AmbientStart's docstring — so it reads correctly as one surface over the room
 * rather than a column inside it.
 *
 * WHAT IT ROUTES (Phase 4). `SimulateConfig.stimulus` is what the ARM screen now carries out:
 *   - a DRAFT  → `POST /api/tools/react` with the ARM dials + `card:true` + `persist:true`.
 *     `card` is the anti-orphan half: react persists a SEAL, seals are read through DESCRIPTORS,
 *     and descriptors come only from rendered card blocks — so without a card block the brought
 *     text seals a row that renders NOWHERE. The route inserts a `brought-card` whose `stimulus`
 *     IS the seal key, then `onLanded` re-reads the thread and the row arrives sealed.
 *   - a VIDEO FILE / LINK → handed to `onVideo`, because that run is the ~2-minute `/api/analyze`
 *     Max pipeline the composer already owns end to end (upload → stream → the
 *     `/api/tools/test/card` seal-on-complete). Duplicating it here would fork the money path.
 *
 * It never QUEUES anything. `parsePersonaStops("")` is 0, so a queued brought draft would sort dead
 * last showing 0/10 — a fabricated "the room hates this" about something the room has never seen.
 * The door goes straight to ARM, and the row only exists once a real run has answered.
 */

import { useCallback, useState } from "react";
import { AmbientSimulate, type BroughtStimulus, type SimulateConfig } from "./AmbientSimulate";
import { buildSimulateData } from "@/lib/surfaces/ambient-v2-adapters";
import { audienceToMeta } from "@/lib/surfaces/ambient-v2-audience-meta";
import type { Audience } from "@/lib/audience/audience-types";
import { reportCredit402 } from "@/lib/billing/credit-wall";
import { reportSession401 } from "@/lib/auth/session-expired";
import { TONE } from "./AmbientDetail";
import { SHEET_STYLE } from "./SimulateIntake";

/** The draft kinds the react route accepts on the card (the video door never lands here). */
type CardKind = "draft" | "hook" | "idea" | "script";

function cardKindOf(kind: BroughtStimulus["kind"]): CardKind {
  return kind === "hook" || kind === "idea" || kind === "draft" ? kind : "draft";
}

/**
 * THE SEALED WAIT — the stimulus, and the honest fact that the room is still reading.
 *
 * No number appears here: a verdict withheld until n-of-n decide is the sealed-verdict law.
 *
 * Extracted + exported for `/dev/cards` (2026-07-29). Phase 6 pinned every other state of ⑤, and
 * this one got missed because it is the only one that is not a step — it exists solely BETWEEN the
 * POST and its response, so the only way to look at it was to spend a credit and be quick. The
 * gallery mounts this, not a copy of it: a copied state is one that drifts in silence.
 */
export function SimDoorReading({ stimulus, audienceName }: { stimulus: string; audienceName: string }) {
  return (
    <div
      data-testid="sim-door-reading"
      className="flex w-full max-w-[460px] flex-col gap-3 rounded-[16px] px-[26px] py-[24px]"
      style={SHEET_STYLE}
    >
      <div className="font-mono text-[12px] uppercase tracking-[0.08em]" style={{ color: TONE.faint }}>
        Reading the room
      </div>
      <p className="text-[14px] leading-[1.45]" style={{ color: TONE.cream }}>
        {stimulus}
      </p>
      <p className="text-[12px]" style={{ color: TONE.faint }}>
        {audienceName} is reading it now — the verdict lands on your board.
      </p>
    </div>
  );
}

export function SimulateDoorHost({
  audience,
  open,
  onClose,
  onLanded,
  onVideo,
  ensureThread,
}: {
  /** The live audience — the same one the board and the composer are pointed at. */
  audience: Audience;
  open: boolean;
  onClose: () => void;
  /**
   * Materialise the thread BEFORE the run, awaited. Not optional bookkeeping: while the client
   * pointer sits on the new-thread sentinel, every server-side `createOpenThreadLazy` mints its OWN
   * row — so the card would be written to one thread while the client reads another, and a paid run
   * would complete into a blank screen. That is F-019, and a brought stimulus fired as the first
   * send of a fresh thread is the same shape.
   */
  ensureThread: () => Promise<void>;
  /**
   * The brought text landed: a `brought-card` is in the thread and its seal is written. The host
   * re-reads the open thread (blocks AND `sim_seals`) so the row arrives already sealed instead of
   * appearing queued until the next reload.
   */
  onLanded: () => void | Promise<void>;
  /** Run the Max video pipeline for a brought file/link (the composer owns that stream). */
  onVideo: (brought: BroughtStimulus) => void;
}) {
  // "reading" holds the text under read — the SEALED wait (no verdict until the run returns).
  const [reading, setReading] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const fire = useCallback(
    async (config: SimulateConfig) => {
      const brought = config.stimulus;
      // A cold ARM always carries one. No stimulus ⇒ nothing to run, and firing the audience
      // default instead would be exactly the bug Phase 2 removed (arming the caller's text).
      if (!brought) return;

      // A video is the composer's pipeline, not a fetch we can own here. Hand it over and close:
      // the run then reads on the thread's own run capsule, where a 2-minute wait belongs.
      if (brought.kind === "video") {
        onVideo(brought);
        onClose();
        return;
      }

      const text = brought.text.trim();
      if (text.length === 0) return;
      setFailed(false);
      setReading(text);
      try {
        // The thread has to exist first — see the `ensureThread` prop doc (F-019).
        await ensureThread();
        const res = await fetch("/api/tools/react", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            // pin: the flywheel capture every deliberate sim makes. persist: the sealed verdict.
            // card: the thread block, without which the seal is orphaned (see the module note).
            pin: true,
            persist: true,
            card: true,
            cardKind: cardKindOf(brought.kind),
            // The ARM dials, all of which this route honours (Phase 1 wired them).
            lens: config.lensKey,
            scene: config.scene,
            ...(config.segment ? { segment: config.segment, segmentLabel: config.segmentLabel } : {}),
          }),
        });
        if (!res.ok) {
          // The THIRD caller of this route, and the third that has to raise the wall itself: react
          // costs 1 credit, so this can come back 402 and the refusal must arrive as the paywall
          // rather than as silence (the composer's `ask` verb learned that the expensive way).
          const err = await res.json().catch(() => null);
          // 401 first. Either refusal already owns the screen, so `setFailed` would add a second
          // explanation underneath a dialog that has the better one.
          if (!reportSession401(res.status) && !reportCredit402(res.status, err)) setFailed(true);
          setReading(null);
          return;
        }
        setReading(null);
        await onLanded();
        onClose();
      } catch {
        // Network/abort — the run produced no verdict, so say so and leave the sheet open with the
        // stimulus intact. Nothing is sealed and nothing is claimed.
        setReading(null);
        setFailed(true);
      }
    },
    [onClose, onLanded, onVideo, ensureThread],
  );

  if (!open) return null;

  const data = buildSimulateData({
    audience: audienceToMeta(audience),
    // The cold path never reads this — `AmbientSimulate` takes its stimulus from what the intake
    // collected — but the view-model requires the field. Empty is the honest placeholder: there is
    // nothing under test until the creator brings it.
    stimulus: { text: "", kind: "draft" },
  });

  return (
    <div
      data-testid="sim-door-host"
      // --z-modal (400), not z-50: the sidebar sits on --z-sidebar (250), so at 50
      // this scrim painted under the app's own chrome. Measured clean for lifting —
      // there are 0 stacking contexts between the composer (where this mounts) and
      // <html>, so the z alone is enough and no portal is needed.
      className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center overflow-y-auto p-4 sm:items-center"
      style={{ background: "rgba(12,12,11,.62)" }}
      onClick={(e) => {
        // Click-outside closes, but never mid-run: the reaction is already paid for.
        if (e.target === e.currentTarget && !reading) onClose();
      }}
    >
      {reading ? (
        <SimDoorReading stimulus={reading} audienceName={audience.name} />
      ) : (
        <div className="flex w-full max-w-[460px] flex-col gap-2">
          <AmbientSimulate data={data} mode="cold" onClose={onClose} onSimulate={fire} />
          {failed ? (
            <p className="px-1 text-[12px]" style={{ color: TONE.faint }}>
              That read didn’t come back. Nothing was sealed — try it again.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
