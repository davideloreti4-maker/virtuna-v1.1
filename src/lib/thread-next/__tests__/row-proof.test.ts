import { describe, expect, it } from "vitest";
import { rowProofOf } from "@/lib/thread-next/row-proof";
import { viewsLabel } from "@/lib/multiple-words";
import { proof } from "@/components/thread-next/__tests__/fixtures/answers";

describe("rowProofOf", () => {
  it("'@handle · 854K views' and the cover", () => {
    expect(rowProofOf(proof({ handle: "creator_one", coverUrl: "/covers/c8.jpg", views: 854_000 }))).toEqual({
      cover: "/covers/c8.jpg",
      line: "@creator_one · 854K views",
    });
  });

  it("the views through the sheet's own formatter (the remix card's and the proof row's)", () => {
    for (const views of [950, 21_000, 154_400, 999_600, 2_000_000]) {
      expect(rowProofOf(proof({ handle: "creator_one", views }))?.line).toBe(`@creator_one · ${viewsLabel(views)} views`);
    }
    expect(rowProofOf(proof({ handle: "creator_one", views: 2_000_000 }))?.line).toBe("@creator_one · 2M views");
  });

  it("a handle stored with its '@' (or several) is not doubled; spaces are trimmed", () => {
    expect(rowProofOf(proof({ handle: "@creator_one", views: 21_000 }))?.line).toBe("@creator_one · 21K views");
    expect(rowProofOf(proof({ handle: " @@creator_one ", views: 21_000 }))?.line).toBe("@creator_one · 21K views");
  });

  it("without views: '@handle' alone", () => {
    expect(rowProofOf(proof({ handle: "creator_one", views: null }))?.line).toBe("@creator_one");
    expect(rowProofOf(proof({ handle: "creator_one", views: Number.NaN }))?.line).toBe("@creator_one");
  });

  it("without a cover: cover null (the words alone)", () => {
    expect(rowProofOf(proof({ handle: "creator_one", coverUrl: null }))?.cover).toBeNull();
    expect(rowProofOf(proof({ handle: "creator_one", coverUrl: "  " }))?.cover).toBeNull();
  });

  it("no proof, or one with no handle to name: nothing", () => {
    expect(rowProofOf(null)).toBeNull();
    expect(rowProofOf(undefined)).toBeNull();
    expect(rowProofOf(proof({ handle: " @ ", views: 21_000 }))).toBeNull();
  });
});
