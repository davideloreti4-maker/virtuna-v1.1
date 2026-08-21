/** @vitest-environment happy-dom */
/**
 * RemixBeats — the beat-by-beat shoot rows on a remix card (phase 1, Task 6).
 *
 * The load-bearing tests in here are the ones the task brief argued AGAINST:
 *
 *  - "renders the variant it was given" + "the card hands the sheet its own variant".
 *    ONE `remix_blueprints` row serves ALL of a run's ranked cards (Task 5), so `script` is
 *    `AdaptedBeat[][]` indexed by rank. The brief hard-coded `variantIndex={0}` at the mount and
 *    justified it with "each card writes its own row" — which is exactly the premise Task 5
 *    disproved. Hard-coded, cards 2 and 3 render the rank-1 shoot sheet: a plausible sheet, not
 *    a visible bug, and nothing else in the suite can see it.
 *
 *  - "says the timing could not be read instead of printing a fabricated sheet". A blueprint with
 *    `from_fixed_buckets: true` (Task 5.5) was assembled from `buildFixedBuckets` — an evenly
 *    spaced grid describing no video at all, whose duration is very likely the hard-coded 30s
 *    fallback. Its beats carry real-LOOKING times and roles, and adapt writes real-looking lines
 *    against them, so the default path prints a confident sheet of pure fiction.
 *
 * Everything else is the ordinary contract: one row per beat, the creator's line rather than the
 * source's, the shot, the repair note, and silence when there is nothing to show.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RemixBeats } from "../remix-beats";
import { RemixCardRenderer } from "../remix-card-block";
import { RemixRefreshContext } from "@/lib/remix-refresh-context";
import type { SourceBlueprint } from "@/lib/engine/remix/blueprint";
import type { AdaptedBeat } from "@/lib/engine/remix/decode-types";
import type { RemixCardBlock } from "@/lib/tools/blocks";

const BLUEPRINT_ID = "abc123def456";

/**
 * Three ranked variants, one per card of a run — the shape a real row holds. Variant 1 exists so
 * a renderer that ignores `variantIndex` prints variant 0's words and fails loudly.
 */
const SCRIPT: AdaptedBeat[][] = [
  [
    {
      index: 0,
      spoken: "Your creatine is doing nothing.",
      on_screen_text: "STOP",
      shot: "waist-up, phone at chest",
    },
    {
      index: 1,
      spoken: "I tested 40 lifters for six weeks.",
      on_screen_text: "",
      shot: "b-roll, tub on bench",
      repair: "cuts 1.2s earlier than the original",
    },
  ],
  [
    { index: 0, spoken: "Rank two opens on a different promise.", on_screen_text: "", shot: "close on the label" },
    { index: 1, spoken: "Rank two's second line.", on_screen_text: "", shot: "hands scooping" },
  ],
  [
    { index: 0, spoken: "Rank three opens somewhere else again.", on_screen_text: "", shot: "wide, gym floor" },
    { index: 1, spoken: "Rank three's second line.", on_screen_text: "", shot: "over the shoulder" },
  ],
];

/**
 * Typed as `SourceBlueprint`, not left to inference — that is what makes tsc fail the day the
 * interface grows another required field, which is how `from_fixed_buckets` (Task 5.5) caught
 * three fixtures that 710 green tests had sailed through.
 *
 * `weakness.factor` is "Completion Pull": one of the five names `HookFactorSchema` can actually
 * emit. The brief's fixture said "pacing", a name the model cannot produce — the same unrealistic
 * fixture that let a dead branch survive review in Task 1.
 */
function makeBlueprint(over: Partial<SourceBlueprint> = {}): SourceBlueprint {
  return {
    duration_s: 14,
    words_per_second: 3.2,
    has_speech: true,
    from_fixed_buckets: false,
    beats: [
      {
        index: 0,
        t_start: 0,
        t_end: 1.8,
        duration_s: 1.8, spoken_span_s: null,
        role: "hook",
        spoken: "Most people waste their first three seconds.",
        on_screen_text: null,
        visual_event: "tight crop",
        audio_event: "",
        cuts: 1,
        weakness: null,
      },
      {
        index: 1,
        t_start: 1.8,
        t_end: 5.4,
        duration_s: 3.6, spoken_span_s: null,
        role: "setup",
        spoken: "Here is what the numbers actually said.",
        on_screen_text: null,
        visual_event: "b-roll → hands on the bench → tub",
        audio_event: "",
        cuts: 3,
        weakness: { factor: "Completion Pull", score: 4, tip: "cut earlier" },
      },
    ],
    ...over,
  };
}

