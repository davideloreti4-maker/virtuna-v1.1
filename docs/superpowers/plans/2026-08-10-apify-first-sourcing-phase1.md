# Apify-first sourcing (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make live Apify scrapes the primary source of video evidence, decoded at request time from
free native subtitles, with decodes written back so the corpus becomes a self-filling cache.

**Architecture:** Two-stage scrape (find creators via `searchSection:"/user"`, then read their posts)
→ per-author multiplier (never the result set) → decode from subtitle VTT + caption + metrics on
`qwen3.7-flash` → write the decode back to `outlier_teardowns`. Pure functions land first so the
math and parsing are testable without network; I/O follows.

**Tech Stack:** TypeScript, Next.js 15, Vitest, `apify-client`, Supabase, DashScope (qwen3.7-flash).

**Spec:** `docs/superpowers/specs/2026-08-10-apify-first-composed-output-design.md`

## Global Constraints

- **Never print a bare multiplier.** Every multiplier ships with its basis label (D9, honesty spine
  §0.5b). Two bases exist and mean different things: `"vs their usual views"` (median views of that
  creator's own posts) and `"vs their lifetime average"` (likes ÷ `heart/video`). Never interchange.
- **Multipliers are clamped to `50×+` for display above 50** (D4). Corpus max is 20,154×.
- **The multiplier is per-AUTHOR, never the median of a result set** (D9). See spec §2.7 — the
  current behaviour prints 1.4× or 28.4× for the same video depending on `resultsPerPage`.
- **Free subtitles only:** `downloadSubtitlesOptions: "DOWNLOAD_SUBTITLES"`. The
  `DOWNLOAD_AND_TRANSCRIBE_*` and `TRANSCRIBE_ALL_VIDEOS` values are AI-charged — never use them.
- **`qwen3.7-flash` is DEAF.** Never send it audio. Spoken words arrive only as subtitle text.
- **Apify is on a FREE $5/mo cap** (`arcuate_azurite`). Tests must never hit the network — mock
  `apify-client` (see `src/lib/scraping/__tests__/resolve-video.test.ts` for the established pattern).
- **A scrape failure degrades visibly, never silently.** A capped account must not read as "check
  your handle is public".
- Run `npx tsc --noEmit` before any commit. A green Vercel check is not a build.

---

### Task 1: Per-author baseline and multiplier (pure)

Fixes the live defect in spec §2.7. Pure functions, no I/O, no network.

**Files:**
- Create: `src/lib/discover/author-baseline.ts`
- Test: `src/lib/discover/__tests__/author-baseline.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type BaselineBasis = "own-median-views" | "lifetime-avg-likes"`
  - `interface AuthorBaseline { basis: BaselineBasis; value: number; label: string }`
  - `computeAuthorBaseline(author: { heart: number; videoCount: number }, ownPostViews?: number[]): AuthorBaseline | null`
  - `multiplierFor(video: { views: number; likes: number }, baseline: AuthorBaseline): number`
  - `formatMultiplier(m: number): string`

- [x] **Step 1: Write the failing test**

```ts
// src/lib/discover/__tests__/author-baseline.test.ts
import { describe, expect, it } from "vitest";
import {
  computeAuthorBaseline,
  multiplierFor,
  formatMultiplier,
} from "@/lib/discover/author-baseline";

describe("computeAuthorBaseline", () => {
  it("prefers the creator's own median VIEWS when their posts are available", () => {
    const b = computeAuthorBaseline({ heart: 55700, videoCount: 405 }, [100, 200, 900]);
    expect(b).toEqual({ basis: "own-median-views", value: 200, label: "vs their usual views" });
  });

  it("falls back to lifetime average LIKES when no own posts are available", () => {
    const b = computeAuthorBaseline({ heart: 55700, videoCount: 405 });
    expect(b?.basis).toBe("lifetime-avg-likes");
    expect(b?.label).toBe("vs their lifetime average");
    expect(b?.value).toBeCloseTo(55700 / 405, 5);
  });

  it("returns null when neither basis is computable (no posts, no video count)", () => {
    expect(computeAuthorBaseline({ heart: 0, videoCount: 0 })).toBeNull();
  });

  it("ignores an empty own-posts array rather than dividing by zero", () => {
    const b = computeAuthorBaseline({ heart: 400, videoCount: 4 }, []);
    expect(b?.basis).toBe("lifetime-avg-likes");
  });
});

describe("multiplierFor", () => {
  it("divides VIEWS by the baseline on the views basis", () => {
    const b = { basis: "own-median-views" as const, value: 200, label: "vs their usual views" };
    expect(multiplierFor({ views: 1000, likes: 7 }, b)).toBe(5);
  });

  it("divides LIKES by the baseline on the likes basis", () => {
    const b = { basis: "lifetime-avg-likes" as const, value: 100, label: "vs their lifetime average" };
    expect(multiplierFor({ views: 999999, likes: 570 }, b)).toBe(5.7);
  });

  it("is INDEPENDENT of any result set — the same inputs always give the same number", () => {
    // Spec §2.7: the old result-set median gave 1.4x / 7.3x / 11.9x / 28.4x for one video.
    const b = { basis: "lifetime-avg-likes" as const, value: 17969, label: "vs their lifetime average" };
    const v = { views: 1_400_000, likes: 103_300 };
    expect(multiplierFor(v, b)).toBeCloseTo(5.7, 1);
    expect(multiplierFor(v, b)).toBeCloseTo(5.7, 1);
  });
});

describe("formatMultiplier", () => {
  it("clamps above the printable band (D4)", () => {
    expect(formatMultiplier(490.2)).toBe("50×+");
    expect(formatMultiplier(20154.7)).toBe("50×+");
  });

  it("prints one decimal inside the band", () => {
    expect(formatMultiplier(5.7)).toBe("5.7×");
    expect(formatMultiplier(50)).toBe("50.0×");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/lib/discover/__tests__/author-baseline.test.ts`
Expected: FAIL — cannot resolve `@/lib/discover/author-baseline`.

- [x] **Step 3: Write minimal implementation**

```ts
// src/lib/discover/author-baseline.ts
/**
 * author-baseline.ts — the DENOMINATOR for an outlier multiplier.
 *
 * ⚠️ Replaces the defect in `outlier-compute.ts`, where `baseline = median(views of the RETURNED
 * set)` made the multiplier a WITHIN-SET statistic: measured 2026-08-10, one real video printed
 * 1.4× at resultsPerPage 3 and 28.4× at 20. A receipt whose value depends on a request parameter
 * is not a receipt. The denominator here is per-AUTHOR and cannot move with scrape size.
 *
 * TWO BASES, deliberately not interchangeable (honesty spine, ui-skill-cards.md §0.5b):
 *   · own-median-views  — median views of that creator's OWN posts. The corpus's basis.
 *   · lifetime-avg-likes — likes ÷ (heart/videoCount). Free (authorMeta is on every scraped row),
 *     stable, but a LIFETIME AVERAGE of LIKES, so a creator who improved is flattered by their own
 *     weak back catalogue. It must never wear the views label.
 */

export type BaselineBasis = "own-median-views" | "lifetime-avg-likes";

export interface AuthorBaseline {
  basis: BaselineBasis;
  value: number;
  /** The creator-facing basis label. Never render a multiplier without it. */
  label: string;
}

/** Ceiling on a printed multiplier — above this a badge reads as broken (spec D4). */
const PRINTABLE_MAX = 50;

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function computeAuthorBaseline(
  author: { heart: number; videoCount: number },
  ownPostViews?: number[],
): AuthorBaseline | null {
  if (ownPostViews && ownPostViews.length > 0) {
    const value = median(ownPostViews);
    if (value > 0) return { basis: "own-median-views", value, label: "vs their usual views" };
  }
  if (author.videoCount > 0 && author.heart > 0) {
    return {
      basis: "lifetime-avg-likes",
      value: author.heart / author.videoCount,
      label: "vs their lifetime average",
    };
  }
  return null;
}

export function multiplierFor(
  video: { views: number; likes: number },
  baseline: AuthorBaseline,
): number {
  if (baseline.value <= 0) return 0;
  const numerator = baseline.basis === "own-median-views" ? video.views : video.likes;
  return numerator / baseline.value;
}

export function formatMultiplier(m: number): string {
  return m > PRINTABLE_MAX ? `${PRINTABLE_MAX}×+` : `${m.toFixed(1)}×`;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/lib/discover/__tests__/author-baseline.test.ts`
Expected: PASS (10 tests).

- [x] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/discover/author-baseline.ts src/lib/discover/__tests__/author-baseline.test.ts
git commit -m "feat(discover): per-author outlier baseline, replacing the within-set median"
```

---

### Task 2: Carry author aggregates through the scrape boundary

`VideoData` currently drops `authorMeta` entirely, so Task 1's denominator has no input.

**Files:**
- Modify: `src/lib/scraping/types.ts` (the `VideoData` interface)
- Modify: `src/lib/scraping/apify-provider.ts` (`remapClockworksVideo`, ~line 186)
- Test: `src/lib/scraping/__tests__/author-aggregates.test.ts`

**Interfaces:**
- Consumes: `AuthorBaseline` shape from Task 1 (field names `heart`, `videoCount`).
- Produces: `VideoData.author?: { handle: string; fans: number; heart: number; videoCount: number }`

- [x] **Step 1: Write the failing test**

```ts
// src/lib/scraping/__tests__/author-aggregates.test.ts
import { describe, expect, it } from "vitest";
import { remapClockworksVideo } from "@/lib/scraping/apify-provider";

const item = (authorMeta: unknown) => ({
  id: "123",
  webVideoUrl: "https://www.tiktok.com/@a/video/123",
  text: "caption",
  playCount: 100000,
  diggCount: 26800,
  commentCount: 10,
  shareCount: 5,
  collectCount: 2,
  hashtags: [],
  createTime: 1735689600,
  videoMeta: { duration: 30 },
  authorMeta,
});

describe("remapClockworksVideo — author aggregates", () => {
  it("carries fans / heart / videoCount so a per-author baseline is computable", () => {
    const v = remapClockworksVideo(
      item({ name: "techwitbrianx", fans: 10400, heart: 55700, video: 405 }),
    );
    expect(v?.author).toEqual({
      handle: "techwitbrianx",
      fans: 10400,
      heart: 55700,
      videoCount: 405,
    });
  });

  it("omits author entirely when authorMeta is absent (never zero-fills a denominator)", () => {
    const v = remapClockworksVideo(item(undefined));
    expect(v?.author).toBeUndefined();
  });

  it("omits author when the aggregates are missing, so no false baseline is derived", () => {
    const v = remapClockworksVideo(item({ name: "x" }));
    expect(v?.author).toBeUndefined();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/lib/scraping/__tests__/author-aggregates.test.ts`
Expected: FAIL — `v.author` is `undefined` in the first test.

- [x] **Step 3: Add the field to `VideoData`**

In `src/lib/scraping/types.ts`, inside `interface VideoData`, after `coverUrl`:

```ts
  /**
   * Author-level aggregates from clockworks `authorMeta`. The ONLY stable denominator available
   * without a second scrape — `heart / videoCount` is that creator's lifetime average likes per
   * post, which (unlike a result-set median) does not move with `resultsPerPage`.
   * Optional/additive: absent when the actor returns no authorMeta, and absent rather than
   * zero-filled when the aggregates are missing, so a baseline is never derived from nothing.
   */
  author?: {
    handle: string;
    fans: number;
    heart: number;
    videoCount: number;
  };
```

- [x] **Step 4: Populate it in the remap**

In `src/lib/scraping/apify-provider.ts`, inside `remapClockworksVideo`'s returned object, after the
`coverUrl` spread:

```ts
    ...(v.authorMeta?.name &&
    typeof v.authorMeta.heart === "number" &&
    typeof v.authorMeta.video === "number"
      ? {
          author: {
            handle: v.authorMeta.name,
            fans: v.authorMeta.fans ?? 0,
            heart: v.authorMeta.heart,
            videoCount: v.authorMeta.video,
          },
        }
      : {}),
```

If `apifyVideoSchema` strips `authorMeta`, widen it to accept an optional
`authorMeta: z.object({ name: z.string().optional(), fans: z.number().optional(), heart: z.number().optional(), video: z.number().optional() }).optional()`.

- [x] **Step 5: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/lib/scraping/__tests__/author-aggregates.test.ts`
Expected: PASS (3 tests).

- [x] **Step 6: Run the existing scraping suite (no regressions)**

Run: `node node_modules/vitest/vitest.mjs run src/lib/scraping`
Expected: PASS, including `apidojo-remap.test.ts` and `multiplatform-remap.test.ts`.

- [x] **Step 7: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/scraping/types.ts src/lib/scraping/apify-provider.ts src/lib/scraping/__tests__/author-aggregates.test.ts
git commit -m "feat(scraping): carry author aggregates on VideoData for the per-author baseline"
```

---

### Task 3: Subtitle VTT fetch and parse

Measured coverage: 71% of real videos, 12/12 parsed (spec §2.6). This turns a stored URL into text.

**Files:**
- Create: `src/lib/decode/vtt.ts`
- Test: `src/lib/decode/__tests__/vtt.test.ts`

**Interfaces:**
- Consumes: `VideoData.subtitleUrl` (already exists).
- Produces:
  - `parseVtt(raw: string): string`
  - `fetchTranscript(url: string, deps?: { fetchFn?: typeof fetch }): Promise<string | null>`

- [x] **Step 1: Write the failing test**

```ts
// src/lib/decode/__tests__/vtt.test.ts
import { describe, expect, it, vi } from "vitest";
import { parseVtt, fetchTranscript } from "@/lib/decode/vtt";

const SAMPLE = `WEBVTT

1
00:00:00.000 --> 00:00:03.000
So I made a huge mistake

2
00:00:03.000 --> 00:00:06.000
the last few months as a founder
`;

describe("parseVtt", () => {
  it("strips the header, cue numbers and timestamps into one line of speech", () => {
    expect(parseVtt(SAMPLE)).toBe("So I made a huge mistake the last few months as a founder");
  });

  it("strips inline markup", () => {
    expect(parseVtt("WEBVTT\n\n00:00.000 --> 00:01.000\n<c.white>hello</c> there")).toBe("hello there");
  });

  it("returns an empty string for a cue-less file", () => {
    expect(parseVtt("WEBVTT\n\n")).toBe("");
  });
});

describe("fetchTranscript", () => {
  it("returns parsed text on a 200", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, text: async () => SAMPLE });
    await expect(fetchTranscript("https://x/sub.vtt", { fetchFn: fetchFn as unknown as typeof fetch }))
      .resolves.toBe("So I made a huge mistake the last few months as a founder");
  });

  it("returns null on a non-200 rather than throwing (the caller escalates per D5)", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    await expect(fetchTranscript("https://x/sub.vtt", { fetchFn: fetchFn as unknown as typeof fetch }))
      .resolves.toBeNull();
  });

  it("returns null when the network throws — a decode must never take down a request", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    await expect(fetchTranscript("https://x/sub.vtt", { fetchFn: fetchFn as unknown as typeof fetch }))
      .resolves.toBeNull();
  });

  it("returns null when the file parses to nothing", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, text: async () => "WEBVTT\n\n" });
    await expect(fetchTranscript("https://x/sub.vtt", { fetchFn: fetchFn as unknown as typeof fetch }))
      .resolves.toBeNull();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/lib/decode/__tests__/vtt.test.ts`
Expected: FAIL — cannot resolve `@/lib/decode/vtt`.

- [x] **Step 3: Write minimal implementation**

```ts
// src/lib/decode/vtt.ts
/**
 * vtt.ts — turn TikTok's FREE native subtitle track into plain speech text.
 *
 * Why this exists: `qwen3.7-flash` is sighted but DEAF (see engine/qwen/client.ts), so the spoken
 * hook — usually the whole hook in short-form — cannot reach it as audio. TikTok publishes a free
 * WEBVTT track for many videos (`downloadSubtitlesOptions: "DOWNLOAD_SUBTITLES"`, no AI charge),
 * which `remapClockworksVideo` already stores as `VideoData.subtitleUrl` but nothing ever read.
 * Measured 2026-08-10: 71% of real videos carry one, and 12/12 of those parsed cleanly.
 *
 * Every failure returns null rather than throwing: a missing transcript downgrades the decode
 * (spec D5), it does not fail the request.
 */

export function parseVtt(raw: string): string {
  return raw
    .split(/\r?\n/)
    .filter(
      (l) =>
        l.trim() &&
        !/^WEBVTT/i.test(l) &&
        !/^\d+$/.test(l.trim()) &&
        !/-->/.test(l) &&
        !/^(NOTE|STYLE|REGION)/i.test(l),
    )
    .map((l) => l.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchTranscript(
  url: string,
  deps: { fetchFn?: typeof fetch } = {},
): Promise<string | null> {
  const fetchFn = deps.fetchFn ?? fetch;
  try {
    const res = await fetchFn(url);
    if (!res.ok) return null;
    const text = parseVtt(await res.text());
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/lib/decode/__tests__/vtt.test.ts`
Expected: PASS (8 tests).

- [x] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/decode/vtt.ts src/lib/decode/__tests__/vtt.test.ts
git commit -m "feat(decode): fetch and parse free native subtitle tracks into speech text"
```

---

### Task 4: Two-stage scrape — find creators, then read their posts

Spec D12. A keyword video-search matches caption text, not people: the Phase 0 run returned a
99-view post and a clip whose transcript was *"okay bye bye love you…"*.

**Files:**
- Modify: `src/lib/scraping/types.ts` (add `searchCreators` to `ScrapingProvider`)
- Modify: `src/lib/scraping/apify-provider.ts` (implement it; add subtitles to the discover input)
- Test: `src/lib/scraping/__tests__/search-creators.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `searchCreators(query: string, limit?: number): Promise<string[]>` — handles, no `@`.

- [x] **Step 1: Write the failing test**

```ts
// src/lib/scraping/__tests__/search-creators.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockState = {
  lastInput: null as unknown,
  listItemsResult: { items: [] as unknown[] },
};

vi.mock("apify-client", () => {
  class ApifyClient {
    actor() {
      return {
        call: async (input: unknown) => {
          mockState.lastInput = input;
          return { defaultDatasetId: "ds-1" };
        },
      };
    }
    dataset() {
      return { listItems: async () => mockState.listItemsResult };
    }
  }
  return { ApifyClient };
});

import { ApifyScrapingProvider } from "@/lib/scraping/apify-provider";

describe("searchCreators (stage 1 of D12)", () => {
  beforeEach(() => {
    mockState.lastInput = null;
    mockState.listItemsResult = { items: [] };
  });

  it("searches the /user section so results are PEOPLE, not caption matches", async () => {
    mockState.listItemsResult = {
      items: [{ authorMeta: { name: "founderone" } }, { authorMeta: { name: "foundertwo" } }],
    };
    await new ApifyScrapingProvider().searchCreators("startup founder", 5);
    expect(mockState.lastInput).toMatchObject({
      searchQueries: ["startup founder"],
      searchSection: "/user",
      maxProfilesPerQuery: 5,
    });
  });

  it("returns de-duplicated bare handles", async () => {
    mockState.listItemsResult = {
      items: [
        { authorMeta: { name: "founderone" } },
        { authorMeta: { name: "founderone" } },
        { authorMeta: { name: "foundertwo" } },
      ],
    };
    const out = await new ApifyScrapingProvider().searchCreators("startup founder");
    expect(out).toEqual(["founderone", "foundertwo"]);
  });

  it("returns an empty array when the search finds nobody (caller degrades visibly)", async () => {
    const out = await new ApifyScrapingProvider().searchCreators("zzzz");
    expect(out).toEqual([]);
  });

  it("never requests a CHARGED transcription option", async () => {
    await new ApifyScrapingProvider().searchCreators("startup founder");
    const input = mockState.lastInput as Record<string, unknown>;
    expect(input.downloadSubtitlesOptions).not.toBe("TRANSCRIBE_ALL_VIDEOS");
    expect(input.downloadSubtitlesOptions).not.toBe(
      "DOWNLOAD_AND_TRANSCRIBE_VIDEOS_WITHOUT_SUBTITLES",
    );
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/lib/scraping/__tests__/search-creators.test.ts`
Expected: FAIL — `searchCreators` is not a function.

- [x] **Step 3: Add the method to the interface**

In `src/lib/scraping/types.ts`, inside `interface ScrapingProvider`:

```ts
  /**
   * STAGE 1 of the two-stage pull (spec D12): find CREATORS in a niche, not videos whose caption
   * matches. `searchSection: "/user"` is what makes the difference — a keyword video-search
   * returned a 99-view post and an unrelated clip in the Phase 0 measurement. Returns bare handles
   * (no '@'), de-duplicated. Empty array when nobody matches — the caller degrades visibly.
   */
  searchCreators(query: string, limit?: number): Promise<string[]>;
```

- [x] **Step 4: Implement it, and turn subtitles on for the post scrape**

In `src/lib/scraping/apify-provider.ts`, add to `ApifyScrapingProvider`:

```ts
  async searchCreators(query: string, limit = 10): Promise<string[]> {
    const run = await this.client.actor(DISCOVER_VIDEO_ACTOR).call(
      {
        searchQueries: [query],
        // THE point of stage 1 — people, not caption matches (spec D12).
        searchSection: "/user",
        maxProfilesPerQuery: limit,
      },
      { waitSecs: 240 },
    );
    if (!run?.defaultDatasetId) return [];
    const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
    const seen = new Set<string>();
    for (const it of items as Array<Record<string, unknown>>) {
      const meta = it.authorMeta as { name?: unknown } | undefined;
      const name = typeof meta?.name === "string" ? meta.name.replace(/^@/, "").trim() : "";
      if (name) seen.add(name);
    }
    return [...seen];
  }
```

Then, in `scrapeVideos`' input construction (~line 537, the `"profile"` branch), add the free
subtitle option and exclude pinned posts so engagement ratios are not skewed:

```ts
        ? {
            profiles: [query],
            resultsPerPage: limit,
            excludePinnedPosts: true,
            profileSorting: "latest",
            downloadSubtitlesOptions: "DOWNLOAD_SUBTITLES",
          }
```

- [x] **Step 5: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/lib/scraping/__tests__/search-creators.test.ts`
Expected: PASS (4 tests).

- [x] **Step 6: Update the mock provider so the interface stays satisfied**

Any object implementing `ScrapingProvider` (search `src/lib/tools/mock/` and test fixtures) now
needs `searchCreators`. Add `async searchCreators() { return []; }` to each.

Run: `npx tsc --noEmit`
Expected: no errors. Fix any implementer the compiler names.

- [x] **Step 7: Run the scraping suite and commit**

```bash
node node_modules/vitest/vitest.mjs run src/lib/scraping
npx tsc --noEmit
git add src/lib/scraping/
git commit -m "feat(scraping): two-stage creator search + free subtitles on the post scrape"
```

---

### Task 5: Live decode from transcript + caption + metrics

**Files:**
- Create: `src/lib/decode/live-decode.ts`
- Test: `src/lib/decode/__tests__/live-decode.test.ts`

**Interfaces:**
- Consumes: `fetchTranscript` (Task 3); `VideoData` incl. `author` (Task 2).
- Produces:
  - `interface LiveDecode { hookPattern: string; structure: string; theTurn: string; emotionalBeat: string; spokenHook: string | null; source: "transcript" | "caption-only" }`
  - `decodeVideo(input, deps?): Promise<LiveDecode | null>`

- [x] **Step 1: Write the failing test**

```ts
// src/lib/decode/__tests__/live-decode.test.ts
import { describe, expect, it, vi } from "vitest";
import { decodeVideo } from "@/lib/decode/live-decode";

const GOOD = JSON.stringify({
  hookPattern: "Opens on an admission of failure",
  structure: "Hook 0-3s → context 3-12s → lesson 12-25s",
  theTurn: "The mistake is reframed as the advice",
  emotionalBeat: "Relief that someone said it out loud",
  spokenHook: "So I made a huge mistake",
});

const video = {
  platformVideoId: "1",
  caption: "founder lessons",
  views: 1893,
  likes: 118,
  durationSeconds: 19,
  subtitleUrl: "https://x/sub.vtt",
};

describe("decodeVideo", () => {
  it("decodes from the TRANSCRIPT when subtitles resolve", async () => {
    const complete = vi.fn().mockResolvedValue({ choices: [{ message: { content: GOOD } }] });
    const out = await decodeVideo(video, {
      complete,
      fetchTranscriptFn: async () => "So I made a huge mistake the last few months as a founder",
    });
    expect(out?.source).toBe("transcript");
    expect(out?.spokenHook).toBe("So I made a huge mistake");
    // The transcript must actually reach the model, or the decode is caption-only in disguise.
    expect(JSON.stringify(complete.mock.calls[0][0])).toContain("huge mistake");
  });

  it("falls back to caption-only when there is no transcript (spec D5)", async () => {
    const complete = vi.fn().mockResolvedValue({ choices: [{ message: { content: GOOD } }] });
    const out = await decodeVideo(
      { ...video, subtitleUrl: undefined },
      { complete, fetchTranscriptFn: async () => null },
    );
    expect(out?.source).toBe("caption-only");
  });

  it("returns null on unparseable model output rather than a half-filled decode", async () => {
    const complete = vi.fn().mockResolvedValue({ choices: [{ message: { content: "not json" } }] });
    const out = await decodeVideo(video, { complete, fetchTranscriptFn: async () => "words" });
    expect(out).toBeNull();
  });

  it("returns null when a required field is missing — never zero-fills a decode", async () => {
    const partial = JSON.stringify({ hookPattern: "x" });
    const complete = vi.fn().mockResolvedValue({ choices: [{ message: { content: partial } }] });
    const out = await decodeVideo(video, { complete, fetchTranscriptFn: async () => "words" });
    expect(out).toBeNull();
  });

  it("returns null when the model call throws — a decode never fails the request", async () => {
    const complete = vi.fn().mockRejectedValue(new Error("upstream 500"));
    const out = await decodeVideo(video, { complete, fetchTranscriptFn: async () => "words" });
    expect(out).toBeNull();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/lib/decode/__tests__/live-decode.test.ts`
Expected: FAIL — cannot resolve `@/lib/decode/live-decode`.

- [x] **Step 3: Write minimal implementation**

```ts
// src/lib/decode/live-decode.ts
/**
 * live-decode.ts — the request-time decode that makes Apify-first possible.
 *
 * Apify returns METRICS (views, likes, caption). The corpus stores the DECODE (hook pattern,
 * structure, the turn). Nothing produced a decode at request time, which is why "find me 3 viral
 * formats" could not be answered from a live scrape at all — a format IS a decode.
 *
 * Reads TEXT only: the free subtitle transcript + caption + metrics. No video tokens, no audio.
 * `qwen3.7-flash` is deaf, and the subtitle track supplies the spoken words for free (71% of real
 * videos, measured 2026-08-10). The four beats mirror `engine/remix/decode-prompts.ts` so a live
 * decode and a corpus row are the same shape.
 *
 * Returns null on ANY failure — a decode is an enrichment, never a reason to fail a request.
 */

import { fetchTranscript } from "./vtt";

export interface LiveDecode {
  hookPattern: string;
  structure: string;
  theTurn: string;
  emotionalBeat: string;
  spokenHook: string | null;
  source: "transcript" | "caption-only";
}

export interface DecodeVideoInput {
  platformVideoId: string;
  caption: string;
  views: number;
  likes: number;
  durationSeconds: number;
  subtitleUrl?: string;
}

type Complete = (params: Record<string, unknown>) => Promise<{
  choices?: Array<{ message?: { content?: string | null } }>;
}>;

const SYSTEM = [
  "You decode short-form videos into their reusable STRUCTURE.",
  "Write in declarative third person about the video ('the hook', 'the creator') — never 'you'.",
  "Return ONLY JSON with keys: hookPattern, structure, theTurn, emotionalBeat, spokenHook.",
  "spokenHook is the creator's OPENING LINE copied verbatim from the transcript, or null if no",
  "transcript was supplied. Never invent it from the caption.",
].join(" ");

const REQUIRED = ["hookPattern", "structure", "theTurn", "emotionalBeat"] as const;

export async function decodeVideo(
  video: DecodeVideoInput,
  deps: { complete?: Complete; fetchTranscriptFn?: typeof fetchTranscript } = {},
): Promise<LiveDecode | null> {
  const fetchFn = deps.fetchTranscriptFn ?? fetchTranscript;
  const complete =
    deps.complete ??
    (async (params) => {
      /* eslint-disable-next-line @typescript-eslint/no-require-imports */
      const { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } = require("@/lib/engine/qwen/client");
      return getQwenClient().chat.completions.create({
        model: QWEN_REASONING_MODEL,
        seed: QWEN_SEED,
        ...params,
      });
    });

  const transcript = video.subtitleUrl ? await fetchFn(video.subtitleUrl) : null;
  const source: LiveDecode["source"] = transcript ? "transcript" : "caption-only";

  const user = [
    `Caption: ${video.caption}`,
    `Duration: ${video.durationSeconds}s · Views: ${video.views} · Likes: ${video.likes}`,
    transcript ? `Transcript: ${transcript}` : "Transcript: (none available)",
  ].join("\n");

  let raw: string;
  try {
    const res = await complete({
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      max_tokens: 700,
      enable_thinking: false,
      response_format: { type: "json_object" },
    });
    raw = res.choices?.[0]?.message?.content ?? "";
  } catch {
    return null;
  }

  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    for (const k of REQUIRED) {
      if (typeof p[k] !== "string" || !(p[k] as string).trim()) return null;
    }
    return {
      hookPattern: String(p.hookPattern),
      structure: String(p.structure),
      theTurn: String(p.theTurn),
      emotionalBeat: String(p.emotionalBeat),
      // Never let a caption-only decode claim a spoken hook.
      spokenHook: transcript && typeof p.spokenHook === "string" ? p.spokenHook : null,
      source,
    };
  } catch {
    return null;
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/lib/decode/__tests__/live-decode.test.ts`
Expected: PASS (5 tests).

- [x] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/decode/live-decode.ts src/lib/decode/__tests__/live-decode.test.ts
git commit -m "feat(decode): request-time structural decode from transcript + caption + metrics"
```

---

### Task 6: Write-back cache — the corpus fills itself

Spec D2. A decoded video is decoded once, ever. This is what bounds the cost.

**Files:**
- Create: `src/lib/decode/decode-cache.ts`
- Test: `src/lib/decode/__tests__/decode-cache.test.ts`

**Interfaces:**
- Consumes: `LiveDecode` (Task 5), `VideoData` (Task 2), `AuthorBaseline` (Task 1).
- Produces:
  - `getCachedDecode(platformVideoId, deps?): Promise<LiveDecode | null>`
  - `storeDecode(video, decode, baseline, deps?): Promise<void>`

- [x] **Step 1: Write the failing test**

```ts
// src/lib/decode/__tests__/decode-cache.test.ts
import { describe, expect, it, vi } from "vitest";
import { getCachedDecode, storeDecode } from "@/lib/decode/decode-cache";

const decode = {
  hookPattern: "h",
  structure: "s",
  theTurn: "t",
  emotionalBeat: "e",
  spokenHook: "So I made a huge mistake",
  source: "transcript" as const,
};

const video = {
  platformVideoId: "123",
  videoUrl: "https://tiktok.com/@a/video/123",
  caption: "c",
  views: 1893,
  likes: 118,
  durationSeconds: 19,
  coverUrl: "https://cdn/cover.jpg",
  author: { handle: "a", fans: 1321, heart: 15400, videoCount: 122 },
};

const baseline = {
  basis: "lifetime-avg-likes" as const,
  value: 126.2,
  label: "vs their lifetime average",
};

function fakeClient(existing: unknown[] = []) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  return {
    upsert,
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: existing[0] ?? null, error: null }) }),
      }),
      upsert,
    }),
  };
}

