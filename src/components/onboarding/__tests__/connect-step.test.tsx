/** @vitest-environment happy-dom */
/**
 * Onboarding step 1 (ConnectStep) + the autoStart handoff into CalibrationFlow.
 *
 * What these lock, and why each one is here:
 *  - the personal door creates a DRAFT AUDIENCE, not just a `creator_profiles.tiktok_handle`
 *    string. That string being inert — read only by /competitors — is the entire defect this
 *    lane exists to fix, so the assertion is on the POST body, not on the store write.
 *  - the describe door exists and posts type=target/platform=custom. It is the skip path: the
 *    old "Skip for now" completed onboarding having set up nothing, which left the product
 *    permanently showing "Not tested yet".
 *  - handle validation still rejects junk BEFORE spending a request.
 *  - 💰 CalibrationFlow's autoStart fires EXACTLY ONCE. Calibration is a real Apify scrape on a
 *    $5/mo capped account and React StrictMode double-invokes mount effects — a regression here
 *    doubles the cost of every signup, silently and only in production-like conditions.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { StrictMode } from "react";

import { ConnectStep } from "../connect-step";
import { CalibrationFlow } from "@/components/audience/calibration-flow";
import type { Audience } from "@/lib/audience/audience-types";
import { __funnelBuffer, __resetFunnel } from "@/lib/analytics/funnel-events";

// The store persists to Supabase on every setter — stub the client out.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({ update: () => ({ eq: async () => ({}) }) }),
  }),
}));

const DRAFT = {
  id: "aud-1",
  name: "@zachking",
  type: "personal",
  platform: "tiktok",
  goal_intent: "grow",
} as unknown as Audience;

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as unknown as Response;
}

/** An SSE body that never closes — enough to observe that a run STARTED. */
function hangingSse(): Response {
  const stream = new ReadableStream<Uint8Array>({ start() { /* never closes */ } });
  return { ok: true, body: stream } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ─── Step 1: the draft ────────────────────────────────────────────────────────

describe("ConnectStep — the personal door", () => {
  it("creates a draft audience and hands it up with the handle prefilled", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ audience: DRAFT }));
    const onDraftReady = vi.fn();

    render(<ConnectStep onDraftReady={onDraftReady} />);

    fireEvent.change(screen.getByPlaceholderText("@yourhandle"), {
      target: { value: "@zachking" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(onDraftReady).toHaveBeenCalledTimes(1));

    // The POST that matters: a real audience row, not a string on the profile.
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/audiences");
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      name: "@zachking",
      type: "personal",
      platform: "tiktok",
    });

    // The @ is stripped before it travels, and the prefill carries into step 2.
    expect(onDraftReady).toHaveBeenCalledWith(DRAFT, { handle: "zachking" });
  });

  it("rejects a malformed handle without spending a request", () => {
    const onDraftReady = vi.fn();
    render(<ConnectStep onDraftReady={onDraftReady} />);

    fireEvent.change(screen.getByPlaceholderText("@yourhandle"), {
      target: { value: "not a handle!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(screen.getByText(/letters, numbers, dots/i)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDraftReady).not.toHaveBeenCalled();
  });
});

describe("ConnectStep — the describe door (the skip path)", () => {
  it("swaps to a textarea and creates a TARGET audience with no handle behind it", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ audience: DRAFT }));
    const onDraftReady = vi.fn();

    render(<ConnectStep onDraftReady={onDraftReady} />);

    fireEvent.click(screen.getByRole("button", { name: /describe who you're making for/i }));

    const textarea = screen.getByLabelText(/who are you making for/i);
    fireEvent.change(textarea, {
      target: { value: "Small business owners who want to grow on TikTok" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(onDraftReady).toHaveBeenCalledTimes(1));

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    // type "target" + platform "custom" sends calibrateFromScrape down its no-handle branch:
    // a niche SEARCH over the description rather than a profile read.
    // ⚠️ Not free. That branch still calls scrapeNiche → Apify (calibration.ts:344). The door's
    // value is that it works with no account and no public profile, NOT that it costs nothing.
    expect(body).toMatchObject({ type: "target", platform: "custom" });
    expect(onDraftReady.mock.calls[0]![1]).toEqual({
      description: "Small business owners who want to grow on TikTok",
    });
  });

  it("offers a route back to the handle door", () => {
    render(<ConnectStep onDraftReady={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /describe who you're making for/i }));
    expect(screen.getByRole("button", { name: /use my tiktok handle instead/i })).toBeTruthy();
  });
});

describe("ConnectStep — recovering onto the other door", () => {
  it("PATCHes the existing draft instead of stranding a second audience row", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ audience: { ...DRAFT, type: "target" } }));
    const onDraftReady = vi.fn();

    // What /welcome passes after a failed personal run: the draft travels with the user.
    render(
      <ConnectStep onDraftReady={onDraftReady} initialDoor="target" existingDraft={DRAFT} />,
    );

    fireEvent.change(screen.getByLabelText(/who are you making for/i), {
      target: { value: "Indie game developers shipping their first title" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(onDraftReady).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/audiences/aud-1");
    expect((init as RequestInit).method).toBe("PATCH");
    // The row is converted in place — personal/tiktok becomes target/custom.
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      type: "target",
      platform: "custom",
    });
  });

  it("opens on the door it was sent to", () => {
    render(<ConnectStep onDraftReady={vi.fn()} initialDoor="target" existingDraft={DRAFT} />);
    expect(screen.getByLabelText(/who are you making for/i)).toBeTruthy();
  });
});

// ─── Step 2: the handoff ──────────────────────────────────────────────────────

describe("CalibrationFlow — autoStart", () => {
  it("💰 starts exactly one calibration under StrictMode's double mount", async () => {
    fetchMock.mockResolvedValue(hangingSse());

    await act(async () => {
      render(
        <StrictMode>
          <CalibrationFlow
            audience={DRAFT}
            autoStart
            prefillHandle="zachking"
            onDone={vi.fn()}
            onSkip={vi.fn()}
          />
        </StrictMode>,
      );
    });

    const calibrateCalls = fetchMock.mock.calls.filter(
      ([url]) => url === "/api/audiences/calibrate",
    );
    expect(calibrateCalls).toHaveLength(1);
    // …and it used the handle the previous step collected, rather than re-asking for it.
    expect(JSON.parse((calibrateCalls[0]![1] as RequestInit).body as string)).toMatchObject({
      handle: "zachking",
      audienceId: "aud-1",
    });
  });

  it("offers the recovery door when a run falls back to General, and makes it the primary", async () => {
    // The thin-data fallback is the LIKELY first-run outcome (isThin = no follower tier and
    // <10 videos — a new creator). Ending it at "Continue with General" hands them the
    // uncalibrated product onboarding exists to prevent.
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(
          new TextEncoder().encode(
            'event: fallback\ndata: {"reason":"thin","message":"Not enough public activity."}\n\n',
          ),
        );
        c.close();
      },
    });
    fetchMock.mockResolvedValue({ ok: true, body: stream } as unknown as Response);
    const onSecondary = vi.fn();

    await act(async () => {
      render(
        <CalibrationFlow
          audience={DRAFT}
          autoStart
          prefillHandle="zachking"
          onDone={vi.fn()}
          onSkip={vi.fn()}
          secondaryAction={{ label: "Describe your audience instead", onClick: onSecondary }}
        />,
      );
    });

    const recover = await screen.findByRole("button", {
      name: /describe your audience instead/i,
    });
    fireEvent.click(recover);
    expect(onSecondary).toHaveBeenCalledTimes(1);

    // General is still reachable, but it is no longer the recommended ending.
    expect(screen.getByRole("button", { name: /continue with general/i })).toBeTruthy();
  });

  it("does not fire without the flag (existing callers keep their idle form)", async () => {
    await act(async () => {
      render(
        <CalibrationFlow audience={DRAFT} prefillHandle="zachking" onDone={vi.fn()} onSkip={vi.fn()} />,
      );
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /calibrate audience/i })).toBeTruthy();
  });
});

