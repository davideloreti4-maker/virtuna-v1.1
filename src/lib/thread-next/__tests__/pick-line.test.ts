import { describe, expect, it } from "vitest";

import { WHY_MAX, pickLine, usableWhy, type PickRow } from "@/lib/thread-next/pick-line";

const REASON = "It dares a friend by name, so you wait to hear why.";

describe("usableWhy", () => {
  it("a plain sentence is shown as it is", () => {
    expect(usableWhy(REASON)).toBe(REASON);
  });

  it("nothing, or only spaces, is not usable", () => {
    expect(usableWhy(undefined)).toBeNull();
    expect(usableWhy(null)).toBeNull();
    expect(usableWhy("")).toBeNull();
    expect(usableWhy("   \t ")).toBeNull();
  });

  it("two lines are not usable", () => {
    expect(usableWhy("It names a cost.\nThen it pays it back.")).toBeNull();
    expect(usableWhy("It names a cost.\r\nThen it pays it back.")).toBeNull();
  });

  it("140 characters are usable, 141 are not (counted trimmed)", () => {
    // Three words, `n` characters in all (fix round 1: a reason needs three words).
    const sized = (n: number) => `${"a".repeat(n - 7)} bb cc.`;
    expect(WHY_MAX).toBe(140);
    expect(sized(140)).toHaveLength(140);
    expect(usableWhy(`  ${sized(140)}  `)).toBe(`A${sized(140).slice(1)}`);
    expect(usableWhy(sized(141))).toBeNull();
  });

  it("trims, and the spaces around it do not count", () => {
    expect(usableWhy(`  ${REASON}  `)).toBe(REASON);
  });

  it("is a sentence: the first letter capital, a full stop added", () => {
    expect(usableWhy("you feel the cost before the second word")).toBe("You feel the cost before the second word.");
    expect(usableWhy("“free” sounds too good, so you stay to check")).toBe("“Free” sounds too good, so you stay to check.");
  });

  it("keeps a full stop, a question mark or an exclamation mark it already ends with", () => {
    expect(usableWhy("Who would not wait to hear the answer?")).toBe("Who would not wait to hear the answer?");
    expect(usableWhy("It is that blunt!")).toBe("It is that blunt!");
    expect(usableWhy("It is short.")).toBe("It is short.");
    // The mark before a closing quote ends it too: no second full stop after the quote.
    expect(usableWhy("Everyone has said “not again.”")).toBe("Everyone has said “not again.”");
  });

  it("a number at the start stays as it is", () => {
    expect(usableWhy("3 dollars a day is a number you can check")).toBe("3 dollars a day is a number you can check.");
  });

  // Fix round 1 (review I1): junk is not a reason.
  it("fewer than three words with a letter in each is not usable", () => {
    for (const junk of [".", "n/a", "ok.", "N/A", "Good hook.", "- -", "3 4 5", "?!"]) expect(usableWhy(junk), junk).toBeNull();
    expect(usableWhy("It works well.")).toBe("It works well.");
    // A number is not a word, the three that are count.
    expect(usableWhy("3 dollars, really cheap")).toBe("3 dollars, really cheap.");
  });

  it("a web address is not usable", () => {
    for (const link of ["https://example.com/watch?v=1", "http://example.com", "See www.example.com for the recipe", "Watch it at (HTTPS://example.com) now", "Go to WWW.example.com today"]) {
      expect(usableWhy(link), link).toBeNull();
    }
  });

  // Fix round 2 (review M-B4): an address, not letters inside a word. (Was: "http" anywhere, so
  // "Read it on HTTPS example pages" was refused; it has no address and is a reason now.)
  it("letters of an address inside a word, or the word https alone, are no address", () => {
    expect(usableWhy("Read it on HTTPS example pages")).toBe("Read it on HTTPS example pages.");
    expect(usableWhy("bathttpwww is a made up word here")).toBe("Bathttpwww is a made up word here.");
    expect(usableWhy("The showww. moment makes you stay")).toBe("The showww. moment makes you stay.");
    expect(usableWhy("The httpd joke lands with you")).toBe("The httpd joke lands with you.");
  });

  // Fix round 2 (review M-B1): writing without spaces is one "word" by spaces.
  it("a reason written without spaces is usable with at least 8 letters", () => {
    expect(usableWhy("友達の名前を呼んで挑発するので理由が気になる")).toBe("友達の名前を呼んで挑発するので理由が気になる.");
    expect(usableWhy("价格低得让人不敢相信所以你想看")).toBe("价格低得让人不敢相信所以你想看.");
    expect(usableWhy("ราคาถูกมากจนคุณอยากรู้ว่าทำยังไง")).toBe("ราคาถูกมากจนคุณอยากรู้ว่าทำยังไง.");
    // Its own sentence end is kept, not followed by a full stop.
    expect(usableWhy("友達の名前を呼ぶので理由が気になる。")).toBe("友達の名前を呼ぶので理由が気になる。");
    expect(usableWhy("价格低得让人不敢相信吗？")).toBe("价格低得让人不敢相信吗？");
    // Katakana alone is such writing too.
    expect(usableWhy("ソーシャルメディアマーケティング")).toBe("ソーシャルメディアマーケティング.");
    // Fewer than 8 letters, or a space in it, is still not enough.
    expect(usableWhy("理由が気になる")).toBeNull();
    expect(usableWhy("Good hook")).toBeNull();
    for (const junk of [".", "n/a", "ok.", "N/A"]) expect(usableWhy(junk), junk).toBeNull();
  });

  // Fix round 2 tweak: only those scripts are written without spaces; one long word of any other is no reason.
  it("one long word in a script written with spaces is not usable: it still needs three words", () => {
    for (const word of ["Unbelievable", "unbelievable.", "Невероятно!", "Απίστευτο", "مدهشجدامدهش", "믿을수없을정도로"]) {
      expect(usableWhy(word), word).toBeNull();
    }
    expect(usableWhy("Это так дёшево, что хочется проверить")).toBe("Это так дёшево, что хочется проверить.");
    expect(usableWhy("너무 싸서 직접 확인하고 싶어요")).toBe("너무 싸서 직접 확인하고 싶어요.");
  });

  // Fix round 2 (review M-B3): the limit is on the text as shown.
  it("the 140 characters are counted on the text as shown, after a dash became a comma", () => {
    // "a—b" grows by one when it becomes "a, b".
    const dashed = (n: number) => `${"a".repeat(n - 10)} bb—cc dd.`;
    expect(dashed(139)).toHaveLength(139);
    expect(usableWhy(dashed(139))).toHaveLength(140);
    expect(usableWhy(dashed(140))).toBeNull();
    // " — " shrinks by one, so 141 typed can be 140 shown.
    const spaced = `${"a".repeat(132)} bb — cc.`;
    expect(spaced).toHaveLength(141);
    expect(usableWhy(spaced)).toHaveLength(140);
    // The full stop it is given counts too.
    expect(usableWhy(`${"a".repeat(134)} bb cc`)).toBeNull();
    expect(usableWhy(`${"a".repeat(133)} bb cc`)).toHaveLength(140);
  });

  it("the hook itself is not a reason: the same words, whatever the case and the end punctuation", () => {
    const hook = "Stop buying protein powder. Do this instead.";
    expect(usableWhy("Stop buying protein powder. Do this instead.", hook)).toBeNull();
    expect(usableWhy("stop buying PROTEIN powder. do this instead", hook)).toBeNull();
    expect(usableWhy("Stop buying protein powder. Do this instead!", hook)).toBeNull();
    expect(usableWhy("  Stop buying protein powder.   Do this instead?  ", hook)).toBeNull();
    // Words of the hook inside a real reason are fine.
    expect(usableWhy("It tells you to stop buying powder, then makes you wait.", hook)).toBe("It tells you to stop buying powder, then makes you wait.");
    // Curly and straight quotes and apostrophes are the same (fix round 2, review M-B2).
    const curly = "Don’t buy this, it’s a “healthy” trap.";
    expect(usableWhy("don't buy this, it's a \"healthy\" trap", curly)).toBeNull();
    expect(usableWhy("Don’t buy this, it’s a “healthy” trap.", "Don't buy this, it's a \"healthy\" trap.")).toBeNull();
    // Without the hook's text there is nothing to compare.
    expect(usableWhy("Stop buying protein powder. Do this instead.")).toBe("Stop buying protein powder. Do this instead.");
  });

  // Fix round 1 (review M4): the copy has no dashes.
  it("an em dash or an en dash, with or without spaces, is shown as a comma and a space", () => {
    expect(usableWhy("It names a cost — then it pays it back")).toBe("It names a cost, then it pays it back.");
    expect(usableWhy("It names a cost—then it pays it back")).toBe("It names a cost, then it pays it back.");
    expect(usableWhy("It names a cost – then it pays it back")).toBe("It names a cost, then it pays it back.");
    expect(usableWhy("It names a cost–then it pays it back.")).toBe("It names a cost, then it pays it back.");
    // A hyphen inside a word is not a dash.
    expect(usableWhy("A 3-step fix sounds easy to try")).toBe("A 3-step fix sounds easy to try.");
  });

  // Fix round 1 (review M2): a word written with a capital inside keeps its case.
  it("the first letter is made a capital only when the first word is all lower case", () => {
    expect(usableWhy("it dares a friend by name")).toBe("It dares a friend by name.");
    expect(usableWhy("iPhone users stop because the price is low")).toBe("iPhone users stop because the price is low.");
    expect(usableWhy("eBay sellers know this one")).toBe("eBay sellers know this one.");
    expect(usableWhy("“free” sounds too good, so you stay")).toBe("“Free” sounds too good, so you stay.");
  });
});

