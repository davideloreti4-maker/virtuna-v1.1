import { describe, expect, it } from "vitest";
import { faceOnStage } from "../stage";

const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
const still = { zoom: 1, x: 0, y: 0 };
const close = (got: { x: number; y: number; w: number; h: number } | null, want: { x: number; y: number; w: number; h: number }) => {
  expect(got).not.toBeNull();
  for (const key of ["x", "y", "w", "h"] as const) expect(got![key]).toBeCloseTo(want[key], 9);
};

describe("a face on the stage", () => {
  it("maps a 720x1280 take, as filmed, onto the stage at 1.5 times", () => {
    const placed = faceOnStage({ ms: 0, face: box(0.25, 0.25, 0.5, 0.25), mouth: null }, { w: 720, h: 1280 }, still);
    close(placed.face, { x: 270, y: 480, w: 540, h: 480 });
    expect(placed.mouth).toBeNull();
  });

  it("fits a 1920x1080 take to the stage's height and crops its sides, as the kit's cover does", () => {
    const scaled = 1920 * (1920 / 1080); // the picture's width once its height fills the stage's
    const { face } = faceOnStage({ ms: 0, face: box(0.4, 0.4, 0.2, 0.2), mouth: null }, { w: 1920, h: 1080 }, still);
    close(face, { x: 540 - 0.1 * scaled, y: 960 - 0.2 * 960, w: 0.2 * scaled, h: 0.2 * 1920 });
  });

  it("doubles about the stage's centre at zoom 2", () => {
    const { face, mouth } = faceOnStage({ ms: 0, face: box(0.25, 0.25, 0.5, 0.25), mouth: box(0.5, 0.5, 0.1, 0.1) }, { w: 720, h: 1280 }, { zoom: 2, x: 0, y: 0 });
    close(face, { x: 0, y: 0, w: 1080, h: 960 });
    close(mouth, { x: 540, y: 960, w: 216, h: 384 });
  });

  it("shows the side x and y ask for once the picture is larger than the stage", () => {
    // At zoom 2 and x 1, y -1 the picture's right edge meets the stage's right edge and its top edge the stage's top.
    const { face } = faceOnStage({ ms: 0, face: box(0.5, 0, 0.5, 0.5), mouth: null }, { w: 720, h: 1280 }, { zoom: 2, x: 1, y: -1 });
    close(face, { x: 0, y: 0, w: 1080, h: 1920 });
  });

  it("gives no box where the sample found no face", () => {
    expect(faceOnStage({ ms: 0, face: null, mouth: null }, { w: 720, h: 1280 }, still)).toEqual({ face: null, mouth: null });
  });
});
