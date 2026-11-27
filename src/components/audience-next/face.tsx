"use client";

import { useCallback, useState } from "react";

import { PlatformBadge, PlatformLogo, platformIdOf } from "@/components/brand/platform-logo";
import type { Face as FaceModel } from "@/lib/audience-next/audience-model";
import { platformName } from "@/lib/audience-next/audience-words";
import { cn } from "@/lib/utils";

/**
 * An audience's face: the account's picture over its initial. The picture is decorative (`alt=""`: the name
 * always stands beside it). A picture address can expire, so the `<img>` removes itself on error and the
 * initial shows through, never a broken image (the old screen's rule, `calibration-progress.tsx`).
 *
 * An image that failed before the page woke up fired its error before React listened for it: on mount, one
 * that has finished loading with no width is taken as failed too. The picture is the connected account's
 * stored copy; the building state shows the one the read delivers.
 *
 * A face with a platform carries that platform's badge on its bottom-right corner (outside the round clip).
 */
export function Face({ face, size, className }: { face: FaceModel; size: number; className?: string }) {
  const platform = platformIdOf(face.platform);
  if (!platform) return <FaceDisc face={face} size={size} className={className} />;
  const badge = Math.max(14, Math.round(size * 0.4));
  return (
    <span data-face-wrap="" className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      <FaceDisc face={face} size={size} />
      <PlatformBadge platform={platform} size={badge} className="absolute -bottom-0.5 -right-0.5" />
    </span>
  );
}

/**
 * A line that names a platform ("TikTok · read 14 Aug · 12 videos", "Another creator · TikTok"), with the
 * platform's mark before its name. The words stay one run of text nodes in the element (the mark is an
 * element between them), so the line reads and matches exactly as the words alone.
 */
export function PlatformLine({ line, platform }: { line: string; platform: FaceModel["platform"] }) {
  const id = platformIdOf(platform);
  const name = id ? platformName(id) : null;
  const at = name ? line.indexOf(name) : -1;
  if (!id || at < 0) return <>{line}</>;
  return (
    <>
      {line.slice(0, at)}
      <PlatformLogo platform={id} size={12} className="mr-1 inline-block align-[-1px]" />
      {line.slice(at)}
    </>
  );
}

function FaceDisc({ face, size, className }: { face: FaceModel; size: number; className?: string }) {
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
