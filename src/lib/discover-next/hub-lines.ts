/**
 * The Videos chip's words around its grid (spec 3.2): the count line above it, and the sentence said
 * in its place when a search finds nothing. One rule for the hub and for its dev preview. Pure.
 *
 * - The line: "372 proven videos"; with a filter on, its names and the count ("Comedy · TikTok · 40
 *   videos"), and the screen draws Clear beside it.
 * - A search with no match: "No video matches that.", or for a @handle (or a TikTok profile link) the
 *   library holds nothing from, "Nothing from @handle in the library yet." (filters aside: a handle the
 *   library holds but the filter hides gets the plain sentence). With no filter on, the line is left
 *   out then, so "0 proven videos" never sits above the sentence; with a filter, it stays (it carries
 *   the filter's Clear).
 */

import { classifyDiscoverInput } from "@/lib/discover/classify-input";

import type { DiscoverPlatform } from "./discover-view";
import { DISCOVER_STRINGS, filterLine, nothingFromHandle, provenVideos } from "./discover-words";
import { searchVideos } from "./grid";
import type { CardVideo } from "./hub-data";
import { nicheLabel } from "./niches";

export interface HubLinesInput {
  /** Every video of the library: where a @handle's videos are looked for, filters aside. */
  library: readonly CardVideo[];
  /** How many videos the grid holds. */
  found: number;
  /** The search as typed, trimmed (`discoverSearchText`); "" for none. */
  q: string;
  /** The niche the filter keeps (`activeNiche`: one a video has), or null. */
  niche: string | null;
  platform: DiscoverPlatform | null;
}

export interface HubLines {
  /** The line above the grid; null leaves it out. */
  countLine: string | null;
  /** A filter is on: the line carries Clear. */
  filtered: boolean;
  /** The sentence in place of the grid; null when there is a grid (or no search to answer). */
  empty: string | null;
}

/** The names of what the filter keeps: the niche's, then the platform's. */
function filterNames(niche: string | null, platform: DiscoverPlatform | null): string[] {
  const names: string[] = [];
  if (niche) names.push(nicheLabel(niche));
  if (platform) names.push(DISCOVER_STRINGS.platforms[platform]);
  return names;
}

/** The sentence for a search that found nothing. */
function emptySentence(library: readonly CardVideo[], q: string): string {
  const input = classifyDiscoverInput(q);
  const handle = input.mode === "profile" ? input.normalized : "";
  return handle && searchVideos(library, q).length === 0 ? nothingFromHandle(handle) : DISCOVER_STRINGS.videos.noMatch;
}

export function hubLines({ library, found, q, niche, platform }: HubLinesInput): HubLines {
  const names = filterNames(niche, platform);
  const filtered = names.length > 0;
  const empty = found === 0 && q !== "" ? emptySentence(library, q) : null;
  const countLine = filtered ? filterLine(names, found) : empty !== null ? null : provenVideos(found);
  return { countLine, filtered, empty };
}
