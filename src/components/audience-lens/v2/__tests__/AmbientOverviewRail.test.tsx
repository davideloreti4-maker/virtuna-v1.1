/** @vitest-environment happy-dom */
/**
 * AmbientOverviewRail — the parallel-run mount of the Ambient v2 surfaces in the composer rail.
 *
 * The integration this locks: a live `Audience` + the thread's projected-card ledger flow through
 * `audienceToMeta` → `buildOverviewData` → the rendered Overview, so the ranked list shows the REAL
 * projected stimuli under the REAL audience name — no fixture, no fabrication. (The pure segment/cast
 * derivation is unit-tested in `ambient-v2-adapters.test.ts`; this proves the glue renders.)
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { AmbientOverviewRail } from "../AmbientOverviewRail";
import { GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import { buildVideoPopulation } from "@/lib/surfaces/ambient-v2-video-population";
import type { Audience } from "@/lib/audience/audience-types";
import type { PersonaSimulationResult } from "@/lib/engine/types";
import type { AmbientCardDescriptor } from "@/components/app/home/use-ambient-focus";

/** One fold reactor in the shape `analysis_results.personas` really stores. */
const foldPersona = (
  archetype: string,
  slot_type: PersonaSimulationResult["slot_type"],
  scroll_past_second: number,
  intents: [share: number, save: number, comment: number, rewatch: number] = [0, 0, 0, 0],
): PersonaSimulationResult =>
  ({
    persona_id: `${slot_type}-${archetype}`,
    archetype,
    slot_type,
    niche: "general",
    scroll_past_second,
    watch_through_pct: scroll_past_second === 0 ? 90 : 30,
    share_intent: intents[0],
    save_intent: intents[1],
    comment_intent: intents[2],
    rewatch_intent: intents[3],
    reasoning: `fold-derived: ${archetype}`,
  }) as PersonaSimulationResult;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const audience: Audience = { ...GENERAL_AUDIENCE, name: "Your audience" };

const descriptors: AmbientCardDescriptor[] = [
  { id: "hook-0", kind: "hook", conceptText: "Nobody tells you the first 10k…", fraction: "3/10 stop", scrollQuote: "" },
  { id: "idea-1", kind: "idea", conceptText: "I quit my 9-5 with $400…", fraction: "9/10 stop", scrollQuote: "" },
];

