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

type WedgeProps = { group: string; dots: readonly RingDot[]; r: number } & WedgeLook;

const Wedge = memo(function Wedge({ group, dots, r, on, coral, outline }: WedgeProps) {
  if (outline) {
    return (
      <g data-wedge={group} data-look="outline" data-dots={0}>
        <path d={circles(dots, r * 0.82)} fill="none" stroke="var(--color-foreground)" strokeWidth={0.8} opacity={0.3} />
      </g>
    );
  }
  const n = dots.length;
  const look = on >= n ? "full" : on > 0 ? "part" : coral ? "coral" : "pale";
  // The dots that have gone: coral for the named scene, else pale.
  const gone = coral ? { fill: "var(--color-below)", opacity: 0.42 } : { fill: "var(--color-foreground)", opacity: 0.13 };
  return (
    <g data-wedge={group} data-look={look} data-dots={n}>
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
  function AudienceRing({ layout, looks }: { layout: RingLayout; looks: readonly WedgeLook[] }) {
    const { size, dotR, wedges } = layout;
    return (
      <svg data-ring="" viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true" className="block">
        {wedges.map((wedge, i) => (
          <Wedge
            key={wedge.group}
            group={wedge.group}
            dots={wedge.dots}
            r={dotR}
            {...(looks[i] ?? { on: 0, coral: false, outline: !wedge.present })}
          />
        ))}
      </svg>
    );
  },
  (prev, next) => prev.layout === next.layout && sameLooks(prev.looks, next.looks),
);
