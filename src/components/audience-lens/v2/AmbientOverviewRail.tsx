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
 *   - a rank tap on an UNSEALED concept row still opens Simulate in develop mode (there is no depth
 *     to drill until a run exists). Both depth tabs are real once a row is sealed — concepts via the
 *     react projection, videos via the Test run's fold reception panel.
 *
 * Build spec: docs/HANDOFF-2026-07-22-ambient-v2-wiring-provenance-audit.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AmbientOverview, type AmbientPresentation, type WatchingRun } from "./AmbientOverview";
import { AmbientSimulate, type StimulusKind, type SimulateConfig } from "./AmbientSimulate";
import { AmbientDetail } from "./AmbientDetail";
import {
  buildOverviewData,
  buildSimulateData,
  type OverviewVideoRow,
} from "@/lib/surfaces/ambient-v2-adapters";
import {
  buildDomainTemplate,
  buildPopulationFrameData,
  type PopulationPersona,
} from "@/lib/surfaces/ambient-v2-population";
import { buildVideoDomainTemplate } from "@/lib/surfaces/ambient-v2-brain";
import { watchCatalogueOf } from "@/lib/surfaces/ambient-v2-drill";
import { audienceToMeta, humanizeArchetype } from "@/lib/surfaces/ambient-v2-audience-meta";
import type { Audience } from "@/lib/audience/audience-types";
import type { AmbientCardDescriptor } from "@/components/app/home/use-ambient-focus";
import type { PopulationAggregate } from "@/lib/audience/population";
import { reportCredit402 } from "@/lib/billing/credit-wall";
import type { SimSealVideo } from "@/lib/threads/sim-seals";
import {
  isSealedSimSeal,
  type SealedSimSeal,
  type WireSimSealMap,
} from "@/lib/onboarding/verdict-seal";
import {
  buildSealedVideoDomainTemplate,
  SEALED_BRAIN_NOTE,
  SEALED_POPULATION_NOTE,
} from "@/lib/surfaces/ambient-v2-sealed";
import { SealedWallCta } from "@/components/onboarding/sealed-wall-cta";

/** One fired sim's full result, kept per descriptor id for the Overview seal + the depth drill. */
interface RailSnapshot {
  pct: number;
  population?: PopulationAggregate | null;
  personas?: PopulationPersona[];
  scrollQuote?: string;
  /** Present ⇒ `pct` is THIS SLICE's stop rate, not the room's. The row prints `label` beside the
   *  %, because the two land in the same ranked column and only the label distinguishes them. */
  slice?: { archetype: string; label: string };
}

/** Sheet-mode shell: the host sheet is the flex column that owns the height cap, so every surface
 *  inside flexes into it (min-h-0 lets their internal scroll regions shrink below content height). */
const SHEET_SHELL = "flex min-h-0 w-full flex-1";

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

/**
 * The develop tie-back's SOURCE — which skill's run this card came out of.
 *
 * This slot used to hold `Strong 8/10`, built from `bandFromStops(parsePersonaStops(d.fraction))`.
 * Both are gone with the 0/10 rank (owner, 2026-08-02): the tie-back was quoting a score the
 * engine no longer measures, printed as a chip right above the spend button. What a creator
 * genuinely needs there is provenance — where this thing came from — so the line names the run
 * instead of scoring it.
 *
 * `null` for a kind we cannot name, and the tie-back is then OMITTED. Naming an unknown source
 * ("your last run") would be the same fabrication in words that the band was in numbers.
 */
