/**
 * stage.ts — where a face the worker found sits on the stage, as the kit draws the take.
 *
 * The kit fits a clip or a picture to the stage as CSS `object-fit: cover` does (`Footage.tsx`): it
 * is scaled until it covers the stage, by the larger of the two ratios, and centred, so a landscape
 * take loses its sides. Then the shot's framing (`framingAt`) enlarges it `zoom` times about the
 * stage's centre and moves it by `x` and `y`, -1 to 1, which say which part shows once it is larger
 * than the stage: x 1 sets its right edge on the stage's right edge, y -1 its top on the stage's top.
 * In Footage.tsx that is `scale(zoom) translate(-x × (zoom - 1) × 50 / zoom %, …)`.
 */
import type { FaceSample, ShareBox } from "./analysis";
import { STAGE, type Frame } from "./doc";
import type { Box } from "../../edit/film/layout";

/**
 * A face sample's face and mouth in stage pixels, through the cover fit and the framing. A box is
 * not cut to the stage: part of it may lie outside. Null where the sample found none.
 */
export function faceOnStage(sample: FaceSample, asset: { w: number; h: number }, frame: Frame): { face: Box | null; mouth: Box | null } {
  const cover = Math.max(STAGE.w / asset.w, STAGE.h / asset.h);
  const [shownW, shownH] = [asset.w * cover, asset.h * cover];
  // A share of the picture to a stage pixel along one side: placed by the cover fit, enlarged about the centre, moved by the framing.
  const along = (share: number, shown: number, stage: number, side: number) => stage / 2 + frame.zoom * (share - 0.5) * shown - (side * (frame.zoom - 1) * stage) / 2;
  const place = (box: ShareBox | null): Box | null =>
    box && {
      x: along(box.x, shownW, STAGE.w, frame.x),
      y: along(box.y, shownH, STAGE.h, frame.y),
      w: frame.zoom * box.w * shownW,
      h: frame.zoom * box.h * shownH,
    };
  return { face: place(sample.face), mouth: place(sample.mouth) };
}
