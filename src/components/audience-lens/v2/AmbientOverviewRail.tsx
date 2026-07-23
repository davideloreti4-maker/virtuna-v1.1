"use client";

/**
 * AmbientOverviewRail — the Ambient Audience v2 surfaces, mounted in the composer's ≥xl thread rail
 * (parallel-run behind `AMBIENT_V2_ENABLED`; the legacy `AudiencePresence` stays the default).
 *
 * Fed the REAL live inputs already in composer scope — the active `Audience` (→ `AudienceMeta`) and
 * the thread's projected-card ledger (`AmbientCardDescriptor[]`). Overview + Simulate render on real
 * data (zero fabrication; queued ranks come from the shipped projection).
 *
 * Phase D-minimal (2026-07-23, owner call): the "Simulate →" door now FIRES a real sealed sim and
 * seals the tapped row with a MEASURED would-stop % — no fabrication. It reuses the shipped
 * `POST /api/tools/react` primitive (the type-to-room reaction), which runs the SAME
 * `runFlashTextMode` + `aggregateFlash` engine every card already uses and — crucially — works for
 * ANY audience (it resolves the active audience SERVER-SIDE off the open thread; it is NOT the
 * General-only `/api/tools/simulate` verb, which `resolveTier`-rejects the socials audience). The
 * returned `fraction` ("N/10 stop") is the honest measured verdict; it replaces the projection for
 * that row (`buildOverviewData` sorts a sealed row above every queued one). While in flight the
 * Overview shows the SEALED watcher (verdict withheld until the run returns — the sealed-verdict law).
 *
 * Two seams remain LATER phases, marked below:
 *   - the flywheel pin (`pinPredictedSignature`) is NOT relocated here — `/api/tools/react` is
 *     ephemeral BY DESIGN (no persistence), and a speculative concept-sim has no reconcilable
 *     posted-video outcome to pin against. The pin belongs on the PERSISTED calibrated sealed sim
 *     (Phase D-full), where an outcome linkage exists. Deferred there, not silently dropped.
 *   - the Brain/Population depth detail (`onOpenStimulus`) — Phase C (its producers aren't real yet),
 *     so a rank tap opens Simulate in develop mode rather than a fixture-backed depth view.
 *
 * Build spec: docs/HANDOFF-2026-07-22-ambient-v2-wiring-provenance-audit.md
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AMBIENT_PANEL_HEIGHT, AmbientOverview, type WatchingRun } from "./AmbientOverview";
import { AmbientSimulate, type StimulusKind } from "./AmbientSimulate";
import { buildOverviewData, buildSimulateData, parsePersonaStops } from "@/lib/surfaces/ambient-v2-adapters";
import { audienceToMeta } from "@/lib/surfaces/ambient-v2-audience-meta";
import type { Audience } from "@/lib/audience/audience-types";
import type { AmbientCardDescriptor } from "@/components/app/home/use-ambient-focus";

/** The descriptor kind → the Simulate stimulus kind (script/remix are drafts under test). */
function stimulusKindOf(kind?: string): StimulusKind {
  switch (kind) {
    case "hook":
      return "hook";
    case "idea":
      return "idea";
    default:
      return "draft"; // script · remix · unknown
  }
}

/** A rough band word for the develop tie-back, from the projection's /10 (shares the 6/3 bands). */
function bandFromStops(stops: number): string {
  if (stops >= 6) return "Strong";
  if (stops >= 3) return "Fair";
  return "Weak";
}

/** The Flash reaction framing the react route accepts — a card's would-stop read is "hook"
 *  (first-2s), an idea's "would they want it" is "idea"; every other kind defaults to hook. */
function framingOf(kind?: string): "hook" | "idea" | undefined {
  if (kind === "hook") return "hook";
  if (kind === "idea") return "idea";
  return undefined; // route default is "hook"
}

/** Parse aggregateFlash's honest "N/10 stop" fraction → a 0–100 would-stop %. Unparseable ⇒ null
 *  (we NEVER fabricate a seal from a malformed fraction — the row stays queued). */
function fractionToStopPct(fraction: string): number | null {
  const m = /(\d+)\s*\/\s*(\d+)/.exec(fraction ?? "");
  if (!m) return null;
  const n = Number(m[1]);
  const d = Number(m[2]);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((n / d) * 100)));
}

