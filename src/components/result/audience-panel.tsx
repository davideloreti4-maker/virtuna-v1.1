"use client";

import { memo, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { audienceLayoutFor, type AudienceLayout } from "@/lib/result/audience-layout";
import { sceneEndShareAt } from "@/lib/result/curve";
import { timecode } from "@/lib/result/format";
import { groupSections, groupsAt, groupWord } from "@/lib/result/group-state";
import { ringDots, wedgeLooks, wedgesOf } from "@/lib/result/ring-layout";
import type { GroupRow, GroupStatus, VideoModel } from "@/lib/result/types";
import { cn } from "@/lib/utils";
import { AudienceRing } from "./audience-ring";
import { usePlayhead } from "./playhead";

/**
 * The Audience panel (spec §5 "Audience"; the mock's `lens`, RUN branches, with `rrows`). The ring
 * of the ten groups with the share still watching in its centre, then the groups as rows under
 * "Left" (earliest first) and "Stayed" ("Watching" while the playhead moves), then the groups that
 * are not in the run. Everything is counted by weight; a row carries no percentage and no count.
 *
 * Stacked (the phone, and any column too narrow for both): the ring in a 350 card (inner radius 74,
 * outer 158), the rows in a card under it, the caption under that. Side by side (the desktop
 * column): the ring (56 / 124) and the rows, 1 : 1.15, 16 apart; the caption closes the rows'
 * card. Which one, and how large the ring is drawn, follows the panel's own width
 * (`audienceLayoutFor`), so a tablet or a narrow window never cuts the ring off.
 */

const PHONE_RING = { r1: 74, R: 158 } as const;
const DESKTOP_RING = { r1: 56, R: 124 } as const;
/** The app's phone / desktop line (`useIsMobile`). */
const DESKTOP_MIN = 768;

/** The mock's `--stage`: a soft light in the middle of the card, from the theme's surfaces. */
const STAGE =
  "bg-[radial-gradient(90%_80%_at_50%_40%,var(--color-surface)_0%,color-mix(in_srgb,var(--color-surface-elevated)_50%,var(--color-surface))_100%)] " +
  "dark:bg-[radial-gradient(80%_70%_at_50%_42%,color-mix(in_srgb,var(--color-surface-elevated)_55%,var(--color-surface))_0%,var(--color-surface)_100%)]";

/**
 * The layout for the panel's width, measured before the first paint and followed as it changes.
 * Until a width is known (and where none can be measured) the window decides, as the page does.
 */
function usePanelLayout(): [React.RefObject<HTMLDivElement | null>, AudienceLayout] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [windowIsPhone] = useState(() => typeof window === "undefined" || window.innerWidth < DESKTOP_MIN);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      if (el.clientWidth > 0) setWidth(el.clientWidth);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const layout = useMemo(
    () => (width == null ? { stacked: windowIsPhone, ringScale: 1 } : audienceLayoutFor(width)),
    [width, windowIsPhone],
  );
  return [ref, layout];
}

/** The centre of the ring: the share still watching. Drawn in SVG, where its sizes are the mock's. */
const RingCentre = memo(function RingCentre({ value, label, box }: { value: number; label: string; box: number }) {
  const h = box / 2;
  return (
    <svg
      data-ring-centre=""
      width={box}
      height={box}
      viewBox={`${-h} ${-h} ${box} ${box}`}
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-visible"
    >
      <text y={-1} textAnchor="middle" fontSize={42} letterSpacing="-0.05em" className="fill-foreground font-bold tabular-nums">
        {value}
        <tspan dx={1} fontSize={20} fontWeight={560} letterSpacing="-0.02em" className="fill-foreground-muted">
          %
        </tspan>
      </text>
      <text y={31} textAnchor="middle" fontSize={13} className="fill-foreground-secondary font-[430] tabular-nums">
        {label}
      </text>
    </svg>
  );
});

type RowLook = GroupStatus | "coral";

interface RowItem {
  group: string;
  name: string;
  word: string;
  look: RowLook;
  heavy: boolean;
}

function rowItem(row: GroupRow, t: number, clipS: number): RowItem {
  // A group with no viewer in the run has the status "absent" (`groupsAt`).
  const look: RowLook = row.status === "left" && row.named ? "coral" : row.status;
  return { group: row.group, name: row.name, word: groupWord(row, t, clipS), look, heavy: row.heavy };
}

/** A row's dot (the mock's `.gs-*`): ink while watching, half while leaving, pale once gone. */
const DOT: Record<RowLook, string> = {
  watching: "bg-foreground",
  leaving:
    "bg-[linear-gradient(90deg,var(--color-foreground)_50%,color-mix(in_srgb,var(--color-foreground)_13%,transparent)_50%)]",
  left: "bg-[color-mix(in_srgb,var(--color-foreground)_13%,transparent)]",
  coral: "bg-below opacity-55",
  absent: "shadow-[inset_0_0_0_1.2px_color-mix(in_srgb,var(--color-foreground)_35%,transparent)]",
};

const WORD: Record<RowLook, string> = {
  watching: "text-foreground",
  leaving: "text-foreground",
  left: "text-foreground-secondary",
  coral: "text-below-text",
  absent: "text-foreground-muted",
};

interface Section {
  heading: string;
  rows: RowItem[];
}

