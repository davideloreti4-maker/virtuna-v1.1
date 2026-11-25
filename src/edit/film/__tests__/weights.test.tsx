/** @vitest-environment happy-dom */
/**
 * weights.test.tsx — captions and a title drawn at the weight they carry (X122, X123): the captions' words at it, a stressed
 * word one step heavier (with a highlight colour, as `DEFAULT_CAPTIONS` has; a plain page with a weight and none draws it at
 * the captions' own, Task 3), a title and a call-out at their own. Drawn by `Captions.tsx`, `Title.tsx` and `Callout.tsx` themselves, one frame at a time
 * (`Thumbnail`), with the server's width tables standing in for the browser's `measureText`, which happy-dom cannot run (as
 * in sentence-pages.test.tsx). The words are made up.
 */
import { Thumbnail } from "@remotion/player";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CAPTION_LOOKS, DEFAULT_CAPTIONS, STAGE, type Captions as CaptionSettings } from "../../../lib/edit/doc";
import type { SaidWord } from "../../../lib/edit/derive";
import { measure, type FontId } from "../../../lib/edit/measure";
import { Captions } from "../Captions";
import { PLAIN_EDGE, captionPages, edgeOf, spaceEm, type CalloutProps, type TitleProps } from "../layout";
import { Callout } from "../parts/Callout";
import { Title } from "../parts/Title";

vi.mock("../fonts", async (real) => {
  const { measure: tables } = await import("../../../lib/edit/measure");
  return {
    ...(await real<typeof import("../fonts")>()),
    measuredIn: (font: FontId) => (text: string, weight: number, size: number, trackingEm?: number) => tables(text, font, weight, size, trackingEm) ?? Number.NaN,
  };
});

/** Made up: three words, the second stressed. */
const SAID: SaidWord[] = ["keep", "this", "simple"].map((text, i) => ({ text, from: i * 6, to: i * 6 + 5, stress: i === 1 }));
const shown = { at: 0, frames: 60, skip: 0, toEnd: false, src: null, kind: null, fileMs: null } as const;