export function AmbientOverviewRail({
  audience,
  descriptors,
  reducedMotion = false,
  persistedSeals,
}: {
  audience: Audience;
  descriptors: AmbientCardDescriptor[];
  reducedMotion?: boolean;
  /** Sealed verdicts rehydrated from `threads.sim_seals`, keyed by TRIMMED concept text → measured
   *  would-stop %. These re-seal rows on reload; a fresh in-session fire (below) takes precedence. */
  persistedSeals?: Record<string, number>;
}) {
  const meta = audienceToMeta(audience);
  // "develop" carries the tapped rank into Simulate; null ⇒ Overview.
  const [developId, setDevelopId] = useState<string | null>(null);
  // Sealed MEASURED would-stop % per descriptor id, from FIRED sims THIS session. Absent ⇒ fall back
  // to a persisted seal (by concept text), else an honest queued row.
  const [sessionMeasured, setSessionMeasured] = useState<Record<string, number>>({});
  // The run in flight — sealed (verdict withheld) until `/api/tools/react` returns.
  const [watching, setWatching] = useState<WatchingRun | null>(null);
  const inflightRef = useRef<AbortController | null>(null);
  useEffect(() => () => inflightRef.current?.abort(), []);

  const openDevelop = (id: string) => setDevelopId(id);

  // Fire the REAL sealed sim for one ranked stimulus and seal its row with the measured fraction.
  const fireSim = useCallback(
    async (id: string) => {
      const d = descriptors.find((x) => x.id === id);
      const text = (d?.conceptText ?? "").trim();
      if (text.length === 0) return;

      inflightRef.current?.abort();
      const controller = new AbortController();
      inflightRef.current = controller;

      // Show the SEALED watcher immediately (verdict withheld) + return to the Overview so the
      // in-flight run reads on the ranked surface, not behind the arming card.
      setWatching({ stimulus: text });
      setDevelopId(null);

      try {
        const framing = framingOf(d?.kind);
        const res = await fetch("/api/tools/react", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // A DELIBERATE Overview sim: pin:true captures the predicted vector for the flywheel
          // (relocated `pinPredictedSignature`); persist:true writes the sealed verdict to the
          // thread so the seal survives reload. Type-to-room omits both and stays ephemeral.
          body: JSON.stringify({ text, pin: true, persist: true, ...(framing ? { framing } : {}) }),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!res.ok) throw new Error("reaction_failed");
        const data: { fraction?: string } = await res.json();
        if (controller.signal.aborted) return;
        const pct = fractionToStopPct(data.fraction ?? "");
        // Seal the row only with a real, parseable fraction (honesty spine — never a fabricated %).
        if (pct !== null) setSessionMeasured((prev) => ({ ...prev, [id]: pct }));
      } catch {
        // Aborted or failed → drop the watcher; the row stays honestly queued (no seal).
      } finally {
        if (inflightRef.current === controller) {
          inflightRef.current = null;
          setWatching(null);
        }
      }
    },
    [descriptors],
  );

  if (developId !== null) {
    const d = descriptors.find((x) => x.id === developId);
    const stops = d ? parsePersonaStops(d.fraction) : 0;
    const simData = buildSimulateData({
      audience: meta,
      stimulus: { text: d?.conceptText ?? "", kind: stimulusKindOf(d?.kind) },
      develop: { band: bandFromStops(stops), value: `${stops}/10`, lensLabel: "would stop" },
    });
    const armedId = developId;
    return (
      <div className="flex w-full items-start justify-center">
        <AmbientSimulate
          data={simData}
          mode="develop"
          onClose={() => setDevelopId(null)}
          // Phase D-minimal: fire the real react sim → sealed measured % replaces the projection.
          onSimulate={() => fireSim(armedId)}
        />
      </div>
    );
  }

  // Merge the seal sources into the per-descriptor-id map buildOverviewData reads: a fresh in-session
  // fire wins; else a persisted seal matched by trimmed concept text (survives reload); else queued.
  const measured: Record<string, number> = {};
  for (const d of descriptors) {
    const pct = sessionMeasured[d.id] ?? persistedSeals?.[d.conceptText.trim()];
    if (typeof pct === "number") measured[d.id] = pct;
  }
  const overview = buildOverviewData({ audience: meta, descriptors, measured, watching });
  return (
    <div style={{ height: AMBIENT_PANEL_HEIGHT }} className="flex w-full justify-center">
      <AmbientOverview
        data={overview}
        reducedMotion={reducedMotion}
        // Phase C: a rank tap should open the Brain/Population depth — its producers aren't real yet,
        // so for now it routes to Simulate (develop) for that rank instead of a fixture depth view.
        onOpenStimulus={openDevelop}
        // Quick-sim fires the real sealed sim immediately (no arming step).
        onQuickSimulate={fireSim}
        onTestVariant={() => descriptors[0] && openDevelop(descriptors[0].id)}
      />
    </div>
  );
}
