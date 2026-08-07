/** @vitest-environment happy-dom */
/**
 * AudienceCreate — the /audience/new three-door flow (P4).
 *
 * Locks:
 *  - the three doors render with their one-line facts (no narration)
 *  - each door sends the RIGHT calibrate body: connect→personal, handle→target,
 *    describe→target/custom with the template's goal intent + auto-derived name
 *  - templates prefill the description (presets reborn as templates)
 *  - Instagram/YouTube on the connect door go to /api/connected-accounts/connect
 *    (analytics only — never the TikTok calibration pipeline)
 *  - the streaming card renders the ACCOUNT's own totals + covers + the pipeline spine
 *  - done → router.push to the audience detail (the detail page IS the reveal)
 *  - error → the quiet inline line, back on the form
 *  - page wiring: ?door= and the legacy ?source=account deep-link
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";
import type React from "react";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, back: vi.fn() }),
}));

import { AudienceCreate, nameFromDescription } from "../audience-create";
import NewAudiencePage from "@/app/(app)/audience/new/page";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sseResponse(
  frames: Array<{ event: string; data: unknown }>,
  opts: { hang?: boolean } = {},
): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const f of frames) {
        controller.enqueue(
          enc.encode(`event: ${f.event}\ndata: ${JSON.stringify(f.data)}\n\n`),
        );
      }
      if (!opts.hang) controller.close();
    },
  });
  return { ok: true, body: stream } as unknown as Response;
}

const EVIDENCE = {
  handle: "zachking",
  displayName: "Zach King",
  avatarUrl: "",
  followerCount: 86_100_000,
  heartCount: 1_300_000_000,
  videoCount: 610,
  videos: Array.from({ length: 12 }, (_, i) => ({ coverUrl: null, views: 1000 + i })),
};

async function typeHandle(value: string, label: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function clickContinue() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await Promise.resolve();
  });
}

beforeEach(() => {
  pushMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── nameFromDescription ──────────────────────────────────────────────────────

describe("nameFromDescription", () => {
  it("passes a short description through, collapsed to one line", () => {
    expect(nameFromDescription("Women 25–40 into  home training")).toBe(
      "Women 25–40 into home training",
    );
  });

  it("cuts a long description at a word boundary under 60 chars", () => {
    const name = nameFromDescription(
      "Women 25–40 into home strength training. Skeptical of fitness influencers, respond to form breakdowns.",
    );
    expect(name.length).toBeLessThanOrEqual(60);
    expect(name.endsWith(" ")).toBe(false);
    expect(name).not.toMatch(/\w-$/);
  });

  it("falls back when empty", () => {
    expect(nameFromDescription("   ")).toBe("Described audience");
  });
});

// ─── Doors ────────────────────────────────────────────────────────────────────

describe("AudienceCreate — doors", () => {
  it("renders the three doors with their one-line facts", () => {
    render(<AudienceCreate />);
    expect(screen.getByText("Connect account")).toBeInTheDocument();
    expect(screen.getByText("Built from your own content.")).toBeInTheDocument();
    expect(screen.getByText("From a handle")).toBeInTheDocument();
    expect(screen.getByText("Any public creator.")).toBeInTheDocument();
    expect(screen.getByText("From a description")).toBeInTheDocument();
    expect(screen.getByText("Define a target audience.")).toBeInTheDocument();
  });

  it("connect is the default door; picking another moves aria-pressed", () => {
    render(<AudienceCreate />);
    expect(screen.getByRole("button", { name: /Connect account/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: /From a description/ }));
    expect(screen.getByRole("button", { name: /From a description/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Connect account/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

// ─── Calibrate bodies per door ────────────────────────────────────────────────

describe("AudienceCreate — calibrate request per door", () => {
  it("connect + TikTok → personal calibration, name auto-derived from the handle", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    render(<AudienceCreate />);
    await typeHandle("@zachking", "Your @handle");
    await clickContinue();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/audiences/calibrate");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      handle: "zachking",
      type: "personal",
      platform: "tiktok",
      name: "@zachking",
    });
  });

  it("from a handle → a TARGET calibration (simulated, never personal)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    render(<AudienceCreate />);
    fireEvent.click(screen.getByRole("button", { name: /From a handle/ }));
    await typeHandle("someoneelse", "Creator @handle");
    await clickContinue();

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body).toMatchObject({ handle: "someoneelse", type: "target", platform: "tiktok" });
  });

  it("describe → target/custom; the template prefills the text and carries its goal intent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    render(<AudienceCreate />);
    fireEvent.click(screen.getByRole("button", { name: /From a description/ }));
    fireEvent.click(screen.getByRole("button", { name: "Conversion" }));

    const textarea = screen.getByLabelText("Describe the audience") as HTMLTextAreaElement;
    expect(textarea.value).toMatch(/Warm followers/);

    await clickContinue();

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body).toMatchObject({ type: "target", platform: "custom", goalIntent: "sell" });
    expect(body.name).toBe(nameFromDescription(textarea.value));
    expect(body.handle).toBeUndefined();
  });

  it("editing the description after picking a template drops the template's intent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    render(<AudienceCreate />);
    fireEvent.click(screen.getByRole("button", { name: /From a description/ }));
    fireEvent.click(screen.getByRole("button", { name: "Conversion" }));
    fireEvent.change(screen.getByLabelText("Describe the audience"), {
      target: { value: "Founders who hate hype." },
    });
    await clickContinue();

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.goalIntent).toBe("grow"); // back to the default, not the stale template
  });
});

// ─── Instagram / YouTube: analytics only ─────────────────────────────────────

describe("AudienceCreate — connect door, non-TikTok platforms", () => {
  it("Instagram goes to /api/connected-accounts/connect and lands on the account detail", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ account: { id: "acct-9" } }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<AudienceCreate />);
    // Open the platform select (combobox labelled by its placeholder) and pick Instagram.
    fireEvent.click(screen.getByRole("combobox", { name: "Platform" }));
    fireEvent.click(screen.getByRole("option", { name: /Instagram/ }));

    expect(screen.getByText("Analytics only.")).toBeInTheDocument();

    await typeHandle("zachking", "Your @handle");
    await clickContinue();

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/connected-accounts/connect");
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/audience/acct-9"));
  });
});

// ─── Streaming reveal ─────────────────────────────────────────────────────────

describe("AudienceCreate — streaming reveal", () => {
  it("shows the account's OWN totals — the profile count, never the scraped window", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([{ event: "evidence", data: EVIDENCE }], { hang: true }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AudienceCreate />);
    await typeHandle("zachking", "Your @handle");
    await clickContinue();

    await waitFor(() => expect(screen.getByTestId("reveal-figures")).toBeInTheDocument());
    expect(screen.getByText("Zach King")).toBeInTheDocument();
    expect(screen.getByText("@zachking")).toBeInTheDocument();
    expect(screen.getByText("86.1M")).toBeInTheDocument(); // followers
    expect(screen.getByText("1.3B")).toBeInTheDocument(); // likes

    // THE REGRESSION. The fixture carries videoCount 610 and a 12-post scrape window, and this
    // card used to render the window under a "Videos" label — so an account with 610 posts (or
    // @mrbeast's few thousand) announced "12". The payload always knew better.
    const figures = screen.getByTestId("reveal-figures");
    expect(within(figures).getByText("610")).toBeInTheDocument();
    expect(within(figures).queryByText("12")).not.toBeInTheDocument();

    expect(screen.getAllByTestId("calibration-cover")).toHaveLength(12);
  });

  it("draws the pipeline spine from the route's stage frames", async () => {
    // /audience/new consumed `status` and `evidence` and dropped every `stage` frame the route
    // sends, so the longest wait in the product rendered as a pulsing dot while /welcome — the
    // same SSE stream — drew the spine.
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse(
        [
          { event: "evidence", data: EVIDENCE },
          { event: "stage", data: { name: "Reading your followers", status: "done" } },
          { event: "stage", data: { name: "Watching your videos", status: "active" } },
        ],
        { hang: true },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AudienceCreate />);
    await typeHandle("zachking", "Your @handle");
    await clickContinue();

    await waitFor(() =>
      expect(screen.getByLabelText("Watching your videos: active")).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Reading your followers: done")).toBeInTheDocument();
    // The plan seeds the whole pipeline, so the step that has not started yet is still drawn.
    expect(screen.getByLabelText("Building your audience profile: pending")).toBeInTheDocument();
  });

  it("shows the plan before any account or stage frame has arrived", async () => {
    // The scrape takes ~126s to return the account. That whole first stretch used to be one
    // line of text; it is the plan now.
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([], { hang: true }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AudienceCreate />);
    await typeHandle("zachking", "Your @handle");
    await clickContinue();

    await waitFor(() => expect(screen.getByTestId("calibration-status")).toBeInTheDocument());
    expect(screen.getByLabelText("Reading your followers: active")).toBeInTheDocument();
  });

  it("done navigates to the new audience's detail page", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([{ event: "done", data: { audience: { id: "aud-7" } } }]),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AudienceCreate />);
    await typeHandle("zachking", "Your @handle");
    await clickContinue();

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/audience/aud-7"));
  });

  /**
   * The route writes THREE different error sentences and the difference is the point:
   * `platform_unsupported` and `synthesis_failed` both mean the handle is fine. Substituting
   * the local "Account not found. Check the handle" is a false accusation that costs the
   * creator another paid scrape — the route's own comment says so in as many words.
   *
   * ⚠️ This block previously fed `message: "nope"` and then asserted the HARDCODED sentence —
   * a fixture carrying a server message next to an assertion demanding it be discarded. It
   * passed for exactly the reason the bug existed.
   */
  it("error carries the ROUTE's own sentence, not the local one", async () => {
    const serverCopy =
      "We read @zachking fine — building the audience from it is what failed. Nothing is wrong with the handle; try again.";
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([{ event: "error", data: { message: serverCopy, retry: true } }]),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AudienceCreate />);
    await typeHandle("zachking", "Your @handle");
    await clickContinue();

    await waitFor(() =>
      expect(screen.getByTestId("create-error")).toHaveTextContent(serverCopy),
    );
    expect(screen.getByTestId("create-error")).not.toHaveTextContent("Account not found");
    // Back on the form — the doors are visible again.
    expect(screen.getByText("Connect account")).toBeInTheDocument();
  });

  it("platform_unsupported keeps the route's wording too", async () => {
    const serverCopy = "Maven can only build an audience from a TikTok account right now.";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([{ event: "error", data: { message: serverCopy, retry: false } }]),
      ),
    );

    render(<AudienceCreate />);
    await typeHandle("zachking", "Your @handle");
    await clickContinue();

    await waitFor(() =>
      expect(screen.getByTestId("create-error")).toHaveTextContent(serverCopy),
    );
  });

  /** No server sentence to carry (transport died) — the local copy is the honest fallback. */
  it("falls back to the local line when the frame carries no message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(sseResponse([{ event: "error", data: { retry: true } }])),
    );

    render(<AudienceCreate />);
    await typeHandle("zachking", "Your @handle");
    await clickContinue();

    await waitFor(() =>
      expect(screen.getByTestId("create-error")).toHaveTextContent(
        "Account not found. Check the handle — private accounts can't be read.",
      ),
    );
    expect(screen.getByText("Connect account")).toBeInTheDocument();
  });
});

