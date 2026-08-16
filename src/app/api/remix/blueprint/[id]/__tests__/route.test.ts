/**
 * route.test.ts — GET /api/remix/blueprint/[id], the read side of the shoot sheet.
 *
 * The contract has THREE outcomes, and the whole point of this file is that the third one is not
 * folded back into the second:
 *   200 — the row, reduced to `script` + `blueprint`
 *   404 — `getBlueprint` returned null: no such row FOR THIS USER (ownership is enforced by the
 *         repo's `user_id` predicate, so someone else's id is a 404 and not a leak)
 *   500 — `getBlueprint` THREW. Task 4 made it throw on everything except PGRST116 precisely so an
 *         unapplied migration is loud. The brief called it bare, which is an unhandled rejection;
 *         catching it back into a 404 would restore the exact silence that deviation removed —
 *         a remix card with no shoot sheet and no error anywhere, looking unbuilt rather than
 *         broken.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn(() => ({ tag: "service" })) }));
vi.mock("@/lib/remix/blueprint-repo", () => ({ getBlueprint: vi.fn() }));
vi.mock("@/lib/engine/filmstrip/storage", () => ({
  signAnalysisFrames: vi.fn(),
  signScrubFrames: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { getBlueprint } from "@/lib/remix/blueprint-repo";
import { signAnalysisFrames, signScrubFrames } from "@/lib/engine/filmstrip/storage";
import { GET } from "../route";
import type { BlueprintRow } from "@/lib/remix/blueprint-repo";
import { emptyBlueprint } from "@/lib/engine/remix/blueprint";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockGetBlueprint = getBlueprint as ReturnType<typeof vi.fn>;
const mockCapture = Sentry.captureException as unknown as ReturnType<typeof vi.fn>;
const mockSignFrames = signAnalysisFrames as ReturnType<typeof vi.fn>;
const mockSignScrub = signScrubFrames as ReturnType<typeof vi.fn>;

const USER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ID = "abc123def456";

function signedIn(userId: string | null = USER) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  });
}

const call = (id: string = ID) =>
  GET(new Request(`http://localhost/api/remix/blueprint/${id}`), {
    params: Promise.resolve({ id }),
  });

function makeRow(): BlueprintRow {
  return {
    id: ID,
    user_id: USER,
    thread_id: "00000000-0000-0000-0000-0000000000bb",
    source_video_id: "https://www.tiktok.com/@x/video/123",
    blueprint: emptyBlueprint(),
    script: [[{ index: 0, spoken: "a line", on_screen_text: "", shot: "waist-up" }]],
    clip_uris: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: a sheet with no frames — every row written before phase 3, and the shape the
  // renderer must keep handling forever.
  mockSignFrames.mockResolvedValue({});
  mockSignScrub.mockResolvedValue({});
});

describe("GET /api/remix/blueprint/[id]", () => {
  it("401s before touching the database when signed out", async () => {
    signedIn(null);
    const res = await call();
    expect(res.status).toBe(401);
    expect(mockGetBlueprint).not.toHaveBeenCalled();
  });

  it("400s on an id that is not the nanoid shape", async () => {
    signedIn();
    const res = await call("../../etc/passwd");
    expect(res.status).toBe(400);
    expect(mockGetBlueprint).not.toHaveBeenCalled();
  });

  it("scopes the read to the caller", async () => {
    signedIn();
    mockGetBlueprint.mockResolvedValue(makeRow());
    await call();
    // The third argument is what stops a known id being a cross-user read — RLS does not apply,
    // both phase-1 call sites use the service client.
    expect(mockGetBlueprint).toHaveBeenCalledWith({ tag: "service" }, ID, USER);
  });

  it("returns the script and the blueprint, and nothing else off the row", async () => {
    signedIn();
    const row = makeRow();
    mockGetBlueprint.mockResolvedValue(row);

    const res = await call();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({
      script: row.script,
      blueprint: row.blueprint,
      frames: {},
      scrubFrames: {},
      sourceUrl: row.source_video_id,
    });
    // The point of this assertion is `user_id` / `thread_id` NEVER crossing the wire. Phase 3
    // widened the contract by exactly one key and the source viewer by exactly two more; it must
    // stay an exact set, not a subset check.
    expect(Object.keys(body).sort()).toEqual([
      "blueprint",
      "frames",
      "script",
      "scrubFrames",
      "sourceUrl",
    ]);
  });

  it("serves the source URL so the embed can name its own platform", async () => {
    // Deliberately the ROW's `source_video_id`, not the request's `platform` flag: every launch
    // hardcodes `PLATFORM = "tiktok"` while 63% of the corpus is Instagram, so the flag would
    // hand an Instagram source a TikTok player.
    signedIn();
    const row = makeRow();
    row.source_video_id = "https://www.instagram.com/reel/DZK33LctVEo/";
    mockGetBlueprint.mockResolvedValue(row);

    const body = (await (await call()).json()) as { sourceUrl: string | null };
    expect(body.sourceUrl).toBe("https://www.instagram.com/reel/DZK33LctVEo/");
  });

  it("serves a null source URL rather than omitting the key", async () => {
    // `source_video_id` is nullable on the table. An absent key and a null key are the same to
    // the renderer, but only one of them keeps the response shape stable.
    signedIn();
    const row = makeRow();
    row.source_video_id = null;
    mockGetBlueprint.mockResolvedValue(row);

    const body = (await (await call()).json()) as Record<string, unknown>;
    expect(body.sourceUrl).toBeNull();
    expect("sourceUrl" in body).toBe(true);
  });

  it("serves the scrub strip from its OWN prefix, alongside the beat frames", async () => {
    // Two independent listings of the same bucket. The scrub set is keyed by grid index and the
    // beat set by beat index; they must not be merged, or ~30 scrub frames would mask beats 0-7.
    signedIn();
    mockGetBlueprint.mockResolvedValue(makeRow());
    mockSignFrames.mockResolvedValue({ 0: "https://signed/0.jpg" });
    mockSignScrub.mockResolvedValue({ 0: "https://signed/scrub/0.jpg", 1: "https://signed/scrub/1.jpg" });

    const body = (await (await call()).json()) as {
      frames: Record<string, string>;
      scrubFrames: Record<string, string>;
    };

    expect(body.frames).toEqual({ 0: "https://signed/0.jpg" });
    expect(body.scrubFrames).toEqual({
      0: "https://signed/scrub/0.jpg",
      1: "https://signed/scrub/1.jpg",
    });
    expect(mockSignScrub).toHaveBeenCalledWith(ID);
  });

  it("a scrub-signing failure costs the strip and nothing else", async () => {
    signedIn();
    const row = makeRow();
    mockGetBlueprint.mockResolvedValue(row);
    mockSignScrub.mockRejectedValue(new Error("storage down"));

    const res = await call();
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.script).toEqual(row.script);
    expect(body.scrubFrames).toEqual({});
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("serves the beat frames, keyed by beat index, signed at READ time", async () => {
    signedIn();
    mockGetBlueprint.mockResolvedValue(makeRow());
    mockSignFrames.mockResolvedValue({ 0: "https://signed/0.jpg", 2: "https://signed/2.jpg" });

    const res = await call();
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.frames).toEqual({ 0: "https://signed/0.jpg", 2: "https://signed/2.jpg" });
    // Signed against the BLUEPRINT id — the storage prefix phase 3 wrote under. Signing the
    // wrong prefix returns {} and the sheet silently loses every frame.
    expect(mockSignFrames).toHaveBeenCalledWith(ID);
  });

  it("PARTIAL frame sets are served as-is — a gap is a beat, not a failure", async () => {
    // Extraction is capped and budgeted, and any single ffmpeg seek can miss. The route must not
    // treat a hole as a fault and drop the whole set: the row renders a play-tile for beat 1 and
    // real frames either side of it.
    signedIn();
    mockGetBlueprint.mockResolvedValue(makeRow());
    mockSignFrames.mockResolvedValue({ 0: "https://signed/0.jpg", 2: "https://signed/2.jpg" });

    const body = (await (await call()).json()) as { frames: Record<string, string> };
    expect(Object.keys(body.frames)).toEqual(["0", "2"]);
  });

  it("a frame-signing FAILURE still serves the text sheet — never a 500", async () => {
    // The frames are an enhancement over a sheet that was a complete product without them. A
    // storage outage must cost the frames and nothing else; 500ing here would delete the shoot
    // sheet from the card over a missing thumbnail.
    signedIn();
    const row = makeRow();
    mockGetBlueprint.mockResolvedValue(row);
    mockSignFrames.mockRejectedValue(new Error("storage down"));

    const res = await call();
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.script).toEqual(row.script);
    expect(body.frames).toEqual({});
    // Not worth a Sentry event: it is a logged degrade, not a fault in this route.
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("404s when there is no such row for this user", async () => {
    signedIn();
    mockGetBlueprint.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(404);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("500s and reports when the read THROWS — never 404", async () => {
    // The live shape of this is an unapplied migration: PostgREST answers PGRST205 for an unknown
    // table and getBlueprint throws. A 404 here would render as "this card has no sheet" forever.
    signedIn();
    mockGetBlueprint.mockRejectedValue(new Error("remix_blueprints read failed: relation does not exist"));

    const res = await call();
    expect(res.status).toBe(500);
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });
});