describe("getCachedDecode", () => {
  it("returns a stored decode so a video is never decoded twice", async () => {
    const c = fakeClient([
      { hook_template: "h", teardown: { structure: "s", theTurn: "t", emotionalBeat: "e" }, spoken_hook: "x" },
    ]);
    const out = await getCachedDecode("123", { client: c as never });
    expect(out?.hookPattern).toBe("h");
    expect(out?.structure).toBe("s");
  });

  it("returns null on a miss", async () => {
    const out = await getCachedDecode("nope", { client: fakeClient() as never });
    expect(out).toBeNull();
  });
});

describe("storeDecode", () => {
  it("writes the decode with source_pool marking it as live-scraped, not curated", async () => {
    const c = fakeClient();
    await storeDecode(video, decode, baseline, { client: c as never });
    const row = c.upsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.platform_video_id).toBe("123");
    expect(row.creator_handle).toBe("a");
    expect(row.source_pool).toBe("live-scrape");
    expect(row.spoken_hook).toBe("So I made a huge mistake");
  });

  it("stores the basis label alongside the multiplier, never a bare number", async () => {
    const c = fakeClient();
    await storeDecode(video, decode, baseline, { client: c as never });
    const row = c.upsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.baseline_label).toBe("vs their lifetime average");
    expect(typeof row.outlier_multiplier).toBe("number");
  });

  it("upserts on the video id so re-decoding the same video does not duplicate a row", async () => {
    const c = fakeClient();
    await storeDecode(video, decode, baseline, { client: c as never });
    expect(c.upsert.mock.calls[0][1]).toMatchObject({ onConflict: "platform_video_id" });
  });

  it("never throws — a cache write must not fail the creator's request", async () => {
    const c = { from: () => { throw new Error("db down"); } };
    await expect(storeDecode(video, decode, baseline, { client: c as never })).resolves.toBeUndefined();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/lib/decode/__tests__/decode-cache.test.ts`
Expected: FAIL — cannot resolve `@/lib/decode/decode-cache`.

- [x] **Step 3: Confirm the unique constraint exists before writing the upsert**

`storeDecode` upserts on `platform_video_id`. Verify a unique index exists:

```sql
select indexname, indexdef from pg_indexes
where tablename = 'outlier_teardowns' and indexdef ilike '%platform_video_id%';
```

If none is unique, apply this via the **Supabase SQL editor** (⚠️ `supabase db push` is unsafe in
this project — migration-ledger drift):

```sql
create unique index if not exists outlier_teardowns_platform_video_id_key
  on public.outlier_teardowns (platform_video_id);
```

- [x] **Step 4: Write minimal implementation**

```ts
// src/lib/decode/decode-cache.ts
/**
 * decode-cache.ts — the corpus stops being a static library and becomes a CACHE OF DECODES.
 *
 * Spec D2: a decoded video never needs decoding again. Apify scrapes fresh on every request;
 * anything new is decoded once and written back, so the second creator asking about a niche hits
 * warm rows. This is what bounds the cost of Apify-first — per-video-ever, not per-request.
 *
 * Rows written here carry `source_pool: "live-scrape"` so accumulated rows stay distinguishable
 * from the original curated 532 (spec assumption 3).
 *
 * Never throws: a cache miss costs a decode, a cache-write failure costs nothing at all.
 */

import type { LiveDecode } from "./live-decode";
import type { AuthorBaseline } from "@/lib/discover/author-baseline";
import { multiplierFor } from "@/lib/discover/author-baseline";

interface CacheDeps {
  client?: { from: (t: string) => never };
}

function getClient(deps: CacheDeps) {
  if (deps.client) return deps.client as unknown as SupabaseLike;
  /* eslint-disable-next-line @typescript-eslint/no-require-imports */
  const { createServiceClient } = require("@/lib/supabase/service");
  return createServiceClient() as SupabaseLike;
}

interface SupabaseLike {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: unknown }> };
    };
    upsert: (row: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<unknown>;
  };
}

