"use client";

import { Card } from "@/components/ui/card";
import type { VideoModel } from "@/lib/result/types";
import { Curve } from "./curve";
import { Gauge } from "./gauge";
import { Player } from "./player";
import { useContentWidth } from "./use-content-width";

/** The line's width before the card is measured: a 393-wide phone (361 card less 2 × 14). */
const FALLBACK_WIDTH = 333;

/**
 * Phone: the card with the video (104 wide) beside the gauge (148), then under a hairline the line
 * (plot 100 tall) with the strip. Geometry from the mock's `.ph2.rr` (`simP0`): padding 14/14/12,
 * 8 between video and gauge (the gauge centred in the rest, 2 lower), the line 14 below the top
 * row with 30 above the plot (room for the readout). The line is as wide as the card's inside, so it
 * follows the card at 360, 393 and 430 wide.
 */
export function Hero({ model }: { model: VideoModel }) {
  const [cardRef, width] = useContentWidth<HTMLDivElement>(FALLBACK_WIDTH);
  return (
    <Card ref={cardRef} data-result="hero" className="px-3.5 pb-3 pt-3.5">
      <div className="flex items-center gap-2">
        <Player model={model} size="hero" />
        <div className="flex min-w-0 flex-1 justify-center pt-0.5">
          <Gauge headline={model.headline} size={148} />
        </div>
      </div>
      <div className="mt-3.5 border-t border-border pt-[30px]">
        <Curve model={model} width={width} height={100} strip />
      </div>
    </Card>
  );
}
