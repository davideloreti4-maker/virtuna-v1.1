/** @vitest-environment happy-dom */
/**
 * sentence-pages.test.tsx — caption pages of up to 16 words (Task K1): a whole short sentence, set in rows by the kit's own
 * line breaking (`lines.ts`, `layout.ts`) and drawn by `Captions.tsx` itself, one frame at a time (`Thumbnail`).
 *
 * The words are measured with the server's width tables (`src/lib/edit/measure.ts`), for the layout and for the component
 * alike. The component measures in the browser (`measuredIn`), which needs a browser's layout engine; happy-dom has none, so
 * the tables stand in for it, the one substitution here. The two agree to within 0.11 px from 12 to 100 px (Chromium 0.016, WebKit 0.109)
 * (`scripts/edit-measure-proof.ts`), and in Chromium the preview-against-render proof holds the drawn boxes to these.
 * The words are made up.
 */
import { Thumbnail } from "@remotion/player";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CAPTION_LOOKS, DEFAULT_CAPTIONS, STAGE, type Captions as CaptionSettings } from "../../../lib/edit/doc";
import type { SaidWord } from "../../../lib/edit/derive";
import { FONTS } from "../../../lib/edit/parts";
import { measure, type FontId } from "../../../lib/edit/measure";
import { Captions } from "../Captions";
import { captionPages, type Measure } from "../layout";

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

/** Made up: one sentence, the first `n` words of it a page. */
const SENTENCE = "so here is the thing nobody tells you about making short videos that people watch right to the end".split(" ");
const LENGTHS = [8, 12, 16] as const;
const SIZES = [44, 52, 64] as const;
/** Each word six frames after the one before it, five frames long; the third and the ninth stressed. */
const said = (n: number): SaidWord[] => SENTENCE.slice(0, n).map((text, i) => ({ text, from: i * 6, to: i * 6 + 5, stress: i === 2 || i === 8 }));
const settings = (over: Partial<CaptionSettings>): CaptionSettings => ({ ...DEFAULT_CAPTIONS, maxWords: 16, ...over });

/** The captions drawn on one frame of a run holding one page of `words`. */
function drawn(captions: CaptionSettings, words: SaidWord[], frame: number) {
  const last = words[words.length - 1]!;
  const { container } = render(
    <Thumbnail component={Captions} inputProps={{ settings: captions, pages: [{ from: 0, to: last.to + 10, words }] }} compositionWidth={STAGE.w} compositionHeight={STAGE.h} fps={30} durationInFrames={last.to + 10} frameToDisplay={frame} />,
  );
  const part = container.querySelector<HTMLElement>('[data-part="captions"]');
  if (!part) throw new Error(`no captions drawn on frame ${frame}`);
  const rows = [...part.children] as HTMLElement[];
  const spans = rows.flatMap((row, r) => ([...row.children] as HTMLElement[]).map((span) => ({ row: r, span, text: span.textContent ?? "" })));
  return { part, rows, spans };
}
const px = (value: string): number => Number(value.replace(/px$/, ""));
const scaleOf = (span: HTMLElement): number => Number(/scale\(([\d.]+)\)/.exec(span.style.transform)?.[1] ?? Number.NaN);

describe("caption pages of up to 16 words: set in rows by the kit's own line breaking", () => {
  it("sets 8, 12 and 16 words at 44, 52 and 64 px in one to three rows, only 16 at 64 px running to four, in every look and typeface", () => {
    for (const font of FONTS) {
      for (const look of CAPTION_LOOKS) {
        const rows = LENGTHS.map((n) => SIZES.map((size) => captionPages(settings({ font, look, size }), [said(n)], tables(font))[0]!.rows.length));
        // 8 words at 44 px fit on one row; at 52 px on one or two, as the look's padding leaves room.
        expect(rows[0]![0], `${font} ${look}`).toBe(1);
        expect(rows[0]![2], `${font} ${look}`).toBe(2);
        expect(rows[1], `${font} ${look}`).toEqual([2, expect.any(Number), 3]);
        expect(rows[1]![1], `${font} ${look}`).toBeGreaterThanOrEqual(2);
        expect(rows[1]![1], `${font} ${look}`).toBeLessThanOrEqual(3);
        expect(rows[2], `${font} ${look}`).toEqual([3, 3, 4]);
      }
    }
  });

  it("keeps the words in order, each row inside the room and as even as the kit's breaking makes it", () => {
    for (const look of CAPTION_LOOKS) {
      for (const n of LENGTHS) {
        for (const size of SIZES) {
          const captions = settings({ look, size });
          const [page] = captionPages(captions, [said(n)], tables("tiktok"));
          const room = 928 - 2 * (look === "pill" ? Math.round(0.46 * size) : look === "highlight" ? Math.round(0.16 * size) : 0); // even(0.86 × 1080) less the look's side
          expect(page!.rows.map((row) => [row.from, row.to]).flat(), `${look} ${n} at ${size}`).toEqual(page!.breaks.flatMap((from, i) => [from, page!.breaks[i + 1] ?? n]));
          for (const row of page!.rows) expect(row.width, `${look} ${n} at ${size}`).toBeLessThanOrEqual(room + 1); // even() may round a row up by one
          expect(page!.size, `${look} ${n} at ${size}: no word too wide, so the type is as asked`).toBe(size);
        }
      }
    }
  });

  it("holds every page inside the stage, low where creators set captions and at the stage's top and bottom edges", () => {
    for (const look of CAPTION_LOOKS) {
      for (const n of LENGTHS) {
        for (const size of SIZES) {
          for (const y of [0, 0.74, 1]) {
            const [page] = captionPages(settings({ look, size, y }), [said(n)], tables("tiktok"));
            const at = `${look} ${n} at ${size}, y ${y}`;
            expect(page!.x, at).toBeGreaterThanOrEqual(0);
            expect(page!.x + page!.w, at).toBeLessThanOrEqual(STAGE.w);
            // 0.02 of the stage's height kept at the top and the bottom, to the whole pixel the centre is rounded to.
            expect(page!.y, at).toBeGreaterThanOrEqual(0.02 * STAGE.h - 0.5);
            expect(page!.y + page!.h, at).toBeLessThanOrEqual(0.98 * STAGE.h + 0.5);
          }
        }
      }
    }
  });
});

