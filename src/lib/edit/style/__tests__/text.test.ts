/**
 * What a reference's measured text says of its captions, its title and the rest (`textOf`, part 3 Task 9b), on made-up text
 * samples as the worker's text stage gives them (`worker/media/text.py`). Widths are the kit's own (`measure`), so the fonts
 * are told apart by the real tables.
 */
import { describe, expect, it } from "vitest";
import { TakeAnalysisSchema, type TakeAnalysis, type TextLine, type TextSample } from "../../analysis";
import { measure } from "../../measure";
import { TEXT_RULES, seenOf, textOf } from "../text";

/* ── made-up samples ───────────────────────────────────────────────────────────────────────────── */

type Colour = TextLine["colours"][number];
const WHITE: Colour = { hex: "#ffffff", share: 0.3, from: 0.05, to: 0.95 };
const PILL_INSIDE: Colour = { hex: "#141210", share: 0.6, from: 0.02, to: 0.98 };
const PILL_RING = [{ hex: "#151311", share: 1 }];
const VIDEO_RING = [{ hex: "#8a7a6a", share: 0.5 }, { hex: "#3a3028", share: 0.3 }, { hex: "#c8b8a8", share: 0.2 }];
const EDGE: Colour = { hex: "#0a0a0a", share: 0.2, from: 0.04, to: 0.96 };

/** A line of `text` centred across the stage at centre `y`, `h` high, as wide as `wide` (a share of the picture's width). */
function line(text: string, y: number, wide: number, over: Partial<TextLine> = {}, h = 0.04): TextLine {
  return { box: { x: round4(0.5 - wide / 2), y: round4(y - h / 2), w: round4(wide), h }, text, score: 0.98, colours: [PILL_INSIDE, WHITE], around: PILL_RING, ...over };
}
/**
 * The box share a row of `text` takes in `font` at `size`, as the kit sets a caption row (each word measured, 0.34 of the size
 * between two) and the reader boxes it: `pad` stage pixels wider (about 11 on the six films).
 */
const wideOf = (text: string, font: "inter" | "montserrat" | "tiktok", size: number, pad = 11): number => {
  const words = text.split(" ");
  return (words.reduce((sum, word) => sum + measure(word, font, 800, size)!, 0) + 0.34 * size * (words.length - 1) + pad) / 1080;
};
const round4 = (value: number): number => Math.round(value * 10_000) / 10_000;
const at = (ms: number, ...lines: TextLine[]): TextSample => ({ ms, lines });
/** The moments the worker reads in a reference `ms` long (`moments` in text.py). */
function moments(ms: number): number[] {
  const dense = Array.from({ length: 16 }, (_, i) => 250 + i * 500).filter((each) => each < ms);
  const rest = ms - 8000;
  if (rest <= 0) return dense;
  return [...dense, ...Array.from({ length: 24 }, (_, i) => 8000 + Math.floor(((i + 0.5) * rest) / 24))];
}
const analysisOf = (text: TextSample[] | undefined): TakeAnalysis => ({ language: "en", pauses: [], faces: [], loudness: null, cuts: [], picture: [], ...(text ? { text } : {}) });

/** Caption pages that change at every moment, `perPage` words each, in `font` at `size`, at centre `y`. */
const WORDS = ["make", "the", "first", "second", "count", "because", "people", "scroll", "past", "slow", "openings", "every", "single", "time", "so", "start", "with", "the", "point", "then", "show", "proof", "and", "finish", "strong"];
function captions(ms: number[], y: number, font: "inter" | "montserrat" | "tiktok", size: number, perPage = 3, over: (i: number) => Partial<TextLine> = () => ({})): TextLine[] {
  return ms.map((_, i) => {
    const text = Array.from({ length: perPage }, (__, k) => WORDS[(i * perPage + k) % WORDS.length]).join(" ");
    return line(text, y, wideOf(text, font, size), over(i));
  });
}
/** Samples: at each moment, the caption line of that moment and whatever `more` adds. */
function samples(ms: number[], lines: TextLine[], more: (at: number) => TextLine[] = () => []): TextSample[] {
  return ms.map((each, i) => at(each, ...more(each), lines[i]!));
}

const THIRTY = moments(30_000);

/* ── the analysis's text ───────────────────────────────────────────────────────────────────────── */

describe("the analysis's text", () => {
  it("parses an analysis with text, and an old one or a take's without it", () => {
    const withText = { ...analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72))) };
    expect(TakeAnalysisSchema.parse(withText).text).toHaveLength(40);
    expect(TakeAnalysisSchema.parse(analysisOf(undefined)).text).toBeUndefined();
    expect(TakeAnalysisSchema.safeParse({ ...withText, text: [at(500), at(500)] }).success).toBe(false);
  });

  it("reads nothing from a reference with no text on screen, and refuses one analysed before its text was measured", () => {
    expect(textOf(analysisOf(THIRTY.map((ms) => at(ms))), 30_000)).toEqual({ captions: null, title: null, other: [] });
    // As `measuresOf` refuses an analysis made before part 3 (review, Minor 10): not read as "no captions".
    expect(() => textOf(analysisOf(undefined), 30_000)).toThrow(/analysed before its text was measured/);
  });

  it("parses a line's ring beyond and the analysis's sheet, and an older analysis without them (Task 9c)", () => {
    const lines = [line("one two", 0.5, 0.3, { beyond: [{ hex: "#8a7a6a", share: 0.9 }] })];
    const parsed = TakeAnalysisSchema.parse({ ...analysisOf([at(250, ...lines)]), sheet: { file: "sheet.jpg", ms: [250] } });
    expect(parsed.text![0]!.lines[0]!.beyond).toEqual([{ hex: "#8a7a6a", share: 0.9 }]);
    expect(parsed.sheet).toEqual({ file: "sheet.jpg", ms: [250] });
    expect(TakeAnalysisSchema.parse(analysisOf([at(250, line("one two", 0.5, 0.3))])).sheet).toBeUndefined();
  });
});

