/**
 * One library video as its page draws it: the card's fields, plus the original's address, why it
 * works, and its beats. Types only.
 */

import type { CardVideo } from "./hub-data";

/** One beat of "How it's built": its name and, when the extraction measured them, its times. */
export interface BeatInput {
  name: string;
  startSec?: number | null;
  endSec?: number | null;
}

export interface LibraryVideo extends CardVideo {
  /** The original's address (Watch on…, and what Remix hands on). */
  videoUrl: string | null;
  /** Trimmed; an empty text is null. */
  whyItWorks: string | null;
  /** In order; empty when the video has no stored beats or its template fails its schema. */
  beats: BeatInput[];
}
