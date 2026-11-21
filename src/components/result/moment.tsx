"use client";

import { useMemo } from "react";
import type { VideoModel } from "@/lib/result/types";
import { usePlayhead } from "./playhead";
import { PlayMark } from "./player";

/**
 * The moment (the mock's `.mom`): one row under the hero. When the sentence names a scene, the
 * whole row is one button that plays from that scene's start: the scene's frame (64×114, with a
 * small play mark), the sentence, and under it the engine's description of the scene, two lines at
 * most. No frame: the sentence and the description. No description: the sentence alone. No named
 * scene: the sentence alone, and not a button.
 */
export function Moment({ model }: { model: VideoModel }) {
  const { playFrom } = usePlayhead();
  const { verdict, moment } = model;

  // The playhead's context changes every frame while playing; the row only depends on the model.
  return useMemo(() => {
    const sentence = (
      <span className="block text-heading font-[640] text-foreground tabular-nums">{verdict.sentence}</span>
    );
    // `moment` is the named scene, null when the sentence names none (videoStateOf).
    if (!moment) {
      return (
        <p data-result="moment">{sentence}</p>
      );
    }
    return (
      <button
        type="button"
        data-result="moment"
        onClick={() => playFrom(moment.t0)}
        className="flex min-h-11 w-full cursor-pointer items-center gap-3.5 rounded-lg text-left"
      >
        {moment.frame && (
          <span className="relative block h-[114px] w-16 shrink-0 overflow-hidden rounded-lg bg-surface-sunken shadow-[0_0_0_1px_var(--color-border),0_8px_16px_-8px_var(--color-scrim)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- a stored frame's signed address */}
            <img src={moment.frame} alt="" draggable={false} className="block h-full w-full object-cover" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <PlayMark size="moment" />
            </span>
          </span>
        )}
        <span className="block min-w-0">
          {sentence}
          {moment.description && (
            // `line-clamp-2` sets its own display (`-webkit-box`); a `block` here would undo the clamp.
            <span className="mt-[5px] line-clamp-2 text-ui text-foreground-secondary">{moment.description}</span>
          )}
        </span>
      </button>
    );
  }, [verdict, moment, playFrom]);
}
