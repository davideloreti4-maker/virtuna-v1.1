/** @vitest-environment happy-dom */
/**
 * as-before.test.tsx — the weights came on 2026-11-24 (X122), and an edit that carries none draws exactly as before (X131).
 * Held here two ways: a digest of every box the kit lays out for settings with no weight, frozen on the code as it stood
 * before the weights came (`987b4e8f`); and the weights, gaps and edges the kit draws with none.
 *
 * The words are measured with the server's width tables (`src/lib/edit/measure.ts`), for the layout and for the component
 * alike: happy-dom has no layout engine for the browser's `measureText`, so the tables stand in for it, as in
 * sentence-pages.test.tsx. The words are made up.
 */
import { Thumbnail } from "@remotion/player";
import { render } from "@testing-library/react";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { CAPTION_LOOKS, DEFAULT_CAPTIONS, STAGE, type Captions as CaptionSettings } from "../../../lib/edit/doc";
import type { SaidWord } from "../../../lib/edit/derive";
import { FONTS } from "../../../lib/edit/parts";
import { measure, type FontId } from "../../../lib/edit/measure";
import { Captions } from "../Captions";
import { calloutBox, captionPages, titleBox, type CalloutProps, type Measure, type TitleProps } from "../layout";
import { Title } from "../parts/Title";

vi.mock("../fonts", async (real) => {
  const { measure: tables } = await import("../../../lib/edit/measure");
  return {
    ...(await real<typeof import("../fonts")>()),
    measuredIn: (font: FontId) => (text: string, weight: number, size: number, trackingEm?: number) => tables(text, font, weight, size, trackingEm) ?? Number.NaN,
  };
});
const tables = (font: FontId): Measure => (text, weight, size, trackingEm) => {
  const width = measure(text, font, weight, size, trackingEm);
  if (width === null) throw new Error(`the tables cannot measure ${JSON.stringify(text)}`);
  return width;
};

/** Every box laid out below, as JSON through SHA-256, on the code before the weights came (`987b4e8f`). */
const AS_BEFORE = "30bef614cedb23580c84c1858c4129e52cf75321b79f1635556a042a9c76ee3e";

/** Made up: sixteen words; the second and the eighth stressed. */
const SENTENCE = "so this is the one small change that makes every video you post feel much clearer".split(" ");
const words = (n: number) => SENTENCE.slice(0, n).map((text, i) => ({ text, stress: i === 1 || i === 7 }));
const settings = (over: Partial<CaptionSettings>): CaptionSettings => ({ ...DEFAULT_CAPTIONS, maxWords: 16, ...over });
const TITLE_LOOKS = ["bold", "label", "outline"] as const;
const TITLE_TEXTS = ["Make it *count*", "Here is the one change that makes it work"];
const CALLOUT_LOOKS = ["pop", "label"] as const;
const title = (over: Partial<TitleProps>): TitleProps => ({ text: "Make it *count*", font: "tiktok", look: "label", y: 0.2, size: 84, color: "#ffffff", accent: "#ffe14a", ...over });
const callout = (over: Partial<CalloutProps>): CalloutProps => ({ text: "Look here", font: "tiktok", look: "pop", x: 0.5, y: 0.4, size: 120, color: "#ffffff", ...over });

/** The captions drawn on one frame of a run holding one page of `said`. */
function drawnCaptions(captions: CaptionSettings, said: SaidWord[], frame: number) {
  const last = said[said.length - 1]!;
  const { container } = render(
    <Thumbnail component={Captions} inputProps={{ settings: captions, pages: [{ from: 0, to: last.to + 10, words: said }] }} compositionWidth={STAGE.w} compositionHeight={STAGE.h} fps={30} durationInFrames={last.to + 10} frameToDisplay={frame} />,
  );
  const part = container.querySelector<HTMLElement>('[data-part="captions"]');
  if (!part) throw new Error(`no captions drawn on frame ${frame}`);
  const rows = [...part.children] as HTMLElement[];
  const spans = rows.flatMap((row) => ([...row.children] as HTMLElement[]).map((span) => ({ span, text: span.textContent ?? "" })));
  return { part, rows, spans };
}
/** The dark edge an element is drawn with: React sets it as the style's `WebkitTextStroke`, which happy-dom keeps as that property alone. */
const strokeOf = (element: HTMLElement): unknown => (element.style as unknown as Record<string, unknown>).WebkitTextStroke;
/** A title drawn on frame 20, at rest: its element. */
function drawnTitle(props: TitleProps): HTMLElement {
  const shown = { at: 0, frames: 60, skip: 0, toEnd: false, src: null, kind: null, fileMs: null } as const;
  const { container } = render(<Thumbnail component={Title} inputProps={{ ...shown, settings: props }} compositionWidth={STAGE.w} compositionHeight={STAGE.h} fps={30} durationInFrames={60} frameToDisplay={20} />);
  const element = container.querySelector<HTMLElement>('[data-part="title"]');
  if (!element) throw new Error("no title drawn");
  return element;
}

describe("an edit with no weight draws exactly as before the weights came", () => {
  it("lays out every caption page, title and call-out of an edit with no weight exactly as before this slice", () => {
    const boxes: unknown[] = [];
    for (const font of FONTS) {
      for (const look of CAPTION_LOOKS) for (const size of [44, 64, 96, 150]) boxes.push(captionPages(settings({ font, look, size }), [words(3), words(8), words(16)], tables(font)));
      for (const look of TITLE_LOOKS) for (const size of [48, 84, 130, 220]) for (const text of TITLE_TEXTS) boxes.push(titleBox(title({ font, look, size, text }), tables(font)));
      for (const look of CALLOUT_LOOKS) for (const size of [44, 120, 200]) boxes.push(calloutBox(callout({ font, look, size }), tables(font)));
    }
    expect(boxes).toHaveLength(3 * (4 * 4 + 3 * 4 * 2 + 2 * 3));
    expect(createHash("sha256").update(JSON.stringify(boxes)).digest("hex")).toBe(AS_BEFORE);
  });

  it("draws captions with no weight as before", () => {
    const said: SaidWord[] = words(3).map((word, i) => ({ ...word, from: i * 6, to: i * 6 + 5 }));
    for (const look of CAPTION_LOOKS) {
      for (const size of [44, 64, 96]) {
        const { part, rows, spans } = drawnCaptions(settings({ look, size }), said, 2);
        const at = `${look} ${size}`;
        expect(part.style.fontWeight, at).toBe("800");
        expect(spans.map(({ span }) => span.style.fontWeight), at).toEqual(["800", "900", "800"]);
        for (const row of rows) expect(row.style.columnGap, at).toBe(`${Math.round(0.34 * size)}px`);
        if (look !== "pill") expect(strokeOf(part), at).toBe(`${size * 0.09}px rgba(0, 0, 0, 0.9)`);
      }
    }
  });

  it("draws a title with no weight as before", () => {
    expect(drawnTitle(title({ look: "label" })).style.fontWeight).toBe("700");
    expect(drawnTitle(title({ look: "bold" })).style.fontWeight).toBe("800");
    expect(drawnTitle(title({ look: "outline" })).style.fontWeight).toBe("800");
  });
});