describe("weights: what the kit draws at the weight an edit gives", () => {
  it("draws captions at their weight and a stressed word one step heavier, and a title at its weight", () => {
    for (const look of CAPTION_LOOKS) {
      const { container } = render(
        <Thumbnail component={Captions} inputProps={{ settings: { ...DEFAULT_CAPTIONS, look, weight: 600 }, pages: [{ from: 0, to: 30, words: SAID }] }} compositionWidth={STAGE.w} compositionHeight={STAGE.h} fps={30} durationInFrames={30} frameToDisplay={2} />,
      );
      const part = container.querySelector<HTMLElement>('[data-part="captions"]');
      if (!part) throw new Error(`no captions drawn in ${look}`);
      expect(part.style.fontWeight, look).toBe("600");
      const spans = [...part.children].flatMap((row) => [...row.children] as HTMLElement[]);
      expect(spans.map((span) => span.style.fontWeight), look).toEqual(["600", "700", "600"]);
    }
    for (const look of ["bold", "label", "outline"] as const) {
      const settings: TitleProps = { text: "Make it *count*", font: "tiktok", look, y: 0.2, size: 84, color: "#ffffff", accent: null, weight: 600 };
      const { container } = render(<Thumbnail component={Title} inputProps={{ ...shown, settings }} compositionWidth={STAGE.w} compositionHeight={STAGE.h} fps={30} durationInFrames={60} frameToDisplay={20} />);
      expect(container.querySelector<HTMLElement>('[data-part="title"]')?.style.fontWeight, look).toBe("600");
    }
  });

  it("draws a label call-out at its weight, and with none at 800", () => {
    const label: CalloutProps = { text: "Right here", font: "tiktok", look: "label", x: 0.5, y: 0.7, size: 84, color: "#111111" };
    for (const [settings, drawn] of [[{ ...label, weight: 600 }, "600"], [label, "800"]] as const) {
      const { container } = render(<Thumbnail component={Callout} inputProps={{ ...shown, settings }} compositionWidth={STAGE.w} compositionHeight={STAGE.h} fps={30} durationInFrames={60} frameToDisplay={20} />);
      const part = container.querySelector<HTMLElement>('[data-part="callout"]');
      if (!part) throw new Error(`no call-out drawn at ${drawn}`);
      expect(part.style.fontWeight, drawn).toBe(drawn);
    }
  });

  it("draws each word of a plain page with a weight at the weight the layout (review's path) measures it at: one weight with no highlight colour, the step with one", () => {
    for (const [highlight, drawn] of [[null, ["600", "600", "600"]], ["#ffe14a", ["600", "700", "600"]]] as const) {
      const settings: CaptionSettings = { ...DEFAULT_CAPTIONS, look: "plain", font: "tiktok", size: 58, weight: 600, highlight };
      // `review` lays a page out with `captionPages` and the tables; record the weight each word is measured at.
      const measured = new Map<string, Set<number>>();
      const [laid] = captionPages(settings, [SAID], (text, weight, size, trackingEm) => {
        measured.set(text, (measured.get(text) ?? new Set()).add(weight));
        return measure(text, "tiktok", weight, size, trackingEm) ?? Number.NaN;
      });
      if (!laid) throw new Error("no page laid out");
      const { container } = render(
        <Thumbnail component={Captions} inputProps={{ settings, pages: [{ from: 0, to: 30, words: SAID }] }} compositionWidth={STAGE.w} compositionHeight={STAGE.h} fps={30} durationInFrames={30} frameToDisplay={2} />,
      );
      const part = container.querySelector<HTMLElement>('[data-part="captions"]');
      if (!part) throw new Error("no captions drawn");
      const spans = [...part.children].flatMap((row) => [...row.children] as HTMLElement[]);
      expect(spans.map((span) => span.style.fontWeight), String(highlight)).toEqual(drawn);
      SAID.forEach((word, i) => {
        expect([...(measured.get(word.text) ?? [])].map(String), `${highlight} ${word.text}`).toEqual([drawn[i]]);
        expect(laid.widths[i], `${highlight} ${word.text}`).toBe(Math.ceil(measure(word.text, "tiktok", Number(drawn[i]), laid.size) ?? Number.NaN));
      });
    }
  });

  it("draws a sentence page with the gap and the edge layout.ts gives", () => {
    const settings: CaptionSettings = { ...DEFAULT_CAPTIONS, look: "plain", font: "tiktok", size: 64, weight: 600 };
    const [laid] = captionPages(settings, [SAID], (text, weight, size, trackingEm) => measure(text, "tiktok", weight, size, trackingEm) ?? Number.NaN);
    if (!laid) throw new Error("no page laid out");
    expect(laid.gap).toBe(Math.round(spaceEm("tiktok", 600) * laid.size)); // a sentence's gap, not 0.34 em
    const { container } = render(
      <Thumbnail component={Captions} inputProps={{ settings, pages: [{ from: 0, to: 30, words: SAID }] }} compositionWidth={STAGE.w} compositionHeight={STAGE.h} fps={30} durationInFrames={30} frameToDisplay={2} />,
    );
    const part = container.querySelector<HTMLElement>('[data-part="captions"]');
    if (!part) throw new Error("no captions drawn");
    const rows = [...part.children] as HTMLElement[];
    expect(rows).toHaveLength(laid.rows.length);
    for (const row of rows) expect(row.style.columnGap).toBe(`${laid.gap}px`);
    expect((part.style as unknown as Record<string, unknown>).WebkitTextStroke).toBe(`${edgeOf(settings, laid.size)}px rgba(0, 0, 0, 0.9)`);
    expect(edgeOf(settings, laid.size)).toBe(PLAIN_EDGE * laid.size);
  });
});