const row = (rank: number | undefined, why: string | null | undefined, simulated = false, text?: string): PickRow => ({ rank, why, simulated, text });

describe("pickLine", () => {
  it("names the first-ranked row and gives its reason", () => {
    expect(pickLine([row(1, REASON), row(2, "Another reason."), row(3, "A third.")])).toBe(`Maven would post hook 1. ${REASON}`);
  });

  it("the number is the first-ranked row's place on the card, not its rank", () => {
    expect(pickLine([row(2, "Second choice."), row(1, REASON), row(3, "Third choice.")])).toBe(`Maven would post hook 2. ${REASON}`);
  });

  it("the reason is shown as a sentence", () => {
    expect(pickLine([row(1, "it names a cost"), row(2, "")])).toBe("Maven would post hook 1. It names a cost.");
  });

  it("no line when the first-ranked row has no usable reason, even if another row has one", () => {
    expect(pickLine([row(1, undefined), row(2, "A reason.")])).toBeNull();
    expect(pickLine([row(1, "  "), row(2, "A reason.")])).toBeNull();
    expect(pickLine([row(1, "Two\nlines."), row(2, "A reason.")])).toBeNull();
  });

  it("no line when the first-ranked row's reason is its own hook", () => {
    const hook = "I spent $40 on meal prep and it tasted like regret.";
    expect(pickLine([row(1, "i spent $40 on meal prep and it tasted like regret", false, hook), row(2, REASON, false, "Hook two.")])).toBeNull();
    expect(pickLine([row(1, REASON, false, hook), row(2, "B c d.", false, "Hook two.")])).toBe(`Maven would post hook 1. ${REASON}`);
  });

  it("no line when the first-ranked row's reason is junk", () => {
    expect(pickLine([row(1, "."), row(2, REASON)])).toBeNull();
    expect(pickLine([row(1, "n/a"), row(2, REASON)])).toBeNull();
    expect(pickLine([row(1, "https://example.com/v/1"), row(2, REASON)])).toBeNull();
  });

  it("no line for one hook only", () => {
    expect(pickLine([row(1, REASON)])).toBeNull();
    expect(pickLine([])).toBeNull();
  });

  it("no line once every row is simulated (the measured line takes the place)", () => {
    expect(pickLine([row(1, REASON, true), row(2, "B.", true), row(3, "C.", true)])).toBeNull();
  });

  it("the line stays while some rows are not simulated, the picked one included or not", () => {
    expect(pickLine([row(1, REASON, true), row(2, "B.", true), row(3, "C.")])).toBe(`Maven would post hook 1. ${REASON}`);
    expect(pickLine([row(1, REASON), row(2, "B.", true), row(3, "C.", true)])).toBe(`Maven would post hook 1. ${REASON}`);
  });

  it("rows with no rank are never picked; with no rank at all there is no line", () => {
    expect(pickLine([row(undefined, "Unranked."), row(1, REASON)])).toBe(`Maven would post hook 2. ${REASON}`);
    expect(pickLine([row(undefined, REASON), row(undefined, "B.")])).toBeNull();
  });

  it("two rows ranked first: the first of them on the card", () => {
    expect(pickLine([row(2, "B."), row(1, REASON), row(1, "Other first.")])).toBe(`Maven would post hook 2. ${REASON}`);
  });
});
