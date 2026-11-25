"use client";

import { memo } from "react";
import type { RingDot, RingLayout, WedgeLook } from "@/lib/result/ring-layout";

/**
 * The audience ring (the mock's `ring`, RUN branch): 1,000 dots, one wedge per group. A wedge is
 * full while its viewers watch and pale once they are gone; the wedges of the groups that leave in
 * the scene the sentence names turn coral instead of pale, once they have gone; a group that is
 * not in the run is a thin wedge of outlines.
 *
 * The playhead moves every animation frame; the ring does not. It renders again only when a
 * wedge's look changes (`memo` on the looks' values), and then only that wedge's paths change: a
 * wedge is one path of circles, or two while part of its group has gone.
 *
 * `focus` (the text result's ring): one group is being looked at, and every other wedge steps back
 * to 30%. No colour is added, so it works where a page is ink and greys only.
 */

/** Dots as circles in one path: each is two half arcs. */
export function circles(dots: readonly RingDot[], r: number): string {
  const d = r.toFixed(2);
  const w = (2 * r).toFixed(2);
  let path = "";
  for (const dot of dots) path += `M${(dot.x - r).toFixed(2)} ${dot.y}a${d} ${d} 0 1 0 ${w} 0a${d} ${d} 0 1 0 -${w} 0`;
  return path;
}

// A wedge that empties or fills fades (the mock's .rg.live); not with reduced motion.
const FADE = "motion-safe:transition-[fill,opacity] motion-safe:duration-[450ms]";

type WedgeProps = { group: string; dots: readonly RingDot[]; r: number; dimmed?: boolean } & WedgeLook;

// A wedge that steps back, or returns, does so in a fifth of a second; not with reduced motion.
const STEP_BACK = "motion-safe:transition-opacity motion-safe:duration-200";

const Wedge = memo(function Wedge({ group, dots, r, dimmed, on, coral, outline }: WedgeProps) {
  // `dimmed` undefined: a ring with no focus to give (the video ring), its markup as it always was.
  const step = dimmed === undefined ? {} : { className: STEP_BACK, ...(dimmed ? { "data-dimmed": "", opacity: 0.3 } : {}) };
  if (outline) {
    return (
      <g data-wedge={group} data-look="outline" data-dots={0} {...step}>
        <path d={circles(dots, r * 0.82)} fill="none" stroke="var(--color-foreground)" strokeWidth={0.8} opacity={0.3} />
      </g>
    );
  }
  const n = dots.length;
  const look = on >= n ? "full" : on > 0 ? "part" : coral ? "coral" : "pale";
  // The dots that have gone: coral for the named scene, else pale.
  const gone = coral ? { fill: "var(--color-below)", opacity: 0.42 } : { fill: "var(--color-foreground)", opacity: 0.13 };
  return (
    <g data-wedge={group} data-look={look} data-dots={n} {...step}>
      {on > 0 && on < n ? (
        <>
          <path d={circles(dots.slice(0, on), r)} fill="var(--color-foreground)" />
          <path d={circles(dots.slice(on), r)} {...gone} />
        </>
      ) : (
        // One element whether full or gone, so the change is a fade.
        <path
          key="all"
          d={circles(dots, r)}
          className={FADE}
          {...(on >= n ? { fill: "var(--color-foreground)", opacity: 1 } : gone)}
        />
      )}
    </g>
  );
});

const sameLooks = (a: readonly WedgeLook[], b: readonly WedgeLook[]) =>
  a.length === b.length && a.every((x, i) => x.on === b[i]!.on && x.coral === b[i]!.coral && x.outline === b[i]!.outline);

export const AudienceRing = memo(
  function AudienceRing({
    layout,
    looks,
    focus,
  }: {
    layout: RingLayout;
    looks: readonly WedgeLook[];
    /**
     * The group being looked at: the other wedges step back. `null`: a ring that can be looked into,
     * with nothing picked. Not given: a ring with no such thing (the video ring).
     */
    focus?: string | null;
  }) {
    const { size, dotR, wedges } = layout;
    return (
      <svg data-ring="" viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true" className="block">
        {wedges.map((wedge, i) => (
          <Wedge
            key={wedge.group}
            group={wedge.group}
            dots={wedge.dots}
            r={dotR}
            dimmed={focus === undefined ? undefined : focus !== null && focus !== wedge.group}
            {...(looks[i] ?? { on: 0, coral: false, outline: !wedge.present })}
          />
        ))}
      </svg>
    );
  },
  (prev, next) => prev.layout === next.layout && prev.focus === next.focus && sameLooks(prev.looks, next.looks),
);
