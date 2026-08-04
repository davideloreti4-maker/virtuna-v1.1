import { describe, it, expect, vi } from "vitest";
import { calibrateFromScrape } from "../calibration";
import type { ProfileBundle, ProfileData, VideoData } from "@/lib/scraping/types";

/**
 * Progressive evidence — showing the account WHILE it is being read.
 *
 * The scrape is a single Apify run producing the profile and the posts together, measured at
 * ~78s for @garyvee. Because `.call()` resolves only when the whole run finishes, onboarding's
 * longest screen sat empty for its first minute and then filled all at once. `onPartial` is
 * threaded down so the run's dataset can be read as it fills — same run, no extra Apify spend.
 *
 * What these lock is the WIRING, which is the part that silently rots: the partial callback has
 * to reach the scraper, and every partial it produces has to become an `onEvidence` frame. The
 * polling loop itself lives in the Apify provider and is exercised against a real run.
 */

const profile = (over: Partial<ProfileData> = {}): ProfileData =>
  ({
    handle: "testcreator",
    displayName: "Test Creator",
    avatarUrl: "https://cdn/a.jpg",
    followerCount: 1000,
    heartCount: 5000,
    videoCount: 40,
    bio: "",
    verified: false,
    ...over,
  }) as ProfileData;

const video = (views: number): VideoData =>
  ({ coverUrl: `https://cdn/${views}.jpg`, views, subtitleUrl: "s" }) as VideoData;

const bundle = (): ProfileBundle =>
  ({
    profile: profile(),
    videos: Array.from({ length: 12 }, (_, i) => video(1000 + i)),
    subCoverage: "12/12",
  }) as ProfileBundle;

const INPUT = {
  handle: "testcreator",
  type: "personal" as const,
  platform: "tiktok",
  name: "Test Creator",
  goalIntent: null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

type PartialFn = (p: { profile: ProfileData | null; videos: VideoData[] }) => void;
type BundleFn = (h: string, l?: number, onPartial?: PartialFn) => Promise<ProfileBundle>;

function deps(scrapeBundle: unknown, onEvidence?: unknown) {
  return {
    scrapeBundle,
    enrich: vi.fn(async () => {
      throw new Error("stop after the scrape — these tests are about the partial wiring");
    }),
    ...(onEvidence ? { onEvidence } : {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("calibration — progressive evidence wiring", () => {
  it("passes a partial callback to the scraper when someone is listening", async () => {
    const scrapeBundle = vi.fn<BundleFn>(async () => bundle());
    const onEvidence = vi.fn();

    await calibrateFromScrape(INPUT, deps(scrapeBundle, onEvidence));

    expect(typeof scrapeBundle.mock.calls[0]![2]).toBe("function");
  });

  it("passes NO callback when nothing is listening — the blocking path stays in use", async () => {
    // Polling with no listener is pure cost for no benefit: there is nothing on screen to
    // update, so the cheap `.call()` path must remain.
    const scrapeBundle = vi.fn<BundleFn>(async () => bundle());

    await calibrateFromScrape(INPUT, deps(scrapeBundle));

    expect(scrapeBundle.mock.calls[0]![2]).toBeUndefined();
  });

  it("turns each partial into an evidence frame, growing as posts land", async () => {
    // The real shape of the run: the profile appears first, then the posts accumulate.
    const scrapeBundle = vi.fn(
      async (
        _h: string,
        _l?: number,
        onPartial?: (p: { profile: ProfileData | null; videos: VideoData[] }) => void,
      ) => {
        onPartial?.({ profile: profile(), videos: [] });
        onPartial?.({ profile: profile(), videos: [video(10), video(20)] });
        onPartial?.({ profile: profile(), videos: [video(10), video(20), video(30)] });
        return bundle();
      },
    );
    const onEvidence = vi.fn();

    await calibrateFromScrape(INPUT, deps(scrapeBundle, onEvidence));

    // Three partials + the final post-scrape emission the pipeline already made.
    expect(onEvidence.mock.calls.length).toBeGreaterThanOrEqual(3);

    const first = onEvidence.mock.calls[0]![0];
    expect(first.handle).toBe("testcreator");
    expect(first.followerCount).toBe(1000);
    expect(first.videos).toEqual([]); // avatar lands before any post does

    const third = onEvidence.mock.calls[2]![0];
    expect(third.videos).toHaveLength(3);
  });

  it("ignores a partial with no profile yet rather than emitting a blank card", async () => {
    // An early poll can return rows the remapper cannot read as a profile. Emitting that would
    // paint an empty avatar and a zero follower count over the real wait.
    const scrapeBundle = vi.fn(
      async (
        _h: string,
        _l?: number,
        onPartial?: (p: { profile: ProfileData | null; videos: VideoData[] }) => void,
      ) => {
        onPartial?.({ profile: null, videos: [] });
        return bundle();
      },
    );
    const onEvidence = vi.fn();

    await calibrateFromScrape(INPUT, deps(scrapeBundle, onEvidence));

    for (const call of onEvidence.mock.calls) {
      expect(call[0].handle).toBeTruthy();
    }
  });
});
