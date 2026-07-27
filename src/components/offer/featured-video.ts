/**
 * FEATURED_VIDEO — the one real clip the /go page is built around.
 *
 * The page tells a single continuous story: here is a real video, here is what Maven said
 * about it, here is what happened when the creator acted on that read. The fold sells the
 * OUTCOME (231 → 183,000 views, the same video recut); the render below shows the READ that
 * produced it. Both surfaces read from this module, so the two can never drift apart.
 *
 * SWAPPING THE CLIP (owner, 2026-07-27 — the current footage is placeholder and will be
 * replaced): replace the six files under `public/offer/featured/` and edit the values here.
 * Nothing else on the page hardcodes the clip. The frames are extracted from the source mp4:
 *
 *   cover.jpg   — the receipt thumbnail (400px wide, 9:16)
 *   beat-1..5   — the filmstrip stills at BEATS[n].atMs (180px wide, 9:16)
 *
 * HONESTY: `outcome` is a real, owner-supplied receipt for a real video. The `read` below is
 * a FIXTURE — a hand-authored read of the actual footage, not the output of a Max run — kept
 * deliberately consistent with what the clip visibly does (the question does not arrive until
 * 0:20; there is an audible stall at 0:12) so nothing on the page contradicts the frames a
 * visitor can watch. It is labeled "Sample read" in the window chrome. If we later run this
 * clip through the real pipeline, replace `read` wholesale with the captured block.
 */

const ASSETS = "/offer/featured/";

/** The clip's five filmstrip beats, in cut order — the frames under `public/offer/featured/`. */
const BEATS = [
  {
    label: "Cold open",
    atMs: 0,
    mark: "weak" as const,
    still: `${ASSETS}beat-1.jpg`,
  },
  {
    label: "Stall",
    atMs: 12_000,
    mark: "weak" as const,
    still: `${ASSETS}beat-2.jpg`,
  },
  {
    label: "The ask",
    atMs: 20_000,
    mark: null,
    still: `${ASSETS}beat-3.jpg`,
  },
  {
    label: "Answer",
    atMs: 32_000,
    mark: "asset" as const,
    still: `${ASSETS}beat-4.jpg`,
  },
  {
    label: "Close",
    atMs: 48_000,
    mark: null,
    still: `${ASSETS}beat-5.jpg`,
  },
] as const;

export const FEATURED_VIDEO = {
  /** Receipt thumbnail — the cover the fold shows beside the climbing view count. */
  cover: `${ASSETS}cover.jpg`,

  /** Runtime + the marked weak beat, as the card labels them. */
  durationLabel: "0:53",
  dropLabel: "0:12 drop",

  beats: BEATS,

  /**
   * The outcome — the fold's whole argument. Owner-supplied, real, and deliberately
   * ANONYMOUS (owner call 2026-07-27: no creator handle). Same video, recut and reposted,
   * so the counter climbing on ONE thumbnail is literally what happened.
   */
  outcome: {
    viewsBefore: 231,
    viewsAfter: 183_000,
    /** What the creator changed — and the surface that told them to. */
    fix: "The recut opened on the question.",
    /** Credits the read itself: the thread's card, then the room's two pages. */
    credit:
      "The card marked the stall at 0:12. The room showed who was already gone by then — and the brain showed why.",
  },

  /**
   * The read, as the Test card carries it. Consistent with the footage: a real Q&A where the
   * question does not arrive until 0:20, opened mid-sentence, with an audible stall at 0:12.
   * Credible and substantive (a real room, a concrete operating answer) but structurally weak
   * at the front — which is exactly why a recut could move it.
   */
  read: {
    craftScore: 54,
    drivers: [
      { name: "Hook", score: 38, band: "weak" as const },
      { name: "Credibility", score: 81, band: "strong" as const },
      { name: "Clarity", score: 46, band: "weak" as const },
      { name: "Substance", score: 74, band: "strong" as const },
    ],
    working: [
      "Credibility — an unscripted room, no set and no production gloss",
      "Substance — the answer names a concrete operating detail, not a platitude",
      "The exchange is real: a live question, answered live",
    ],
    notWorking: [
      { text: "The question doesn't arrive until 0:20", atMs: 20_000 },
      { text: "Cut the stall at 0:12", atMs: 12_000 },
      { text: "The open starts mid-sentence", atMs: 0 },
    ],
    fixes: [
      {
        title: "Open on the question",
        lever: "Stakes",
        atMs: 0,
        beat: 0,
        diagnosis:
          "The clip opens mid-sentence — “our revenue from scaling is…” — and the question itself doesn't land until 0:20. For twenty seconds a cold viewer has no idea what is being asked.",
        why: "Attention is lent against an expected payoff. With nothing named to wait for, there is no reason to stay — and no cost to leaving.",
        move: "Open on the ask, and let the setup follow it.",
      },
      {
        title: "Cut the stall at 0:12",
        lever: "Momentum",
        atMs: 12_000,
        beat: 1,
        diagnosis:
          "The longest flat stretch in the cut — an audible filler beat with no new information on screen.",
        why: "A beat that resolves nothing and opens nothing leaves the mind free to go. Dead air is where the scroll happens.",
        move: null,
      },
      {
        title: "Put the number on screen",
        lever: "Substance",
        atMs: 20_000,
        beat: 2,
        diagnosis:
          "The most concrete thing said arrives as audio only, buried in the middle of a long question.",
        why: "A specific number reads as lived experience rather than opinion — but only if it is seen as well as heard.",
        move: null,
      },
    ],
    /** The room the read is against — the card's provenance line. */
    audienceName: "Founders & operators",
  },

  /**
   * The room's verdict, overriding the shared v2 fixture for this clip. Kept coherent with a
   * 38-band hook: a low stop rate is the reception counterpart of a buried question, and it is
   * what a 231-view post looks like from the inside.
   */
  room: {
    stopRate: "21.4%",
    stopRatio: 0.214,
    read: "Operators are the only cluster that stays — 68% stop. Everyone else leaves around 0:12, before the ask lands.",
    /** The stop / skim / scroll split behind the verdict. */
    triState: { stopped: 21, skimmed: 34, scrolled: 45 },
    // No "your last 41 hooks" — that is account history a cold visitor does not have, the same
    // reason the rail's pager is blanked inside the marketing window.
    percentileLine: "bottom 20% of comparable hooks",
    /** The clip's own opening line, as the brain tab's scrubber transcript. */
    transcript: "our revenue from scaling is everything — uhm — what's your current rate on the reach outs?",
    /** Index of the held word in `transcript` — "rate", the first concrete thing said. */
    peakWordIndex: 10,
    unlock: {
      lever: "Open on the question",
      gain: "+14% would stop",
      insight:
        "The answer is the strong part — the room that hears it stays. It is the twenty seconds before the question that costs the other four fifths.",
    },
    /** Cluster lit-ratios track the verdict: only the operators cluster holds. */
    clusters: {
      operators: 0.68,
      scrollers: 0.19,
      skeptics: 0.08,
      "drop-ins": 0.22,
    } as Record<string, number>,
  },
} as const;