function serve(payload: { script: AdaptedBeat[][]; blueprint: SourceBlueprint }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload }),
  );
}

function renderWithClient(ui: Parameters<typeof render>[0]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  serve({ script: SCRIPT, blueprint: makeBlueprint() });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RemixBeats", () => {
  it("renders one row per beat with its timecode and role", async () => {
    render(<RemixBeats blueprintId={BLUEPRINT_ID} variantIndex={0} />);
    // The timecode sits BESIDE the role, never the label alone (Task 1 carry-forward): a 0–5s
    // beat still labelled "hook" is then self-describing rather than a misstatement.
    await waitFor(() => expect(screen.getByText("0.0–1.8s · HOOK")).toBeInTheDocument());
    expect(screen.getByText(/1\.8–5\.4s · SETUP/)).toBeInTheDocument();
  });

  // The gallery path. /dev/cards is this repo's answer to "a surface with no cheap way to LOOK at
  // it will drift", and the shoot sheet was invisible there from the day it shipped: the fixture
  // has no blueprintId, so the fetch below never fires and the whole section silently vanishes.
  // Measured on the live page 2026-08-12 — the Remix entry rendered the pre-lane card exactly.
  it("renders from injected data without fetching — the gallery path", async () => {
    render(
      <RemixBeats
        blueprintId={BLUEPRINT_ID}
        variantIndex={0}
        initialData={{ script: SCRIPT, blueprint: makeBlueprint() }}
      />,
    );

    await waitFor(() => expect(screen.getByText("0.0–1.8s · HOOK")).toBeInTheDocument());
    expect(screen.getByText(/Your creatine is doing nothing\./)).toBeInTheDocument();
    // A gallery that quietly hits the API renders differently signed-in vs not, which is the
    // opposite of what a fixture page is for.
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("still honours variantIndex when the data is injected", async () => {
    render(
      <RemixBeats
        blueprintId={BLUEPRINT_ID}
        variantIndex={2}
        initialData={{ script: SCRIPT, blueprint: makeBlueprint() }}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText(/Rank three opens somewhere else again\./)).toBeInTheDocument(),
    );
  });

  it("injected data still refuses to print a fabricated sheet", async () => {
    render(
      <RemixBeats
        blueprintId={BLUEPRINT_ID}
        variantIndex={0}
        initialData={{ script: SCRIPT, blueprint: makeBlueprint({ from_fixed_buckets: true }) }}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText(/We couldn’t read this video’s timing/)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Your creatine is doing nothing\./)).not.toBeInTheDocument();
  });

  it("requests the blueprint it was given", async () => {
    render(<RemixBeats blueprintId={BLUEPRINT_ID} variantIndex={0} />);
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(`/api/remix/blueprint/${BLUEPRINT_ID}`),
    );
  });

  it("shows the creator's line, not the source's", async () => {
    const { container } = render(<RemixBeats blueprintId={BLUEPRINT_ID} variantIndex={0} />);
    await waitFor(() =>
      expect(screen.getByText(/Your creatine is doing nothing\./)).toBeInTheDocument(),
    );
    // The source's own words are the one thing that must never reach the sheet — they are the
    // video the creator is remixing, not the video they are shooting.
    expect(container.textContent).not.toContain("Most people waste their first three seconds.");
  });

  it("shows the shot instruction for each beat", async () => {
    render(<RemixBeats blueprintId={BLUEPRINT_ID} variantIndex={0} />);
    await waitFor(() =>
      expect(screen.getByText(/waist-up, phone at chest/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/b-roll, tub on bench/)).toBeInTheDocument();
  });

  it("surfaces the repair note when the source beat was weak", async () => {
    render(<RemixBeats blueprintId={BLUEPRINT_ID} variantIndex={0} />);
    await waitFor(() => expect(screen.getByText(/cuts 1\.2s earlier/)).toBeInTheDocument());
  });

  it("renders the variant it was given, not the first one", async () => {
    const { container } = render(<RemixBeats blueprintId={BLUEPRINT_ID} variantIndex={1} />);
    await waitFor(() =>
      expect(screen.getByText(/Rank two opens on a different promise\./)).toBeInTheDocument(),
    );
    expect(container.textContent).not.toContain("Your creatine is doing nothing.");
  });

  it("counts the cuts INSIDE a beat, not the cells it merged", async () => {
    // `BlueprintBeat.cuts` is `group.length` — the number of source cells merged into the beat.
    // N cells have N-1 boundaries between them, so printing `cuts` verbatim overstates the
    // original's cutting by one on every merged beat. Beat 1 merged 3 cells → 2 cuts.
    render(<RemixBeats blueprintId={BLUEPRINT_ID} variantIndex={0} />);
    await waitFor(() => expect(screen.getByText("1.8–5.4s · SETUP · 2 cuts")).toBeInTheDocument());
    // Beat 0 is a single cell — no cuts inside it, so it says nothing about cuts at all.
    expect(screen.getByText("0.0–1.8s · HOOK")).toBeInTheDocument();
  });

  it("names a beat the model wrote no line for instead of dropping it", async () => {
    // `AdaptedBeatZodSchema.index` is `z.number().int().min(0)` and `ScriptZodSchema` is
    // `.min(1).max(MAX_BEATS)` — nothing ties a script entry to a real beat index, and nothing
    // requires one entry per beat (Task 4 handed this join to the renderer). Dropping the row
    // leaves a silent hole in the timeline: the creator shoots a video with a missing middle and
    // has no way to know why.
    serve({ script: [[SCRIPT[0]![0]!]], blueprint: makeBlueprint() });
    render(<RemixBeats blueprintId={BLUEPRINT_ID} variantIndex={0} />);
    await waitFor(() => expect(screen.getByText(/1\.8–5\.4s · SETUP/)).toBeInTheDocument());
    expect(screen.getByText(/No line was written for this beat/i)).toBeInTheDocument();
  });

  it("says the timing could not be read instead of printing a fabricated sheet", async () => {
    // from_fixed_buckets: true ⇒ the grid came out of `buildFixedBuckets`, which describes no
    // video. The times are evenly spaced fiction and the duration is very likely the hard-coded
    // 30s fallback. Printing them is worse than printing nothing: adapt still wrote plausible
    // lines against them, so the sheet reads as a real read of a real video.
    serve({ script: SCRIPT, blueprint: makeBlueprint({ from_fixed_buckets: true }) });
    const { container } = render(<RemixBeats blueprintId={BLUEPRINT_ID} variantIndex={0} />);
    await waitFor(() =>
      expect(screen.getByText(/couldn’t read this video’s timing/i)).toBeInTheDocument(),
    );
    expect(container.querySelector("[data-beats]")).toBeNull();
    expect(container.textContent).not.toContain("0.0–1.8s");
    expect(container.textContent).not.toContain("Your creatine is doing nothing.");
  });

  it("renders the sheet when the fabricated flag is absent (a pre-lane row)", async () => {
    // `getBlueprint` casts the jsonb with no zod parse, so a row written before Task 5.5 reads
    // back `undefined` while typed `boolean`. The branch is `=== true`, so undefined renders —
    // suppressing every sheet on a missing flag would be a far larger failure than the one it
    // guards, and there are zero such rows.
    // Built by deletion off a real blueprint, not by hand: the point is a row that is a valid
    // SourceBlueprint in every respect EXCEPT this field, which is what the jsonb cast can hand
    // back. `Record<string, unknown>` because the interface declares the field required, so
    // `delete` on a `SourceBlueprint`-typed value does not compile (TS2790).
    const legacy: Record<string, unknown> = { ...makeBlueprint() };
    delete legacy.from_fixed_buckets;
    serve({ script: SCRIPT, blueprint: legacy as unknown as SourceBlueprint });
    const { container } = render(<RemixBeats blueprintId={BLUEPRINT_ID} variantIndex={0} />);
    await waitFor(() => expect(container.querySelector("[data-beats]")).not.toBeNull());
  });

  it("renders nothing when the row holds no beats", async () => {
    // `emptyBlueprint()` — the honest "no video" row. Nothing to shoot beat by beat.
    serve({ script: [[], [], []], blueprint: makeBlueprint({ beats: [], has_speech: false, duration_s: 0 }) });
    const { container } = render(<RemixBeats blueprintId={BLUEPRINT_ID} variantIndex={0} />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing rather than an error when the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
    const { container } = render(<RemixBeats blueprintId={BLUEPRINT_ID} variantIndex={0} />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(container.querySelector("[data-beats]")).toBeNull();
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing rather than an error when the fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { container } = render(<RemixBeats blueprintId={BLUEPRINT_ID} variantIndex={0} />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The refresh channel (phase 5, Task 2) — a `revised` frame bumps this sheet's counter in
// RemixRefreshContext and RemixBeats treats that as an explicit "refetch me" signal, since the
// thread reload never remounts it (positional keys). Context default `{counters: {}}` is what
// every test ABOVE this block renders under with no provider at all — that they stay green
// unmodified IS the proof that a non-thread host (e.g. /dev/cards) sees zero behavior change.
// ─────────────────────────────────────────────────────────────────────────────

describe("RemixBeats — the refresh channel (phase 5)", () => {
  it("bumping this sheet's counter fires exactly one refetch", async () => {
    const { rerender } = render(
      <RemixRefreshContext.Provider value={{ counters: {} }}>
        <RemixBeats blueprintId={BLUEPRINT_ID} variantIndex={0} />
      </RemixRefreshContext.Provider>,
    );
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));

    rerender(
      <RemixRefreshContext.Provider value={{ counters: { [BLUEPRINT_ID]: 1 } }}>
        <RemixBeats blueprintId={BLUEPRINT_ID} variantIndex={0} />
      </RemixRefreshContext.Provider>,
    );
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
  });

  it("bumping a DIFFERENT sheet's counter does not refetch this one", async () => {
    const { rerender } = render(
      <RemixRefreshContext.Provider value={{ counters: {} }}>
        <RemixBeats blueprintId={BLUEPRINT_ID} variantIndex={0} />
      </RemixRefreshContext.Provider>,
    );
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));

    rerender(
      <RemixRefreshContext.Provider value={{ counters: { "some-other-blueprint": 1 } }}>
        <RemixBeats blueprintId={BLUEPRINT_ID} variantIndex={0} />
      </RemixRefreshContext.Provider>,
    );
    await waitFor(() => expect(screen.getByText("0.0–1.8s · HOOK")).toBeInTheDocument());
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("initialData + bump 0 stays byte-identical to today — no network at all", async () => {
    render(
      <RemixRefreshContext.Provider value={{ counters: {} }}>
        <RemixBeats
          blueprintId={BLUEPRINT_ID}
          variantIndex={0}
          initialData={{ script: SCRIPT, blueprint: makeBlueprint() }}
        />
      </RemixRefreshContext.Provider>,
    );
    await waitFor(() => expect(screen.getByText("0.0–1.8s · HOOK")).toBeInTheDocument());
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("initialData + bump > 0 skips the short-circuit — the network IS hit", async () => {
    const { rerender } = render(
      <RemixRefreshContext.Provider value={{ counters: {} }}>
        <RemixBeats
          blueprintId={BLUEPRINT_ID}
          variantIndex={0}
          initialData={{ script: SCRIPT, blueprint: makeBlueprint() }}
        />
      </RemixRefreshContext.Provider>,
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();

    rerender(
      <RemixRefreshContext.Provider value={{ counters: { [BLUEPRINT_ID]: 1 } }}>
        <RemixBeats
          blueprintId={BLUEPRINT_ID}
          variantIndex={0}
          initialData={{ script: SCRIPT, blueprint: makeBlueprint() }}
        />
      </RemixRefreshContext.Provider>,
    );
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
  });

  it("once the refetch resolves, the FETCHED payload renders — it must not stay shadowed by the stale initialData", async () => {
    // Spec §6.7: the refresh must not shadow a payload it now knows is stale. Firing the network
    // call is not enough on its own — `data = initialData ?? fetched` would keep the OLD line on
    // screen forever, because `initialData` never becomes falsy. This is the display half of the
    // fix; the previous test only proved the fetch half.
    const REVISED_SCRIPT: AdaptedBeat[][] = [
      [
        {
          index: 0,
          spoken: "This is the REVISED opening line.",
          on_screen_text: "NEW",
          shot: "revised shot",
        },
      ],
    ];
    serve({ script: REVISED_SCRIPT, blueprint: makeBlueprint() });

    const { rerender } = render(
      <RemixRefreshContext.Provider value={{ counters: {} }}>
        <RemixBeats
          blueprintId={BLUEPRINT_ID}
          variantIndex={0}
          initialData={{ script: SCRIPT, blueprint: makeBlueprint() }}
        />
      </RemixRefreshContext.Provider>,
    );
    // No revision yet — the injected (stale-to-be) line is what's on screen, and no network fired.
    await waitFor(() =>
      expect(screen.getByText(/Your creatine is doing nothing\./)).toBeInTheDocument(),
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();

    rerender(
      <RemixRefreshContext.Provider value={{ counters: { [BLUEPRINT_ID]: 1 } }}>
        <RemixBeats
          blueprintId={BLUEPRINT_ID}
          variantIndex={0}
          initialData={{ script: SCRIPT, blueprint: makeBlueprint() }}
        />
      </RemixRefreshContext.Provider>,
    );

    await waitFor(() =>
      expect(screen.getByText(/This is the REVISED opening line\./)).toBeInTheDocument(),
    );
    // The stale initialData line is GONE — not merely fetched-and-ignored.
    expect(screen.queryByText(/Your creatine is doing nothing\./)).not.toBeInTheDocument();
  });
});

describe("RemixBeats — accent dosage (LOCKED)", () => {
  it("spends no accent on the beat rows", () => {
    // The card already spends its one accent on the Borrowed chip, and the dosage rule is at most
    // one accent element visible at a time. A static read because the classes are what ship —
    // happy-dom has no stylesheet to compute a colour from.
    const src = readFileSync(join(__dirname, "..", "remix-beats.tsx"), "utf8");
    for (const banned of ["accent", "#FF6363", "coral", "signal-"]) {
      expect(src.replace(/\/\*[\s\S]*?\*\//g, "")).not.toContain(banned);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The mount — the half the brief got wrong, and the half no renderer test can see.
// ─────────────────────────────────────────────────────────────────────────────

function makeRemix(over: Partial<RemixCardBlock["props"]> = {}): RemixCardBlock {
  return {
    type: "remix-card",
    props: {
      adaptedHook: "The real reason 90% of lifters waste their creatine",
      angle: "Cold-open pattern interrupt reveals hidden truth",
      whoItsFor: "Beginner fitness creators",
      formatBorrowed: "open-loop cold open",
      band: "Strong",
      fraction: "7/10 stop",
      scrollQuote: "This actually made me stop.",
      model: "sim1-flash",
      ...over,
    },
  };
}

describe("RemixCardRenderer — the shoot sheet mount", () => {
  it("hands the sheet the card's OWN variant, not the run's first", async () => {
    // One row serves all three ranked cards. Card #3 carries blueprintVariant 2; a hard-coded 0
    // renders the rank-1 sheet on it — plausible on screen, wrong in every word.
    const { container } = renderWithClient(
      <RemixCardRenderer block={makeRemix({ blueprintId: BLUEPRINT_ID, blueprintVariant: 2 })} />,
    );
    await waitFor(() =>
      expect(container.textContent).toContain("Rank three opens somewhere else again."),
    );
    expect(container.textContent).not.toContain("Your creatine is doing nothing.");
  });

  it("defaults to variant 0 when the card carries no variant", async () => {
    const { container } = renderWithClient(
      <RemixCardRenderer block={makeRemix({ blueprintId: BLUEPRINT_ID })} />,
    );
    await waitFor(() => expect(container.textContent).toContain("Your creatine is doing nothing."));
  });

  it("asks for nothing on a card with no blueprint", async () => {
    // Every card persisted before this lane has no blueprintId; it must render exactly as it did,
    // and must not fire a request for a row that does not exist.
    const { container } = renderWithClient(<RemixCardRenderer block={makeRemix()} />);
    await waitFor(() => expect(container.textContent).toContain("The real reason 90%"));
    // Scoped to OUR endpoint, not to fetch at all: `SaveAffordance` legitimately calls
    // `/api/saved` on every card, so a blanket `not.toHaveBeenCalled()` fails on a correct card.
    const urls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(urls.filter((u) => u.startsWith("/api/remix/blueprint/"))).toEqual([]);
    expect(container.querySelector("[data-beats]")).toBeNull();
  });
});
