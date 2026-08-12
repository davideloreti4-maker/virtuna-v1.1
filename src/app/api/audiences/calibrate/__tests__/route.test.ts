/**
 * route.test.ts — POST /api/audiences/calibrate (SSE) route-layer tests.
 *
 * The route layer had NO test until P4 (the per-persona lesson: an untested route
 * layer is where five-touchpoint props silently die). Covers:
 *   - auth gate (401) + body validation (400)
 *   - success path: SSE event order (status → evidence → done), audience persisted,
 *     connected account resolved, snapshot seeded
 *   - ONE-SCRAPE (P4): account_posts written from the SAME bundle calibration read
 *     (via onBundle) + pillars clustered — never a second scrape call
 *   - target path: NO connected account, NO posts archive
 *   - error / fallback / platform_unsupported event shapes (retry semantics)
 *   - best-effort isolation: a posts-archive failure never breaks the done event
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProfileBundle } from "@/lib/scraping/types";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/audience/calibration", () => ({
  calibrateFromScrape: vi.fn(),
}));

vi.mock("@/lib/audience/audience-repo", () => ({
  createAudience: vi.fn(),
  updateAudience: vi.fn(),
  listAudiences: vi.fn(),
}));

vi.mock("@/lib/account-metrics/account-metrics-repo", () => ({
  upsertAccountSnapshot: vi.fn(),
}));

vi.mock("@/lib/account-metrics/account-posts-repo", () => ({
  upsertAccountPosts: vi.fn(),
}));

vi.mock("@/lib/content-pillars/cluster", () => ({
  clusterPillarsForAccount: vi.fn(),
}));

vi.mock("@/lib/connected-accounts/connected-accounts-repo", () => ({
  getOrCreateConnectedAccount: vi.fn(),
  touchAccountSynced: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { calibrateFromScrape } from "@/lib/audience/calibration";
import { createAudience, updateAudience, listAudiences } from "@/lib/audience/audience-repo";
import { upsertAccountSnapshot } from "@/lib/account-metrics/account-metrics-repo";
import { upsertAccountPosts } from "@/lib/account-metrics/account-posts-repo";
import { clusterPillarsForAccount } from "@/lib/content-pillars/cluster";
import {
  getOrCreateConnectedAccount,
  touchAccountSynced,
} from "@/lib/connected-accounts/connected-accounts-repo";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockCalibrate = calibrateFromScrape as ReturnType<typeof vi.fn>;
const mockCreateAudience = createAudience as ReturnType<typeof vi.fn>;
const mockUpdateAudience = updateAudience as ReturnType<typeof vi.fn>;
const mockListAudiences = listAudiences as ReturnType<typeof vi.fn>;
const mockUpsertSnapshot = upsertAccountSnapshot as ReturnType<typeof vi.fn>;
const mockUpsertPosts = upsertAccountPosts as ReturnType<typeof vi.fn>;
const mockCluster = clusterPillarsForAccount as ReturnType<typeof vi.fn>;
const mockGetOrCreateAccount = getOrCreateConnectedAccount as ReturnType<typeof vi.fn>;
const mockTouchSynced = touchAccountSynced as ReturnType<typeof vi.fn>;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeSupabase(userId: string | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  };
}

function makeBundle(videoCount = 3): ProfileBundle {
  return {
    profile: {
      handle: "zachking",
      displayName: "Zach King",
      bio: "magic",
      avatarUrl: "https://cdn.example/a.jpg",
      verified: true,
      followerCount: 86_100_000,
      followingCount: 100,
      heartCount: 1_300_000_000,
      videoCount: 610,
    },
    videos: Array.from({ length: videoCount }, (_, i) => ({
      platformVideoId: `vid_${i}`,
      videoUrl: `https://tiktok.com/@zachking/video/${i}`,
      caption: `caption ${i}`,
      views: 1000 + i,
      likes: 100,
      comments: 10,
      shares: 5,
      saves: 3,
      hashtags: ["magic"],
      durationSeconds: 30,
      postedAt: new Date("2026-06-01"),
    })),
    subCoverage: "3/3",
  };
}

const SUCCESS_RESULT = {
  audience: {
    name: "@zachking",
    type: "personal",
    platform: "tiktok",
    mode: "socials",
  },
  reveal: {
    profile: {
      handle: "zachking",
      displayName: "Zach King",
      bio: "magic",
      avatarUrl: "https://cdn.example/a.jpg",
      verified: true,
      followerCount: 86_100_000,
      heartCount: 1_300_000_000,
      videoCount: 610,
    },
    posts: [],
  },
};

const PERSONAL_BODY = {
  handle: "zachking",
  type: "personal",
  platform: "tiktok",
  goalIntent: "grow",
  name: "@zachking",
};

async function callPOST(body: unknown): Promise<Response> {
  const { POST } = await import("../route");
  const req = new Request("http://localhost/api/audiences/calibrate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  return POST(req);
}

/** Drain the SSE stream into ordered { event, data } frames. */
async function readSse(res: Response): Promise<Array<{ event: string; data: Record<string, unknown> }>> {
  const text = await res.text();
  const frames: Array<{ event: string; data: Record<string, unknown> }> = [];
  for (const block of text.split("\n\n")) {
    const eventLine = block.split("\n").find((l) => l.startsWith("event: "));
    const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
    if (!eventLine || !dataLine) continue;
    frames.push({
      event: eventLine.slice(7).trim(),
      data: JSON.parse(dataLine.slice(6)) as Record<string, unknown>,
    });
  }
  return frames;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mockCreateClient.mockResolvedValue(makeSupabase("user-1"));
  mockCreateAudience.mockResolvedValue({ id: "aud-1", name: "@zachking" });
  mockUpdateAudience.mockResolvedValue({ id: "aud-1", name: "@zachking" });
  mockGetOrCreateAccount.mockResolvedValue({
    id: "acct-1",
    platform: "tiktok",
    handle: "zachking",
    is_primary: true,
  });
  mockUpsertSnapshot.mockResolvedValue(undefined);
  mockUpsertPosts.mockResolvedValue(undefined);
  mockCluster.mockResolvedValue({ status: "clustered", pillarCount: 5, assigned: 3 });
  mockListAudiences.mockResolvedValue([]);
});

