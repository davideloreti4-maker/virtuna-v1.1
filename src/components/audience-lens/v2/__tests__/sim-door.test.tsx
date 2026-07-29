/** @vitest-environment happy-dom */
/**
 * THE ＋ DOOR — bring your own stimulus (Phases 3+4, 2026-07-28).
 *
 * Two doors, one host, one run. What each test here holds shut:
 *
 *  - The board's ＋ was a DEAD BUTTON on an empty rail and a LIAR on a full one:
 *    `onTestVariant={() => descriptors[0] && openDevelop(descriptors[0].id)}` — undefined on an
 *    empty board (the only control a new creator has), and on a non-empty board it re-armed their
 *    FIRST EXISTING CARD instead of testing anything new. Both defects live in that one line, so
 *    both are asserted: the ＋ opens the door and NEVER the develop card.
 *  - `AmbientStart`'s docstring described a SIMULATE DOOR that did not exist (one `onSkill` call
 *    site, no door element). It exists now, and it is inert-proof: no handler ⇒ no door.
 *  - The ARM screen used to collect five dials and DISCARD them. The cold ARM must carry the brought
 *    stimulus out on its config, or the door opens onto a run that reads the audience default.
 *  - A brought VIDEO reaches `/api/analyze`, which honours NO lens, NO slice and NO scene and reads
 *    a TEN-reactor fold. So those dials lock with a reason and the headcount says 10 — not 10,000,
 *    which is the TEXT projection's number.
 *  - The host's routing: a draft is a `/api/tools/react` run with `card:true` (the anti-orphan half)
 *    AFTER the thread exists (F-019); a video is handed to the composer's pipeline and never fetched
 *    here; a 402 raises the wall instead of vanishing.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/hooks/queries/use-profile", () => ({
  useProfile: () => ({ data: { name: "Davide Loreti" } }),
}));

import { AmbientOverviewRail } from "../AmbientOverviewRail";
import { AmbientStartHome } from "../AmbientStartHome";
import { AmbientSimulate, type SimulateConfig } from "../AmbientSimulate";
import { SimulateDoorHost } from "../SimulateDoorHost";
import { SIMULATE_R4 } from "../simulate-fixture";
import { GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import { CREDIT_WALL_EVENT } from "@/lib/billing/credit-wall";
import type { AmbientCardDescriptor } from "@/components/app/home/use-ambient-focus";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const audience = { ...GENERAL_AUDIENCE, name: "Your audience" };

const descriptors: AmbientCardDescriptor[] = [
  { id: "hook-0", kind: "hook", conceptText: "An existing card of mine", fraction: "4/10 stop", scrollQuote: "" },
];

// ── Door 1: the board's ＋ ───────────────────────────────────────────────────────

describe("the board's ＋ door", () => {
  it("opens the door on an EMPTY board — where the old handler was a dead button", () => {
    const onTestVariant = vi.fn();
    render(<AmbientOverviewRail audience={audience} descriptors={[]} onTestVariant={onTestVariant} />);
    fireEvent.click(screen.getByTestId("ambient-sim-door"));
    expect(onTestVariant).toHaveBeenCalledTimes(1);
  });

  it("opens the door on a FULL board too — never re-arming the first existing card", () => {
    const onTestVariant = vi.fn();
    render(
      <AmbientOverviewRail audience={audience} descriptors={descriptors} onTestVariant={onTestVariant} />,
    );
    fireEvent.click(screen.getByTestId("ambient-sim-door"));
    expect(onTestVariant).toHaveBeenCalledTimes(1);
    // THE LIE: the old line opened `develop` pre-filled with descriptors[0]. The ARM card must not
    // be on screen, and the existing card's text must not have become the thing under test.
    expect(screen.queryByTestId("ambient-simulate")).toBeNull();
  });

  it("says what it does — it takes something the creator brings, not a variant of a row", () => {
    render(<AmbientOverviewRail audience={audience} descriptors={descriptors} onTestVariant={vi.fn()} />);
    expect(screen.getByTestId("ambient-sim-door").textContent).toContain("Test something of your own");
  });

  it("renders NO ＋ when the host cannot run what comes through it", () => {
    // A gallery/fixture host (no handler) shows no door, rather than one that goes nowhere.
    render(<AmbientOverviewRail audience={audience} descriptors={descriptors} />);
    expect(screen.queryByTestId("ambient-sim-door")).toBeNull();
  });
});

// ── Door 2: the Start card's SIMULATE DOOR ──────────────────────────────────────

describe("the Start card's SIMULATE DOOR", () => {
  it("exists and fires — the element its docstring described for a week and never had", () => {
    const onSimDoor = vi.fn();
    render(
      <AmbientStartHome
        audience={GENERAL_AUDIENCE}
        onSkill={vi.fn()}
        onSubmit={vi.fn()}
        onSimDoor={onSimDoor}
      />,
    );
    const door = screen.getByTestId("ambient-start-sim-door");
    expect(door.textContent).toContain("Test something against your audience");
    fireEvent.click(door);
    expect(onSimDoor).toHaveBeenCalledTimes(1);
  });

  it("is absent without a handler — a named door with nothing behind it is worse than none", () => {
    render(<AmbientStartHome audience={GENERAL_AUDIENCE} onSkill={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByTestId("ambient-start-sim-door")).toBeNull();
  });
});

// ── The ARM screen carries the brought stimulus out ─────────────────────────────

describe("the cold ARM's config", () => {
  /** Walk: doors → collect → type → arm → Simulate ↑, returning the emitted config. */
  function armDraft(text: string): SimulateConfig {
    const onSimulate = vi.fn();
    render(<AmbientSimulate data={SIMULATE_R4} mode="cold" onSimulate={onSimulate} />);
    fireEvent.click(screen.getByText("Screen a draft"));
    fireEvent.change(screen.getByLabelText("Paste the draft to screen"), { target: { value: text } });
    fireEvent.click(screen.getByText("Arm the run →"));
    fireEvent.click(screen.getByText("Simulate"));
    expect(onSimulate).toHaveBeenCalledTimes(1);
    return onSimulate.mock.calls[0]![0] as SimulateConfig;
  }

  it("carries WHAT THE CREATOR BROUGHT — without this the door fires the audience default", () => {
    const config = armDraft("  my own hook, typed here  ");
    expect(config.stimulus).toBeDefined();
    expect(config.stimulus!.text).toBe("my own hook, typed here"); // trimmed by the collect step
    expect(config.stimulus!.kind).toBe("draft");
    // And the dials still ride along (Phase 1's wiring, unbroken).
    expect(config.lensKey).toBeTruthy();
    expect(config.scene).toBeTruthy();
  });

  it("a DEVELOP entry carries none — its caller resolves the stimulus from the row id", () => {
    const onSimulate = vi.fn();
    render(<AmbientSimulate data={SIMULATE_R4} mode="develop" onSimulate={onSimulate} />);
    fireEvent.click(screen.getByText("Simulate"));
    const config = onSimulate.mock.calls[0]![0] as SimulateConfig;
    expect(config.stimulus).toBeUndefined();
  });
});