// ─── The funnel bracket ───────────────────────────────────────────────────────

/**
 * `handle_submit` is the OPENING bracket of the ~128s blocking calibration that follows this
 * step. Its closing bracket is `calibrate_done` (welcome/page.tsx). Both were declared in
 * FUNNEL_EVENTS when the funnel was designed and, until 2026-08-13, emitted from nowhere — so the
 * most likely real drop-off point in the product had no denominator and no numerator.
 *
 * These tests exercise the REAL component and the REAL `track`/`__funnelBuffer` pair; the only
 * thing stubbed is `fetch`, which is the I/O boundary. Nothing here asserts against a mock of our
 * own code, because a green suite built on that proves nothing about whether the event ships.
 */
describe("ConnectStep — the funnel bracket", () => {
  beforeEach(() => __resetFunnel());
  afterEach(() => __resetFunnel());

  it("emits handle_submit with the personal door once the draft row exists", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ audience: DRAFT }));
    const onDraftReady = vi.fn();

    render(<ConnectStep onDraftReady={onDraftReady} />);
    fireEvent.change(screen.getByPlaceholderText("@yourhandle"), {
      target: { value: "@zachking" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(onDraftReady).toHaveBeenCalledTimes(1));

    const submits = __funnelBuffer().filter((e) => e.event === "handle_submit");
    expect(submits).toHaveLength(1);
    expect(submits[0]!.payload).toMatchObject({ door: "personal" });
  });

  it("labels the describe door separately — the two doors are different pipelines", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ audience: DRAFT }));
    const onDraftReady = vi.fn();

    render(<ConnectStep onDraftReady={onDraftReady} />);
    fireEvent.click(screen.getByRole("button", { name: /describe who you're making for/i }));
    fireEvent.change(screen.getByLabelText(/who are you making for/i), {
      target: { value: "people learning to cook on a budget" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(onDraftReady).toHaveBeenCalledTimes(1));

    const submits = __funnelBuffer().filter((e) => e.event === "handle_submit");
    expect(submits).toHaveLength(1);
    expect(submits[0]!.payload).toMatchObject({ door: "target" });
  });

  /**
   * THE ONE THAT DEFINES THE METRIC. A submit whose POST failed never entered the wait, so
   * counting it would inflate the denominator and understate the completion rate of the exact
   * step being measured — the failure mode would be a calibration drop that looks worse than it
   * is, chased instead of the real one. Hence the call sits after the `res.ok` check, not on
   * the button press.
   */
  it("does NOT emit when the draft POST fails — a submit that never started is not a submit", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) } as unknown as Response);
    const onDraftReady = vi.fn();

    render(<ConnectStep onDraftReady={onDraftReady} />);
    fireEvent.change(screen.getByPlaceholderText("@yourhandle"), {
      target: { value: "@zachking" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(screen.getByText(/couldn't start/i)).toBeTruthy());

    expect(onDraftReady).not.toHaveBeenCalled();
    expect(__funnelBuffer().filter((e) => e.event === "handle_submit")).toHaveLength(0);
  });
});