export async function getCachedDecode(
  platformVideoId: string,
  deps: CacheDeps = {},
): Promise<LiveDecode | null> {
  try {
    const { data } = await getClient(deps)
      .from("outlier_teardowns")
      .select("hook_template, teardown, spoken_hook")
      .eq("platform_video_id", platformVideoId)
      .maybeSingle();
    if (!data) return null;
    const row = data as { hook_template?: string; teardown?: Record<string, string>; spoken_hook?: string };
    const t = row.teardown ?? {};
    if (!row.hook_template || !t.structure) return null;
    return {
      hookPattern: row.hook_template,
      structure: t.structure,
      theTurn: t.theTurn ?? "",
      emotionalBeat: t.emotionalBeat ?? "",
      spokenHook: row.spoken_hook ?? null,
      source: row.spoken_hook ? "transcript" : "caption-only",
    };
  } catch {
    return null;
  }
}

export async function storeDecode(
  video: {
    platformVideoId: string;
    videoUrl: string;
    caption: string;
    views: number;
    likes: number;
    coverUrl?: string;
    author?: { handle: string; fans: number; heart: number; videoCount: number };
  },
  decode: LiveDecode,
  baseline: AuthorBaseline,
  deps: CacheDeps = {},
): Promise<void> {
  try {
    await getClient(deps)
      .from("outlier_teardowns")
      .upsert(
        {
          platform: "tiktok",
          platform_video_id: video.platformVideoId,
          video_url: video.videoUrl,
          cover_url: video.coverUrl ?? null,
          creator_handle: video.author?.handle ?? null,
          // Distinguishes accumulated rows from the original curated corpus (spec assumption 3).
          source_pool: "live-scrape",
          views: video.views,
          follower_count: video.author?.fans ?? null,
          outlier_multiplier: multiplierFor(video, baseline),
          // The basis ALWAYS travels with the number (Global Constraints).
          baseline_label: baseline.label,
          caption: video.caption,
          spoken_hook: decode.spokenHook,
          hook_template: decode.hookPattern,
          teardown: {
            structure: decode.structure,
            theTurn: decode.theTurn,
            emotionalBeat: decode.emotionalBeat,
          },
          status: "active",
        },
        { onConflict: "platform_video_id" },
      );
  } catch {
    /* best-effort by contract — a ledger hiccup never costs the answer */
  }
}
```

- [x] **Step 5: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run src/lib/decode/__tests__/decode-cache.test.ts`
Expected: PASS (6 tests).