// ── The video variant: only the dials the route honours ─────────────────────────

describe("a brought VIDEO arms honestly", () => {
  function armVideo() {
    render(<AmbientSimulate data={SIMULATE_R4} mode="cold" onSimulate={vi.fn()} />);
    fireEvent.click(screen.getByText("Test a real video"));
    fireEvent.change(screen.getByLabelText("Upload video file"), {
      target: { files: [new File(["x"], "my-clip.mp4", { type: "video/mp4" })] },
    });
    fireEvent.click(screen.getByText("Arm the run →"));
  }

  it("locks the three dials /api/analyze cannot honour, each with its reason", () => {
    armVideo();
    const reasons = screen
      .getAllByTestId("sim-locked")
      .map((el) => el.parentElement?.textContent ?? "");
    // lens · slice · scene — three locks, not a silently-inert dropdown among them.
    expect(reasons).toHaveLength(3);
    expect(reasons.join(" | ")).toContain("every behaviour at once");
    expect(reasons.join(" | ")).toContain("whole room");
    expect(reasons.join(" | ")).toContain("isn’t a dial here");
    // No live control for any of them.
    expect(screen.queryByText("or ask your own question…")).toBeNull();
  });

  it("states TEN reactors — the fold's real N, not the text projection's 10,000", () => {
    armVideo();
    const panel = screen.getByTestId("ambient-simulate");
    expect(panel.textContent).toContain("reactors");
    expect(panel.textContent).not.toContain("10,000");
    expect(panel.textContent).not.toContain("1,000 ");
  });

  it("keeps every dial LIVE for a text draft — the locks are the video path only", () => {
    render(<AmbientSimulate data={SIMULATE_R4} mode="cold" onSimulate={vi.fn()} />);
    fireEvent.click(screen.getByText("Screen a draft"));
    fireEvent.change(screen.getByLabelText("Paste the draft to screen"), { target: { value: "a draft" } });
    fireEvent.click(screen.getByText("Arm the run →"));
    // Only the fidelity chip is locked on the text path (Phase 1: text→Max has no live caller).
    expect(screen.queryAllByTestId("sim-locked")).toHaveLength(0);
    expect(screen.getByTestId("sim-fidelity-locked")).toBeTruthy();
    expect(screen.getByPlaceholderText("or ask your own question…")).toBeTruthy();
  });
});

