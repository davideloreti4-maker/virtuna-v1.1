"use client";

import type { VideoModel } from "@/lib/result/types";
import { Curve } from "./curve";
import { FirstCard, PHONE_LINE_FALLBACK, PLOT_PX } from "./first-block";
import { useLanding } from "./landing";
import { Player } from "./player";
import { useContentWidth } from "./use-content-width";
import { ViewerCount } from "./viewer-count";

/**
 * Phone: the first card. The video in focus, the count under it, then under the hairline
 * the line with the strip and its two times. The line is as wide as the card's inside, so it follows
 * the card at 320, 393 and 430 wide.
 */
export function Hero({ model }: { model: VideoModel }) {
  const [cardRef, width] = useContentWidth<HTMLDivElement>(PHONE_LINE_FALLBACK);
  const landing = useLanding();
  return (
    <FirstCard
      name="hero"
      cardRef={cardRef}
      tile={<Player model={model} size="hero" />}
      under={<ViewerCount audience={model.audience} />}
      line={<Curve model={model} width={width} height={PLOT_PX.phone} strip enter={landing} />}
    />
  );
}
