/**
 * keyframes.ts — a segment's move as CSS keyframes.
 *
 * A film clip moves by CSS animation with `translate`, `scale` and `rotate` only (never `left`,
 * `top` or `transform`), on its own time. The name is derived from the move, so equal moves
 * share one block and the film's keyframes are the same for the same edit.
 *
 * Pans and the shake carry a small constant scale: without it the move would uncover the stage
 * at the clip's edge.
 */
import type { Move } from "../spec";
import { num } from "./html";

export function moveName(move: Move): string {
  return `mv-${move.kind}-${Math.round(move.amount * 100)}`;
}

/** The body of the move's `@keyframes` block. */
export function moveKeyframes(move: Move): string {
  const a = move.amount;
  switch (move.kind) {
    case "push-in":
      return `from { scale: 1 } to { scale: ${num(1 + 0.2 * a)} }`;
    case "push-out":
      return `from { scale: ${num(1 + 0.2 * a)} } to { scale: 1 }`;
    case "pan-left":
      return `from { scale: ${num(1 + 0.08 * a)}; translate: ${num(4 * a)}vw 0 } to { scale: ${num(1 + 0.08 * a)}; translate: ${num(-4 * a)}vw 0 }`;
    case "pan-right":
      return `from { scale: ${num(1 + 0.08 * a)}; translate: ${num(-4 * a)}vw 0 } to { scale: ${num(1 + 0.08 * a)}; translate: ${num(4 * a)}vw 0 }`;
    case "shake": {
      const s = num(1 + 0.03 * a);
      const d = num(1.2 * a);
      const stops: [number, string][] = [
        [0, "0 0"], [20, `${d}vw -${d}vw`], [40, `-${d}vw ${d}vw`], [60, `${d}vw ${d}vw`], [80, `-${d}vw -${d}vw`], [100, "0 0"],
      ];
      return stops.map(([at, translate]) => `${at}% { scale: ${s}; translate: ${translate} }`).join(" ");
    }
  }
}

/** One line of the film's keyframes block. */
export function keyframesLine(move: Move): string {
  return `@keyframes ${moveName(move)} { ${moveKeyframes(move)} }`;
}