function sourceLabelOf(kind?: string): string | null {
  switch (kind) {
    case "hook":
      return "Hooks run";
    case "idea":
      return "Ideas run";
    case "script":
      return "Script run";
    case "remix":
      return "Remix run";
    default:
      return null;
  }
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
  presentation = "rail",
  onDismiss,
  focusVideo,
  onTestVariant,
}: {
  audience: Audience;
  descriptors: AmbientCardDescriptor[];
  reducedMotion?: boolean;
  /** Full-screen (mobile) only — the Overview header's caret closes the room. The drilled surfaces
   *  keep their own back/close, which return HERE; only the Overview is the exit. */
  onDismiss?: () => void;
  /** Where this rail is mounted. `rail` = the ≥xl right column (default). `sheet` = the <xl mobile
   *  header sheet, whose host bar already owns the identity, the ground and the height cap — the
   *  SAME surfaces and the SAME live data either way, only the chrome differs. */
  presentation?: AmbientPresentation;
  /** Sealed sims rehydrated from `threads.sim_seals`, keyed by TRIMMED concept text → the full seal
   *  (measured %, + the Phase-C population/personas depth). These re-seal rows AND repopulate the
   *  depth drill on reload; a fresh in-session fire (below) takes precedence.
   *  An ANONYMOUS session receives the sealed wire form instead (verdict-seal.ts): no %, no
   *  population, no curve — those rows open the sealed drill (§0b② THE WALL), never a verdict. */
  persistedSeals?: WireSimSealMap;
  /**
   * A request to open a TESTED VIDEO's depth directly — the Test card's "Simulate with your audience
   * →" door. `id` is the analysisId (the video seal's key); `nonce` makes a repeat tap on the SAME
   * video a new request, so backing out and tapping again re-opens it (a bare id would compare equal
   * and the effect would never re-fire).
   *
   * It skips the reveal gate on purpose: tapping that CTA IS the deliberate ask, so making the
   * creator tap the row twice more to see what they already asked for would be ceremony. Ignored
   * when no video seal matches — the card only routes here when the composer confirms one exists.
   */
  focusVideo?: { id: string; nonce: number } | null;
  /**
   * The ＋ door — "Test something of your own". The HOST owns it (the composer), because what comes
   * through it has to be ROUTED: a draft to `/api/tools/react`, a video file or link to the
   * `/api/analyze` pipeline the composer already drives. The rail has no access to either seam.
   *
   * ⚠️ This replaced `onTestVariant={() => descriptors[0] && openDevelop(descriptors[0].id)}`, which
   * was dead on an empty rail (`descriptors[0]` undefined ⇒ `&&` short-circuits) and, on a non-empty
   * one, re-armed the creator's FIRST EXISTING CARD — the opposite of testing something new.
   * Omitted ⇒ the board renders no ＋ at all, rather than a door onto nothing.
   */
  onTestVariant?: () => void;
}) {
  const meta = audienceToMeta(audience);
  const sheet = presentation === "sheet";
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
      if (!isSealedSimSeal(seal) && seal.video) out[key] = seal.video;
    }
    return out;
  }, [persistedSeals]);

  // SEALED video seals — the anonymous wire form (§0b② THE WALL). Only the free half arrives
  // (analysisId + craft score); these rows open the sealed drill and can never reveal a %,
  // because the % was never transmitted.
  const sealedVideos = useMemo<Record<string, SealedSimSeal["video"]>>(() => {
    const out: Record<string, SealedSimSeal["video"]> = {};
    for (const [key, seal] of Object.entries(persistedSeals ?? {})) {
      if (isSealedSimSeal(seal)) out[key] = seal.video;
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

  // The creator's own last-N catalogue, behind the Key metrics rank strip. Fetched LAZILY — the
  // first time a video drill actually opens — because the Overview never draws it and the rail
  // mounts on every thread. Fired once per mount and then cached: the answer changes only when the
  // creator seals a new run, which remounts this surface anyway.
  //
  // Every failure path is silent BY DESIGN: an anonymous visitor gets a 401 here, and the card
  // already has honest copy for "no baseline yet". A baseline is the one thing on this page that
  // must never be improvised, so not having one is a state, not an error.
  const [catalogue, setCatalogue] = useState<number[] | null>(null);
  const catalogueRef = useRef(false);
  useEffect(() => {
    if (catalogueRef.current) return;
    if (detailId === null || !videoSeals[detailId]) return;
    catalogueRef.current = true;
    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/analysis/history", { signal: ac.signal });
        if (!res?.ok) return;
        const rows: unknown = await res.json();
        if (!Array.isArray(rows)) return;
        // The clip being read is itself a history row by now — it was persisted at Test time. Left
        // in, it would rank against a catalogue containing itself and drag the median toward its own
        // value. `detailId` IS the analysisId, so it drops out by id.
        setCatalogue(watchCatalogueOf(rows.filter((r) => r?.id !== detailId)));
      } catch {
        // Every failure lands in the same place on purpose — rejected, aborted, 401, malformed body.
        // "No baseline" is a state this card already has honest copy for, so there is nothing to
        // report and nothing to retry: the one thing a benchmark must never do is appear anyway.
      }
    })();
    return () => ac.abort();
  }, [detailId, videoSeals]);

  // Reset the open drill wholesale when the thread's descriptor set changes (thread switch), so a
  // stale positional id can't render a mismatched depth view.
  useEffect(() => {
    setDetailId(null);
    setDevelopId(null);
  }, [descriptors]);

  // A Test card asked for THIS video's audience read. Declared AFTER the reset above so that when a
  // thread switch and a focus request land in the same commit, the request wins (effects run in
  // declaration order) instead of being wiped by the reset it arrived with.
  useEffect(() => {
    const id = focusVideo?.id;
    if (!id) return;
    if (sealedVideos[id]) {
      // The wall (§0b②): the door opens the SEALED drill directly — there is no % to reveal.
      setDevelopId(null);
      setDetailId(id);
      return;
    }
    if (!videoSeals[id]) return; // no matching sealed video ⇒ ignore, never open an empty drill
    revealVideo(id);
    setDevelopId(null);
    setDetailId(id);
  }, [focusVideo, videoSeals, sealedVideos, revealVideo]);

  // Resolve a descriptor id → its sealed snapshot: a fresh in-session fire wins; else a persisted seal
  // matched by trimmed concept text (survives reload). Undefined ⇒ the row is still honestly queued.
  const snapshotFor = useCallback(
    (id: string): RailSnapshot | undefined => {
      if (sessionSeals[id]) return sessionSeals[id];
      const d = descriptors.find((x) => x.id === id);
      const seal = d ? persistedSeals?.[d.conceptText.trim()] : undefined;
      // A sealed wire seal carries no verdict — the row stays honestly queued (§0b②).
      if (!seal || isSealedSimSeal(seal)) return undefined;
      return {
        pct: seal.pct,
        population: seal.population,
        personas: seal.personas,
        scrollQuote: seal.scrollQuote,
        // A sliced seal must survive reload still knowing it is a slice — otherwise the row comes
        // back after a refresh looking like a reading of the whole room. The persisted seal has
        // only the archetype, so the label falls back to it (humanised at render).
        ...(seal.slice ? { slice: { archetype: seal.slice.archetype, label: humanizeArchetype(seal.slice.archetype) } } : {}),
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
  //
  // `config` is what ⑤ ARMED — the lens, the slice, the scene. It used to be dropped on the floor
  // (`onSimulate={() => fireSim(armedId)}`), so every run was the audience default however the
  // dials were set. It is OPTIONAL because the quick-simulate door on a queued row fires without
  // ever opening ⑤, and that path genuinely has no config: absent ⇒ the room, the stop lens, the
  // inherited scene — which is exactly what it always did.
  const fireSim = useCallback(
    async (id: string, config?: SimulateConfig) => {
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
          //
          // `framing` and `lens` are DIFFERENT axes and both ride along: framing is what the
          // stimulus IS (a hook vs an idea, from the descriptor's kind), the lens is what this run
          // MEASURES (would they stop / finish / share / follow / buy). Conflating them is the
          // mistake an earlier reading of this screen made.
          body: JSON.stringify({
            text,
            pin: true,
            persist: true,
            ...(framing ? { framing } : {}),
            ...(config
              ? {
                  lens: config.lensKey,
                  scene: config.scene,
                  ...(config.segment ? { segment: config.segment } : {}),
                }
              : {}),
          }),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!res.ok) {
          // THE WALL (2026-07-28): `/api/tools/react` is priced at 1 credit, so this fetch can
          // now come back 402. Announce it so the ONE paywall dialog renders the server's
          // sentence; the row still drops back to honestly queued below, which is the right
          // resting state — a refused run produced no verdict to show.
          const err = await res.json().catch(() => null);
          reportCredit402(res.status, err);
          throw new Error("reaction_failed");
        }
        const data: {
          fraction?: string;
          scrollQuote?: string;
          personas?: PopulationPersona[];
          population?: PopulationAggregate | null;
          slice?: { archetype: string; honored: boolean; stopPct?: number; total?: number; reason?: string } | null;
        } = await res.json();
        if (controller.signal.aborted) return;
        // A SLICED run's verdict is the slice's own stop rate, not the room's fraction — asking
        // about Builders and sealing the room's number would answer a question nobody asked.
        // An un-honoured slice seals NOTHING (the row stays queued) rather than falling back to
        // the room, which would be the same lie arriving quietly.
        const sliced = data.slice ?? null;
        const pct = sliced
          ? sliced.honored
            ? sliced.stopPct ?? null
            : null
          : fractionToStopPct(data.fraction ?? "");
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
              ...(sliced?.honored
                ? { slice: { archetype: sliced.archetype, label: config?.segmentLabel ?? sliced.archetype } }
                : {}),
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
      // A sealed video has no % to reveal — the tap opens the sealed drill (the wall).
      if (sealedVideos[id]) return setDetailId(id);
      if (videoSeals[id]) return revealVideo(id);
      return openDevelop(id);
    },
    [sealedVideos, videoSeals, revealVideo],
  );

  // A row's body tap. A revealed VIDEO drills into its (real) Brain depth; an unrevealed one reveals
  // first (the % gates the drill). A concept routes to the existing population/develop opener.
  const handleOpenStimulus = useCallback(
    (id: string) => {
      if (sealedVideos[id]) {
        setDetailId(id);
        return;
      }
      if (videoSeals[id]) {
        if (revealedVideos[id]) setDetailId(id);
        else revealVideo(id);
        return;
      }
      openStimulus(id);
    },
    [sealedVideos, videoSeals, revealedVideos, revealVideo, openStimulus],
  );

  // A SEALED video row (anonymous wire seal) → the sealed drill: craft chip, honest withheld
  // notes, nothing else — the wire never carried the verdict, so this surface cannot leak it
  // (§0b② THE WALL). Checked before the full-video branch: the maps are disjoint by construction
  // (one wire seal is either sealed or full), but the sealed drill must win if that ever drifts.
  if (detailId !== null && sealedVideos[detailId]) {
    const template = buildSealedVideoDomainTemplate({
      craftScore: sealedVideos[detailId]!.craftScore,
    });
    return (
      <div className={sheet ? SHEET_SHELL : "flex w-full items-start justify-center"}>
        <AmbientDetail
          template={template}
          brainNote={SEALED_BRAIN_NOTE}
          populationNote={SEALED_POPULATION_NOTE}
          noteAction={<SealedWallCta />}
          reducedMotion={reducedMotion}
          presentation={presentation}
          onBack={() => setDetailId(null)}
        />
      </div>
    );
  }

  // A drilled VIDEO row → its real Detail. BOTH tabs are real now: the Brain from the sealed
  // attention read, and the Population from the SAME run's fold reception panel (the analyze route
  // repaints the fold with this thread's active audience, so those 10 archetype reactors ARE this
  // creator's room). Guarded before the concept branch (disjoint id spaces).
  if (detailId !== null && videoSeals[detailId] && revealedVideos[detailId]) {
    const v = videoSeals[detailId];
    // The AUDIENCE tab, from the SAME sealed run — the fold's real archetype reactors, mapped by
    // `buildVideoPopulation` at Test time and persisted on the seal. Absent on a Wave-3-degraded row
    // (and on every seal written before this shipped), which keeps the honest brain-only drill.
    // (This branch only runs for FULL seals — videoSeals excludes the sealed wire form — so the
    // narrowing here is for the type, not a reachable sealed path.)
    const fullSeal = persistedSeals?.[detailId];
    const videoAggregate =
      fullSeal && !isSealedSimSeal(fullSeal) ? fullSeal.population ?? null : null;
    const skimmedPct = typeof v.skimmedPct === "number" ? v.skimmedPct : undefined;
    // What they'd DO with it — sealed numbers only; the one-line read is derived in the adapter.
    const actionIntent = v.intents;
    const template = buildVideoDomainTemplate({
      heatmap: v.heatmap,
      videoSignals: v.videoSignals,
      verbatim: v.verbatim,
      stopPct: v.stopPct,
      stimulusKey: detailId,
      conceptLabel: "video",
      ...(catalogue?.length ? { catalogue } : {}),
      population: videoAggregate
        ? buildPopulationFrameData({
            aggregate: videoAggregate,
            personas: [], // a video fold emits no exemplar voices — the receipts section omits itself
            calibratedFrom: meta.calibratedFrom,
            tier: "max", // a Test is the Max video pipeline, never Flash
            ...(skimmedPct !== undefined ? { skimmedPct } : {}),
            ...(actionIntent ? { actionIntent } : {}),
          })
        : null,
    });
    return (
      <div className={sheet ? SHEET_SHELL : "flex w-full items-start justify-center"}>
        <AmbientDetail
          template={template}
          reducedMotion={reducedMotion}
          presentation={presentation}
          onBack={() => setDetailId(null)}
        />
      </div>
    );
  }

  if (developId !== null) {
    const d = descriptors.find((x) => x.id === developId);
    const sourceLabel = sourceLabelOf(d?.kind);
    const simData = buildSimulateData({
      audience: meta,
      stimulus: { text: d?.conceptText ?? "", kind: stimulusKindOf(d?.kind) },
      ...(sourceLabel ? { develop: { sourceLabel } } : {}),
    });
    const armedId = developId;
    return (
      <div className={sheet ? SHEET_SHELL : "flex h-full w-full"}>
        <AmbientSimulate
          data={simData}
          mode="develop"
          connected
          presentation={presentation}
          onClose={() => setDevelopId(null)}
          // Phase D-minimal: fire the real react sim → sealed measured % replaces the projection.
          // The ARMED config travels with it — until 2026-07-28 this was `() => fireSim(armedId)`
          // and the five dials ⑤ collects were discarded here, one call short of the engine.
          onSimulate={(config) => fireSim(armedId, config)}
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
        // The stimulus text the row was fired on. Omitting it was measured live on production
        // 2026-08-05: every text/hook drill headed itself "Untitled" (drillIdentity's empty-title
        // fallback) while the concept sat right there on the descriptor — the ARM panel two
        // branches up already reads the same field. It also starves the Brain tab, whose
        // attention scrubber falls back to the coded reason labels when the transcript is absent.
        ...(d?.conceptText?.trim() ? { transcript: d.conceptText.trim() } : {}),
      });
      return (
        <div className={sheet ? SHEET_SHELL : "flex h-full w-full"}>
          <AmbientDetail
            template={template}
            reducedMotion={reducedMotion}
            presentation={presentation}
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
  const measuredSlice: Record<string, string> = {};
  const depthless: Record<string, boolean> = {};
  for (const d of descriptors) {
    const snap = snapshotFor(d.id);
    if (typeof snap?.pct === "number") {
      measured[d.id] = snap.pct;
      // Whose percentage it is travels with the percentage itself.
      if (snap.slice) measuredSlice[d.id] = snap.slice.label;
      // A sealed row with no population has no drill behind it (see `openStimulus`). Marking it
      // here is what stops the board from rendering an inert door: the SAME predicate the opener
      // uses, read one layer earlier so the row can be honest before it is tapped rather than
      // silent after. Keep the two in step — if one learns a new depth source, so must the other.
      if (!snap.population) depthless[d.id] = true;
    }
  }
  // Tested videos from the seal store → ranked in alongside the concepts. A revealed video ranks by
  // its measured attention %; an unrevealed one stays queued (viral score shown, % withheld).
  const videos: OverviewVideoRow[] = [
    ...Object.entries(videoSeals).map(([id, v]) => ({
      id,
      label: videoLabel(v),
      viralScore: v.craftScore ?? null,
      stopPct: v.stopPct,
      revealed: !!revealedVideos[id],
    })),
    // SEALED rows (§0b②): craft score shown, the audience % NEVER — the wire seal carries none.
    // `revealed` is hardcoded false, so the adapter's withheld-0 sentinel stays inert; the wire
    // seal has no verbatim, so the label is the honest fallback.
    ...Object.entries(sealedVideos).map(([id, v]) => ({
      id,
      label: "Tested video",
      viralScore: v.craftScore ?? null,
      stopPct: 0,
      revealed: false,
    })),
  ];
  const overview = buildOverviewData({ audience: meta, descriptors, measured, measuredSlice, depthless, videos, watching });
  return (
    <div className={sheet ? SHEET_SHELL : "flex h-full w-full"}>
      <AmbientOverview
        data={overview}
        reducedMotion={reducedMotion}
        presentation={presentation}
        onDismiss={onDismiss}
        // A rank tap opens the real Population depth for a SEALED calibrated row (or the Brain depth for
        // a revealed video); an unsealed row routes to Simulate (develop) / reveals a video's %.
        onOpenStimulus={handleOpenStimulus}
        // Quick-sim fires the real sealed sim (concept) or reveals the measured % (video).
        onQuickSimulate={handleQuickSimulate}
        // The ＋ door, handed straight to the host (see the prop doc for the two defects the old
        // one-liner here carried). No handler ⇒ no door, never a dead one.
        onTestVariant={onTestVariant}
      />
    </div>
  );
}