describe("caption pages of up to 16 words: as Captions.tsx draws them", () => {
  it("draws every row the layout gives, each as wide as it says, and the pill's box around all of them", () => {
    for (const n of LENGTHS) {
      for (const size of SIZES) {
        const captions = settings({ look: "pill", size });
        const [page] = captionPages(captions, [said(n)], tables("tiktok"));
        const { part, rows } = drawn(captions, said(n), 1);
        const at = `${n} words at ${size} px`;
        expect(rows.map((row) => px(row.style.width)), at).toEqual(page!.rows.map((row) => row.width));
        expect(rows.map((row) => row.children.length), at).toEqual(page!.rows.map((row) => row.to - row.from));
        // One box: the page's own, dark, rounded, holding every row with the pill's padding above, below and at each side.
        expect(part.style.backgroundColor, at).toBe("rgba(0, 0, 0, 0.78)");
        expect([px(part.style.width), px(part.style.height)], at).toEqual([page!.w, page!.h]);
        expect(page!.h, at).toBe(rows.length * page!.pitch + (rows.length - 1) * page!.rowGap + 2 * page!.pad);
        expect(page!.w, at).toBe(Math.max(...page!.rows.map((row) => row.width)) + 2 * page!.side);
        expect(part.style.padding, at).toBe(`${page!.pad}px ${page!.side}px`);
        expect([px(part.style.rowGap), px(part.style.lineHeight)], at).toEqual([page!.rowGap, page!.pitch]);
        for (const row of rows) expect(row.style.backgroundColor, at).toBe(""); // no box of its own: the rows share the page's
      }
    }
  });

  it("colours only the word being said, in whichever row it is, in pill, pop and highlight; and pops it in pop alone", () => {
    for (const look of ["pill", "pop", "highlight"] as const) {
      for (const n of LENGTHS) {
        const size = 52;
        const captions = settings({ look, size, highlight: "#ffe14a" });
        const [page] = captionPages(captions, [said(n)], tables("tiktok"));
        // The first word of every row, and the page's last word: two frames after each starts.
        const asked = [...page!.breaks, n - 1];
        for (const word of asked) {
          const { spans } = drawn(captions, said(n), word * 6 + 2);
          const at = `${look}, ${n} words, word ${word}`;
          const shown = spans[word]!;
          expect(shown.text, at).toBe(SENTENCE[word]);
          expect(shown.row, at).toBe(page!.rows.findIndex((row) => word >= row.from && word < row.to));
          const coloured = spans.filter((each) => (look === "highlight" ? each.span.querySelector("span[style*='background-color']") !== null : each.span.style.color === "#ffe14a"));
          expect(coloured.map((each) => each.text), at).toEqual([SENTENCE[word]]);
          if (look === "highlight") expect(shown.span.style.color, at).toBe("#111111");
          // The pop: the said word grows while it lands, the others stay as they are.
          const scales = spans.map((each) => scaleOf(each.span));
          if (look === "pop") expect(scales[word], at).toBeGreaterThan(1);
          else expect(scales[word], at).toBe(1);
          expect(scales.filter((_, i) => i !== word).every((scale) => scale === 1), at).toBe(true);
        }
      }
    }
  });

  it("colours the stressed words in plain, wherever they are, and pops nothing", () => {
    for (const n of LENGTHS) {
      const captions = settings({ look: "plain", size: 52, highlight: "#ffe14a" });
      for (const frame of [2, 26, n * 6 - 4]) {
        const { spans } = drawn(captions, said(n), frame);
        expect(spans.filter((each) => each.span.style.color === "#ffe14a").map((each) => each.text), `${n} words, frame ${frame}`).toEqual([2, 8].filter((i) => i < n).map((i) => SENTENCE[i]));
        expect(spans.every((each) => scaleOf(each.span) === 1), `${n} words, frame ${frame}`).toBe(true);
      }
    }
  });
});
