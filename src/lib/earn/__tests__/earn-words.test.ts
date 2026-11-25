/**
 * Earn's words (ruling 10), each built from the constants in `earn.ts` so a ruling changes one line.
 * Pure: no stand-ins.
 */
import { describe, expect, it } from "vitest";

import { EARN_STRINGS, headline, howItWorks, joinedLine, ratePct, rateLine } from "../earn-words";

describe("the words at the top of the page", () => {
  it("are Earn 50%, the rate line, and the joined line", () => {
    expect(headline()).toBe("Earn 50%");
    expect(rateLine()).toBe("of a creator's first month, for every creator you bring.");
  });

  it.each([
    [0, "0 creators joined through your link"],
    [1, "1 creator joined through your link"],
    [3, "3 creators joined through your link"],
    [1240, "1,240 creators joined through your link"],
  ])("joinedLine(%i) is %s", (n, words) => {
    expect(joinedLine(n)).toBe(words);
  });
});

describe("How it works", () => {
  it("is the three lines of rulings 10 and 43", () => {
    expect(howItWorks()).toEqual([
      "Share your link or the card.",
      "A creator opens it and subscribes within 30 days, on the same device.",
      "When they start paying, you earn 50% of their first month.",
    ]);
  });
});

describe("every sentence follows the constants", () => {
  const other = { ratePct: 30, firstPaymentOnly: false, linkDays: 60 };

  it("another rate and another link time change every sentence that states them", () => {
    expect(ratePct(other)).toBe("30%");
    expect(headline(other)).toBe("Earn 30%");
    expect(howItWorks(other)[1]).toBe("A creator opens it and subscribes within 60 days, on the same device.");
    expect(howItWorks(other)[2]).toBe("When they start paying, you earn 30% of each payment they make.");
    expect(rateLine(other)).toBe("of everything a creator pays, for every creator you bring.");
  });

  it("a one-day link says day, not days", () => {
    expect(howItWorks({ ...other, linkDays: 1 })[1]).toBe("A creator opens it and subscribes within 1 day, on the same device.");
  });
});

describe("the fixed words", () => {
  it("are the ones ruling 10 and the plan name", () => {
    expect(EARN_STRINGS).toEqual({
      title: "Earn",
      yourLink: "Your link",
      copy: "Copy",
      copied: "Copied",
      share: "Share",
      saveImage: "Save image",
      youEarn: "YOU EARN",
      sharedBy: "SHARED BY",
      howItWorks: "How it works",
      shareText: "Simulate your videos before you post them. Try Maven:",
      loadFailed: "Couldn't load Earn. Try again.",
      tryAgain: "Try again",
      loading: "Loading",
      qrName: "QR code of your link",
      fileName: "maven-earn.png",
    });
  });
});
