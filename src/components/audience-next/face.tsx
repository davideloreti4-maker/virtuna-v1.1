"use client";

import { useCallback, useState } from "react";

import type { Face as FaceModel } from "@/lib/audience-next/audience-model";
import { cn } from "@/lib/utils";

/**
 * An audience's face: the account's picture over its initial. The picture is decorative (`alt=""`: the name
 * always stands beside it). A picture address can expire, so the `<img>` removes itself on error and the
 * initial shows through, never a broken image (the old screen's rule, `calibration-progress.tsx`).
 *
 * An image that failed before the page woke up fired its error before React listened for it: on mount, one
 * that has finished loading with no width is taken as failed too. The page stores no picture today, so the
 * initial is the usual case; the building state shows the one the read delivers.
 */
export function Face({ face, size, className }: { face: FaceModel; size: number; className?: string }) {
  // The address that failed; a new address is tried again.
  const [failed, setFailed] = useState<string | null>(null);
  const picture = face.picture && face.picture !== failed ? face.picture : null;
  const failedEarly = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth === 0) setFailed(img.getAttribute("src"));
  }, []);
  return (
    <span
      data-face=""
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-sunken", className)}
      style={{ width: size, height: size }}
    >
      <span aria-hidden className="font-[650] leading-none text-foreground-secondary" style={{ fontSize: Math.round(size * 0.4) }}>
        {face.initial}
      </span>
      {picture && (
        // A new element per address, so the check above runs for each.
        // eslint-disable-next-line @next/next/no-img-element -- an address that expires, not a static asset
        <img
          key={picture}
          ref={failedEarly}
          src={picture}
          alt=""
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailed(picture)}
        />
      )}
    </span>
  );
}
