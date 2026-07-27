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
              },
            }
          : baseBrain.driver,
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
      terrain: {
        ...basePopulation.terrain,
        // "builders" is the other video's cluster name; this room is operators. Lit ratios
        // track the verdict — one cluster holds, the rest leave before the ask lands.
        clusters: basePopulation.terrain.clusters.map((c) => {
          const name = c.name === "builders" ? "operators" : c.name;
          return { ...c, name, lit: room.clusters[name] ?? c.lit };
        }),
      },
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