describe("AmbientOverviewRail", () => {
  it("renders the real audience + the projected ledger as the ranked Overview", () => {
    render(<AmbientOverviewRail audience={audience} descriptors={descriptors} reducedMotion />);
    // the real audience name (mapped via audienceToMeta)
    expect(screen.getByText("Your audience")).toBeTruthy();
    // both projected stimuli render as ranked rows (real data, not a fixture)
    expect(screen.getByText(/Nobody tells you the first 10k/)).toBeTruthy();
    expect(screen.getByText(/I quit my 9-5 with \$400/)).toBeTruthy();
  });

  it("renders the Overview (not Simulate) at rest — the develop surface is gated behind a rank tap", () => {
    render(<AmbientOverviewRail audience={audience} descriptors={descriptors} reducedMotion />);
    expect(screen.getByTestId("ambient-overview")).toBeTruthy();
  });

  /**
   * The header states the room's FACTS; the avatars are gone (rev B+, 2026-08-02).
   *
   * The board used to wear a bordered `CALIBRATED` pill beside the name and an "on call" avatar
   * footer pinned to the bottom — and between them they told a creator one word about their room.
   * How many minds, how it was calibrated, and where they read were on no surface at all. The
   * facts line says all three; the pill and the footer are deleted.
   *
   * The footer had a second, worse mode: it derives from the room's NAMED SLICES, General carries
   * none, and General is every new creator's default — so the first thing a new user saw in the
   * rail was a bare "on call" label under a rule with zero avatars beside it (caught live
   * 2026-07-24). It cannot regress now, in either room, and both are asserted.
   */
  it("states the room's real facts in the header — minds · calibration · where they read", () => {
    render(<AmbientOverviewRail audience={audience} descriptors={descriptors} reducedMotion />);
    const board = screen.getByTestId("ambient-overview").textContent ?? "";
    expect(board).toContain("1,000 minds"); // TIER_N.flash, the real headcount of a Flash read
    expect(board).toContain("baseline"); // General ⇒ the honest badge, not "calibrated"
    expect(board).toContain("reads on TikTok"); // the scene, from the same source ⑤ arms with
  });

  it("renders NO cast footer and NO calibration pill — in the General room or a calibrated one", () => {
    const calibrated: Audience = {
      ...audience,
      is_general: false,
      personas: [
        { archetype: "loyalist", label: "Gym regulars", share: 0.6 },
        { archetype: "fyp", label: "Drive-by scrollers", share: 0.4 },
      ] as Audience["personas"],
    };
    const { rerender } = render(
      <AmbientOverviewRail audience={audience} descriptors={descriptors} reducedMotion />,
    );
    expect(screen.queryByText("on call")).toBeNull();

    // The calibrated room is the one that USED to render avatars — two named slices, so `deriveCast`
    // returns two members. It still does (the derivation is kept, handoff §8); nothing draws them.
    rerender(<AmbientOverviewRail audience={calibrated} descriptors={descriptors} reducedMotion />);
    expect(screen.queryByText("on call")).toBeNull();
    expect(screen.queryByText("G")).toBeNull();
    expect(screen.queryByText("D")).toBeNull();
    // …and this room's facts line reports ITS calibration, not the baseline's.
    expect(screen.getByTestId("ambient-overview").textContent).toContain("calibrated");
  });

  /**
   * THE 0/10 RANK IS DEAD (owner, 2026-08-02) — and this is the surface it was printed on.
   * Both descriptors carry a `fraction` ("3/10 stop" / "9/10 stop"), so if any of it comes back —
   * the number, a bar, or a sort keyed to it — it comes back here first.
   */
  it("prints no /10 on a queued row, and offers the Simulate door instead", () => {
    render(<AmbientOverviewRail audience={audience} descriptors={descriptors} reducedMotion />);
    const board = screen.getByTestId("ambient-overview").textContent ?? "";
    expect(board).not.toMatch(/\d+\s*\/\s*10/);
    expect(board).not.toContain("Strong");
    expect(board).not.toContain("Weak");
    // The row's one affordance is the run it hasn't had. Two queued descriptors ⇒ two doors.
    expect(screen.getAllByText(/Simulate\s*→/)).toHaveLength(2);
    // Ledger order, not the 9/10-first order the dead rank produced.
    const rows = screen.getAllByRole("button").map((b) => b.textContent ?? "");
    const hook = rows.findIndex((t) => t.includes("Nobody tells you the first 10k"));
    const idea = rows.findIndex((t) => t.includes("I quit my 9-5"));
    expect(hook).toBeLessThan(idea);
  });

  it("re-seals a row from persistedSeals on mount — no fire needed (survives reload, Phase D)", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AmbientOverviewRail
        audience={audience}
        descriptors={descriptors}
        reducedMotion
        // keyed by the trimmed concept text (matches the persisted store)
        persistedSeals={{ "I quit my 9-5 with $400…": { pct: 80, band: "Strong", at: "" } }}
      />,
    );
    // the persisted verdict shows as a sealed 80.0% row without any network call
    expect(screen.getByText(/80\.0%/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("drills a SEALED text row into the real depth — brain-first attention-scrubber (real top-reason synthesis) + the Population tab", () => {
    const population = {
      total: 1000,
      stop: 800,
      scroll: 200,
      stopPct: 80,
      segments: [
        { archetype: "builder", displayName: "builders", share: 0.6, total: 600, stop: 540, stopPct: 90 },
        { archetype: "skeptic", displayName: "skeptics", share: 0.4, total: 400, stop: 260, stopPct: 65 },
      ],
      reasons: [
        { reason: "strong-hook", count: 520 },
        { reason: "too-slow", count: 120 },
      ],
    };
    const personas = [{ archetype: "builder", verdict: "stop" as const, quote: "that detail made me stay" }];
    render(
      <AmbientOverviewRail
        audience={audience}
        descriptors={descriptors}
        reducedMotion
        persistedSeals={{
          "I quit my 9-5 with $400…": { pct: 80, band: "Strong", at: "", population, personas, scrollQuote: "" },
        }}
      />,
    );
    // tapping the SEALED row opens the depth drill (not Simulate) — it has a real population
    fireEvent.click(screen.getByRole("button", { name: /I quit my 9-5 with \$400/ }));
    expect(screen.getByTestId("ambient-detail")).toBeTruthy();
    // opens BRAIN-first (owner call 2026-07-24: text sim = full video Brain parity). The text brain is
    // the SAME attention-scrubber the video draws (modeled retention curve + real transcript), headed by
    // the REAL top-reason synthesis — the friction (loss) reason, humanized + coral. This REVERSED the
    // old reason-bars stance, so "What carried the stop" must NOT render; and it is NEVER the "text
    // concept sim — unavailable" paused state. (textContent matcher tolerates the synthesis' spans.)
    const bodyHas = (re: RegExp) =>
      screen.getAllByText((_content, el) => !!el && re.test(el.textContent ?? "")).length > 0;
    expect(bodyHas(/Most who stalled did so on/i)).toBe(true); // the real "why they stopped" synthesis
    expect(bodyHas(/too slow/i)).toBe(true); // the friction (loss) reason leads it (520 vs 120: loss wins)
    expect(screen.queryByText(/What carried the stop/i)).toBeNull(); // the reversed-away reason-bars header
    expect(screen.queryByText(/text concept sim/i)).toBeNull(); // never the unavailable fallback
    // the Population tab is still reachable — the same sim's REAL districts render there
    fireEvent.click(screen.getByRole("button", { name: /The audience/ }));
    expect(screen.getAllByText(/builders/).length).toBeGreaterThan(0);
  });

  it("a tested VIDEO shows its viral score + Simulate; a tap reveals the % then drills into Brain depth", () => {
    const videoSeal = {
      pct: 62,
      band: null,
      at: "",
      video: {
        analysisId: "an-1",
        stopPct: 62,
        craftScore: 84, // the native viral score — shown before any sim
        heatmap: { weighted_curve: [0.9, 0.5, 0.6], segments: [] },
        videoSignals: null,
        verbatim: { hook: { spoken_words: "Here is the money truth" } },
      },
    };
    render(
      <AmbientOverviewRail
        audience={audience}
        descriptors={descriptors}
        reducedMotion
        persistedSeals={{ "an-1": videoSeal as never }}
      />,
    );
    // the video is a QUEUED row: its real opening words as the label, its viral score, NO attention %
    const row = screen.getByRole("button", { name: /Here is the money truth/ });
    expect(row).toBeTruthy();
    expect(screen.getByText(/84/)).toBeTruthy();
    expect(screen.getByText(/viral/)).toBeTruthy();
    expect(screen.queryByText(/62\.0%/)).toBeNull(); // withheld until Simulate

    // tap 1 → reveal the already-measured attention % (no network — the Test analysis produced it)
    fireEvent.click(row);
    expect(screen.getByText(/62\.0%/)).toBeTruthy();
    expect(screen.getByText(/viral 84/)).toBeTruthy(); // native score stays in view

    // tap 2 → drill into the real Brain depth (brain-first for a video)
    fireEvent.click(screen.getByRole("button", { name: /Here is the money truth/ }));
    expect(screen.getByTestId("ambient-detail")).toBeTruthy();
  });

  it("a drilled VIDEO fills the Population tab from the SAME run's fold cast — named districts, no invented receipts", () => {
    // The aggregate is produced by the real mapper off a real fold shape — the exact path the Test
    // route seals, so this proves producer → seal → drill end to end, not a hand-written blob.
    const fold = buildVideoPopulation({
      personas: [
        foldPersona("tough_crowd", "fyp", 2.8),
        foldPersona("lurker", "fyp", 0),
        foldPersona("high_engager", "fyp", 0),
        foldPersona("loyalist", "loyalist", 0),
        foldPersona("cross_niche_curiosity", "cross_niche", 8.5),
      ],
      heatmap: {
        segments: [{ idx: 0, t_start: 0, t_end: 3, is_hook_zone: true, keyframe_uri: null }],
        weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
      } as never,
    })!;
    render(
      <AmbientOverviewRail
        audience={audience}
        descriptors={descriptors}
        reducedMotion
        persistedSeals={{
          "an-1": {
            pct: 62,
            band: null,
            at: "",
            population: fold.aggregate,
            video: {
              analysisId: "an-1",
              stopPct: 62,
              craftScore: 84,
              heatmap: { weighted_curve: [0.9, 0.5, 0.6], segments: [] },
              videoSignals: null,
              verbatim: { hook: { spoken_words: "Here is the money truth" } },
              skimmedPct: fold.skimmedPct,
            },
          } as never,
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Here is the money truth/ })); // reveal
    fireEvent.click(screen.getByRole("button", { name: /Here is the money truth/ })); // drill
    fireEvent.click(screen.getByRole("button", { name: /The audience/ }));

    // the fold's REAL archetypes are the districts — the room, named, not a placeholder
    // (display names, so this also proves the slugs go through `archetypeDisplayName`)
    expect(screen.getAllByText(/Tough Crowd/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Regulars/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Passers-by/).length).toBeGreaterThan(0);
    // and NO receipts heading: a video fold codes no per-viewer reasons, so the section omits itself
    // rather than printing a kicker over nothing (the orphaned-label defect).
    expect(screen.queryByText(/Why · coded from/)).toBeNull();
    // no action profile on this seal either — it predates the intents, so the section is simply gone
    expect(screen.queryByText(/what they’d do with it/i)).toBeNull();
  });

  it("a drilled VIDEO renders the action profile when its seal carries the intents", () => {
    const personas = [
      foldPersona("tough_crowd", "fyp", 2.8),
      foldPersona("lurker", "fyp", 0),
      foldPersona("high_engager", "fyp", 0, [45, 30, 60, 20]),
      foldPersona("loyalist", "loyalist", 0, [50, 40, 80, 30]),
      foldPersona("cross_niche_curiosity", "cross_niche", 8.5, [15, 10, 5, 0]),
    ];
    // producer → seal → drill, off the REAL `vSoTpo5AixUS` aggregate — no hand-written section blob
    const fold = buildVideoPopulation({
      personas,
      heatmap: {
        segments: [{ idx: 0, t_start: 0, t_end: 3, is_hook_zone: true, keyframe_uri: null }],
        weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
      } as never,
      aggregate: {
        completion_pct: 68.8,
        share_pct: 38.285714285714285,
        save_pct: 48.142857142857146,
        comment_pct: 44.971428571428575,
        loop_pct: 21,
      } as never,
    })!;
    render(
      <AmbientOverviewRail
        audience={audience}
        descriptors={descriptors}
        reducedMotion
        persistedSeals={{
          "an-1": {
            pct: 62, band: null, at: "",
            population: fold.aggregate,
            video: {
              analysisId: "an-1", stopPct: 62, craftScore: 84,
              heatmap: { weighted_curve: [0.9, 0.5, 0.6], segments: [] },
              videoSignals: null,
              verbatim: { hook: { spoken_words: "Here is the money truth" } },
              skimmedPct: fold.skimmedPct,
              intents: fold.intents,
            },
          } as never,
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Here is the money truth/ })); // reveal
    fireEvent.click(screen.getByRole("button", { name: /Here is the money truth/ })); // drill
    fireEvent.click(screen.getByRole("button", { name: /The audience/ }));

    expect(screen.getByText(/what they’d do with it/i)).toBeInTheDocument();
    // the four verbs, and the real headcount off the real cast (3 of 5 carry any intent)
    expect(screen.getByText("rewatch")).toBeInTheDocument();
    expect(screen.getByText(/3 of 5/)).toBeInTheDocument();
    // the read GROUPS the head — save tops comment by 3 points, which is sort order, not a finding
    expect(screen.getByText(/run together \(38–48\); rewatch is the floor at 21\./)).toBeInTheDocument();
    // and the denominator is stated: these are not rates
    expect(screen.getByText(/not a room average/)).toBeInTheDocument();
    // the section it sits beside stays absent — intent is not a reach claim
    expect(screen.queryByText(/who spreads it/i)).toBeNull();
  });

  it("a focusVideo request opens that video's depth directly — the Test card's door", () => {
    const seals = {
      "an-1": {
        pct: 62,
        band: null,
        at: "",
        video: {
          analysisId: "an-1",
          stopPct: 62,
          craftScore: 84,
          heatmap: { weighted_curve: [0.9, 0.5, 0.6], segments: [] },
          videoSignals: null,
          verbatim: { hook: { spoken_words: "Here is the money truth" } },
        },
      },
    } as never;
    const { rerender } = render(
      <AmbientOverviewRail audience={audience} descriptors={descriptors} reducedMotion persistedSeals={seals} />,
    );
    // At rest the room is the Overview and the video's % is withheld behind its reveal gate.
    expect(screen.queryByTestId("ambient-detail")).toBeNull();

    // The card's CTA IS the deliberate ask, so the request skips the reveal gate and lands on the
    // depth — making the creator tap the row twice more for what they just asked for is ceremony.
    rerender(
      <AmbientOverviewRail
        audience={audience}
        descriptors={descriptors}
        reducedMotion
        persistedSeals={seals}
        focusVideo={{ id: "an-1", nonce: 1 }}
      />,
    );
    expect(screen.getByTestId("ambient-detail")).toBeTruthy();
  });

  it("ignores a focusVideo request with no matching seal — never opens an empty drill", () => {
    render(
      <AmbientOverviewRail
        audience={audience}
        descriptors={descriptors}
        reducedMotion
        focusVideo={{ id: "an-does-not-exist", nonce: 1 }}
      />,
    );
    expect(screen.queryByTestId("ambient-detail")).toBeNull();
  });

  it("a drilled VIDEO with NO fold cast keeps the honest audience-unavailable state", () => {
    render(
      <AmbientOverviewRail
        audience={audience}
        descriptors={descriptors}
        reducedMotion
        persistedSeals={{
          "an-1": {
            pct: 62,
            band: null,
            at: "",
            // no `population` — a Wave-3-degraded row, or a seal written before this shipped
            video: {
              analysisId: "an-1",
              stopPct: 62,
              craftScore: 84,
              heatmap: { weighted_curve: [0.9, 0.5, 0.6], segments: [] },
              videoSignals: null,
              verbatim: { hook: { spoken_words: "Here is the money truth" } },
            },
          } as never,
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Here is the money truth/ }));
    fireEvent.click(screen.getByRole("button", { name: /Here is the money truth/ }));
    // the Brain drill still opens — the depth we DO have is never withheld because the other is absent
    expect(screen.getByTestId("ambient-detail")).toBeTruthy();
    expect(screen.queryByText(/Tough Crowd/)).toBeNull();
  });

  it("tapping a queued row opens the ARM config FIRST, then its Simulate fires the react route (config→run)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ fraction: "8/10 stop" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AmbientOverviewRail audience={audience} descriptors={descriptors} reducedMotion />);
    // tapping a queued row opens the ARM panel — it must NOT fire the sim yet (config comes first)
    fireEvent.click(screen.getByRole("button", { name: /I quit my 9-5 with \$400/ }));
    expect(fetchMock).not.toHaveBeenCalled();
    // the develop/ARM surface is now up (its Simulate control is present)
    const armSimulate = screen.getByRole("button", { name: /^Simulate/ });

    // NOW the run fires — from inside the ARM panel
    fireEvent.click(armSimulate);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tools/react",
      expect.objectContaining({ method: "POST" }),
    );
    const sentBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(sentBody.text).toMatch(/I quit my 9-5/);
    expect(sentBody.pin).toBe(true); // a deliberate sim captures the flywheel vector (Phase D)

    // 8/10 stop → a sealed 80.0% would-stop row (measured, not the projection)
    expect(await screen.findByText(/80\.0%/)).toBeTruthy();
  });

  it("does NOT seal the row when the react route (fired from the ARM panel) fails — queued state holds", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    render(<AmbientOverviewRail audience={audience} descriptors={descriptors} reducedMotion />);
    fireEvent.click(screen.getByRole("button", { name: /I quit my 9-5 with \$400/ }));
    // wrap in act so the rejected fetch + the watcher-clear state update settle inside React
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Simulate/ }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalled();
    // no fabricated seal — no "%.0%" sealed value appears
    expect(screen.queryByText(/\d+\.\d%/)).toBeNull();
  });
});

