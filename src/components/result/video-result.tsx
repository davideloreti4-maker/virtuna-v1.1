"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MOBILE_NAV_BAND } from "@/components/sidebar/Sidebar";
import { Card } from "@/components/ui/card";
import { useIsMobileHydrated } from "@/hooks/useIsMobile";
import type { VideoModel } from "@/lib/result/types";
import { AudiencePanel } from "./audience-panel";
import { BrainPanel } from "./brain-panel";
import { CompactPlayer } from "./compact-player";
import { Curve } from "./curve";
import { EngagementPanel } from "./engagement-panel";
import { Gauge } from "./gauge";
import { Hero } from "./hero";
import { Moment } from "./moment";
import { PanelSwitch, panelId, tabId, type PanelId } from "./panel-switch";
import { Player } from "./player";
import { useContentWidth } from "./use-content-width";

const PANEL_VIEWS: Record<PanelId, (props: { model: VideoModel }) => React.ReactNode> = {
  brain: BrainPanel,
  engagement: EngagementPanel,
  audience: AudiencePanel,
};

/**
 * The phone's content starts 9px into <main>: <main> reserves the header band (MOBILE_NAV_BAND,
 * 46) and the 40px header sits centred in it (3px to spare), so the first card lands 12px under
 * the header, as in the mock (`.phone .nav` ends at 96, `.phone .page` starts at 108).
 */
const PHONE_TOP = "pt-[9px]";
const PHONE_GAP_PX = 9;
/** The line the hero has scrolled past when it is gone under the header. */
const PIN_LINE_PX = MOBILE_NAV_BAND + PHONE_GAP_PX;

/**
 * The page's frame with empty cards and no text: shown while the row loads, and for the one frame
 * before the viewport is measured (so the video is mounted once, in the right layout).
 */
export function ResultFrame() {
  return (
    <div aria-busy="true">
      <div className={`px-4 ${PHONE_TOP} md:hidden`}>
        <Card className="h-[426px]" />
        <Card className="mt-5 h-[350px]" />
      </div>
      <div className="hidden px-8 pt-8 md:block">
        <div className="mx-auto grid max-w-[980px] grid-cols-[minmax(0,372fr)_minmax(0,588fr)] items-start gap-5">
          <div className="aspect-[9/16] w-full rounded-3xl bg-surface-sunken" />
          <div className="flex min-w-0 flex-col gap-4">
            <Card className="h-[224px]" />
            <Card className="h-[227px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** True once the element has scrolled up under the header (the scroll container is <main>). */
function useScrolledPast(ref: React.RefObject<HTMLElement | null>): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setPast(!entry.isIntersecting && entry.boundingClientRect.top < PIN_LINE_PX);
      },
      { rootMargin: `-${PIN_LINE_PX}px 0px 0px 0px` },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return past;
}

interface Parts {
  model: VideoModel;
  tabs: React.ReactNode;
  panel: React.ReactNode;
  /** Directly under the first block ("After posting"), from the screen. */
  after?: React.ReactNode;
}

/**
 * Phone (the mock's `simP0`, RUN branch): one column, 16px sides. The hero card; the moment 18
 * below; the switch 20 below; the panel 10 below. Once the hero has scrolled under the header the
 * compact player is pinned there.
 */
function PhoneResult({ model, tabs, panel, after }: Parts) {
  const heroRef = useRef<HTMLDivElement>(null);
  const scrolled = useScrolledPast(heroRef);
  return (
    <div className={`px-4 ${PHONE_TOP} pb-[calc(env(safe-area-inset-bottom)+40px)]`}>
      <div ref={heroRef}>
        <Hero model={model} />
      </div>
      {/* 12 under the hero; no room at all while it shows nothing (it renders nothing until read). */}
      {after !== undefined && <div className="mt-3 empty:hidden">{after}</div>}
      <div className="mt-[18px]">
        <Moment model={model} />
      </div>
      <div className="mt-5">{tabs}</div>
      <div className="mt-2.5">{panel}</div>
      {scrolled && (
        // Pinned right under the header band, 12px under the header like the hero was. The ground
        // behind it (and the 9px above it) hides the content scrolling under it, as a header would.
        <div
          className="fixed inset-x-0 z-[var(--z-sticky)] bg-background px-4"
          style={{ top: `calc(env(safe-area-inset-top) + ${MOBILE_NAV_BAND}px)`, paddingTop: PHONE_GAP_PX }}
        >
          <CompactPlayer model={model} />
        </div>
      )}
    </div>
  );
}

/**
 * Desktop (the mock's `simD` and `.desk` rules): a 980 grid centred in the content area, 32 under
 * the header row: the video (372, 9:16) and, 20 to its right, a 588 column with 16 between its
 * parts: the gauge (180) beside the moment in one card (padding 22/30/22/22, 26 apart); the line
 * as its own card (padding 32/24/14, plot 104 tall, as wide as the card's inside); the switch;
 * the panel.
 */
function DesktopResult({ model, tabs, panel, after }: Parts) {
  const [curveCard, curveWidth] = useContentWidth<HTMLDivElement>(540);
  return (
    <div className="px-8 pb-12 pt-8">
      <div className="mx-auto grid max-w-[980px] grid-cols-[minmax(0,372fr)_minmax(0,588fr)] items-start gap-5">
        <Player model={model} size="desktop" />
        <div className="@container flex min-w-0 flex-col gap-4">
          {/* Beside each other where the moment keeps a readable line (a column of 460 and up);
              in a narrower column (a tablet held upright) the gauge sits above the moment. */}
          <Card className="flex flex-col items-center gap-4 p-[22px] @min-[460px]:flex-row @min-[460px]:gap-[26px] @min-[460px]:pr-[30px]">
            <Gauge headline={model.headline} size={180} />
            <div className="w-full min-w-0 @min-[460px]:w-auto @min-[460px]:flex-1">
              <Moment model={model} />
            </div>
          </Card>
          {/* The column's first block is the gauge's card: "After posting" stands under it. */}
          {after}
          <Card ref={curveCard} className="px-6 pb-3.5 pt-8">
            <Curve model={model} width={curveWidth} height={104} strip />
          </Card>
          {tabs}
          {panel}
        </div>
      </div>
    </div>
  );
}

/**
 * The video result: phone or desktop, the panel switch, and the chosen panel. `after` (the screen's
 * "After posting") stands under the first block: the hero on a phone, the gauge's card on a desk.
 */
export function VideoResult({ model, after }: { model: VideoModel; after?: React.ReactNode }) {
  const { isMobile, hydrated } = useIsMobileHydrated();
  const [selected, setSelected] = useState<PanelId>("audience");
  const idBase = useId();

  if (!hydrated) return <ResultFrame />;

  const View = PANEL_VIEWS[selected];
  const tabs = <PanelSwitch value={selected} onChange={setSelected} idBase={idBase} />;
  const panel = (
    // A Tab stop of its own: a panel without controls (Engagement) can still be reached and read.
    // A container too: a panel lays itself out for the width it gets, not for the window's.
    <div
      role="tabpanel"
      tabIndex={0}
      id={panelId(idBase)}
      aria-labelledby={tabId(idBase, selected)}
      data-result="panel"
      className="@container"
    >
      <View model={model} />
    </div>
  );

  return isMobile ? (
    <PhoneResult model={model} tabs={tabs} panel={panel} after={after} />
  ) : (
    <DesktopResult model={model} tabs={tabs} panel={panel} after={after} />
  );
}