/* ── pages and the caption band ────────────────────────────────────────────────────────────────── */

describe("textOf: pages and the caption band", () => {
  it("takes two stacked rows as one page: its words counted together, its place the block's middle", () => {
    const rows = THIRTY.map((_, i) => [line(`${WORDS[i % 20]} ${WORDS[(i + 1) % 20]}`, 0.6, 0.4), line(`${WORDS[(i + 2) % 20]} two`, 0.6 + 0.04 + 0.6 * 0.04 * 0.9, 0.3)]);
    const read = textOf(analysisOf(THIRTY.map((ms, i) => at(ms, ...rows[i]!))), 30_000);
    expect(read.captions?.maxWords).toBe(4);
    expect(read.captions?.pages).toBe(40);
    expect(read.captions?.y).toBeCloseTo(0.6 + (0.04 + 0.6 * 0.04 * 0.9) / 2, 3);
  });

  it("keeps rows apart that are further apart than 0.6 of a row's height: two pages, each of two words", () => {
    const rows = THIRTY.map((_, i) => [line(`${WORDS[i % 20]} one`, 0.6, 0.4), line(`${WORDS[(i + 2) % 20]} two`, 0.6 + 0.04 + 0.6 * 0.04 * 1.2, 0.3)]);
    expect(textOf(analysisOf(THIRTY.map((ms, i) => at(ms, ...rows[i]!))), 30_000).captions?.maxWords).toBe(2);
  });

  it("joins pieces of one row the reader gave apart (a coloured word cut off) into one row", () => {
    const pieces = THIRTY.map((_, i) => {
      const [a, b] = [`${WORDS[i % 20]} ${WORDS[(i + 1) % 20]}`, WORDS[(i + 2) % 20]!];
      const [wa, wb] = [wideOf(a, "inter", 72), wideOf(b, "inter", 72)];
      const left = 0.5 - (wa + wb) / 2;
      return [{ ...line(a, 0.8, wa), box: { x: round4(left), y: 0.78, w: round4(wa), h: 0.04 } }, { ...line(b, 0.8, wb), box: { x: round4(left + wa + 0.005), y: 0.781, w: round4(wb), h: 0.038 } }];
    });
    const read = textOf(analysisOf(THIRTY.map((ms, i) => at(ms, ...pieces[i]!))), 30_000);
    expect(read.captions?.maxWords).toBe(3);
    expect(read.captions?.pages).toBe(40);
  });

  it("finds the captions in the band of 0.05 bins with the most pages that change, not where a line stays the same", () => {
    const still = line("follow for more", 0.45, 0.3, { colours: [WHITE], around: VIDEO_RING });
    const read = textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72), () => [still])), 30_000);
    expect(read.captions?.y).toBeCloseTo(0.8, 3);
    expect(read.captions?.pages).toBe(40);
  });

  it("has no captions with fewer than three pages that change", () => {
    const few = THIRTY.map((ms, i) => at(ms, ...(i < 2 ? [line(WORDS[i]!, 0.8, 0.2)] : [])));
    expect(textOf(analysisOf(few), 30_000).captions).toBeNull();
    const held = THIRTY.map((ms) => at(ms, line("the same words", 0.8, 0.3)));
    expect(textOf(analysisOf(held), 30_000).captions).toBeNull();
  });
});

/* ── held text: the title and the rest ─────────────────────────────────────────────────────────── */

describe("textOf: the title and other held text", () => {
  const title = (from: number, to: number, y = 0.16, text = "Three things nobody tells you", h = 0.06) => (ms: number) =>
    ms >= from && ms < to ? [line(text, y, 0.8, { colours: [WHITE, EDGE], around: VIDEO_RING }, h)] : [];

  it("takes held text on by 750 ms and gone before 60 % as the title: from 0, to halfway between its last moment and the next", () => {
    const read = textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72), title(0, 2000))), 30_000);
    expect(read.title).toMatchObject({ y: 0.16, fromMs: 0, toMs: 2000, text: "Three things nobody tells you" });
  });

  it("starts a title that comes in after the first moment halfway between the moment before and its first", () => {
    const read = textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72), title(600, 3000))), 30_000);
    expect(read.title).toMatchObject({ fromMs: 500, toMs: 3000 });
  });

  it("matches held text by its letters and digits, whatever their case or marks, and its place within 0.03", () => {
    const wobbly = (ms: number) => (ms < 2500 ? [line(ms === 750 ? "THREE things, nobody tells you!" : "Three things nobody tells you", ms === 1250 ? 0.18 : 0.16, 0.8, { around: VIDEO_RING })] : []);
    const read = textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72), wobbly)), 30_000);
    expect(read.title).toMatchObject({ fromMs: 0, toMs: 2500 });
    const moved = (ms: number) => (ms < 2500 ? [line("Three things", ms === 1250 ? 0.2 : 0.16, 0.8, { around: VIDEO_RING })] : []);
    expect(textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72), moved)), 30_000).title).toBeNull();
  });

  it("needs held text to span 1.5 s: a line on for 1 s is no title", () => {
    expect(textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72), title(0, 1300))), 30_000).title).toBeNull();
    expect(textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72), title(0, 1800))), 30_000).title).not.toBeNull();
  });

  it("takes the tallest of several titles, and puts held text that comes late or stays past 60 % in `other`", () => {
    const more = (ms: number) => [...title(0, 3000, 0.16, "Big hook", 0.07)(ms), ...title(0, 3000, 0.3, "small kicker line", 0.03)(ms), ...title(4000, 9000, 0.45, "late sticker words")(ms), ...title(0, 30_000, 0.05, "@creator handle")(ms)];
    const read = textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72), more)), 30_000);
    expect(read.title?.text).toBe("Big hook");
    // In the order they come on, top to bottom among those coming on together.
    expect(read.other).toEqual(["@creator handle", "small kicker line", "late sticker words"]);
  });

  it("does not take a caption page held for 2 s in the caption band for a title", () => {
    const pages = captions(THIRTY, 0.8, "inter", 72).map((each, i) => (i < 4 ? { ...each, text: "a slow first page" } : each));
    const read = textOf(analysisOf(samples(THIRTY, pages, title(0, 2000, 0.2))), 30_000);
    expect(read.title).toMatchObject({ y: 0.2, toMs: 2000 });
    expect(read.other).toEqual([]);
  });

  it("cuts other text to 40 characters", () => {
    const long = "a very long line of text that goes on and on past the limit";
    const read = textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72), title(9000, 15_000, 0.4, long))), 30_000);
    expect(read.other).toEqual([long.slice(0, 40)]);
  });
});

