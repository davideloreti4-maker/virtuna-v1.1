import type { DomainTemplate } from "@/components/audience-lens/v2/domain-template";
import { CREATOR_TEMPLATE } from "@/components/audience-lens/v2/detail-fixture";
import { FEATURED_VIDEO } from "./featured-video";

/**
 * FEATURED_ROOM_TEMPLATE — the shared v2 room fixture, retargeted at the clip the /go page is
 * about.
 *
 * `CREATOR_TEMPLATE` describes a DIFFERENT video in detail: a "$400 opener", the transcript
 * "I quit my 9-5 with $400 in my account", believers clustering in *builders*, and a 38.2%
 * stop rate off a hook that already works. Rendered beside a Test card reading craft 54 on a
 * business Q&A, it made the window contradict itself — the two panes are the same run in the
 * real product, so they cannot disagree about what the video is.
 *
 * This overrides the clip-specific SURFACE — the verdict, the unlock, the audience read, the
 * scrubber transcript, the cluster lit-ratios — and inherits the rest. The deeper brain
 * internals (parcellation seeds, z-scores, KPI rows) carry no video-specific text, so they
 * stay: replacing them with invented equivalents would add fabrication, not fidelity.
 *
 * It does NOT mutate `CREATOR_TEMPLATE`. That fixture is shared by `/ambient-v2` (the no-auth
 * review route), `pricing-template`, `detail-live-fixture` and `shot-stages` — retargeting it
 * in place would silently repoint surfaces that have nothing to do with this page.
 */

const { room } = FEATURED_VIDEO;
const CLIP_SECONDS = 53;

/** Per-signal "why this score" prose, rewritten for this clip. Keyed by the grid's own keys. */
const SIGNAL_WHY: Record<string, string> = {
  visual: "One static frame at the open — nothing moves in the first second.",
  voice: "Room audio, unmiked crowd; the question is audible but never emphasised.",
  grip: "Focus scatters while the setup runs on past 0:12.",
  emotion: "Little is at stake until the answer arrives at 0:32.",
  memory: "The rate figure sticks; the framing around it is familiar.",
  attention: "Drops hard at 0:12 — the wait costs everyone but the operators.",
  buy: "Interest is real once the answer lands, but it lands late.",
  risk: "Low resistance — an unscripted room reads as safe to trust.",
  effort: "Easy to follow; the cost is patience, not comprehension.",
};

/** `brain.driver` and `population.main` are discriminated unions — spreading them widens the
 *  member back to the union, so each is narrowed by its `kind` before being rebuilt. Anything
 *  that is not the creator shape is passed through untouched. */
const baseBrain = CREATOR_TEMPLATE.brain;
const basePopulation = CREATOR_TEMPLATE.population;

const brain: DomainTemplate["brain"] = baseBrain
  ? {
      ...baseBrain,
      stopRatio: room.stopRatio,
      clipSeconds: CLIP_SECONDS,
      driver:
        baseBrain.driver.kind === "attention-scrubber"
          ? {
              kind: "attention-scrubber",
              data: {
                ...baseBrain.driver.data,
                hold: room.triState.stopped,
                transcript: room.transcript,
                peakWordIndex: room.peakWordIndex,
                clipSeconds: CLIP_SECONDS,
                points: [...room.attentionPoints],
                moments: room.attentionMoments.map((m) => ({ ...m })),
              },
            }
          : baseBrain.driver,
      // The brain page is VISITED by the probe now, so its narration is on screen and has to be
      // about this clip. Inherited, these read "the $400 stake holds half" and dipped at 0:04 —
      // a 12-second video that is not the one in the window.
      whyThisSecond: {
        moment: room.whyThisSecond.moment,
        segments: [
          { text: room.whyThisSecond.lead },
          { text: room.whyThisSecond.loss, loss: true },
        ],
      },
      networks: room.networks.map((n) => ({ ...n })),
      // The nine-signal grid's `whyScore` prose narrated the other clip too ("the $400 line
      // lands", "drops hard at 0:04"). Scores and bands are kept; only the sentences move.
      signalGrid: baseBrain.signalGrid?.map((s) => ({
        ...s,
        whyScore: SIGNAL_WHY[s.key] ?? s.whyScore,
      })),
    }
  : baseBrain;

const population: DomainTemplate["population"] = basePopulation
  ? {
      ...basePopulation,
      heroRead: room.read,
      main:
        basePopulation.main.kind === "tri-state"
          ? {
              ...basePopulation.main,
              data: { ...room.triState },
              percentileLine: room.percentileLine,
            }
          : basePopulation.main,
      // The coded reasons quoted a "$400 stake" and threaded to a 0:04 drop that no longer
      // exists on either page.
      voices: {
        ...basePopulation.voices,
        reasons: room.reasons.map((r) => ({ ...r })),
      },
      terrain: {
        ...basePopulation.terrain,
        // "builders" is the other video's cluster name; this room is operators. Lit ratios
        // track the verdict — one cluster holds, the rest leave before the ask lands.
        clusters: basePopulation.terrain.clusters.map((c) => {
          const name = c.name === "builders" ? "operators" : c.name;
          return { ...c, name, lit: room.clusters[name] ?? c.lit };
        }),
      },
      // Everything below the fold of the rail narrated the other video too — the fit rows and
      // the carriers were still "builders", the swing still moved 38%→49% off a 0:04 drop, and
      // the room claimed to be calibrated on "your 4.2k followers", which a cold visitor has
      // no account to have.
      ...(basePopulation.audienceFit && {
        audienceFit: {
          ...basePopulation.audienceFit,
          baseline: "vs comparable hooks",
          rows: basePopulation.audienceFit.rows.map((r) =>
            r.label === "builders" ? { ...r, label: "operators", index: 41 } : { ...r },
          ),
          read: "This one narrows hard onto operators and cools on everyone else — the people who came for the answer stay for it, and the rest never reach the question.",
        },
      }),
      ...(basePopulation.amplification && {
        amplification: {
          ...basePopulation.amplification,
          carriers: basePopulation.amplification.carriers.map((c) =>
            c.label === "builders" ? { ...c, label: "operators" } : { ...c },
          ),
          read: "Reach rides on operators resharing — the one district that hears the answer. Move the question earlier and the other three get far enough in to carry it.",
        },
      }),
      ...(basePopulation.swing && {
        swing: {
          ...basePopulation.swing,
          fromPct: 21,
          toPct: 35,
          gainLabel: room.unlock.gain,
          read: "94 viewers stalled at 0:12 — not gone, just still waiting for the question. Open on it and the room moves from 21% to 35%.",
        },
      }),
      ...(basePopulation.room && {
        room: { ...basePopulation.room, calibratedOn: "a modeled operator audience" },
      }),
    }
  : basePopulation;

export const FEATURED_ROOM_TEMPLATE: DomainTemplate = {
  ...CREATOR_TEMPLATE,

  // "hook 2 of 5" is app context a cold visitor does not have; inside the marketing window it
  // reads as noise.
  pager: "",

  verdict: { value: room.stopRate, label: "would stop" },
  unlock: { ...room.unlock },

  brain,
  population,
};
