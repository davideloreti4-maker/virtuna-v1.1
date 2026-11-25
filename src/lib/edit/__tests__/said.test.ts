/**
 * said.test.ts — the words code writes (plan 2026-11-24-editor-screens-a, Task 3; spec §5.4, E7, E22): the first cut's line,
 * a direct change's sentence, the edit's title, a look's name. On real edits made by the door from the suite's take
 * (12.7 s, "Good morning. Let us begin").
 */
import { describe, expect, it } from "vitest";
import { applyOps, type Edit, type Op } from "@/lib/edit";
import { assetOf, firstEdit } from "@/lib/edit/worker/takes";
import { BUCKET, takeRow } from "@/lib/edit/worker/__tests__/rows";
import { NEXT_ASKS, firstCutLine, lookName, opsSay, sameWord, takeTitle } from "../said";

const ASSET = assetOf(takeRow(), BUCKET);
const TAKE = firstEdit(ASSET);
const through = (edit: Edit, ops: Op[]): Edit => {
  const made = applyOps(edit, ops, [ASSET]);
  if (!made.ok) throw new Error(made.problems.map((problem) => `${problem.path}: ${problem.message}`).join("; "));
  return made.edit;
};
const LABEL: Op = {
  op: "item.add",
  item: { id: "hook", part: "title", anchor: "start", at: 0, frames: null, props: { text: "Good morning", font: "tiktok", look: "label", y: 0.2, size: 72, color: "#111111", accent: null } },
};

describe("the first cut's line", () => {
  it("says what was cut and what is on", () => {
    expect(firstCutLine(TAKE, through(TAKE, [{ op: "shot.trim", id: "s1", startMs: 400, endMs: 11_300 }, LABEL]))).toBe("Cut from 12.7 to 10.9 seconds. Captions and a label are on.");
  });

  it("says only what is on when nothing was cut", () => {
    expect(firstCutLine(TAKE, through(TAKE, [LABEL]))).toBe("Captions and a label are on.");
  });

  it("says captions alone when the look has no label", () => {
    expect(firstCutLine(TAKE, through(TAKE, [{ op: "shot.trim", id: "s1", endMs: 11_300 }]))).toBe("Cut from 12.7 to 11.3 seconds. Captions are on.");
  });

  it("says there are no captions for a take with no speech", () => {
    const silent = firstEdit(assetOf(takeRow({ words: [] }), BUCKET));
    expect(firstCutLine(silent, silent)).toBe("No speech was found, so there are no captions.");
  });

  it("says a label alone when the captions are off", () => {
    expect(firstCutLine(TAKE, through(TAKE, [{ op: "captions.set", on: false }, LABEL]))).toBe("A label is on.");
  });

  it("says the cut is ready when nothing was cut and nothing is on", () => {
    expect(firstCutLine(TAKE, through(TAKE, [{ op: "captions.set", on: false }]))).toBe("Your first cut is ready.");
  });

  describe("of a take longer than a film may be (R31)", () => {
    /** The suite's take, `ms` long, as one shot: its first three minutes when longer. */
    const takeOf = (ms: number) => {
      const asset = assetOf(takeRow({ facts: { ...(takeRow().facts as object), ms } }), BUCKET);
      return { asset, take: firstEdit(asset) };
    };
    const cutOf = ({ asset, take }: ReturnType<typeof takeOf>, ops: Op[]) => {
      const made = applyOps(take, ops, [asset]);
      if (!made.ok) throw new Error(made.problems.map((problem) => problem.message).join("; "));
      return made.edit;
    };

    it("says how long the take is and that the cut is made from its first three minutes, and cuts from those", () => {
      const five = takeOf(300_000);
      expect(firstCutLine(five.take, cutOf(five, [{ op: "shot.trim", id: "s1", endMs: 151_200 }]))).toBe(
        "Your take is 5 minutes long. This cut is made from its first 3 minutes. Cut from 180.0 to 151.2 seconds. Captions are on.",
      );
      expect(firstCutLine(five.take, five.take)).toBe("Your take is 5 minutes long. This cut is made from its first 3 minutes. Captions are on.");
    });

    it("says the take's length to a tenth of a minute, and never as no longer than the three minutes", () => {
      const line = (ms: number) => firstCutLine(takeOf(ms).take, takeOf(ms).take);
      expect(line(200_000)).toBe("Your take is 3.3 minutes long. This cut is made from its first 3 minutes. Captions are on.");
      expect(line(9 * 60_000 + 50_000)).toMatch(/^Your take is 9\.8 minutes long\. /);
      expect(line(182_000)).toMatch(/^Your take is 3\.1 minutes long\. /); // 3.0 to a tenth: said as just over
      expect(line(180_000)).toBe("Captions are on."); // three minutes exactly: all of it is in the film
    });

    it("says it of a take with no speech too", () => {
      const asset = assetOf(takeRow({ words: [], facts: { ...(takeRow().facts as object), ms: 240_000 } }), BUCKET);
      const silent = firstEdit(asset);
      expect(firstCutLine(silent, silent)).toBe("Your take is 4 minutes long. This cut is made from its first 3 minutes. No speech was found, so there are no captions.");
    });
  });
});

