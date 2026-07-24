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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AmbientOverview, type WatchingRun } from "./AmbientOverview";
import { AmbientSimulate, type StimulusKind } from "./AmbientSimulate";
import { AmbientDetail } from "./AmbientDetail";
import {
  buildOverviewData,
  buildSimulateData,
  parsePersonaStops,
  type OverviewVideoRow,
} from "@/lib/surfaces/ambient-v2-adapters";
import { buildDomainTemplate, type PopulationPersona } from "@/lib/surfaces/ambient-v2-population";
import { buildVideoDomainTemplate } from "@/lib/surfaces/ambient-v2-brain";
import { audienceToMeta } from "@/lib/surfaces/ambient-v2-audience-meta";
import type { Audience } from "@/lib/audience/audience-types";
import type { AmbientCardDescriptor } from "@/components/app/home/use-ambient-focus";
import type { PopulationAggregate } from "@/lib/audience/population";
import type { SimSealMap, SimSealVideo } from "@/lib/threads/sim-seals";

/** One fired sim's full result, kept per descriptor id for the Overview seal + the depth drill. */
interface RailSnapshot {
  pct: number;
  population?: PopulationAggregate | null;
  personas?: PopulationPersona[];
  scrollQuote?: string;
}

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

/** A tested video's row label — its real opening words (spoken, else on-screen), clipped; an honest
 *  "Tested video" fallback when the transcript is bare. Never invents a title. */