/* ── captions, measured ────────────────────────────────────────────────────────────────────────── */

describe("textOf: the captions' font and size from their widths", () => {
  it.each([
    ["inter", 72],
    ["montserrat", 80],
    ["tiktok", 76],
  ] as const)("tells %s at %i px by how well each font's widths fit the rows", (font, size) => {
    const read = textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, font, size))), 30_000);
    expect(read.captions?.font).toBe(font);
    expect(read.captions?.size).toBeCloseTo(size, 0);
  });

  it("fits each font's sizes and the reader's padding together, so a padding of any width does not favour the widest font", () => {
    for (const pad of [0, 11, 25]) {
      const rows = THIRTY.map((_, i) => {
        const text = Array.from({ length: 1 + (i % 4) }, (_, k) => WORDS[(i * 3 + k) % WORDS.length]).join(" ");
        return line(text, 0.8, wideOf(text, "tiktok", 72, pad));
      });
      expect(textOf(analysisOf(samples(THIRTY, rows)), 30_000).captions).toMatchObject({ font: "tiktok", size: 72 });
    }
  });

  it("gives inter with fewer than five rows of four letters or more, sized by inter", () => {
    const short = THIRTY.map((_, i) => line(i < 4 ? WORDS[(i % 3) + 2]! : ["so", "it", "is", "go"][i % 4]!, 0.8, wideOf("first", "montserrat", 80)));
    const read = textOf(analysisOf(samples(THIRTY, short)), 30_000);
    expect(read.captions?.font).toBe("inter");
  });

  it("counts the words of the fullest page and reads capitals", () => {
    const pages = captions(THIRTY, 0.8, "inter", 72, 4).map((each) => ({ ...each, text: each.text.toUpperCase() }));
    const read = textOf(analysisOf(samples(THIRTY, pages)), 30_000);
    expect(read.captions).toMatchObject({ maxWords: 4, upper: true });
    expect(textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72))), 30_000).captions?.upper).toBe(false);
  });
});

describe("textOf: the captions' colours", () => {
  const YELLOW = (from: number, to: number, share: number): Colour => ({ hex: "#ffe14a", share, from, to });

  it("reads white letters on a dark box with a yellow word in its letters as a backing, ink white, highlight yellow said in letters", () => {
    const pages = captions(THIRTY, 0.8, "tiktok", 72, 3, () => ({ colours: [PILL_INSIDE, WHITE, YELLOW(0.4, 0.7, 0.1)], around: PILL_RING }));
    expect(textOf(analysisOf(samples(THIRTY, pages)), 30_000).captions).toMatchObject({ ink: "#ffffff", highlight: "#ffe14a", said: "letters", backing: true, edge: false });
  });

  it("reads a yellow box behind the said word (its colour fills its stretch) as said by a box", () => {
    const pages = captions(THIRTY, 0.8, "tiktok", 72, 3, () => ({ colours: [WHITE, YELLOW(0.35, 0.65, 0.2), { ...EDGE, share: 0.3 }, { hex: "#5a4a3a", share: 0.2, from: 0, to: 1 }], around: VIDEO_RING }));
    expect(textOf(analysisOf(samples(THIRTY, pages)), 30_000).captions).toMatchObject({ highlight: "#ffe14a", said: "box", backing: false, edge: true });
  });

  it("leaves out the background (a colour near a ring colour holding 0.15) and what is neither light nor strong", () => {
    // A light wall behind the words, in the ring and in the box: not their ink. Grey letters (luma 128) are neither light nor strong.
    const wall = { hex: "#e8e4dc", share: 0.6 };
    const pages = captions(THIRTY, 0.8, "inter", 72, 3, () => ({ colours: [{ hex: "#e6e2da", share: 0.5, from: 0, to: 1 }, { hex: "#ffd400", share: 0.3, from: 0.05, to: 0.95 }, { hex: "#808080", share: 0.1, from: 0.1, to: 0.9 }], around: [wall, { hex: "#202020", share: 0.4 }] }));
    expect(textOf(analysisOf(samples(THIRTY, pages)), 30_000).captions).toMatchObject({ ink: "#ffd400", highlight: null, said: null });
  });

  it("takes an accent only 80 from the ink, at least 0.15 of its share, over at most 0.7 of the row", () => {
    const near = { hex: "#e0e0d0", share: 0.2, from: 0.3, to: 0.6 }; // 64 from white
    const thin = YELLOW(0.3, 0.6, 0.03); // 0.1 of the ink's share
    const wide = YELLOW(0.1, 0.9, 0.2); // across 0.8 of the row
    for (const accent of [near, thin, wide]) {
      const pages = captions(THIRTY, 0.8, "inter", 72, 3, () => ({ colours: [PILL_INSIDE, WHITE, accent] }));
      expect(textOf(analysisOf(samples(THIRTY, pages)), 30_000).captions).toMatchObject({ highlight: null, said: null });
    }
  });

  it("gives a highlight only when at least 30 % of the pages have one", () => {
    const some = (share: number) => captions(THIRTY, 0.8, "inter", 72, 3, (i) => ({ colours: [PILL_INSIDE, WHITE, ...(i < share * 40 ? [YELLOW(0.4, 0.7, 0.1)] : [])] }));
    expect(textOf(analysisOf(samples(THIRTY, some(0.25))), 30_000).captions?.highlight).toBeNull();
    expect(textOf(analysisOf(samples(THIRTY, some(0.3))), 30_000).captions?.highlight).toBe("#ffe14a");
  });

  it("needs a flat ring on 60 % of the rows for a backing, and no backing and a dark colour of 0.08 on most rows for an edge", () => {
    const rings = (flat: number) => captions(THIRTY, 0.8, "inter", 72, 3, (i) => ({ colours: [PILL_INSIDE, WHITE], around: i < flat * 40 ? PILL_RING : [{ hex: "#151311", share: 0.7 }, { hex: "#a08070", share: 0.3 }] }));
    expect(textOf(analysisOf(samples(THIRTY, rings(0.6))), 30_000).captions?.backing).toBe(true);
    expect(textOf(analysisOf(samples(THIRTY, rings(0.55))), 30_000).captions?.backing).toBe(false);
  });

  it("reads a thick dark edge (the kit's outline, 0.1 of the size) where the dark holds 0.58 of the light, not a bold's thin one", () => {
    // Measured on the light rows of the ground truth's titles: a bold's thin edge 0.39 to 0.56 of its white (film 1), an outline's 0.62 to 0.71 (film 4).
    const edged = (dark: number, around = VIDEO_RING) => captions(THIRTY, 0.8, "inter", 72, 3, () => ({ colours: [{ hex: "#6a5a4a", share: 0.5, from: 0, to: 1 }, WHITE, { ...EDGE, share: dark }], around }));
    expect(textOf(analysisOf(samples(THIRTY, edged(0.2))), 30_000).captions?.edge).toBe(true);
    expect(textOf(analysisOf(samples(THIRTY, edged(0.12))), 30_000).captions?.edge).toBe(false);
    // Over a dark picture the dark of the background is in the box too: rows whose ring is mostly dark are left out, unless every row's is.
    const dark = [{ hex: "#1a1410", share: 0.7 }, { hex: "#8a7a6a", share: 0.3 }];
    const mixed = captions(THIRTY, 0.8, "inter", 72, 3, (i) => (i % 2 ? { colours: [WHITE, { ...EDGE, share: 0.5 }], around: dark } : { colours: [{ hex: "#6a5a4a", share: 0.5, from: 0, to: 1 }, WHITE, { ...EDGE, share: 0.12 }], around: VIDEO_RING }));
    expect(textOf(analysisOf(samples(THIRTY, mixed)), 30_000).captions?.edge).toBe(false);
    expect(textOf(analysisOf(samples(THIRTY, edged(0.2, dark))), 30_000).captions?.edge).toBe(true);
  });
});

