/**
 * Remix and the prices Discover says before the tap. Pure.
 */

import { creditCost } from "@/lib/pricing";

import { webAddress } from "./video-words";

/**
 * The platforms a library video may be remixed from: TikTok alone. The remix route fetches the source
 * video with the TikTok scraper (`resolveAndRehost` → `resolveVideoUrl`, `clockworks/tiktok-scraper`)
 * whatever platform it is sent, so an Instagram or YouTube link comes back with nothing (seen live). The
 * route's `platform` is the run's target, for the audience's grounding, not the source's.
 */
export const REMIX_PLATFORMS: ReadonlySet<string> = new Set(["tiktok"]);

/** Remix is offered on a video of such a platform with a web address to hand the engine. */
export function remixOffered(platform: string | null | undefined, videoUrl: string | null | undefined): boolean {
  return REMIX_PLATFORMS.has((platform ?? "").trim().toLowerCase()) && webAddress(videoUrl) !== null;
}

/** The longest brief the Remix sheet takes: the Remix dialog's `MAX_BRIEF` (a client module this
 *  one cannot import; a test pins the two together). */
export const REMIX_BRIEF_MAX = 200;

/** A remix run, in credits. */
export const REMIX_PRICE = creditCost("remix");

/** A live pull, in credits (a result served again from the cache costs nothing). */
export const PULL_PRICE = creditCost("discover");

/**
 * A price in words: "1 credit", "10 credits". The thread's cards' `creditsLabel`
 * (`thread-next/answer-card.tsx`), which lives in a client module a pure one cannot import (a word
 * built from it on the server would call into the client); a test pins the two together.
 */
export function creditsWords(n: number): string {
  return `${n} credit${n === 1 ? "" : "s"}`;
}
