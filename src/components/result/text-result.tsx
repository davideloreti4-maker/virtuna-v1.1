"use client";

import { memo, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AnswerPrimary, PROSE, keepHyphens } from "@/components/thread-next/answer-card";
import { DocIcon } from "@/components/thread-next/field-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Archetype } from "@/lib/engine/wave3/persona-registry";
import { creditCost } from "@/lib/pricing";
import { ringDots } from "@/lib/result/ring-layout";
import {
  TEXT_RESULT_TITLE,
  TEXT_RING,
  sweepOrdered,
  textRingLooks,
  wedgeAreas,
  type TextGroup,
  type TextResultAs,
  type TextResultModel,
} from "@/lib/result/text-result";
import { cn } from "@/lib/utils";

import { AudienceRing } from "./audience-ring";
import { Gauge } from "./gauge";
import { ResultHeader } from "./result-header";
import { STAGE } from "./stage";
import { usePushedTitle } from "./use-pushed-title";

/**
 * The result page of a text simulation (thread answers step 2, spec §4; drawing P7, `axResult`), from
 * props: the text, the number ("would stop to watch"), "Script this one" (not on an opening line), the
 * ring of 1,000 lit by group, the ten groups. No Share (nothing can be shared yet). A number with no
 * known group: the first card only. Loading: the three cards as quiet blocks; not found: one line and Back.
 *
 * The ring and the list are one picture and its key (review 2026-11-23: ten wedges with no way to
 * tell which is whose). A group can be looked at from either: a row is a button, a wedge is a tap
 * area; the group's wedge stays, the others step back, and the ring's centre shows its percent and
 * name. A mouse over a row or a wedge looks without picking. Ink and greys only.
 *
 * Where the column has 920 of room (a desk), the page is two columns: the text and the ring on the
 * left, the groups on the right, so the picture and its key are on screen together. Narrower: one
 * column, as drawn.
 */

export type TextResultState =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "result"; text: string; model: TextResultModel };

/** The column: 640 as drawn; 920 in two columns where the page's body has that much room. */
const COLUMN = "mx-auto w-full max-w-[640px]";
const TWO_COLUMNS = "@min-[920px]:grid @min-[920px]:max-w-[920px] @min-[920px]:grid-cols-[400px_minmax(0,1fr)] @min-[920px]:items-start";

function Loading() {
  return (
    <div aria-busy="true" data-text-result="loading" className={cn(COLUMN, TWO_COLUMNS, "flex flex-col gap-3")}>
      <div className="flex flex-col gap-3">
        <Card className="h-[359px]" />
        <Card className="h-[340px]" />
      </div>
      <Card className="h-[619px]" />
    </div>
  );
}

function Missing() {
  const router = useRouter();
  // Back returns to where the creator came from; opened directly, Home (the shell's rule).
  const back = () => (window.history.length > 1 ? router.back() : router.push("/home"));
  return (
    <div data-text-result="missing" className={cn(COLUMN, "flex flex-col items-center gap-4 pt-24 text-center")}>
      <p className="text-title font-[640] text-foreground">This simulation isn&apos;t here.</p>
      <Button variant="secondary" onClick={back}>
        Back
      </Button>
    </div>
  );
}

/**
 * The ring's centre (`.ax-rc`): "1,000" 30 / 32 at 700 and "viewers" 13 in the secondary ink 2 under it,
 * one centred block. In SVG (sizes off the type roles live there); the baselines are where that HTML
 * block puts them (Inter: ascent 0.96875, content 1.2109 per em): 1.9 and 21.7 from the centre.
 *
 * With a group looked at: its percent in the number's place (the "%" small, as the gauge's) and its
 * name under it, 12 so the longest ("Purposeful viewers") stays inside the innermost dots.
 */
function RingCentre({ group }: { group: TextGroup | null }) {
  return (
    <svg
      aria-hidden
      data-text-result="centre"
      width={120}
      height={60}
      viewBox="-60 -30 120 60"
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-visible"
    >
      <text y={1.9} textAnchor="middle" fontSize={30} fontWeight={700} letterSpacing="-0.045em" className="fill-foreground tabular-nums">
        {group ? group.percent : "1,000"}
        {group && (
          <tspan dx={2} fontSize={15} fontWeight={600} letterSpacing="0" className="fill-foreground-secondary">
            %
          </tspan>
        )}
      </text>
      <text y={21.7} textAnchor="middle" fontSize={group ? 12 : 13} className="fill-foreground-secondary">
        {group ? group.name : "viewers"}
      </text>
    </svg>
  );
}