describe("textOf: the title, measured", () => {
  it("places and sizes the title from its rows in the title's own font, and reads a label's backing and an outline's edge", () => {
    const rows = (y: number, over: Partial<TextLine>) => (ms: number) =>
      ms < 3000
        ? [
            line("Three things", y - 0.036, (measure("Three things", "tiktok", 800, 120, -0.01)! * TEXT_RULES.boxOverLetters) / 1080, over, 0.065),
            line("nobody tells you", y + 0.036, (measure("nobody tells you", "tiktok", 800, 120, -0.01)! * TEXT_RULES.boxOverLetters) / 1080, over, 0.065),
          ]
        : [];
    const outlined = textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72), rows(0.2, { colours: [WHITE, { ...EDGE, share: 0.21 }], around: VIDEO_RING }))), 30_000);
    expect(outlined.title).toMatchObject({ y: 0.2, backing: false, edge: true, text: "Three things nobody tells you", fromMs: 0, toMs: 3000 });
    expect(outlined.title?.size).toBeCloseTo(120, 0);
    const labelled = textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72), rows(0.14, { colours: [PILL_INSIDE, WHITE], around: PILL_RING }))), 30_000);
    expect(labelled.title).toMatchObject({ y: 0.14, backing: true, edge: false });
  });
});

describe("seenOf: what Qwen is told was read already", () => {
  it("gives the captions' pages' words, each once, in order, and the title's", () => {
    const pages = captions(THIRTY, 0.8, "inter", 72).map((each, i) => (i === 1 ? { ...each, text: "make the first" } : each));
    const analysis = analysisOf(samples(THIRTY, pages, (ms) => (ms < 2000 ? [line("Big hook", 0.16, 0.5, { around: VIDEO_RING })] : [])));
    const seen = seenOf(analysis, 30_000);
    expect(seen.title).toBe("Big hook");
    expect(seen.captions.slice(0, 3)).toEqual(["make the first", "people scroll past", "slow openings every"]); // the second page repeats the first
    expect(new Set(seen.captions).size).toBe(seen.captions.length);
  });

  it("gives none of either when nothing was read", () => {
    expect(seenOf(analysisOf(THIRTY.map((ms) => at(ms))), 30_000)).toEqual({ captions: [], title: null });
  });
});

