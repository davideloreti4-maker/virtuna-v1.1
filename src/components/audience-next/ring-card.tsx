"use client";

import { memo, useMemo } from "react";

import { AudienceRing } from "@/components/result/audience-ring";
import { equalRing } from "@/components/result/running-ring";
import { AUDIENCE_RING, type PageGroup } from "@/lib/audience-next/audience-model";
import { AUDIENCE_STRINGS } from "@/lib/audience-next/audience-words";
import type { Archetype } from "@/lib/engine/wave3/persona-registry";
import { ringDots, type WedgeInput, type WedgeLook } from "@/lib/result/ring-layout";
import { wedgeAreas } from "@/lib/result/text-result";

/**
 * The audience's ring (spec 3.2.2, 3.3): the 1,000 viewers in one wedge per group, each as wide
 * as its group's share, largest first, clockwise from the top, every dot ink. The layout is the model's own
 * (`ringDots` with `AUDIENCE_RING`), so each wedge draws exactly the count its row and its sheet say.
 *
 * In the middle "1,000" over "viewers"; with a group looked at (its sheet open) the other nine wedges step
 * back and the middle shows the group's count over its name. A wedge is a tap area for a pointer; the
 * keyboard and the screen reader reach the groups through their rows, so the drawing is hidden from them.
 * One line says the total to a screen reader: the percentages are on the rows, the 1,000 nowhere else.
 *
 * `PaleRing`: ten equal pale wedges with nothing in the middle (no audience yet; an audience with no groups).
 */

const COUNT = new Intl.NumberFormat("en-US");

/** Every dot of every wedge is a viewer: all lit. */
const FULL = (layout: { wedges: readonly { dots: readonly unknown[] }[] }): WedgeLook[] =>
  layout.wedges.map((w) => ({ on: w.dots.length, coral: false, outline: false }));

/**
 * The middle of the ring, as the text result's (`text-result.tsx`, `RingCentre`): the number 30 at 700 over
 * its word 13 (12 for a group's name, so the longest stays inside the innermost dots). In SVG, centred.
 */
function RingCentre({ group }: { group: PageGroup | null }) {
  return (
    <svg
      aria-hidden
      data-ring-centre=""
      width={120}
      height={60}
      viewBox="-60 -30 120 60"
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-visible"
    >
      <text y={1.9} textAnchor="middle" fontSize={30} fontWeight={700} letterSpacing="-0.045em" className="fill-foreground tabular-nums">
        {group ? COUNT.format(group.count) : AUDIENCE_STRINGS.ringTotal}
      </text>
      <text y={21.7} textAnchor="middle" fontSize={group ? 12 : 13} className="fill-foreground-secondary">
        {group ? group.name : AUDIENCE_STRINGS.ringUnit}
      </text>
    </svg>
  );
}

export interface RingCardProps {
  wedges: readonly WedgeInput[];
  groups: readonly PageGroup[];
  /** The group whose sheet is open: the other wedges step back. */
  focus: Archetype | null;
  onPick(group: Archetype): void;
}

export const RingCard = memo(function RingCard({ wedges, groups, focus, onPick }: RingCardProps) {
  const layout = useMemo(() => ringDots(wedges, AUDIENCE_RING), [wedges]);
  const looks = useMemo(() => FULL(layout), [layout]);
  const areas = useMemo(() => wedgeAreas(layout, AUDIENCE_RING), [layout]);
  const group = focus ? (groups.find((g) => g.group === focus) ?? null) : null;
  return (
    <div className="relative shrink-0" style={{ width: layout.size, height: layout.size }}>
      <p className="sr-only">{`${AUDIENCE_STRINGS.ringTotal} ${AUDIENCE_STRINGS.ringUnit}`}</p>
      <AudienceRing layout={layout} looks={looks} focus={group ? group.group : null} />
      <RingCentre group={group} />
      {/* The wedges' tap areas: for a pointer. A keyboard and a screen reader have the rows. */}
      <svg aria-hidden viewBox={`0 0 ${layout.size} ${layout.size}`} width={layout.size} height={layout.size} className="absolute inset-0 block">
        {areas.map((area) => (
          <path
            key={area.group}
            data-wedge-area={area.group}
            d={area.d}
            fill="transparent"
            className="cursor-pointer"
            onClick={() => onPick(area.group)}
          />
        ))}
      </svg>
    </div>
  );
});

/** Ten equal wedges, every dot pale, nothing in the middle. */
export const PaleRing = memo(function PaleRing() {
  const { layout } = equalRing(10, AUDIENCE_RING.r1, AUDIENCE_RING.R, 1000);
  const looks = useMemo(() => layout.wedges.map((): WedgeLook => ({ on: 0, coral: false, outline: false })), [layout]);
  return (
    <div className="relative shrink-0" style={{ width: layout.size, height: layout.size }}>
      <AudienceRing layout={layout} looks={looks} />
    </div>
  );
});