/** Looking at a group: `pick` on a tap (again: let go), `look` while a mouse is over it. */
interface Looking {
  focus: Archetype | null;
  pick: (group: Archetype) => void;
  look: (group: Archetype | null) => void;
}

/** A mouse looks; a finger picks (its tap is the click). */
const overWithMouse = (looking: Looking, group: Archetype | null) => (event: React.PointerEvent) => {
  if (event.pointerType === "mouse") looking.look(group);
};

const TextRing = memo(function TextRing({ model, looking }: { model: TextResultModel; looking: Looking }) {
  const layout = useMemo(() => sweepOrdered(ringDots(model.wedges, TEXT_RING)), [model]);
  const looks = useMemo(() => textRingLooks(model, layout), [model, layout]);
  const areas = useMemo(() => wedgeAreas(layout, TEXT_RING), [layout]);
  const group = looking.focus ? (model.groups.find((g) => g.group === looking.focus) ?? null) : null;
  return (
    <div className="relative shrink-0" style={{ width: layout.size, height: layout.size }}>
      <AudienceRing layout={layout} looks={looks} focus={group ? group.group : null} />
      <RingCentre group={group} />
      {/* The wedges' tap areas: for a pointer. A keyboard and a screen reader have the rows. */}
      <svg
        aria-hidden
        viewBox={`0 0 ${layout.size} ${layout.size}`}
        width={layout.size}
        height={layout.size}
        className="absolute inset-0 block"
        onPointerLeave={overWithMouse(looking, null)}
      >
        {areas.map((area) => (
          <path
            key={area.group}
            data-wedge-area={area.group}
            d={area.d}
            fill="transparent"
            className="cursor-pointer"
            onClick={() => looking.pick(area.group)}
            onPointerEnter={overWithMouse(looking, area.group)}
          />
        ))}
      </svg>
    </div>
  );
});

function GroupRow({
  group,
  looking,
  picked,
  onPick,
}: {
  group: TextGroup;
  looking: Looking;
  picked: boolean;
  onPick: (group: Archetype) => void;
}) {
  return (
    <li data-group={group.group}>
      <button
        type="button"
        aria-pressed={picked}
        onClick={() => onPick(group.group)}
        onPointerEnter={overWithMouse(looking, group.group)}
        onPointerLeave={overWithMouse(looking, null)}
        // -mx/px: the tint and the focus ring get 8 of room either side; the text stays where drawn.
        className={cn(
          "-mx-2 block w-[calc(100%+16px)] cursor-pointer rounded-xl px-2 pb-2.5 pt-[9px] text-left transition-colors duration-150",
          looking.focus === group.group && "bg-hover",
        )}
      >
        <span className="flex items-center gap-3">
          <span className="block min-w-0 flex-1">
            <span className={cn("block text-ui font-[560] leading-5 text-foreground", PROSE)}>{group.name}</span>
            <span className="block text-meta text-foreground-secondary tabular-nums">{group.share}% of your audience</span>
          </span>
          <span className="shrink-0 text-title font-[680] tracking-[-0.02em] text-foreground tabular-nums">
            {group.percent}
            <span className="ml-px text-meta font-[560] tracking-normal text-foreground-muted">%</span>
          </span>
        </span>
        {/* The percent as a length, so ten rows read at a glance (twenty figures did not). */}
        <span aria-hidden data-part="bar" className="mt-2 block h-[3px] overflow-hidden rounded-full bg-gauge-track">
          <span className="block h-full rounded-full bg-foreground" style={{ width: `${group.percent}%` }} />
        </span>
      </button>
    </li>
  );
}

