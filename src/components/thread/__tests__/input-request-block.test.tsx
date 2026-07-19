/** @vitest-environment happy-dom */
/**
 * InputRequestBlockRenderer — the in-thread input affordance the chat agent surfaces (request_input).
 *
 * Locks the contract of each field kind: it renders inline, a submit runs the matching skill on its
 * own route (via the skill's stream hook / a fetch), and a clean completion reloads the host thread
 * (onComplete) then flips to the done receipt. Every stream hook + platform context is mocked so
 * nothing hits the network or the paid engine.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { InputRequestBlock } from "@/lib/tools/blocks";
import { validateBlock } from "@/lib/tools/block-registry";

// ── Mutable mock state per stream hook (flip fields, then render) ─────────────────
const remixState = { start: vi.fn(async () => {}), isStreaming: false, error: null as string | null, isDone: false, stages: [] as unknown[] };
const exploreState = { start: vi.fn(async () => {}), isStreaming: false, error: null as string | null, isDone: false, stages: [] as unknown[] };
const accountState = {
  start: vi.fn(async () => {}),
  isStreaming: false,
  error: null as string | null,
  fallbackMessage: null as string | null,
  block: null as unknown,
};
const analysisState = {
  start: vi.fn(async () => {}),
  phase: "idle" as string,
  analysisId: null as string | null,
  error: null as string | null,
  quotaError: null as { message: string } | null,
};

vi.mock("@/hooks/queries/use-remix-stream", () => ({ useRemixStream: () => remixState }));
vi.mock("@/hooks/queries/use-explore-stream", () => ({ useExploreStream: () => exploreState }));
vi.mock("@/hooks/queries/use-account-read-stream", () => ({ useAccountReadStream: () => accountState }));
vi.mock("@/hooks/queries/use-analysis-stream", () => ({ useAnalysisStream: () => analysisState }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    storage: { from: () => ({ upload: async () => ({ error: null }) }) },
  }),
}));
vi.mock("@/lib/platform-context", () => ({ usePlatform: () => "tiktok" }));

import { InputRequestBlockRenderer } from "../input-request-block";
import { InThreadInputContext } from "@/lib/in-thread-input-context";

function renderField(block: InputRequestBlock, onComplete = vi.fn()) {
  return render(
    <InThreadInputContext.Provider value={{ onComplete }}>
      <InputRequestBlockRenderer block={block} />
    </InThreadInputContext.Provider>,
  );
}

const REMIX: InputRequestBlock = {
  type: "input-request",
  props: { kind: "link", action: "remix", label: "Paste the video link", placeholder: "https://…", platform: "tiktok" },
};
const EXPLORE: InputRequestBlock = {
  type: "input-request",
  props: { kind: "text", action: "explore", label: "Name a niche", placeholder: "e.g. fitness…" },
};
const READ: InputRequestBlock = {
  type: "input-request",
  props: { kind: "text", action: "read", label: "What should I read?", placeholder: "Paste a concept…", prefill: "cold plunges" },
};
const ACCOUNT: InputRequestBlock = {
  type: "input-request",
  props: { kind: "none", action: "account", label: "I'll read your latest posts." },
};
const TEST: InputRequestBlock = {
  type: "input-request",
  props: { kind: "upload", action: "test", label: "Drop the video and I'll test it.", placeholder: "https://tiktok.com/…", platform: "tiktok" },
};

beforeEach(() => {
  cleanup();
  remixState.start = vi.fn(async () => {});
  remixState.isStreaming = false; remixState.error = null; remixState.isDone = false; remixState.stages = [];
  exploreState.start = vi.fn(async () => {});
  exploreState.isStreaming = false; exploreState.error = null; exploreState.isDone = false; exploreState.stages = [];
  accountState.start = vi.fn(async () => {});
  accountState.isStreaming = false; accountState.error = null; accountState.fallbackMessage = null; accountState.block = null;
  analysisState.start = vi.fn(async () => {});
  analysisState.phase = "idle"; analysisState.analysisId = null; analysisState.error = null; analysisState.quotaError = null;
  vi.restoreAllMocks();
});

describe("InputRequestBlockRenderer — schema", () => {
  it("the registry accepts every kind/action combination (round-trip)", () => {
    for (const b of [REMIX, EXPLORE, READ, ACCOUNT, TEST]) {
      expect(validateBlock(b).ok).toBe(true);
    }
  });
});

describe("Remix field (kind: link)", () => {
  it("renders the field + CTA; a URL submit runs the remix with the block's platform", () => {
    renderField(REMIX);
    expect(screen.getByLabelText("Paste the video link")).toBeTruthy();
    const input = screen.getByLabelText("Paste the video link") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://tiktok.com/@x/video/1" } });
    fireEvent.click(screen.getByText("Adapt it →"));
    expect(remixState.start).toHaveBeenCalledWith("https://tiktok.com/@x/video/1", "tiktok");
  });

  it("an empty field runs nothing", () => {
    renderField(REMIX);
    fireEvent.click(screen.getByText("Adapt it →"));
    expect(remixState.start).not.toHaveBeenCalled();
  });

  it("a clean completion reloads the thread once and shows the receipt", () => {
    const onComplete = vi.fn();
    remixState.isDone = true;
    renderField(REMIX, onComplete);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("input-request-done")).toBeTruthy();
    expect(screen.queryByText("Adapt it →")).toBeNull();
  });

  it("an error keeps the field (no reload) with plain-language copy", () => {
    const onComplete = vi.fn();
    remixState.error = "resolve_failed";
    renderField(REMIX, onComplete);
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/public video URL/i);
    expect(screen.getByText("Adapt it →")).toBeTruthy();
  });
});

describe("Explore field (kind: text, niche optional)", () => {
  it("an EMPTY niche is allowed — it runs an un-niched pull", () => {
    renderField(EXPLORE);
    fireEvent.click(screen.getByText("Scan it →"));
    expect(exploreState.start).toHaveBeenCalledWith({ niche: undefined });
  });

  it("a typed niche is passed through", () => {
    renderField(EXPLORE);
    fireEvent.change(screen.getByLabelText("Name a niche"), { target: { value: "  fitness coaches " } });
    fireEvent.click(screen.getByText("Scan it →"));
    expect(exploreState.start).toHaveBeenCalledWith({ niche: "fitness coaches" });
  });

  it("a clean completion reloads the thread and shows the receipt", () => {
    const onComplete = vi.fn();
    exploreState.isDone = true;
    renderField(EXPLORE, onComplete);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("input-request-done")).toBeTruthy();
  });
});

describe("Read field (kind: text, concept required)", () => {
  it("seeds the textarea from the model prefill", () => {
    renderField(READ);
    expect((screen.getByLabelText("What should I read?") as HTMLTextAreaElement).value).toBe("cold plunges");
  });

  it("submit POSTs the concept to /api/tools/read, then reloads on success", async () => {
    const onComplete = vi.fn();
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ block: {} }) }));
    vi.stubGlobal("fetch", fetchMock);
    renderField(READ, onComplete);
    fireEvent.click(screen.getByText("Read it →"));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tools/read",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ concept: "cold plunges" }) }),
    );
    expect(screen.getByTestId("input-request-done")).toBeTruthy();
  });

  it("an empty concept runs nothing", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderField({ ...READ, props: { ...READ.props, prefill: undefined } });
    fireEvent.click(screen.getByText("Read it →"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a route error keeps the field with the server message", async () => {
    const onComplete = vi.fn();
    const fetchMock = vi.fn(async () => ({ ok: false, json: async () => ({ error: "concept is required" }) }));
    vi.stubGlobal("fetch", fetchMock);
    renderField(READ, onComplete);
    fireEvent.click(screen.getByText("Read it →"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/concept is required/i));
    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe("Account field (kind: none — a confirm button)", () => {
  it("renders a run BUTTON and no text input", () => {
    renderField(ACCOUNT);
    expect(screen.getByText("Read my account →")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("the tap runs the account read asking the route to PERSIST", () => {
    renderField(ACCOUNT);
    fireEvent.click(screen.getByText("Read my account →"));
    expect(accountState.start).toHaveBeenCalledWith({ persist: true });
  });

  it("a returned block reloads the thread and shows the receipt", () => {
    const onComplete = vi.fn();
    accountState.block = { type: "account-read", props: {} };
    renderField(ACCOUNT, onComplete);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("input-request-done")).toBeTruthy();
  });

  it("a thin-history fallback is a calm status, not a reload", () => {
    const onComplete = vi.fn();
    accountState.fallbackMessage = "Not enough history to read yet.";
    renderField(ACCOUNT, onComplete);
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toMatch(/not enough history/i);
    // The run button is still available.
    expect(screen.getByText("Read my account →")).toBeTruthy();
  });
});

describe("Test field (kind: upload — a video file OR a TikTok URL)", () => {
  it("renders the video drop, a URL field, and the Test CTA", () => {
    renderField(TEST);
    expect(screen.getByText("Test it →")).toBeTruthy();
    expect(screen.getByPlaceholderText("https://tiktok.com/…")).toBeTruthy();
  });

  it("a TikTok URL submit runs the full analyze pipeline with tiktok_url mode", () => {
    renderField(TEST);
    fireEvent.change(screen.getByPlaceholderText("https://tiktok.com/…"), {
      target: { value: "https://tiktok.com/@x/video/1" },
    });
    fireEvent.click(screen.getByText("Test it →"));
    expect(analysisState.start).toHaveBeenCalledWith({
      input_mode: "tiktok_url",
      content_type: "video",
      tiktok_url: "https://tiktok.com/@x/video/1",
    });
  });

  it("an invalid URL and no file runs nothing (the CTA stays disabled)", () => {
    renderField(TEST);
    fireEvent.change(screen.getByPlaceholderText("https://tiktok.com/…"), {
      target: { value: "not a link" },
    });
    fireEvent.click(screen.getByText("Test it →"));
    expect(analysisState.start).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/tiktok video url/i);
  });

  it("on analysis complete it builds the in-thread card and reloads once", async () => {
    const onComplete = vi.fn();
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ block: { type: "video-test-card" } }) }));
    vi.stubGlobal("fetch", fetchMock);
    analysisState.phase = "complete";
    analysisState.analysisId = "an-1";
    renderField(TEST, onComplete);
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tools/test/card",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ analysisId: "an-1" }) }),
    );
    expect(screen.getByTestId("input-request-done")).toBeTruthy();
  });

  it("a degraded run (no honest reaction) shows the link-out, not a card or reload", async () => {
    const onComplete = vi.fn();
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ degraded: "no_audience_reaction", analysisId: "an-2" }) }));
    vi.stubGlobal("fetch", fetchMock);
    analysisState.phase = "complete";
    analysisState.analysisId = "an-2";
    renderField(TEST, onComplete);
    await waitFor(() => expect(screen.getByText("See the full breakdown →")).toBeTruthy());
    expect(onComplete).not.toHaveBeenCalled();
    expect((screen.getByText("See the full breakdown →") as HTMLAnchorElement).getAttribute("href")).toBe("/analyze/an-2");
  });
});

// ── The run-capsule waits (2026-07-19) — every field's in-flight state speaks the spine idiom ──
// Before this, remix/explore showed an unlabeled, unseeded spine; read/account a bare spinner
// line; and the Test field's ~2-minute Max run was ONE static sentence. These lock the upgrade:
// plan-seeded spines with the running label as the field header, and the one-row capsule for the
// stageless routes.

describe("Field run capsules", () => {
  it("remix mid-run: the FULL remix plan renders with the running label as header", () => {
    remixState.isStreaming = true;
    remixState.stages = [{ name: "Resolving", status: "active" }];
    renderField(REMIX);
    // Header swaps from the field question to the running label.
    expect(screen.getByText("Reworking the video")).toBeTruthy();
    // The whole pipeline is visible from the first live event (plan-seeded).
    for (const step of ["Resolving", "Decoding", "Adapting", "Simulating your audience"]) {
      expect(screen.getByText(step)).toBeTruthy();
    }
  });

  it("explore mid-run: plan-seeded spine + running label", () => {
    exploreState.isStreaming = true;
    exploreState.stages = [{ name: "Pulling outliers", status: "active" }];
    renderField(EXPLORE);
    expect(screen.getByText("Scanning for outliers")).toBeTruthy();
    expect(screen.getByText("Scoring for your audience")).toBeTruthy();
  });

  it("read mid-run: the one-row capsule (no spinner, no stale question)", async () => {
    // The read route is a plain POST — hold it open to observe the in-flight state.
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    renderField(READ);
    fireEvent.click(screen.getByText("Read it →"));
    expect(await screen.findByText("Reading it past your audience")).toBeTruthy();
    // The field question is gone while running (the capsule row carries the job).
    expect(screen.queryByText("What should I read?")).toBeNull();
    expect(screen.getByLabelText("Skill run progress")).toBeTruthy();
  });

  it("account mid-run: the one-row capsule", () => {
    accountState.isStreaming = true;
    renderField(ACCOUNT);
    expect(screen.getByText("Reading your account")).toBeTruthy();
    expect(screen.getByLabelText("Skill run progress")).toBeTruthy();
  });

  it("test mid-run (analyzing): the 3-step /analyze plan renders, step 1 active", () => {
    analysisState.phase = "analyzing";
    renderField(TEST);
    expect(screen.getByText("Testing your video")).toBeTruthy();
    for (const step of ["Fetching your video", "Watching it frame by frame", "Simulating your audience"]) {
      expect(screen.getByText(step)).toBeTruthy();
    }
    // Step 1 is the active one at t=0 (elapsed floors haven't advanced the spine yet).
    expect(screen.getByLabelText("Fetching your video: active")).toBeTruthy();
    expect(screen.getByLabelText("Watching it frame by frame: pending")).toBeTruthy();
  });
});
