/** @vitest-environment node */
/**
 * One library video with its beats, for its page: `getLibraryVideo(id, client?)`. The corpus
 * client is the boundary and is stood in: a recording client whose one query answers with the row
 * the test hands it. Everything else is real: `toCorpusVideo`'s honesty rules, `toCardVideo`, and
 * the template's schema.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getLibraryVideo } from "../library-video-read";
import type { LibraryVideo } from "../video";

interface Call {
  method: string;
  args: unknown[];
}

/** A corpus client stand-in: one query, answered with `result`; every call recorded. */
function standIn(result: { data: unknown; error: unknown }) {
  const calls: Call[] = [];
  const builder: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of ["select", "eq"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.maybeSingle = (...args: unknown[]) => {
    calls.push({ method: "maybeSingle", args });
    return Promise.resolve(result);
  };
  const client = {
    from: (...args: unknown[]) => {
      calls.push({ method: "from", args });
      return builder;
    },
  };
  return { client, calls };
}

const corpus = vi.hoisted(() => ({ getCorpusClient: vi.fn() }));
vi.mock("@/lib/grounding/corpus", () => ({ getCorpusClient: corpus.getCorpusClient }));

const ID = "3f2a9c1e-8b7d-4c6a-9e5f-1a2b3c4d5e6f";

const SELECT =
  "id, video_url, cover_url, creator_handle, spoken_hook, hook_template, hook_archetype, niche, views, platform, engagement_rate, posted_at, outlier_multiplier, baseline_label, why_it_works, template";

function template(beats: unknown) {
  return {
    name: "Correction",
    slots: [{ key: "mistake", label: "The mistake", example: "boiling pasta" }],
    skeleton: ["Hook", "Proof", "Fix"],
    guidance: "When the viewer is doing something wrong.",
    beats,
  };
}

/** A real-shaped `outlier_teardowns` row (numeric columns arrive as strings through PostgREST). */
function row(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    video_url: "https://www.tiktok.com/@nia.cooks/video/1",
    cover_url: "https://proj.supabase.co/storage/v1/object/public/covers/tiktok/1.jpg",
    creator_handle: "nia.cooks",
    spoken_hook: "Stop boiling your pasta like this",
    hook_template: "Stop [doing] like this",
    hook_archetype: "correction",
    niche: "food",
    views: 25_000_000,
    platform: "tiktok",
    engagement_rate: "0.041",
    posted_at: "2020-06-01T00:00:00Z",
    outlier_multiplier: "16.2",
    baseline_label: "vs their usual views",
    why_it_works: "  It opens on a mistake. The fix lands in the first beat.  ",
    template: template([
      { name: "Hook", description: "The mistake, on screen", startSec: 0, endSec: 3.5 },
      { name: "Proof", description: "Side by side", startSec: 3.5, endSec: 30 },
      { name: "Fix", description: "The right way", startSec: 30, endSec: 51 },
    ]),
    ...over,
  };
}

const FULL: LibraryVideo = {
  id: ID,
  coverUrl: "https://proj.supabase.co/storage/v1/object/public/covers/tiktok/1.jpg",
  handle: "nia.cooks",
  spokenHook: "Stop boiling your pasta like this",
  niche: "food",
  platform: "tiktok",
  views: 25_000_000,
  postedAt: "2020-06-01T00:00:00Z",
  multiplier: 16.2,
  baselineLabel: "vs their usual views",
  proven: true,
  extreme: false,
  formats: [],
  videoUrl: "https://www.tiktok.com/@nia.cooks/video/1",
  whyItWorks: "It opens on a mistake. The fix lands in the first beat.",
  beats: [
    { name: "Hook", startSec: 0, endSec: 3.5 },
    { name: "Proof", startSec: 3.5, endSec: 30 },
    { name: "Fix", startSec: 30, endSec: 51 },
  ],
};

