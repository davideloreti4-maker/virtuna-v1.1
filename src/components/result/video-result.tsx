"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MOBILE_NAV_BAND } from "@/components/sidebar/Sidebar";
import { useIsMobileHydrated } from "@/hooks/useIsMobile";
import type { VideoModel } from "@/lib/result/types";
import { cn } from "@/lib/utils";
import { AudiencePanel } from "./audience-panel";
import { BrainPanel } from "./brain-panel";
import { CompactPlayer } from "./compact-player";
import { Curve } from "./curve";
import { EngagementPanel } from "./engagement-panel";
import { PHONE_COLUMN, PHONE_TOP_PX, PLOT_PX, ResultFrame, WIDE_LINE_FALLBACK, WideFrame, type Viewport } from "./first-block";
import { Hero } from "./hero";
import { LAND, useLanding } from "./landing";
import { Moment } from "./moment";
import { PanelSwitch, panelId, tabId, type PanelId } from "./panel-switch";
import { Player } from "./player";
import { useContentWidth } from "./use-content-width";
import { ViewerCount } from "./viewer-count";

const PANEL_VIEWS: Record<PanelId, (props: { model: VideoModel }) => React.ReactNode> = {
  brain: BrainPanel,
  engagement: EngagementPanel,
  audience: AudiencePanel,
};

/** The line the first card has scrolled past when it is gone under the header. */
const PIN_LINE_PX = MOBILE_NAV_BAND + PHONE_TOP_PX;

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
 * Phone (the mock's `simP0`, RUN branch): one column, 16px sides. The first card (`Hero`); the moment
 * 18 below; the switch 20 below; the panel 10 below. Once the first card has scrolled under the header
 * the compact player is pinned there.
 */
function PhoneResult({ model, tabs, panel, after }: Parts) {
  const heroRef = useRef<HTMLDivElement>(null);
  const scrolled = useScrolledPast(heroRef);
  // Landing: what lies under the first card comes in after it (opacity only, see landing.tsx).
  const rest = useLanding() ? LAND.rest : undefined;
  return (
    <div className={PHONE_COLUMN}>
      <div ref={heroRef}>
        <Hero model={model} />
      </div>
      {/* 12 under the first card; no room at all while it shows nothing (it renders nothing until read). */}
      {after !== undefined && <div className={cn("mt-3 empty:hidden", rest)}>{after}</div>}
      <div className={cn("mt-[18px]", rest)}>
        <Moment model={model} />
      </div>
      <div className={cn("mt-5", rest)}>{tabs}</div>
      <div className={cn("mt-2.5", rest)}>{panel}</div>
      {scrolled && (
        // Pinned right under the header band, 12px under the header like the first card was. The ground
        // behind it (and the 9px above it) hides the content scrolling under it, as a header would.
        <div
          className="fixed inset-x-0 z-[var(--z-sticky)] bg-background px-4"
          style={{ top: `calc(env(safe-area-inset-top) + ${MOBILE_NAV_BAND}px)`, paddingTop: PHONE_TOP_PX }}
        >
          <CompactPlayer model={model} />
        </div>
      )}
    </div>
  );
}

/**
 * Wide window (`WideFrame`): the video large at the left with the count under it; at the
 * right the sentence's card alone, "After posting", the line's card (plot 104, as wide as the card's
 * inside), the switch and the panel.
 */
function DesktopResult({ model, tabs, panel, after }: Parts) {
  const [lineCard, lineWidth] = useContentWidth<HTMLDivElement>(WIDE_LINE_FALLBACK);
  const landing = useLanding();
  // Landing: the line's card was there while waiting; its line draws, the rest of the column comes in.
  const rest = landing ? LAND.rest : undefined;
  return (
    <WideFrame
      tile={<Player model={model} size="desktop" />}
      under={<ViewerCount audience={model.audience} />}
      first={<Moment model={model} />}
      firstClassName={rest}
      after={after}
      afterClassName={rest}
      lineCardRef={lineCard}
      line={<Curve model={model} width={lineWidth} height={PLOT_PX.wide} strip enter={landing} />}
      restClassName={rest}
      rest={
        <>
          {tabs}
          {panel}
        </>
      }
    />
  );
}

/**
 * The video result: phone or desktop, the panel switch, and the chosen panel. `after` (the screen's
 * "After posting") stands under the first block: the first card on a phone, the sentence's card on a
 * wide window.
 */
export function VideoResult({
  model,
  after,
  viewport,
}: {
  model: VideoModel;
  after?: React.ReactNode;
  /** The page's measurement of the window; measured here when it is drawn on its own. */
  viewport?: Viewport;
}) {
  const measured = useIsMobileHydrated();
  const { isMobile, hydrated } = viewport ?? measured;
  const [selected, setSelected] = useState<PanelId>("audience");
  const idBase = useId();

  if (!hydrated) return <ResultFrame />;

  const View = PANEL_VIEWS[selected];
  const tabs = <PanelSwitch value={selected} onChange={setSelected} idBase={idBase} />;
  const panel = (
    // A Tab stop of its own: a panel without controls can still be reached and read.
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