describe("textOf: what the films showed (part 3, Task 9b)", () => {
  it("does not read a line the reader scores under 0.65: a shadow read as digits does not add a row", () => {
    const phantom = { ...line("000·00", 0.8 + 0.035, 0.12, {}, 0.013), score: 0.57 };
    const read = textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72, 2), () => [phantom])), 30_000);
    expect(read.captions?.maxWords).toBe(2);
  });

  it("does not stack a held title's last row and a changing caption row below it into one page", () => {
    const title = (ms: number) => (ms < 3000 ? [line("Three things", 0.2, 0.6, { around: VIDEO_RING }, 0.065), line("nobody tells you", 0.272, 0.7, { around: VIDEO_RING }, 0.065)] : []);
    // The caption row's top is 0.02 under the title's last row: within 0.6 of a row's height.
    const read = textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.3445, "inter", 72), title)), 30_000);
    expect(read.title).toMatchObject({ text: "Three things nobody tells you", fromMs: 0, toMs: 3000 });
    expect(read.captions?.maxWords).toBe(3);
  });

  it("takes the letters' colour for the ink, not a box behind the said word that holds more of the row than they do", () => {
    const boxed = captions(THIRTY, 0.62, "montserrat", 80, 2, () => ({ colours: [{ hex: "#ffe14a", share: 0.45, from: 0.05, to: 0.5 }, { hex: "#111111", share: 0.2, from: 0.06, to: 0.48 }, { ...WHITE, share: 0.12, from: 0.55, to: 0.95 }], around: VIDEO_RING }));
    expect(textOf(analysisOf(samples(THIRTY, boxed)), 30_000).captions).toMatchObject({ ink: "#ffffff", highlight: "#ffe14a", said: "box" });
  });

  it("counts the words of the fullest page among word counts seen on at least two pages: one misread page does not add a word", () => {
    const pages = (extra: number) => captions(THIRTY, 0.8, "inter", 72, 2).map((each, i) => (i < extra ? { ...each, text: `I ${each.text}` } : each));
    expect(textOf(analysisOf(samples(THIRTY, pages(1))), 30_000).captions?.maxWords).toBe(2);
    expect(textOf(analysisOf(samples(THIRTY, pages(2))), 30_000).captions?.maxWords).toBe(3);
  });
});

describe("textOf: the ink and the background of rows the reader gave in pieces", () => {
  it("takes white for the ink where the said word's colour holds as much of the letters as the white does (pages of two words)", () => {
    const yellow = (from: number, to: number, share: number): Colour => ({ hex: "#f8de49", share, from, to });
    // As film 6: on a pill, the said word yellow and the other white, each about half; on pages of one word, the said word alone.
    const pages = THIRTY.map((_, i) => {
      const text = i % 3 === 2 ? WORDS[i % 25]! : `${WORDS[i % 25]} ${WORDS[(i + 1) % 25]}`;
      const colours = i % 3 === 2 ? [PILL_INSIDE, yellow(0.06, 0.87, 0.26)] : i % 2 ? [PILL_INSIDE, yellow(0.04, 0.42, 0.11), { ...WHITE, share: 0.1, from: 0.56, to: 0.92 }] : [PILL_INSIDE, { ...WHITE, share: 0.12, from: 0.04, to: 0.42 }, yellow(0.56, 0.92, 0.1)];
      return line(text, 0.3, wideOf(text, "inter", 70), { colours });
    });
    expect(textOf(analysisOf(samples(THIRTY, pages)), 30_000).captions).toMatchObject({ ink: "#ffffff", highlight: "#f8de49", said: "letters", backing: true });
  });

  it("takes no dark, dull block at a word for a said-word box: a said word's box is strong or light (fix round 2)", () => {
    // As Task 11's reference 2, second run: white captions, and on half the pages a small dark block at the row's end (#1e1d23,
    // saturation 0.22) that fills its stretch, on a row the reader rings with a light, flat colour.
    const read = (block: string) =>
      textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72, 3, (i) => (i % 2 === 0 ? {} : {
        colours: [{ hex: "#fdfdfd", share: 0.75, from: 0, to: 1 }, { hex: block, share: 0.09, from: 0.88, to: 0.99 }], around: [{ hex: "#fdfdfc", share: 1 }], beyond: VIDEO_RING,
      })))), 30_000).captions;
    expect(read("#1e1d23")).toMatchObject({ ink: "#ffffff", highlight: null, said: null });
    // A strong block there is a said word's box.
    expect(read("#e0402a")).toMatchObject({ ink: "#ffffff", highlight: "#e0402a", said: "box" });
  });

  it("keeps a word's box as a colour where the reader boxed that word alone, inside its box, beside the other words", () => {
    // As film 2: the said word read as its own piece, its ring the box's yellow; the other word a piece whose ring is the picture.
    const pieces = THIRTY.map((_, i) => {
      const [a, b] = [WORDS[i % 20]!, WORDS[(i + 1) % 20]!];
      const [wa, wb] = [wideOf(a, "montserrat", 80, 0), wideOf(b, "montserrat", 80, 0)];
      const left = 0.5 - (wa + wb + 0.03) / 2;
      const boxed: TextLine = { ...line(a, 0.62, wa), box: { x: round4(left), y: 0.6, w: round4(wa), h: 0.04 }, colours: [{ hex: "#f8dd46", share: 0.62, from: 0.03, to: 0.97 }, { hex: "#100e0c", share: 0.34, from: 0.06, to: 0.9 }], around: [{ hex: "#fadc46", share: 0.72 }, { hex: "#5b2e24", share: 0.28 }] };
      const plain: TextLine = { ...line(b, 0.62, wb), box: { x: round4(left + wa + 0.03), y: 0.6, w: round4(wb), h: 0.04 }, colours: [{ ...WHITE, share: 0.45, from: 0.03, to: 0.97 }, EDGE], around: VIDEO_RING };
      return [boxed, plain];
    });
    expect(textOf(analysisOf(THIRTY.map((ms, i) => at(ms, ...pieces[i]!))), 30_000).captions).toMatchObject({ ink: "#ffffff", highlight: "#f8dd46", said: "box", backing: false });
  });
});

/* ── Task 9c: what five real references showed ──────────────────────────────────────────────────── */

const DESK = [{ hex: "#8a6a4a", share: 0.92 }, { hex: "#5a4a3a", share: 0.08 }];