describe("a direct change's sentence", () => {
  it("names the word fixed, once or in every place", () => {
    expect(opsSay(TAKE, [{ op: "word.set", asset: ASSET.id, index: 2, text: "Lets" }])).toBe('Changed "Let" to "Lets".');
    const twice = through(TAKE, [{ op: "word.set", asset: ASSET.id, index: 3, text: "Let" }]);
    expect(opsSay(twice, [{ op: "word.set", asset: ASSET.id, index: 2, text: "Lets" }, { op: "word.set", asset: ASSET.id, index: 3, text: "Lets" }])).toBe('Changed "Let" to "Lets" in 2 places.');
  });

  it("counts a word heard in two spellings as one word fixed", () => {
    const spelled = through(TAKE, [{ op: "word.set", asset: ASSET.id, index: 3, text: "let," }]);
    expect(opsSay(spelled, [{ op: "word.set", asset: ASSET.id, index: 2, text: "Lets" }, { op: "word.set", asset: ASSET.id, index: 3, text: "lets," }])).toBe('Changed "Let" to "Lets" in 2 places.');
    // Two different fixes stay two sentences.
    expect(opsSay(spelled, [{ op: "word.set", asset: ASSET.id, index: 2, text: "Lets" }, { op: "word.set", asset: ASSET.id, index: 3, text: "led," }])).toBe('Changed "Let" to "Lets". Changed "let" to "led".');
  });

  it("never writes two closing marks in a row", () => {
    // A new word: said without the marks around it.
    expect(opsSay(TAKE, [{ op: "word.set", asset: ASSET.id, index: 1, text: "evening." }])).toBe('Changed "morning" to "evening".');
    // The same word with a new mark or a new case: said as written, and the sentence ends with the word's own mark.
    expect(opsSay(TAKE, [{ op: "word.set", asset: ASSET.id, index: 4, text: "begin." }])).toBe('Changed "begin" to "begin."');
    expect(opsSay(TAKE, [{ op: "word.set", asset: ASSET.id, index: 1, text: "morning!" }, { op: "captions.set", on: false }])).toBe('Changed "morning." to "morning!" Captions are off.');
    expect(opsSay(TAKE, [{ op: "word.set", asset: ASSET.id, index: 2, text: "let" }])).toBe('Changed "Let" to "let".');
    const twice = through(TAKE, [{ op: "word.set", asset: ASSET.id, index: 3, text: "Let" }]);
    expect(opsSay(twice, [{ op: "word.set", asset: ASSET.id, index: 2, text: "Let." }, { op: "word.set", asset: ASSET.id, index: 3, text: "Let." }])).toBe('Changed "Let" to "Let." in 2 places.');
  });

  it("says captions on or off", () => {
    expect(opsSay(TAKE, [{ op: "captions.set", on: false }])).toBe("Captions are off.");
    expect(opsSay(TAKE, [{ op: "captions.set", on: true }])).toBe("Captions are on.");
  });

  it("says nothing changed only when nothing did", () => {
    expect(opsSay(TAKE, [])).toBe("Nothing changed.");
    expect(opsSay(TAKE, [{ op: "word.set", asset: ASSET.id, index: 2, text: "Let" }])).toBe("Nothing changed.");
    expect(opsSay(TAKE, [{ op: "word.set", asset: ASSET.id, index: 2, hidden: false }])).toBe("Nothing changed.");
    expect(opsSay(TAKE, [{ op: "captions.set", size: TAKE.captions.size }])).toBe("Nothing changed.");
  });

  it("throws for a change it has no words for, and never calls it nothing", () => {
    expect(() => opsSay(TAKE, [{ op: "captions.set", size: 96 }])).toThrow("opsSay has no words for captions.set (size)");
    expect(() => opsSay(TAKE, [{ op: "captions.set", on: false, size: 96 }])).toThrow("opsSay has no words for captions.set (size)");
    expect(() => opsSay(TAKE, [{ op: "word.set", asset: ASSET.id, index: 2, hidden: true }])).toThrow("opsSay has no words for word.set (hidden)");
    expect(() => opsSay(TAKE, [{ op: "word.set", asset: ASSET.id, index: 2, text: "Lets", stress: true }])).toThrow("opsSay has no words for word.set (stress)");
    expect(() => opsSay(TAKE, [{ op: "word.set", asset: ASSET.id, index: 99, text: "Lets" }])).toThrow("opsSay has no words for word.set (a word the edit does not hold)");
    expect(() => opsSay(TAKE, [{ op: "shot.trim", id: "s1", endMs: 10_000 }])).toThrow("opsSay has no words for shot.trim");
  });

  it("knows a word heard again whatever its case and punctuation", () => {
    expect(sameWord("Claudel", "claudel.")).toBe(true);
    expect(sameWord("Claude", "Claudel")).toBe(false);
    expect(sameWord("...", "...")).toBe(false);
  });
});

describe("the edit's title and look", () => {
  it("is the take's first words, else its file's name", () => {
    expect(takeTitle("IMG_0042.MOV", ASSET.kind === "video" ? ASSET.words : null)).toBe("Good morning");
    expect(takeTitle("IMG_0042.MOV", [{ text: "First," }, { text: "tea." }, { text: "Then" }])).toBe("First, tea");
    expect(takeTitle("IMG_0042.MOV", null)).toBe("IMG_0042");
    expect(takeTitle(".mov", [])).toBe("Your video");
  });

  it("names a look as the sheet does", () => {
    expect(lookName("house")).toBe("Our pick");
    expect(lookName("mono")).toBe("Black and white");
    expect(lookName("video")).toBe("Like a video");
    expect(lookName("words")).toBe("Described");
    expect(lookName(null)).toBe("Our pick");
  });

  it("offers three next steps in slice A", () => {
    expect(NEXT_ASKS).toEqual(["Shorter", "Bigger captions", "Add zooms"]);
  });
});