describe("POST /api/audiences/calibrate — gates", () => {
  it("401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase(null));
    const res = await callPOST(PERSONAL_BODY);
    expect(res.status).toBe(401);
  });

  it("400 on an invalid body", async () => {
    const res = await callPOST({ type: "nope" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/audiences/calibrate — success path (SSE)", () => {
  it("streams status → stage → evidence → stage(done) → done, and persists the audience", async () => {
    const bundle = makeBundle();
    mockCalibrate.mockImplementation(async (_input, deps) => {
      deps?.onStage?.("scraping");
      deps?.onEvidence?.({
        handle: "zachking",
        displayName: "Zach King",
        avatarUrl: "",
        followerCount: 86_100_000,
        heartCount: 1_300_000_000,
        videoCount: 610,
        videos: bundle.videos.map((v) => ({ coverUrl: null, views: v.views })),
      });
      deps?.onBundle?.(bundle);
      return SUCCESS_RESULT;
    });

    const res = await callPOST(PERSONAL_BODY);
    const frames = await readSse(res);
    const names = frames.map((f) => f.event);

    // 4d (2026-08-01): the three phases now ALSO ride as `stage` frames, so the ~126s wait can
    // render as the same progress spine as every other wait. `status` is unchanged and still
    // first — calibration-flow falls back to it when no stage frame has arrived.
    expect(names).toEqual(["status", "stage", "evidence", "stage", "done"]);
    expect(frames.at(-1)!.data).toHaveProperty("audience");
    expect(mockCreateAudience).toHaveBeenCalledTimes(1);

    // The opening phase goes ACTIVE (no preceding step, so no inferred `done` before it)…
    expect(frames[1]!.data).toEqual({ name: "Reading your followers", status: "active" });
    // …and the last plan step lands before the run settles, so no row is left spinning.
    expect(frames[3]!.data).toEqual({
      name: "Building your audience profile",
      status: "done",
    });

    // The evidence frame carries the reveal figures (heart + video counts).
    const evidence = frames[2]!.data;
    expect(evidence.heartCount).toBe(1_300_000_000);
    expect(evidence.videoCount).toBe(610);
  });

  it("infers each phase's COMPLETION from the next one starting", async () => {
    // calibrateFromScrape's onStage fires only on a phase BEGINNING, so nothing ever reports a
    // finish. The route closes the previous row when the next opens — a real boundary the
    // pipeline crossed, not a guess — otherwise every finished step would stay `active` and the
    // spine would show three live rows at once.
    mockCalibrate.mockImplementation(async (_input, deps) => {
      deps?.onStage?.("scraping");
      deps?.onStage?.("watching");
      deps?.onStage?.("synthesizing");
      return SUCCESS_RESULT;
    });

    const frames = await readSse(await callPOST(PERSONAL_BODY));
    const stages = frames.filter((f) => f.event === "stage").map((f) => f.data);

    expect(stages).toEqual([
      { name: "Reading your followers", status: "active" },
      { name: "Reading your followers", status: "done" },
      { name: "Watching your videos", status: "active" },
      { name: "Watching your videos", status: "done" },
      { name: "Building your audience profile", status: "active" },
      { name: "Building your audience profile", status: "done" },
    ]);
  });

  it("ONE SCRAPE: archives account_posts from the bundle calibration read, then clusters pillars", async () => {
    const bundle = makeBundle(3);
    mockCalibrate.mockImplementation(async (_input, deps) => {
      deps?.onBundle?.(bundle);
      return SUCCESS_RESULT;
    });

    const res = await callPOST(PERSONAL_BODY);
    await readSse(res);

    // Posts written from the SAME videos the calibration watched — keyed to the account.
    expect(mockUpsertPosts).toHaveBeenCalledTimes(1);
    const [, accountId, userId, platform, handle, videos] = mockUpsertPosts.mock.calls[0]!;
    expect(accountId).toBe("acct-1");
    expect(userId).toBe("user-1");
    expect(platform).toBe("tiktok");
    expect(handle).toBe("zachking");
    expect(videos).toBe(bundle.videos);

    // Pillars clustered right after, so the detail page is lit at creation.
    expect(mockCluster).toHaveBeenCalledWith(expect.anything(), "user-1", "acct-1");

    // A successful scrape IS a sync — the SYNC rail's "Last" fact must not read "—".
    expect(mockTouchSynced).toHaveBeenCalledWith(expect.anything(), "acct-1");
  });

  it("re-connecting a synced handle UPDATES the canonical audience — one connection, one audience", async () => {
    // The account already manifests as an audience. A second connect-door run must
    // re-calibrate THAT row, not strand a duplicate behind audienceForAccount.
    mockListAudiences.mockResolvedValue([
      {
        id: "aud-existing",
        user_id: "user-1",
        name: "@zachking",
        type: "personal",
        mode: "socials",
        platform: "tiktok",
        is_general: false,
        is_preset: false,
        source_account_id: "acct-1",
        personas: [{ archetype: "fyp" }],
        profile: null,
        calibration: { source: "scrape", handle: "zachking" },
      },
    ]);
    mockCalibrate.mockResolvedValue(SUCCESS_RESULT);

    const res = await callPOST(PERSONAL_BODY);
    const frames = await readSse(res);

    expect(frames.map((f) => f.event)).toContain("done");
    expect(mockUpdateAudience).toHaveBeenCalledTimes(1);
    expect(mockUpdateAudience.mock.calls[0]![1]).toBe("aud-existing");
    expect(mockCreateAudience).not.toHaveBeenCalled();
  });

  it("updates the draft row in place when audienceId is supplied (no orphan dupe)", async () => {
    mockCalibrate.mockResolvedValue(SUCCESS_RESULT);
    const res = await callPOST({
      ...PERSONAL_BODY,
      audienceId: "11111111-1111-4111-8111-111111111111",
    });
    await readSse(res);
    expect(mockUpdateAudience).toHaveBeenCalledTimes(1);
    expect(mockCreateAudience).not.toHaveBeenCalled();
  });

  it("a posts-archive failure never breaks the done event (best-effort)", async () => {
    const bundle = makeBundle();
    mockCalibrate.mockImplementation(async (_input, deps) => {
      deps?.onBundle?.(bundle);
      return SUCCESS_RESULT;
    });
    mockUpsertPosts.mockRejectedValue(new Error("db down"));

    const res = await callPOST(PERSONAL_BODY);
    const frames = await readSse(res);

    expect(frames.map((f) => f.event)).toContain("done");
  });
});

describe("POST /api/audiences/calibrate — target path (SIMULATED, no account)", () => {
  it("creates NO connected account and archives NO posts for a target audience", async () => {
    const bundle = makeBundle();
    mockCalibrate.mockImplementation(async (_input, deps) => {
      deps?.onBundle?.(bundle);
      return SUCCESS_RESULT;
    });

    const res = await callPOST({
      ...PERSONAL_BODY,
      type: "target",
      handle: "someoneelse",
    });
    const frames = await readSse(res);

    expect(frames.map((f) => f.event)).toContain("done");
    expect(mockGetOrCreateAccount).not.toHaveBeenCalled();
    // No account → the bundle has no first-class owner → no posts archive.
    expect(mockUpsertPosts).not.toHaveBeenCalled();
    expect(mockCluster).not.toHaveBeenCalled();
  });

  it("names the phases for the NICHE SEARCH when no handle was supplied", async () => {
    // A described audience has no account behind it: calibrateFromScrape takes its `else` branch
    // and runs scrapeNiche over the description, then builds a SYNTHETIC profile. Emitting
    // "Reading your followers" / "Pulling the account and its posts" there described work that
    // was not happening — caught on the live /welcome run once onboarding put this path in front
    // of every new account that skips the handle.
    mockCalibrate.mockImplementation(async (_input, deps) => {
      deps?.onStage?.("scraping");
      deps?.onStage?.("watching");
      deps?.onStage?.("synthesizing");
      return SUCCESS_RESULT;
    });

    const frames = await readSse(
      await callPOST({
        ...PERSONAL_BODY,
        type: "target",
        platform: "custom",
        handle: undefined,
        description: "Small business owners who want to grow on TikTok",
      }),
    );

    const stageNames = frames
      .filter((f) => f.event === "stage")
      .map((f) => f.data.name as string);
    expect([...new Set(stageNames)]).toEqual([
      "Finding videos in that niche",
      "Watching what performs there",
      "Building your audience profile",
    ]);

    // The status line has to move with them, or the spine and the line under it disagree.
    const statuses = frames.filter((f) => f.event === "status").map((f) => f.data.message);
    expect(statuses).toContain("Searching for videos in that niche…");
    expect(statuses.join(" ")).not.toContain("followers");
  });

  it("keeps the ACCOUNT vocabulary for a target audience built from a real handle", async () => {
    // /audience/new's "From a handle" door: type=target, but a real account IS being read.
    // The discriminator is the handle, never the type.
    mockCalibrate.mockImplementation(async (_input, deps) => {
      deps?.onStage?.("scraping");
      return SUCCESS_RESULT;
    });

    const frames = await readSse(
      await callPOST({ ...PERSONAL_BODY, type: "target", handle: "someoneelse" }),
    );

    expect(frames.filter((f) => f.event === "stage").map((f) => f.data.name)).toContain(
      "Reading your followers",
    );
  });
});

describe("POST /api/audiences/calibrate — failure shapes", () => {
  it("scrape_failed → error event with retry:true, nothing persisted", async () => {
    mockCalibrate.mockResolvedValue({ error: "scrape_failed" });
    const res = await callPOST(PERSONAL_BODY);
    const frames = await readSse(res);

    // The mock emits no stages, so the error frame stands alone.
    expect(frames).toHaveLength(1);
    expect(frames.at(-1)!.event).toBe("error");
    expect(frames.at(-1)!.data.retry).toBe(true);
    expect(mockCreateAudience).not.toHaveBeenCalled();
    expect(mockUpsertPosts).not.toHaveBeenCalled();
  });

  it("platform_unsupported → error with retry:false and the domain's own message", async () => {
    mockCalibrate.mockResolvedValue({
      error: "platform_unsupported",
      message: "Maven can only build an audience from a TikTok account right now.",
    });
    const res = await callPOST({ ...PERSONAL_BODY, platform: "instagram" });
    const frames = await readSse(res);

    const err = frames.find((f) => f.event === "error");
    expect(err!.data.retry).toBe(false);
    expect(String(err!.data.message)).not.toContain("check the handle");
  });

  it("thin fallback → fallback event, no account, no posts", async () => {
    mockCalibrate.mockResolvedValue({ fallback: "general", reason: "thin" });
    const res = await callPOST(PERSONAL_BODY);
    const frames = await readSse(res);

    expect(frames.find((f) => f.event === "fallback")).toBeTruthy();
    expect(mockGetOrCreateAccount).not.toHaveBeenCalled();
    expect(mockUpsertPosts).not.toHaveBeenCalled();
  });
});