describe("textOf: a box behind the words has an end (Task 9c, B.1)", () => {
  const ringed = (around: TextLine["around"], beyond?: TextLine["around"], colours: Colour[] = [PILL_INSIDE, WHITE]) =>
    textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72, 3, () => ({ colours, around, ...(beyond ? { beyond } : {}) })))), 30_000).captions;

  it("reads no box where the flat colour round the words is also beyond them: a flat scene, not a box", () => {
    expect(ringed(PILL_RING, PILL_RING)?.backing).toBe(false);
    expect(ringed(PILL_RING, [{ hex: "#181614", share: 0.95 }])?.backing).toBe(false); // the same colour, as the reader quantises it
  });

  it("tells a near-black box from a dark flat scene: the same flat colour is stricter near black (fix round 1)", () => {
    // 38 apart: a box over a darker scene (the kit's pill is #151311); the dark curtain of Task 11's reference 1 read 4 to 7 apart.
    expect(ringed([{ hex: "#0a0a0a", share: 1 }], [{ hex: "#202020", share: 1 }])?.backing).toBe(true);
    expect(ringed(PILL_RING, [{ hex: "#2c2a28", share: 1 }])?.backing).toBe(true);
    expect(ringed([{ hex: "#0e100f", share: 1 }], [{ hex: "#111011", share: 1 }])?.backing).toBe(false);
    // Away from black, 48 as before: skin and a desk read 2 to 11 apart.
    expect(ringed([{ hex: "#a0683a", share: 1 }], [{ hex: "#a36937", share: 1 }])?.backing).toBe(false);
  });

  it("reads a box where the colour beyond is another, or not flat, and keeps today's rule with no ring beyond", () => {
    expect(ringed(PILL_RING, [{ hex: "#8a7a6a", share: 0.9 }])?.backing).toBe(true);
    expect(ringed(PILL_RING, VIDEO_RING)?.backing).toBe(true);
    expect(ringed(PILL_RING)?.backing).toBe(true);
  });

  it("reads the dark edge of letters over a flat desk, now that the desk is no box (Task 11's reference 3)", () => {
    const outline = ringed(DESK, DESK, [{ hex: "#8a6a4a", share: 0.4, from: 0, to: 1 }, WHITE, { ...EDGE, share: 0.25 }]);
    expect(outline).toMatchObject({ backing: false, edge: true });
  });
});

describe("textOf: size and font when the letters are unlike the kit's (Task 9c, B.5)", () => {
  /** Rows `h` of the picture's height, their widths as `widthOf` gives them. */
  const rowsOf = (h: number, widthOf: (text: string) => number, texts: (i: number) => string = (i) => [WORDS[i % 25], WORDS[(i + 3) % 25], WORDS[(i + 7) % 25]].join(" ")) =>
    THIRTY.map((_, i) => line(texts(i), 0.57, widthOf(texts(i)), {}, h));
  const read = (rows: TextLine[]) => textOf(analysisOf(samples(THIRTY, rows)), 30_000).captions;

  it("holds the fit's padding to 0 to 40 px: a padding of 60 still gives the font, and a size near its own", () => {
    const captions = read(rowsOf(0.0437, (text) => wideOf(text, "tiktok", 72, 60)));
    expect(captions?.font).toBe("tiktok");
    expect(Math.abs(captions!.size - 72) / 72).toBeLessThan(0.08);
  });

  it("sizes by the rows' height (1.17 of the size, as the six kit films set it) when no kit font fits their widths", () => {
    // Every row as wide whatever its words: no font fits. 0.06 of 1920 is 115 px high: size 98.
    expect(TEXT_RULES.heightOverSize).toBe(1.17);
    expect(read(rowsOf(0.06, () => 0.5))).toMatchObject({ size: 98, font: "inter", typeface: "unlike" });
  });

  it("sizes by the rows' height when the best font's size is more than 30 % from it (Task 11's reference 5: 32 px for about 110)", () => {
    // Widths of tiktok at 50 px, heights of letters at 100: the width says 50, the height 100.
    expect(read(rowsOf(0.0609, (text) => wideOf(text, "tiktok", 50)))).toMatchObject({ size: 100, font: "inter", typeface: "unlike" });
    // At the size its height says, the same font is the kit's.
    expect(read(rowsOf(0.0304, (text) => wideOf(text, "tiktok", 50)))).toMatchObject({ font: "tiktok", typeface: "kit" });
  });

  it("sizes rows in capitals by their own factor, 0.88 of the size (no descenders), not the mixed rows' 1.17 (fix round 1)", () => {
    expect(TEXT_RULES.heightOverSizeUpper).toBe(0.88);
    // 0.04 of 1920 is 76.8 px high: in capitals size 87; in mixed case 66.
    const texts = (upper: boolean) => (i: number) => {
      const text = [WORDS[i % 25], WORDS[(i + 3) % 25], WORDS[(i + 7) % 25]].join(" ");
      return upper ? text.toUpperCase() : text;
    };
    expect(read(rowsOf(0.04, () => 0.5, texts(true)))).toMatchObject({ size: 87, typeface: "unlike", upper: true });
    expect(read(rowsOf(0.04, () => 0.5, texts(false)))).toMatchObject({ size: 66, typeface: "unlike", upper: false });
  });

  it("sizes a script the width tables lack by its height, never 0 (review, Important 1)", () => {
    const chinese = ["今天我们来聊", "这个问题很重要", "大家一定要看完", "我们下次再见"];
    expect(read(rowsOf(0.045, () => 0.5, (i) => chinese[i % 4]!))).toMatchObject({ size: 74, font: "inter", typeface: "script" });
  });
});