- [x] **Step 6: Run the full suite, typecheck, commit**

```bash
node node_modules/vitest/vitest.mjs run
npx tsc --noEmit
git add src/lib/decode/decode-cache.ts src/lib/decode/__tests__/decode-cache.test.ts
git commit -m "feat(decode): write-back cache so the corpus fills itself from live scrapes"
```

---

### Task 7: Live end-to-end verification (one real scrape)

Wire-level tests cannot see a real Apify payload. This runs the whole Phase 1 chain once, for real.

**Files:**
- Create: `scripts/verify-apify-first.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: a printed report. No production code depends on it.

- [x] **Step 1: Check the Apify account BEFORE spending**

```bash
node -e 'require("dotenv").config({path:".env.local"});
fetch(`https://api.apify.com/v2/users/me/limits?token=${process.env.APIFY_TOKEN}`)
 .then(r=>r.json()).then(j=>console.log("usage:",j.data.current.monthlyUsageUsd,"/",j.data.limits.maxMonthlyUsageUsd))'
```

Expected: usage below the cap with room for ~2 runs (~$0.13). **If it is at the cap, STOP** — a
403 here reads as a bad handle and will waste an hour (see memory `apify-free-plan-hard-limit`).

- [x] **Step 2: Write the verification script**

```ts
// scripts/verify-apify-first.ts
/**
 * verify-apify-first.ts — one real end-to-end run of the Phase 1 chain.
 * Run: node node_modules/tsx/dist/cli.mjs scripts/verify-apify-first.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

/* eslint-disable @typescript-eslint/no-require-imports */
const { createScrapingProvider } = require("@/lib/scraping");
const { computeAuthorBaseline, multiplierFor, formatMultiplier } = require("@/lib/discover/author-baseline");
const { decodeVideo } = require("@/lib/decode/live-decode");