function videoLabel(v: SimSealVideo): string {
  const hook = v.verbatim?.hook;
  const text = (hook?.spoken_words ?? hook?.on_screen_text ?? "").trim();
  if (text.length === 0) return "Tested video";
  return text.length > 64 ? `${text.slice(0, 63)}…` : text;
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
  /** Sealed sims rehydrated from `threads.sim_seals`, keyed by TRIMMED concept text → the full seal
   *  (measured %, + the Phase-C population/personas depth). These re-seal rows AND repopulate the
   *  depth drill on reload; a fresh in-session fire (below) takes precedence. */
  persistedSeals?: SimSealMap;
}) {
  const meta = audienceToMeta(audience);
  // "develop" carries the tapped rank into Simulate; null ⇒ Overview.
  const [developId, setDevelopId] = useState<string | null>(null);
  // "detail" opens the Brain/Population depth drill for a SEALED row; null ⇒ not open.
  const [detailId, setDetailId] = useState<string | null>(null);
  // Sealed sims fired THIS session, per descriptor id (measured % + the depth payload). Absent ⇒ fall
  // back to a persisted seal (by concept text), else an honest queued row.
  const [sessionSeals, setSessionSeals] = useState<Record<string, RailSnapshot>>({});
  // The run in flight — sealed (verdict withheld) until `/api/tools/react` returns.
  const [watching, setWatching] = useState<WatchingRun | null>(null);
  const inflightRef = useRef<AbortController | null>(null);
  useEffect(() => () => inflightRef.current?.abort(), []);

  // Tested videos, sourced from the seal store — a `sim_seals` entry carrying a `video` blob (written
  // at Test time, keyed by analysisId). These are a DIFFERENT kind of row than a projected concept:
  // they carry a native VIRAL score (craft) and an ALREADY-measured attention %, and they route
  // through their own reveal/drill handlers below (never through the concept fireSim/develop path).
  const videoSeals = useMemo<Record<string, SimSealVideo>>(() => {
    const out: Record<string, SimSealVideo> = {};
    for (const [key, seal] of Object.entries(persistedSeals ?? {})) {
      if (seal.video) out[key] = seal.video;
    }
    return out;
  }, [persistedSeals]);

  // Which video rows have been "simulated" this session — a click reveals the persisted attention %
  // (no re-run: the Test analysis already produced it). Until then the row shows only its viral score.
  const [revealedVideos, setRevealedVideos] = useState<Record<string, boolean>>({});
  const revealVideo = useCallback((id: string) => {
    setRevealedVideos((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }, []);

  const openDevelop = (id: string) => setDevelopId(id);

  // Reset the open drill wholesale when the thread's descriptor set changes (thread switch), so a
  // stale positional id can't render a mismatched depth view.
  useEffect(() => {
    setDetailId(null);
    setDevelopId(null);
  }, [descriptors]);

  // Resolve a descriptor id → its sealed snapshot: a fresh in-session fire wins; else a persisted seal
  // matched by trimmed concept text (survives reload). Undefined ⇒ the row is still honestly queued.
  const snapshotFor = useCallback(
    (id: string): RailSnapshot | undefined => {
      if (sessionSeals[id]) return sessionSeals[id];
      const d = descriptors.find((x) => x.id === id);
      const seal = d ? persistedSeals?.[d.conceptText.trim()] : undefined;
      if (!seal) return undefined;
      return {
        pct: seal.pct,
        population: seal.population,
        personas: seal.personas,
        scrollQuote: seal.scrollQuote,
      };
    },
    [sessionSeals, persistedSeals, descriptors],
  );

  // Clicking a row:
  //  - a SEALED row WITH population → the real Population page (AmbientDetail). BOTH calibrated and
  //    General yield a population now — General reacts through the honest generic baseline signature
  //    (general-baseline-signature.ts), so a new user drills into the SAME Population room.
  //  - a SEALED row with NO population (presets, or a projection failure) → inert; the measured % IS
  //    the result. We never invent a page, and never re-open the ARM config (owner-caught).
  //  - an un-run QUEUED row (no snapshot) → develop, to arm.
  const openStimulus = useCallback(
    (id: string) => {
      const snap = snapshotFor(id);
      if (snap?.population) setDetailId(id);
      else if (!snap) openDevelop(id);
      // Sealed but no population (preset / failure): inert — the % on the row is the answer.
    },
    [snapshotFor],
  );

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
        const data: {
          fraction?: string;
          scrollQuote?: string;
          personas?: PopulationPersona[];
          population?: PopulationAggregate | null;
        } = await res.json();
        if (controller.signal.aborted) return;
        const pct = fractionToStopPct(data.fraction ?? "");
        // Seal the row only with a real, parseable fraction (honesty spine — never a fabricated %).
        // Capture the full snapshot (population/personas) too, so the depth drill opens without a re-run.
        if (pct !== null) {
          setSessionSeals((prev) => ({
            ...prev,
            [id]: {
              pct,
              population: data.population ?? null,
              personas: data.personas,
              scrollQuote: data.scrollQuote,
            },
          }));
        }
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

  // A row's Simulate tap. A VIDEO reveals its already-measured attention % (no re-run — nothing to
  // configure). A concept OPENS the ARM panel first (pick lens/slice), whose own "Simulate ↑" then
  // fires the real sim — config BEFORE the run, never a run that back-fills into a config (owner call
  // 2026-07-23: the loading-then-config order was backwards).
  const handleQuickSimulate = useCallback(
    (id: string) => {
      if (videoSeals[id]) return revealVideo(id);
      return openDevelop(id);
    },
    [videoSeals, revealVideo],
  );

  // A row's body tap. A revealed VIDEO drills into its (real) Brain depth; an unrevealed one reveals
  // first (the % gates the drill). A concept routes to the existing population/develop opener.
  const handleOpenStimulus = useCallback(
    (id: string) => {
      if (videoSeals[id]) {
        if (revealedVideos[id]) setDetailId(id);
        else revealVideo(id);
        return;
      }
      openStimulus(id);
    },
    [videoSeals, revealedVideos, revealVideo, openStimulus],
  );

  // A drilled VIDEO row → its real Brain-depth Detail (brain-first; population omitted for a video →
  // the honest audience-unavailable state). Guarded before the concept branch (disjoint id spaces).
  if (detailId !== null && videoSeals[detailId] && revealedVideos[detailId]) {
    const v = videoSeals[detailId];
    const template = buildVideoDomainTemplate({
      heatmap: v.heatmap,
      videoSignals: v.videoSignals,
      verbatim: v.verbatim,
      stopPct: v.stopPct,
      stimulusKey: detailId,
      conceptLabel: "video",
      population: null,
    });
    return (
      <div className="flex w-full items-start justify-center">
        <AmbientDetail template={template} reducedMotion={reducedMotion} onBack={() => setDetailId(null)} />
      </div>
    );
  }

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
      <div className="flex h-full w-full">
        <AmbientSimulate
          data={simData}
          mode="develop"
          connected
          onClose={() => setDevelopId(null)}
          // Phase D-minimal: fire the real react sim → sealed measured % replaces the projection.
          onSimulate={() => fireSim(armedId)}
        />
      </div>
    );
  }

  // A SEALED row drills into the real depth. BOTH tabs are real now (owner call 2026-07-24): the
  // Population projection AND the Brain — the cortex proxy + the real reason-driver breakdown built off
  // the same sim (buildDomainTemplate → buildReasonBrainFrameData). The drill opens brain-first.
  if (detailId !== null) {
    const snap = snapshotFor(detailId);
    const d = descriptors.find((x) => x.id === detailId);
    if (snap?.population) {
      const template = buildDomainTemplate({
        pct: snap.pct,
        aggregate: snap.population,
        personas: snap.personas ?? [],
        calibratedFrom: meta.calibratedFrom,
        tier: meta.tier,
        conceptLabel: d?.kind ?? "concept",
        stimulusKey: detailId,
      });
      return (
        <div className="flex h-full w-full">
          <AmbientDetail
            template={template}
            reducedMotion={reducedMotion}
            onBack={() => setDetailId(null)}
          />
        </div>
      );
    }
    // No population (General) or snapshot gone — fall through to the Overview. A General sealed row has
    // no population page (never invented); openStimulus keeps it inert, so this path is only reached if
    // a detailId was set for a row that has since lost its population (thread switch / clear).
  }

  // Merge the seal sources into the per-descriptor-id map buildOverviewData reads: a fresh in-session
  // fire wins; else a persisted seal matched by trimmed concept text (survives reload); else queued.
  const measured: Record<string, number> = {};
  for (const d of descriptors) {
    const pct = snapshotFor(d.id)?.pct;
    if (typeof pct === "number") measured[d.id] = pct;
  }
  // Tested videos from the seal store → ranked in alongside the concepts. A revealed video ranks by
  // its measured attention %; an unrevealed one stays queued (viral score shown, % withheld).
  const videos: OverviewVideoRow[] = Object.entries(videoSeals).map(([id, v]) => ({
    id,
    label: videoLabel(v),
    viralScore: v.craftScore ?? null,
    stopPct: v.stopPct,
    revealed: !!revealedVideos[id],
  }));
  const overview = buildOverviewData({ audience: meta, descriptors, measured, videos, watching });
  return (
    <div className="flex h-full w-full">
      <AmbientOverview
        data={overview}
        reducedMotion={reducedMotion}
        // A rank tap opens the real Population depth for a SEALED calibrated row (or the Brain depth for
        // a revealed video); an unsealed row routes to Simulate (develop) / reveals a video's %.
        onOpenStimulus={handleOpenStimulus}
        // Quick-sim fires the real sealed sim (concept) or reveals the measured % (video).
        onQuickSimulate={handleQuickSimulate}
        onTestVariant={() => descriptors[0] && openDevelop(descriptors[0].id)}
      />
    </div>
  );
}