describe("textOf: the ink is read, not assumed (Task 9c, B.6)", () => {
  const LIGHT_BOX = [{ hex: "#f2f2f0", share: 1 }];
  const read = (colours: Colour[], around: TextLine["around"], beyond?: TextLine["around"]) =>
    textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72, 3, () => ({ colours, around, ...(beyond ? { beyond } : {}) })))), 30_000).captions;

  it("reads dark letters on a light box as the ink: the row's darkest colour", () => {
    const dark = read([{ hex: "#f4f4f2", share: 0.7, from: 0, to: 1 }, { hex: "#141414", share: 0.25, from: 0.05, to: 0.95 }], LIGHT_BOX, VIDEO_RING);
    expect(dark).toMatchObject({ ink: "#141414", backing: true, highlight: null });
    // With the light blend of the box's edge into the letters among the colours, as the reader gives it on real labels.
    const blended = read([{ hex: "#fdfdfd", share: 0.64, from: 0, to: 1 }, { hex: "#010101", share: 0.19, from: 0.04, to: 0.94 }, { hex: "#d9d9d9", share: 0.05, from: 0.01, to: 0.95 }, { hex: "#9f9f9f", share: 0.04, from: 0.04, to: 0.95 }], [{ hex: "#fdfdfc", share: 1 }], VIDEO_RING);
    expect(blended).toMatchObject({ ink: "#010101", backing: true });
  });

  it("gives no ink where none can be read, never white by default", () => {
    expect(read([{ hex: "#8a7a6a", share: 0.9, from: 0, to: 1 }], VIDEO_RING)?.ink).toBeNull();
  });

  // Fix round 1 (9c review, Important 1): the darkest colour is the ink only on a real light box, and a light colour far from
  // the box is still the letters'.
  const outlined = (wall: string): Colour[] => [{ hex: wall, share: 0.55, from: 0, to: 1 }, { hex: "#fafafa", share: 0.25, from: 0.05, to: 0.95 }, { hex: "#0b0b0b", share: 0.15, from: 0.04, to: 0.96 }];

  it("never takes the dark edge of white letters over a flat light wall for the ink: no box there, so the plain rule", () => {
    // The wall beyond is the wall: no box. White far enough from #d8d8d8 is the ink; from #e6e6e6 it is the wall's, so none.
    expect(read(outlined("#d8d8d8"), [{ hex: "#d8d8d8", share: 1 }], [{ hex: "#d9d9d9", share: 1 }])).toMatchObject({ ink: "#fafafa", backing: false });
    expect(read(outlined("#e6e6e6"), [{ hex: "#e6e6e6", share: 1 }], [{ hex: "#e5e5e5", share: 1 }])).toMatchObject({ ink: null, backing: false });
    // As the title: white, not near-black.
    const hook = (ms: number) => (ms < 3000 ? [line("Three things nobody tells you", 0.16, 0.8, { colours: outlined("#d8d8d8"), around: [{ hex: "#d8d8d8", share: 1 }], beyond: [{ hex: "#d8d8d8", share: 1 }] }, 0.06)] : []);
    expect(textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72), hook)), 30_000).title?.ink).toBe("#fafafa");
  });

  // Fix round 2: what is lighter than the box or wall is the letters, the dark their edge; a colour is the ink only at a real share.
  it("reads white letters over a light wall whose ring beyond is not flat as white: lighter than the wall, they are the letters", () => {
    // The ring beyond not flat: by B.1 a box. The white is 34 lighter than the wall at 0.25: the letters; the dark is their edge.
    expect(TEXT_RULES.onLight.luma).toBe(5);
    expect(read(outlined("#d8d8d8"), [{ hex: "#d8d8d8", share: 1 }], VIDEO_RING)).toMatchObject({ ink: "#fafafa", backing: true });
    // White only 8 lighter than a pale wall, as over reference 4's pale sweater (7.3 to 16.7): the letters still.
    const pale = [{ hex: "#d8d8d8", share: 0.4, from: 0, to: 1 }, { hex: "#e0e0e0", share: 0.4, from: 0.05, to: 0.95 }, { hex: "#0b0b0b", share: 0.15, from: 0.04, to: 0.96 }];
    expect(read(pale, [{ hex: "#d8d8d8", share: 1 }], VIDEO_RING)).toMatchObject({ ink: "#e0e0e0", backing: true });
    // On a pale grey box (the 9c re-review's Minor 2), white 42 lighter.
    expect(read([{ hex: "#d0d0d0", share: 0.6, from: 0, to: 1 }, { hex: "#fafafa", share: 0.25, from: 0.05, to: 0.95 }, { hex: "#5a5a5a", share: 0.1, from: 0.05, to: 0.95 }], [{ hex: "#d0d0d0", share: 1 }], VIDEO_RING)?.ink).toBe("#fafafa");
  });

  it("takes dark letters on a white label for the ink, not a grey blend at 0.05 (the 9c re-review's Minor 1)", () => {
    const label = [{ hex: "#fdfdfd", share: 0.64, from: 0, to: 1 }, { hex: "#010101", share: 0.19, from: 0.04, to: 0.94 }, { hex: "#c4c4c4", share: 0.05, from: 0.01, to: 0.95 }, { hex: "#9f9f9f", share: 0.04, from: 0.04, to: 0.95 }];
    expect(read(label, [{ hex: "#fdfdfc", share: 1 }], VIDEO_RING)).toMatchObject({ ink: "#010101", backing: true });
    // Nothing lighter than the label and nothing dark at a real share: no ink.
    expect(read([{ hex: "#fdfdfd", share: 0.9, from: 0, to: 1 }, { hex: "#c4c4c4", share: 0.05, from: 0.01, to: 0.95 }], [{ hex: "#fdfdfc", share: 1 }], VIDEO_RING)?.ink).toBeNull();
  });

  it("reads white letters on a light grey box as white: far from the box, they are the letters (Task 9b had it right)", () => {
    const grey = [{ hex: "#c4c4c4", share: 0.6, from: 0, to: 1 }, { hex: "#fafafa", share: 0.3, from: 0.05, to: 0.95 }, { hex: "#5a5a5a", share: 0.05, from: 0.05, to: 0.95 }];
    expect(read(grey, [{ hex: "#c4c4c4", share: 1 }], VIDEO_RING)).toMatchObject({ ink: "#fafafa", backing: true });
    // With a said word in yellow: white stays the ink, the yellow the highlight.
    const said = (i: number) => ({ colours: [...grey, { hex: "#ffe14a", share: 0.1, from: 0.6 + (i % 2) * 0.1, to: 0.75 + (i % 2) * 0.1 }], around: [{ hex: "#c4c4c4", share: 1 }], beyond: VIDEO_RING });
    expect(textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72, 3, said))), 30_000).captions).toMatchObject({ ink: "#fafafa", highlight: "#ffe14a" });
  });
});