function Result({
  text,
  model,
  scriptable,
  onScript,
  after,
}: {
  text: string;
  model: TextResultModel;
  scriptable: boolean;
  onScript?: () => void;
  after?: React.ReactNode;
}) {
  // No known group: nothing to light and nothing to list, so no ring card and no groups card.
  const grouped = model.groups.length > 0;
  const [picked, setPicked] = useState<Archetype | null>(null);
  const [over, setOver] = useState<Archetype | null>(null);
  const looking: Looking = useMemo(
    () => ({
      focus: over ?? picked,
      pick: (group) => setPicked((now) => (now === group ? null : group)),
      look: setOver,
    }),
    [over, picked],
  );
  const focused = looking.focus ? (model.groups.find((g) => g.group === looking.focus) ?? null) : null;
  // A row picked while the ring is off screen (a phone, where the list sits under it) brings the ring
  // back into view, so the tap shows something: the row's wedge, and its number in the centre.
  const ring = useRef<HTMLElement>(null);
  const pickFromRow = (group: Archetype) => {
    const picking = picked !== group;
    looking.pick(group);
    const figure = ring.current;
    if (!picking || !figure || typeof figure.scrollIntoView !== "function") return;
    const box = figure.getBoundingClientRect();
    if (box.top >= 0 && box.bottom <= window.innerHeight) return;
    const still = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    figure.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
  };
  const hero = (
    <Card data-text-result="hero" className="px-5 pb-3.5 pt-5">
      <p className={cn("text-pretty text-subhead font-[620] leading-[26px] tracking-[-0.018em] text-foreground", PROSE)}>{keepHyphens(text)}</p>
      {/* The thread's stronger track, as drawn (the drawing's answers re-value `--track` for every gauge). */}
      <div className="mt-4 flex justify-center border-t border-border pt-[18px] [--color-track:var(--color-gauge-track)]">
        <Gauge headline={{ value: model.value, label: "would stop to watch" }} size={148} lines={["would stop", "to watch"]} />
      </div>
      {scriptable && (
        <div className="mt-1.5">
          <AnswerPrimary
            icon={<DocIcon size={20} aria-hidden className="shrink-0" />}
            label="Script this one"
            price={creditCost("script")}
            onClick={onScript}
          />
        </div>
      )}
    </Card>
  );
  if (!grouped)
    return (
      <div className={cn(COLUMN, "flex flex-col gap-3")}>
        {hero}
        {after}
      </div>
    );
  return (
    <div className={cn(COLUMN, TWO_COLUMNS, "flex flex-col gap-3")}>
      <div className="flex min-w-0 flex-col gap-3">
        {hero}
        {after}
        <figure
          ref={ring}
          data-text-result="ring"
          className={cn("m-0 flex flex-col items-center gap-1.5 overflow-hidden rounded-3xl pb-4 pt-3.5 shadow-[var(--shadow-rest)]", STAGE)}
        >
          <TextRing model={model} looking={looking} />
          {/* With a group looked at, the other groups' dark dots are stepped back, so the general
              caption would be false: it names the group's place in the audience instead. */}
          <figcaption className="px-4 text-center text-meta text-foreground-secondary tabular-nums">
            {focused ? `${focused.name} · ${focused.share}% of your audience` : "Each dot is a viewer. Dark ones would stop."}
          </figcaption>
        </figure>
      </div>
      <Card data-text-result="groups" className="px-[18px] pb-1.5 pt-1">
        <div>
          <h2 className="px-0.5 pb-2 pt-2.5 text-meta font-[540] leading-[21px] text-foreground-secondary">Would stop, by group</h2>
          {/* One hairline under the header; between rows the bars' tracks are the dividers. */}
          <ul className="m-0 list-none border-t border-border p-0 pt-0.5">
            {model.groups.map((g) => (
              <GroupRow key={g.group} group={g} looking={looking} picked={picked === g.group} onPick={pickFromRow} />
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}

export function TextResultView({
  state,
  as,
  onScript,
  after,
}: {
  state: TextResultState;
  as: TextResultAs;
  onScript?: () => void;
  /** What stands directly under the first card of a result ("After posting"); the screen supplies it. */
  after?: React.ReactNode;
}) {
  const title = TEXT_RESULT_TITLE[as];
  usePushedTitle(title);
  const body =
    state.kind === "loading" ? (
      <Loading />
    ) : state.kind === "not-found" ? (
      <Missing />
    ) : (
      <Result
        text={state.text}
        model={state.model}
        scriptable={as !== "opening" && onScript !== undefined}
        onScript={onScript}
        after={after}
      />
    );
  return (
    <div className="flex min-h-full flex-col">
      <ResultHeader title={title} />
      {/* `@container`: the body's own width decides one column or two (the sidebar's width varies). */}
      <div data-result-body="" className="@container flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+40px)] pt-[9px] md:px-8 md:pb-12 md:pt-8">
        {body}
      </div>
    </div>
  );
}