// ── Phase 5: the ARM screen's budget — what the redesign must not give back ──────

/**
 * Three defects were measured on the live screen (2026-07-29, production build, 1512×900):
 * the footer restated 5 of 5 facts already on it (145–161px, 16–20% of the card), the audience
 * was named THREE ways at once, and the stimulus echo grew without a bound (112 → 295px across a
 * 42 → 430-character draft, against a LENS fixed at 187px — which is the whole of the "preamble
 * outweighs the lens 1.7:1" finding, and why clamping the echo is the fix that matches the cause).
 *
 * These are the kind of thing that creeps back one helpful sentence at a time, so each is held by
 * the property rather than by its wording.
 */
describe("the ARM screen's budget", () => {
  function armText() {
    render(<AmbientSimulate data={SIMULATE_R4} mode="cold" onSimulate={vi.fn()} />);
    fireEvent.click(screen.getByText("Screen a draft"));
    fireEvent.change(screen.getByLabelText("Paste the draft to screen"), { target: { value: "a draft" } });
    fireEvent.click(screen.getByText("Arm the run →"));
    return screen.getByTestId("ambient-simulate");
  }
  const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

  it("names the room ONCE — three registers for one set reads as three different things", () => {
    const panel = armText();
    // "Your audience" (the fixture's room) belongs to the conditions line and nowhere else.
    expect(occurrences(panel.textContent ?? "", SIMULATE_R4.room)).toBe(1);
    // And the two paraphrases that used to stand in for it are gone: the slice chip already
    // says "Everyone", so the caption must not also say "the whole room".
    expect(panel.textContent).not.toContain("the whole room");
  });

  it("does not echo the slice chip's own label back at it in the caption", () => {
    render(<AmbientSimulate data={SIMULATE_R4} mode="cold" onSimulate={vi.fn()} />);
    fireEvent.click(screen.getByText("Screen a draft"));
    fireEvent.change(screen.getByLabelText("Paste the draft to screen"), { target: { value: "a draft" } });
    fireEvent.click(screen.getByText("Arm the run →"));
    fireEvent.click(screen.getByText("Everyone")); // open the slice dropdown
    fireEvent.click(screen.getByText("Builders")); // a real signature slice, share 0.41
    const panel = screen.getByTestId("ambient-simulate");
    // The chip states the slice; the caption states the arithmetic. Exactly one of them names it.
    // CASE-INSENSITIVELY: the caption echoed the label LOWERCASED ("the builders slice · 41%…"),
    // so a case-sensitive count of "Builders" stays at 1 with the echo fully restored — this guard
    // passed against its own mutation until 2026-07-29.
    expect(occurrences((panel.textContent ?? "").toLowerCase(), "builders")).toBe(1);
    expect(panel.textContent).toContain("41% of the room");
  });

  it("spends the footer on the WAIT, not on restating the form above it", () => {
    const panel = armText();
    expect(panel.textContent).toContain("Reads in a few seconds");
    // The receipt named five facts, every one of which is on the screen already.
    expect(panel.textContent).not.toContain("Screening");
  });

  it("states the video wait instead — the two paths differ by minutes, and nothing said so", () => {
    render(<AmbientSimulate data={SIMULATE_R4} mode="cold" onSimulate={vi.fn()} />);
    fireEvent.click(screen.getByText("Test a real video"));
    fireEvent.change(screen.getByLabelText("Upload video file"), {
      target: { files: [new File(["x"], "my-clip.mp4", { type: "video/mp4" })] },
    });
    fireEvent.click(screen.getByText("Arm the run →"));
    expect(screen.getByTestId("ambient-simulate").textContent).toContain("1–3 minutes");
  });

  it("CLAMPS the stimulus echo — a 2,000-char draft must not crowd out the one loud dial", () => {
    const long = "x".repeat(1200);
    render(<AmbientSimulate data={SIMULATE_R4} mode="cold" onSimulate={vi.fn()} />);
    fireEvent.click(screen.getByText("Screen a draft"));
    fireEvent.change(screen.getByLabelText("Paste the draft to screen"), { target: { value: long } });
    fireEvent.click(screen.getByText("Arm the run →"));
    const echo = screen.getByTestId("sim-stimulus");
    // Clamped VISUALLY — the whole draft stays in the DOM, so nothing about it is hidden from
    // anything that reads the text; only its height is bounded.
    expect(echo.textContent).toBe(long);
    expect(echo.getAttribute("data-clamp")).toBe("3");
  });
});

