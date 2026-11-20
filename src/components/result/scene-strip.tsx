"use client";

import { memo } from "react";
import type { VideoModel } from "@/lib/result/types";

/** Between two tiles. */
const GAP = 3;

/**
 * The strip of scenes under the line, on the same time axis (the mock's `rStrip` with `.ed-clip`):
 * one tile per scene, as wide as its time less the 3px gap (at least 5), its frame repeated to fill
 * it. The named scene carries the coral mark: a `--color-below` outline with a wash of the same
 * colour, light enough that the frame still shows. 38 tall on the phone, 46 on desktop. It does not
 * move with the playhead, so it renders once per model and size.
 */
export const SceneStrip = memo(function SceneStrip({
  model,
  width,
  height,
}: {
  model: VideoModel;
  width: number;
  height: number;
}) {
  const { scenes, clipS } = model.audience;
  const x = (t: number) => (t / clipS) * width;
  const last = scenes.length - 1;
  return (
    <div data-result="strip" data-scenes={scenes.length} className="relative select-none" style={{ width, height }}>
      {scenes.map((scene, k) => {
        const w = Math.max(5, x(scene.t1) - x(scene.t0) - (k < last ? GAP : 0));
        // Tiles of a 9:16-ish crop: as many copies as fit at about 0.62 of the height each.
        const copies = scene.frame ? Math.max(1, Math.round(w / (height * 0.62))) : 0;
        const named = model.verdict.scene === k;
        return (
          <div
            key={scene.index}
            data-scene={k}
            className="absolute inset-y-0"
            style={{ left: `${x(scene.t0).toFixed(1)}px`, width: `${w.toFixed(1)}px` }}
          >
            <div className="absolute inset-0 flex overflow-hidden rounded-lg bg-surface-sunken shadow-[0_0_0_1px_var(--color-border)]">
              {Array.from({ length: copies }, (_, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- a stored frame's signed address
                <img
                  key={i}
                  src={scene.frame!}
                  alt=""
                  draggable={false}
                  className="block h-full min-w-0 flex-1 object-cover object-[50%_14%]"
                />
              ))}
            </div>
            {named && (
              <span
                data-part="mark"
                className="absolute inset-0 rounded-lg bg-below/35 shadow-[inset_0_0_0_2px_var(--color-below)]"
              />
            )}
          </div>
        );
      })}
    </div>
  );
});