async function main() {
  const provider = createScrapingProvider();

  const handles = await provider.searchCreators("startup founder", 3);
  console.log("STAGE 1 — creators:", handles);
  if (handles.length === 0) throw new Error("stage 1 returned nobody");

  const videos = await provider.scrapeVideos(handles[0], 6, "profile");
  console.log(`STAGE 2 — ${videos.length} posts from @${handles[0]}`);
  const withSubs = videos.filter((v: { subtitleUrl?: string }) => v.subtitleUrl).length;
  console.log(`  subtitle coverage: ${withSubs}/${videos.length}`);

  const author = videos.find((v: { author?: unknown }) => v.author)?.author;
  if (!author) throw new Error("no author aggregates — Task 2 is not wired");
  const baseline = computeAuthorBaseline(author, videos.map((v: { views: number }) => v.views));
  console.log("BASELINE —", baseline);

  const top = [...videos].sort((a, b) => b.views - a.views)[0];
  console.log(`TOP — ${top.views} views · ${formatMultiplier(multiplierFor(top, baseline))} ${baseline.label}`);

  const decode = await decodeVideo(top);
  console.log("DECODE —", decode ? JSON.stringify(decode, null, 2) : "FAILED (null)");
  if (!decode) throw new Error("decode returned null on a real video");
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
```

- [x] **Step 3: Run it**

Run: `node node_modules/tsx/dist/cli.mjs scripts/verify-apify-first.ts`

Expected: stage 1 prints real founder handles; stage 2 prints ~6 posts with non-zero subtitle
coverage; the baseline prints `basis: "own-median-views"` with label `"vs their usual views"` (own
posts ARE available on a profile scrape); the decode prints four non-empty structural fields and a
`spokenHook` copied from the transcript.

- [x] **Step 4: Confirm the write-back landed**

```sql
select creator_handle, source_pool, baseline_label, outlier_multiplier, hook_template
from public.outlier_teardowns where source_pool = 'live-scrape'
order by created_at desc limit 5;
```

Expected: at least one row, `source_pool = 'live-scrape'`, a non-null `hook_template`, and
`baseline_label` matching the basis actually used.

- [x] **Step 5: Commit**

```bash
git add scripts/verify-apify-first.ts
git commit -m "test(decode): live end-to-end verification of the Apify-first chain"
```

---

## Self-Review

**Spec coverage:**

| spec item | task |
|---|---|
| D1 Apify leads evidence-bearing asks | 4, 7 |
| D2 write-back cache | 6 |
| D3 decode from free VTT + caption + metrics on flash | 3, 5 |
| D4 clamp to `50×+` | 1 (`formatMultiplier`) |
| D5 no-subs escalation | 5 (`caption-only` source) |
| D9 per-author basis + label | 1, 2, 6 |
| D11 breadth = need + headroom | 7 (scrapes 6 for 3) |
| D12 two-stage scrape | 4, 7 |
| §2.7 the live multiplier defect | 1 |

**Not covered here, deliberately:** D6/D7/D8/D10 are Phase 2 (the `composed-card` output layer) and
belong to that plan. `outlier-compute.ts`'s existing `rankOutliers` is left in place — Task 1 adds
the correct denominator without ripping out a function that Discover/Explore still call; switching
those call sites is a Phase 2 concern once the card renderer consumes the new basis.

**Type consistency:** `AuthorBaseline` (Task 1) is consumed by name in Tasks 6 and 7. `LiveDecode`
(Task 5) is consumed in Task 6. `VideoData.author` uses `videoCount` (not the wire name `video`)
consistently in Tasks 2, 1, 6, 7. `searchCreators` has the same signature in Tasks 4 and 7.

**Placeholder scan:** no TBDs; every code step carries real code; every test step carries real
assertions.

---

## Execution record — 2026-08-10

All 7 tasks executed on `feat/apify-first-sourcing`. 5,852 tests green, `tsc` clean.
Commits: `e2a99db3` `67b5300b` `e4845178` `27b47c91` `c07712f6` `51d71336` `5e8746a2`.

**The code deviates from this plan in seven places.** The plan text above is left as written; where
it disagrees with the code, the code is right and the reason is here.

### Corrections found by reading the live schema (before writing any code)

Three of these would have failed **silently** — `supabase-js` RETURNS `{error}` rather than
throwing, and `storeDecode`'s contract is "never throw", so a rejected write left no trace.

| plan said | reality | shipped |
|---|---|---|
| `source_pool: "live-scrape"` | `CHECK (source_pool IN ('curated','competitor','scraped','expanded'))` | `"scraped"` — 0 rows before this, so it still separates accumulated from the curated 532 |
| `status: "active"` | `CHECK (status IN ('metadata','extracted','watched','failed'))` | `"extracted"` |
| `onConflict: "platform_video_id"` + **Task 6 Step 3 migration** | the only unique index is `(platform, platform_video_id)`; the single-column form raises 42P10 | `onConflict: "platform,platform_video_id"`. **No migration was needed or applied** — Step 3 is void, and a single-column index would have been semantically wrong (the table is keyed per platform) |

Two additions in the same area: `hook_source` is written from `decode.source`
(`native_transcript` / `caption_fallback` — the column's CHECK already encoded exactly this
distinction), and a returned Supabase `{error}` is now logged. `storeDecode` still never throws.

`apifyVideoSchema.authorMeta` did strip the aggregates, as Task 2 Step 4 anticipated; widened with
`fans`/`heart`/`video` left **optional and un-defaulted**, so a missing aggregate stays absent
rather than becoming a zero denominator.

### Corrections found by the live run (Task 7) — and only by it

Four real Apify runs, **$0.106 total**. Every one of these was invisible to the mocked suite.

1. **`searchCreators` returned candidates in the actor's dataset order.** A caller taking
   `handles[0]` got an 18-follower account (median 11 views) while the only relevant creator
   (`@startupfounderceo`, 2,306 fans) sat third. Now ordered by `authorMeta.fans`, which rides on
   every stage-1 item for free. **D12 as specified is half a fix:** `searchSection: "/user"`
   answers *a person rather than a caption*; it does not answer *which person*.
2. **`tiktokLink` serves two wire formats.** Some videos return WEBVTT, others return
   `{"utterances":[{text,start_time,text_color,…}]}`. The line filter had no opinion about JSON, so
   13,472 chars of styling metadata reached the model as "Transcript:". Sniffing the shape:
   13,472 → 2,785 chars, **5,401 → 664 prompt tokens** on the same video.
3. **`qwen3.7-flash` returns `structure` as a LIST** — an array of strings on one run, an array of
   `{step, description}` objects on the next. Correct content, wrong container, whole decode
   discarded. `SYSTEM` now shows the required shape by example; `asBeat()` repairs the two
   containers actually observed and rejects anything else.
4. **A silent `null` is undebuggable.** `decodeVideo` returned null with no reason; finding #3 took
   a hand-written raw model call to see. It now logs *why* it failed, and still never throws.

⚠️ **Methodology trap, recorded in the source:** the first shape example in `SYSTEM` was written
from the test video itself, and flash returned it back **verbatim**. A copied answer is
indistinguishable from a decoded one when the subjects match. The example is now from an unrelated
domain (knife sharpening) so copying is detectable.

### Still open after Phase 1

- **`own-median-views` is not N-invariant.** Task 1 kills the *cross-creator* result-set median,
  but the own-median basis is still a median over the posts we happened to fetch: measured on
  `@thefounderadvisor`, **5.2× at N=3 vs 3.0× at N=6**. Far better than the old 1.4×→28.4×, but the
  denominator still moves with scrape size. A fixed baseline N would close it.
- **Nothing wires Phase 1 into a request path.** `decodeVideo` / `storeDecode` / `searchCreators`
  have no production caller; `/api/discover` and `/api/tools/explore` still render `rankOutliers`'
  within-set multiplier. Switching those call sites is Phase 2, as stated above — **the live defect
  in §2.7 is therefore FIXED IN THE LIBRARY BUT STILL SHIPPING IN THE UI.**
- **No outlier threshold exists.** The final run wrote a `0.298×` video (it underperformed its
  creator's median) into `outlier_teardowns`. Which videos qualify as outliers is a selection
  decision the plan explicitly defers.
- **Stage 2 changes four existing live callers.** `excludePinnedPosts: true` and
  `profileSorting: "latest"` now apply to every profile-mode `scrapeVideos` — competitors/add,
  refresh-account-snapshots, explore-runner profile mode, account-read. Deliberate (it matches
  `scrapeProfileBundle`), but it was not called out in the plan.
- **Apify: $3.06 / $5.00** used after this work; cycle resets 2026-08-20. A paid plan still gates
  SHIPPING, not building.