// ── The host: what each stimulus is actually routed to ──────────────────────────

describe("SimulateDoorHost routing", () => {
  function mountHost() {
    // Spies kept as `vi.fn()` (not widened to the prop types) so `.mock` stays readable — the
    // ORDERING assertion below is the point, and it needs invocationCallOrder.
    const props = {
      audience,
      open: true,
      onClose: vi.fn(),
      onLanded: vi.fn().mockResolvedValue(undefined),
      onVideo: vi.fn(),
      ensureThread: vi.fn().mockResolvedValue(undefined),
    };
    render(<SimulateDoorHost {...props} />);
    return props;
  }

  function bringDraft(text = "a hook I wrote myself") {
    fireEvent.click(screen.getByText("Screen a draft"));
    fireEvent.change(screen.getByLabelText("Paste the draft to screen"), { target: { value: text } });
    fireEvent.click(screen.getByText("Arm the run →"));
    fireEvent.click(screen.getByText("Simulate"));
  }

  it("runs a draft through /api/tools/react WITH card:true — the half that de-orphans the seal", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ fraction: "6/10 stop", scrollQuote: "q", personas: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const props = mountHost();

    bringDraft("a hook I wrote myself");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/tools/react");
    const body = JSON.parse((init as { body: string }).body);
    expect(body.text).toBe("a hook I wrote myself");
    expect(body.card).toBe(true); // no card ⇒ no descriptor ⇒ the sealed row renders nowhere
    expect(body.persist).toBe(true); // no seal ⇒ the row never carries its measured verdict
    expect(body.pin).toBe(true);
    expect(body.cardKind).toBe("draft");
    expect(body.lens).toBeTruthy();
    expect(body.scene).toBeTruthy();

    // The thread has to exist BEFORE the run, or the card lands where the client is not looking.
    expect(props.ensureThread).toHaveBeenCalledTimes(1);
    expect(props.ensureThread.mock.invocationCallOrder[0]!).toBeLessThan(
      fetchMock.mock.invocationCallOrder[0]!,
    );
    // Landed ⇒ the host re-reads the thread (blocks AND seals) and closes.
    await waitFor(() => expect(props.onLanded).toHaveBeenCalledTimes(1));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("hands a VIDEO to the composer's pipeline and fetches nothing itself", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const props = mountHost();

    fireEvent.click(screen.getByText("Test a real video"));
    fireEvent.change(screen.getByLabelText("Paste a TikTok link"), {
      target: { value: "https://tiktok.com/@me/video/123" },
    });
    fireEvent.click(screen.getByText("Arm the run →"));
    fireEvent.click(screen.getByText("Simulate"));

    await waitFor(() => expect(props.onVideo).toHaveBeenCalledTimes(1));
    expect(props.onVideo).toHaveBeenCalledTimes(1);
    const brought = props.onVideo.mock.calls[0]![0] as { kind: string; url?: string };
    expect(brought.kind).toBe("video");
    expect(brought.url).toBe("https://tiktok.com/@me/video/123");
    // The ~2-minute Max pipeline is the composer's — duplicating it here would fork the money path.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(props.onLanded).not.toHaveBeenCalled();
  });

  it("raises THE WALL on a 402 — react costs a credit, and a refusal must not be silent", async () => {
    const quota = {
      error: "credit_quota_exceeded",
      message: "You're out of credits.",
      required: 1,
      remaining: 0,
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 402, json: async () => quota });
    vi.stubGlobal("fetch", fetchMock);
    const onWall = vi.fn();
    window.addEventListener(CREDIT_WALL_EVENT, onWall);
    const props = mountHost();

    bringDraft();

    await waitFor(() => expect(onWall).toHaveBeenCalledTimes(1));
    window.removeEventListener(CREDIT_WALL_EVENT, onWall);
    // Nothing landed and nothing closed: there is no verdict, and the wall IS the UI for this.
    expect(props.onLanded).not.toHaveBeenCalled();
  });
});
