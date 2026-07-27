import type { VideoTestCardBlock } from "@/lib/tools/blocks";
import { FEATURED_VIDEO } from "./featured-video";

/**
 * The landing's Test-card fixture — the SAME block shape `/dev/cards` feeds the real
 * `VideoTestCardRenderer`, composed from `FEATURED_VIDEO` so the card, the filmstrip frames
 * and the fold's receipt all describe ONE clip. The card's *design* auto-updates because the
 * landing imports the live renderer; its *content* now has a single source of truth.
 *
 * Rewritten 2026-07-27. The previous fixture described an imaginary video and contradicted
 * itself — `dropLabel: "0:06 drop"` beside a fix reading "you lose them at 0:08", a 0:15
 * runtime, `audienceName: "Skincare buyers"`, and a diagnosis quoting a freelancing hook —
 * which was survivable only while the window was attributed to nothing. The window is now
 * attributed to a real clip a visitor can watch, so every field has to match the frames.
 *
 * `proof` is null on every fix. The old fixture attached real TikTok handles and invented
 * multipliers/view counts to them; the schema's warrant contract explicitly allows honest
 * absence ("a fix without a match simply shows no receipt"), and inventing corpus receipts
 * against named third-party accounts on a commercial page is not a thing to ship.
 */
export const TEST_CARD_FIXTURE: VideoTestCardBlock = {
  type: "video-test-card",
  props: {
    craftScore: FEATURED_VIDEO.read.craftScore,
    drivers: [...FEATURED_VIDEO.read.drivers],
    filmstrip: FEATURED_VIDEO.beats.map((beat, idx) => ({
      idx,
      label: beat.label,
      atMs: beat.atMs,
      mark: beat.mark,
      keyframeUrl: beat.still,
    })),
    dropLabel: FEATURED_VIDEO.dropLabel,
    durationLabel: FEATURED_VIDEO.durationLabel,
    working: [...FEATURED_VIDEO.read.working],
    notWorking: FEATURED_VIDEO.read.notWorking.map((n) => ({ text: n.text, atMs: n.atMs })),
    fixes: FEATURED_VIDEO.read.fixes.map((fix) => ({
      title: fix.title,
      lever: fix.lever,
      atMs: fix.atMs,
      keyframeUrl: FEATURED_VIDEO.beats[fix.beat]!.still,
      diagnosis: fix.diagnosis,
      why: fix.why,
      move: fix.move,
      proof: null,
    })),
    audienceName: FEATURED_VIDEO.read.audienceName,
    analysisId: "offer-featured-read",
    model: "sim1-max",
    tier: "Directional",
  },
};
