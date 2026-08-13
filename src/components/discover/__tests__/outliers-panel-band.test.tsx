/** @vitest-environment happy-dom */
/**
 * The feed badge must carry the band's honesty flag (B1, Task 9).
 *
 * Before the one-band rule, thin-baseline extremes never reached this feed, so the card badge
 * could render one unconditional green `▲ N×`. Task 9 admits them with the number clamped at
 * 100× — which turns that unconditional badge into a false proof claim: a real number from a
 * baseline of ~1k views, printed in the same green as a genuine 5× receipt.
 *
 * `MultiplierChip` (discover-primitives.tsx) already encodes the correct rule, but the feed does
 * NOT use it — the card draws its own badge over the cover scrim. These tests exist because that
 * duplication is invisible from the schema side: `corpus-reads` can be perfectly honest while the
 * pixel a creator actually sees is not.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { OutliersPanel } from "@/components/discover/outliers-panel";
import { ToastProvider } from "@/components/ui/toast";
import type { CorpusVideo } from "@/lib/discover/corpus-reads";

afterEach(cleanup);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/feed",
  useSearchParams: () => new URLSearchParams(),
}));

function renderPanel(videos: CorpusVideo[]): ReturnType<typeof render> {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const ui: ReactElement = (
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <OutliersPanel videos={videos} query="" refreshedLabel="today" onOpen={vi.fn()} />
      </ToastProvider>
    </QueryClientProvider>
  );
  return render(ui);
}

const video = (over: Partial<CorpusVideo>): CorpusVideo => ({
  id: "v1",
  videoUrl: "https://tiktok.com/@x/video/1",
  coverUrl: null,
  handle: "somebody",
  spokenHook: "The one habit that changed my mornings",
  template: null,
  archetype: null,
  niche: "wellness",
  views: 2_400_000,
  platform: "tiktok",
  engagement: 0.02,
  postedAt: "2026-05-18T00:00:00Z",
  multiplier: 12,
  baselineLabel: "vs their usual views",
  proven: true,
  extreme: false,
  ...over,
});

describe("outliers feed badge — the band's flag survives the trip to the pixel", () => {
  it("prints a genuine receipt in proven green with the ▲", () => {
    renderPanel([video({ multiplier: 12, extreme: false })]);
    const badge = screen.getByText(/▲\s*12/);
    expect(badge.className).toContain("--color-positive");
  });

  it("does NOT print a clamped thin-baseline row in proven green", () => {
    renderPanel([video({ id: "x", multiplier: 100, extreme: true })]);
    // The number is real and still shown — it is the PROOF styling that must not apply.
    const badge = screen.getByText(/100×/);
    expect(badge.className).not.toContain("--color-positive");
  });

  it("flags the clamped row with ⚠ and drops the ▲ that means 'proven'", () => {
    renderPanel([video({ id: "x", multiplier: 100, extreme: true })]);
    expect(screen.getByText(/100×\s*⚠/)).toBeTruthy();
    expect(screen.queryByText(/▲\s*100/)).toBeNull();
  });

  it("says why, on hover, rather than leaving a bare glyph", () => {
    renderPanel([video({ id: "x", multiplier: 100, extreme: true })]);
    expect(screen.getByText(/100×\s*⚠/).getAttribute("title")).toMatch(/thin baseline/i);
  });

  it("still makes no claim at all when there is no multiplier", () => {
    renderPanel([video({ id: "x", multiplier: null, extreme: false })]);
    expect(screen.queryByText(/▲/)).toBeNull();
    expect(screen.queryByText(/⚠/)).toBeNull();
  });
});

/**
 * Owner ruling 2026-08-12: in the multiplier sort, flagged rows come LAST.
 *
 * Clamping ties all 55 extremes at exactly 100×, so ordering on the number alone puts every
 * thin-baseline row above every genuine receipt — "Highest ×" would open on 24 identical
 * `100× ⚠` tiles and bury a real 41.6×. Measured in a browser before this rule existed.
 */
describe("Highest × — the best real receipt leads", () => {
  it("ranks an in-band receipt above a clamped thin-baseline row", async () => {
    const { rerender } = renderPanel([
      video({ id: "extreme", multiplier: 100, extreme: true, spokenHook: "THIN BASELINE ROW" }),
      video({ id: "real", multiplier: 41.6, extreme: false, spokenHook: "GENUINE RECEIPT ROW" }),
    ]);
    void rerender;

    await import("@testing-library/user-event").then(async ({ default: userEvent }) => {
      await userEvent.click(screen.getByRole("button", { name: /Highest/ }));
    });

    const text = document.body.innerText || document.body.textContent || "";
    expect(text.indexOf("GENUINE RECEIPT ROW")).toBeGreaterThan(-1);
    expect(text.indexOf("GENUINE RECEIPT ROW")).toBeLessThan(text.indexOf("THIN BASELINE ROW"));
  });
});
