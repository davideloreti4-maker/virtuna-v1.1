import { describe, expect, it } from "vitest";
import * as edit from "..";
import { fixture, library } from "./fixture";

describe("the edit, through its public surface", () => {
  it("builds the fixture from a raw take, through the one door", () => {
    const want = fixture();
    const [m1, w1] = want.shots[1]!.marks;
    const result = edit.applyOps(edit.newEdit(want.assets[0]!), [
      { op: "asset.add", id: "broll" },
      { op: "asset.add", id: "whoosh" },
      { op: "shot.trim", id: "s1", endMs: 5000 },
      { op: "shot.insert", after: "s1", shot: { id: "s2", asset: "take", startMs: 8000, endMs: 12000 } },
      { op: "mark.add", shot: "s2", mark: m1 },
      { op: "mark.add", shot: "s2", mark: w1 },
      { op: "item.add", item: want.items[0] },
    ], library());
    expect(result).toEqual({ ok: true, edit: want });
  });

  it("undoes by keeping the edit before", () => {
    const before = fixture();
    const result = edit.applyOps(before, [{ op: "shot.split", id: "s1", atMs: 2500, newId: "s1b" }, { op: "shot.remove", id: "s1b" }]);
    expect(result.ok && edit.filmFrames(result.edit)).toBe(195);
    expect(before).toEqual(fixture());
    expect(edit.checkEdit(before)).toEqual([]);
  });

  it("keeps the small shared shapes to itself", () => {
    expect(Object.keys(edit)).not.toContain("Hex");
    expect(Object.keys(edit)).toEqual(expect.arrayContaining(["applyOps", "checkEdit", "layout", "placed", "runWords", "framingAt", "parseEdit", "newEdit", "PARTS", "FPS"]));
  });
});