// ─── Page wiring ──────────────────────────────────────────────────────────────

describe("/audience/new page wiring", () => {
  function findCreate(node: React.ReactNode): React.ReactElement | null {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) {
      for (const c of node) {
        const found = findCreate(c);
        if (found) return found;
      }
      return null;
    }
    const el = node as React.ReactElement;
    if ("type" in el && el.type === AudienceCreate) return el;
    return findCreate((el.props as { children?: React.ReactNode }).children);
  }

  it("?door=describe preselects the describe door", async () => {
    const tree = await NewAudiencePage({ searchParams: Promise.resolve({ door: "describe" }) });
    const create = findCreate(tree);
    expect((create!.props as { initialDoor?: string }).initialDoor).toBe("describe");
  });

  it("legacy ?source=account&handle=x lands on the connect door with the handle prefilled", async () => {
    const tree = await NewAudiencePage({
      searchParams: Promise.resolve({ source: "account", handle: "zachking" }),
    });
    const create = findCreate(tree);
    const props = create!.props as { initialDoor?: string; prefillHandle?: string };
    expect(props.initialDoor).toBe("connect");
    expect(props.prefillHandle).toBe("zachking");
  });

  it("absent params ⇒ no preselection (component defaults to connect)", async () => {
    const tree = await NewAudiencePage({ searchParams: Promise.resolve({}) });
    const create = findCreate(tree);
    expect((create!.props as { initialDoor?: string }).initialDoor).toBeUndefined();
  });

  it("legacy ?mode=general (the Build description path) lands on the describe door", async () => {
    const tree = await NewAudiencePage({ searchParams: Promise.resolve({ mode: "general" }) });
    const create = findCreate(tree);
    expect((create!.props as { initialDoor?: string }).initialDoor).toBe("describe");
  });
});