// ─── The funnel wall — sealed wire seals (ONBOARDING-FUNNEL-DESIGN.md §0b②) ───
// An anonymous session's /api/threads/open sends the SEALED wire form: analysisId +
// craft score, nothing else. The rail must render that as a queued row that opens the
// sealed drill — honest withheld notes, and no % anywhere, because none was transmitted.

describe("AmbientOverviewRail — the funnel wall (sealed wire seals, §0b②)", () => {
  const sealedSeal = {
    sealed: true as const,
    at: "2026-07-26T12:00:00Z",
    video: { analysisId: "an-1", craftScore: 84 },
  };

  it("a sealed video renders as a queued row (craft score, no %) and a tap opens the SEALED drill", () => {
    render(
      <AmbientOverviewRail
        audience={audience}
        descriptors={[]}
        reducedMotion
        persistedSeals={{ "an-1": sealedSeal }}
      />,
    );
    // The row: honest fallback label (the wire seal carries no verbatim) + the craft score.
    const row = screen.getByRole("button", { name: /Tested video/ });
    expect(row).toBeTruthy();
    expect(screen.getByText(/84/)).toBeTruthy();
    // No attention % anywhere — the wire never carried one.
    expect(screen.queryByText(/\d+(\.\d+)?%/)).toBeNull();

    // The tap opens the sealed drill directly — there is no % to reveal first.
    fireEvent.click(row);
    expect(screen.getByTestId("ambient-detail")).toBeTruthy();
    // The audience tab leads (no brain) with the WALL sentence — withheld, not "no run yet".
    expect(screen.getByText(/reaction is sealed/i)).toBeTruthy();
    // Still no % after the drill — the sealed surface cannot leak what it never received.
    expect(screen.queryByText(/\d+(\.\d+)?%/)).toBeNull();
  });

  it("the sealed drill's brain tab carries the sealed note, not the text-sim excuse", () => {
    render(
      <AmbientOverviewRail
        audience={audience}
        descriptors={[]}
        reducedMotion
        persistedSeals={{ "an-1": sealedSeal }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Tested video/ }));
    fireEvent.click(screen.getByRole("button", { name: "The brain" }));
    expect(screen.getByText(/unlocks with the simulation verdict/i)).toBeTruthy();
  });

  it("a focusVideo request (the Test card's Simulate door) opens the sealed drill directly", () => {
    render(
      <AmbientOverviewRail
        audience={audience}
        descriptors={[]}
        reducedMotion
        persistedSeals={{ "an-1": sealedSeal }}
        focusVideo={{ id: "an-1", nonce: 1 }}
      />,
    );
    expect(screen.getByTestId("ambient-detail")).toBeTruthy();
    expect(screen.getByText(/reaction is sealed/i)).toBeTruthy();
  });
});