describe("textOf: the caption band keeps to the captions (Task 9c, B.7)", () => {
  it("leaves out rows in the band more than 35 % off its median row's height: the text of B-roll screenshots", () => {
    // A screenshot's small print in a third of the frames, beside the captions.
    const shot = (ms: number) => (THIRTY.indexOf(ms) % 3 === 0 ? [line(`${WORDS[ms % 25]} small print of a page here`, 0.6, 0.6, { around: VIDEO_RING }, 0.015)] : []);
    const read = textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.57, "inter", 72, 2), shot)), 30_000).captions;
    expect(read?.maxWords).toBe(2);
  });

  it("leaves out a screenshot's small words the reader puts on a caption's row, and its large lines stacked above it (Task 11's reference 5)", () => {
    // Small words at the right edge, level with the caption: the reader joins them to its row.
    const beside = (ms: number) => (THIRTY.indexOf(ms) % 3 === 0 ? [{ ...line(`${WORDS[ms % 25]} small print`, 0.575, 0.1, { around: VIDEO_RING }, 0.022), box: { x: 0.86, y: 0.564, w: 0.1, h: 0.022 } }] : []);
    expect(textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.57, "inter", 72, 2), beside)), 30_000).captions?.maxWords).toBe(2);
    // A screenshot's large lines stacked over a one-word caption into one page in the band, as on reference 5 at 129 s (two of
    // its boxes): the line whose middle is out of the band is left out; the one next to the caption, in the band, stays.
    const one = (ms: number[]) => ms.map((_, i) => ({ ...line(WORDS[i % 25]!, 0.5684, 0.5, {}, 0.0703) }));
    const above = (ms: number) => (THIRTY.indexOf(ms) % 3 === 0 ? [[0.415, 0.0479], [0.4834, 0.0557]].map(([y, h], k) => line(WORDS[(THIRTY.indexOf(ms) + k + 5) % 25]!, y! + h! / 2, 0.6, { around: VIDEO_RING }, h)) : []);
    const read = textOf(analysisOf(samples(THIRTY, one(THIRTY), above)), 30_000).captions;
    expect(read?.maxWords).toBe(2);
  });
});

describe("textOf: a hook that stays is a title (Task 9c, B.8)", () => {
  const held = (text: string, x: number, h: number) => () => [{ ...line(text, 0.17, 0.5, { around: VIDEO_RING }, h), box: { x: round4(x - 0.25), y: round4(0.17 - h / 2), w: 0.5, h } }];

  it("takes a hook held from the start to the end, large enough and in the middle across, as a title that stays", () => {
    const read = textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72), held("Keep them watching to the end", 0.5, 0.03))), 30_000);
    expect(read.title).toMatchObject({ stays: true, fromMs: 0, y: 0.17, text: "Keep them watching to the end" });
    expect(read.other).toEqual([]);
  });

  it("keeps a handle in a corner, or small text, held to the end as other text", () => {
    expect(textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72), held("creator handle", 0.85, 0.03))), 30_000)).toMatchObject({ title: null, other: ["creator handle"] });
    expect(textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72), held("small print", 0.5, 0.015))), 30_000)).toMatchObject({ title: null, other: ["small print"] });
  });

  it("reads a title gone before 60 % as before: not staying", () => {
    const early = (ms: number) => (ms < 2000 ? [line("Three things nobody tells you", 0.16, 0.8, { around: VIDEO_RING }, 0.06)] : []);
    expect(textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72), early)), 30_000).title).toMatchObject({ stays: false, toMs: 2000 });
  });

  it("reads a title's ink: dark letters on a white label (Task 11's reference 3)", () => {
    const label = (ms: number) => (ms < 3000 ? [line("four quick answers here", 0.53, 0.7, { colours: [{ hex: "#f6f6f6", share: 0.7, from: 0, to: 1 }, { hex: "#101010", share: 0.25, from: 0.05, to: 0.95 }], around: [{ hex: "#f5f5f5", share: 1 }], beyond: VIDEO_RING }, 0.04)] : []);
    expect(textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72), label)), 30_000).title).toMatchObject({ ink: "#101010", backing: true });
    const white = (ms: number) => (ms < 3000 ? [line("Three things nobody tells you", 0.16, 0.8, { colours: [WHITE, EDGE], around: VIDEO_RING }, 0.06)] : []);
    expect(textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72), white)), 30_000).title?.ink).toBe("#ffffff");
  });
});

describe("textOf: held text matched loosely, a line under 0.7 read (Task 9c, B.9 and review Minor 2)", () => {
  it("holds a title one misread letter apart at one moment: one edit in five letters", () => {
    const misread = (ms: number) => (ms < 2000 ? [line(ms === 750 ? "Three thlngs nobody tells you" : "Three things nobody tells you", 0.16, 0.8, { around: VIDEO_RING }, 0.06)] : []);
    expect(textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72), misread)), 30_000).title).toMatchObject({ fromMs: 0, toMs: 2000 });
    const other = (ms: number) => (ms < 2000 ? [line(ms === 750 ? "Three thlngs nobady tells yau" : "Three things nobody tells you", 0.16, 0.8, { around: VIDEO_RING }, 0.06)] : []);
    // Three edits in 25 letters are within five; a wholly other text is not.
    expect(textOf(analysisOf(samples(THIRTY, captions(THIRTY, 0.8, "inter", 72), other)), 30_000).title).toMatchObject({ fromMs: 0, toMs: 2000 });
  });

  it("reads a line the reader scores 0.67: the cut-off is 0.65, between the phantoms (0.57, 0.58) and real lines (0.73 up)", () => {
    expect(TEXT_RULES.minScore).toBe(0.65);
    const scored = captions(THIRTY, 0.8, "inter", 72).map((each) => ({ ...each, score: 0.67 }));
    expect(textOf(analysisOf(samples(THIRTY, scored)), 30_000).captions?.pages).toBe(40);
  });
});