beforeEach(() => {
  corpus.getCorpusClient.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("getLibraryVideo: the query", () => {
  it("asks for one extracted video by its id, with its why and its template", async () => {
    const { client, calls } = standIn({ data: row(), error: null });

    await getLibraryVideo(ID, client as never);

    expect(calls).toEqual([
      { method: "from", args: ["outlier_teardowns"] },
      { method: "select", args: [SELECT] },
      { method: "eq", args: ["id", ID] },
      { method: "eq", args: ["status", "extracted"] },
      { method: "maybeSingle", args: [] },
    ]);
  });

  it("reads through the corpus client when none is given", async () => {
    const { client, calls } = standIn({ data: row(), error: null });
    corpus.getCorpusClient.mockReturnValue(client);

    await expect(getLibraryVideo(ID)).resolves.toEqual(FULL);
    expect(corpus.getCorpusClient).toHaveBeenCalledTimes(1);
    expect(calls[0]).toEqual({ method: "from", args: ["outlier_teardowns"] });
  });

  it("answers null for an id that is not a library video's, without a query or a client", async () => {
    const { client, calls } = standIn({ data: row(), error: null });

    for (const bad of ["", "abc", "tiktok:7301", `${ID} `, `${ID}0`, "../etc"]) {
      await expect(getLibraryVideo(bad, client as never)).resolves.toBeNull();
      await expect(getLibraryVideo(bad)).resolves.toBeNull();
    }
    expect(calls).toEqual([]);
    expect(corpus.getCorpusClient).not.toHaveBeenCalled();
  });

  it("takes an id in capitals (a UUID is case-blind)", async () => {
    const { client, calls } = standIn({ data: row(), error: null });

    await getLibraryVideo(ID.toUpperCase(), client as never);

    expect(calls).toContainEqual({ method: "eq", args: ["id", ID.toUpperCase()] });
  });

  it("throws the read's error, so the page can say it couldn't load", async () => {
    const failure = { message: "PGRST: connection refused", code: "08006" };
    const { client } = standIn({ data: null, error: failure });

    await expect(getLibraryVideo(ID, client as never)).rejects.toBe(failure);
  });

  it("answers null when the library no longer holds the video", async () => {
    const { client } = standIn({ data: null, error: null });

    await expect(getLibraryVideo(ID, client as never)).resolves.toBeNull();
  });
});

describe("getLibraryVideo: the video", () => {
  it("maps a full row: the card's fields, the address, the why trimmed, the beats without descriptions", async () => {
    const { client } = standIn({ data: row(), error: null });

    await expect(getLibraryVideo(ID, client as never)).resolves.toEqual(FULL);
  });

  it("keeps the corpus's honesty rules: past 100 is clamped and marked, no basis is no number", async () => {
    const extreme = standIn({ data: row({ outlier_multiplier: 20154 }), error: null });
    await expect(getLibraryVideo(ID, extreme.client as never)).resolves.toMatchObject({
      multiplier: 100,
      proven: true,
      extreme: true,
    });

    const unbased = standIn({ data: row({ baseline_label: null }), error: null });
    await expect(getLibraryVideo(ID, unbased.client as never)).resolves.toMatchObject({
      multiplier: null,
      proven: false,
      extreme: false,
    });
  });

  it("reads an empty why as none", async () => {
    for (const why of [null, "", "   \n "]) {
      const { client } = standIn({ data: row({ why_it_works: why }), error: null });
      const video = await getLibraryVideo(ID, client as never);
      expect(video?.whyItWorks).toBeNull();
    }
  });

  it("lists beats stored without times with null times", async () => {
    const { client } = standIn({
      data: row({
        template: template([
          { name: "Hook", description: "The mistake" },
          { name: "Fix", description: "The way", startSec: null, endSec: null },
        ]),
      }),
      error: null,
    });

    const video = await getLibraryVideo(ID, client as never);

    expect(video?.beats).toEqual([
      { name: "Hook", startSec: null, endSec: null },
      { name: "Fix", startSec: null, endSec: null },
    ]);
  });

  it("gives no beats for a template without beats, or no template", async () => {
    const without = standIn({ data: row({ template: template(undefined) }), error: null });
    expect((await getLibraryVideo(ID, without.client as never))?.beats).toEqual([]);

    const none = standIn({ data: row({ template: null }), error: null });
    expect((await getLibraryVideo(ID, none.client as never))?.beats).toEqual([]);
  });

  it("still returns the video when its template fails the schema, with no beats", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client } = standIn({
      data: row({ template: { name: "Broken", beats: [{ name: "Hook", startSec: "0" }] } }),
      error: null,
    });

    const video = await getLibraryVideo(ID, client as never);

    expect(video).toEqual({ ...FULL, beats: [] });
    // The schema's own loud warning is kept, not swallowed.
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("library-video-read.ts", () => {
  it("is not a server action (it is no endpoint; only the video route calls it, after its auth check)", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/discover-next/library-video-read.ts"), "utf8");
    expect(src).not.toMatch(/^\s*["']use server["']/m);
  });
});