/** The rows, phone or desktop. Renders again only when a row's words or look change. */
const GroupList = memo(
  function GroupList({ sections, phone }: { sections: Section[]; sig: string; phone: boolean }) {
    const idBase = useId();
    return (
      <>
        {sections.map((section, s) => {
          const headingId = `${idBase}-${s}`;
          return (
            <div key={section.heading}>
              <h3
                id={headingId}
                className={cn(
                  "text-foreground-secondary",
                  phone ? "pb-[7px] pt-3.5 text-label font-[560]" : "pb-[0.5px] pt-2 text-meta font-[560]",
                )}
              >
                {section.heading}
              </h3>
              <ul aria-labelledby={headingId} className={phone ? "divide-y divide-border" : undefined}>
                {section.rows.map((row) => (
                  <li
                    key={row.group}
                    data-group={row.group}
                    data-look={row.look}
                    className={cn("flex items-center", phone ? "h-11 gap-2.5" : "h-[26.5px] gap-[9px]")}
                  >
                    <span className={cn("flex shrink-0 items-center justify-center", phone ? "size-[9px]" : "size-2")}>
                      <span
                        data-dot={row.heavy ? "heavy" : "light"}
                        className={cn("size-full rounded-full", DOT[row.look], !row.heavy && "scale-[0.55]")}
                      />
                    </span>
                    <span
                      data-name=""
                      className={cn("min-w-0 flex-1 truncate text-foreground", phone ? "text-ui font-[560]" : "text-meta font-[430]")}
                    >
                      {row.name}
                    </span>
                    <span
                      data-word=""
                      className={cn(
                        "shrink-0 tabular-nums",
                        phone ? "text-ui font-[560]" : "text-meta",
                        !phone && (row.look === "watching" || row.look === "leaving" ? "font-[640]" : "font-[560]"),
                        WORD[row.look],
                      )}
                    >
                      {row.word}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </>
    );
  },
  (prev, next) => prev.sig === next.sig && prev.phone === next.phone,
);

/** Most runs have one viewer per group; some have a group twice or three times and another missing. */
const captionOf = (viewers: VideoModel["audience"]["viewers"]) =>
  new Set(viewers.map((v) => v.group)).size === viewers.length
    ? "One simulated viewer per group."
    : "One to three simulated viewers per group.";

export function AudiencePanel({ model }: { model: VideoModel }) {
  const { audience, verdict, clipS, headline } = model;
  const { t } = usePlayhead();
  const [panelRef, { stacked: phone, ringScale }] = usePanelLayout();
  const atEnd = t >= clipS;

  // The ring's layout depends on the groups' weights only: once per run and size.
  const layout = useMemo(
    () => ringDots(wedgesOf(groupsAt(audience, verdict, clipS)), phone ? PHONE_RING : DESKTOP_RING),
    [audience, verdict, clipS, phone],
  );

  // Every frame while playing: ten rows, cheap. What they feed renders only on a change.
  const groups = groupsAt(audience, verdict, t);
  const looks = wedgeLooks(groups, layout);

  const { left, stayed, absent } = groupSections(groups);
  const item = (row: GroupRow) => rowItem(row, t, clipS);
  const sections: Section[] = [];
  if (left.length) sections.push({ heading: "Left", rows: left.map(item) });
  if (stayed.length) sections.push({ heading: atEnd ? "Stayed" : "Watching", rows: stayed.map(item) });
  // The groups that are not in the run close the last list, without a heading of their own.
  if (absent.length && sections.length) sections[sections.length - 1]!.rows.push(...absent.map(item));
  const sig = sections.map((s) => `${s.heading}:${s.rows.map((r) => `${r.group}=${r.look}/${r.word}`).join(",")}`).join("|");

  const at = sceneEndShareAt(audience, t);
  const share = atEnd ? { pct: headline.value, label: "stayed" } : { pct: at.pct, label: `watching · ${timecode(at.at)}` };

  const ring = (
    <div
      data-result="ring"
      className="relative shrink-0"
      style={{
        width: layout.size,
        height: layout.size,
        transform: ringScale < 1 ? `scale(${ringScale})` : undefined,
      }}
    >
      <AudienceRing layout={layout} looks={looks} />
      <RingCentre value={share.pct} label={share.label} box={2 * (phone ? PHONE_RING.r1 : DESKTOP_RING.r1) - 28} />
    </div>
  );

  if (phone) {
    return (
      <div ref={panelRef} data-result="audience" className="flex flex-col gap-2.5">
        <Card data-result="audience-ring" className={cn("flex h-[350px] items-center justify-center overflow-hidden p-0", STAGE)}>
          {ring}
        </Card>
        <Card data-result="audience-rows" className="px-5 pb-2 pt-1">
          <GroupList sections={sections} sig={sig} phone />
        </Card>
        <p data-result="audience-caption" className="px-1 text-label font-[430] text-foreground-secondary">
          {captionOf(audience.viewers)}
        </p>
      </div>
    );
  }

  return (
    <div ref={panelRef} data-result="audience" className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-4">
      <Card
        data-result="audience-ring"
        className={cn("flex min-h-[372px] items-center justify-center overflow-hidden p-0", STAGE)}
      >
        {ring}
      </Card>
      <Card data-result="audience-rows" className="flex flex-col px-6 pb-[18px] pt-6">
        <GroupList sections={sections} sig={sig} phone={false} />
        <p data-result="audience-caption" className="pt-2 text-label font-[430] text-foreground-secondary">
          {captionOf(audience.viewers)}
        </p>
      </Card>
    </div>
  );
}
