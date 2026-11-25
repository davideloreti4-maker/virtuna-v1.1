import { describe, expect, it } from "vitest";
import { PART_IDS } from "../../../lib/edit";
import { KIT, LAYERS } from "../parts";
import { even, hold } from "../parts/types";

describe("the kit", () => {
  it("has a component for every part an edit may hold, and for no other", () => {
    expect(Object.keys(KIT).sort()).toEqual([...PART_IDS].sort());
    for (const id of PART_IDS) expect(typeof KIT[id].Component, id).toBe("function");
  });

  it("draws every part on one of its layers, with captions under titles and over call-outs", () => {
    for (const id of PART_IDS) expect(LAYERS, id).toContain(KIT[id].layer);
    expect(LAYERS.indexOf("callout")).toBeLessThan(LAYERS.indexOf("captions"));
    expect(LAYERS.indexOf("captions")).toBeLessThan(LAYERS.indexOf("title"));
    expect(LAYERS.indexOf("cutaway")).toBeLessThan(LAYERS.indexOf("callout"));
    expect(LAYERS[LAYERS.length - 1]).toBe("progress");
  });
});

describe("the kit's whole pixels", () => {
  it("takes a measure to the nearest even whole number, so that half of it is whole too", () => {
    expect([0, 0.9, 1, 2.9, 3, 110.37, 111, 112.4].map(even)).toEqual([0, 0, 2, 2, 4, 110, 112, 112]);
    for (const value of [89.7, 137.2, 1651.2]) expect((even(value) / 2) % 1).toBe(0);
  });

  it("holds a value between two others", () => {
    expect([hold(5, 0, 10), hold(-5, 0, 10), hold(15, 0, 10)]).toEqual([5, 0, 10]);
  });
});
