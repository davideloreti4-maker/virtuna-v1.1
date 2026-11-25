/**
 * One library video with its beats, for its page.
 *
 * The one server read of this folder. `outlier_teardowns` has RLS enabled with no policies, so it is
 * read through the corpus SERVICE client, as the hub's read and the old detail dialog's are
 * (`corpus-reads.ts`, `app/actions/discover/teardown.ts`). Deliberately NOT a server action: an
 * action is a public POST endpoint, and this one would hand the library to anyone with an id. Only
 * the video route imports it, after its own auth check.
 *
 * The card's fields go through the hub's own mapping (`toCorpusVideo`, then `toCardVideo`), so the
 * page and the card cannot disagree about the multiple, its clamp, or "proven".
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { toCorpusVideo, type TeardownRow } from "@/lib/discover/corpus-reads";
import { getCorpusClient } from "@/lib/grounding/corpus";
import { parseTeardownTemplate } from "@/lib/grounding/types";

import { toCardVideo } from "./hub-data";
import { isLibraryVideoRef } from "./saved-ref";
import type { BeatInput, LibraryVideo } from "./video";

/** The card's columns (as the hub's read), plus the two detail fields the page draws. */
const SELECT =
  "id, video_url, cover_url, creator_handle, spoken_hook, hook_template, hook_archetype, niche, views, platform, engagement_rate, posted_at, outlier_multiplier, baseline_label, why_it_works, template";

interface LibraryVideoRow extends TeardownRow {
  why_it_works: string | null;
  /** Raw JSONB: parsed against its schema, never cast. */
  template: unknown;
}

/** The stored beats, without their descriptions (the page does not show them). A template that
 *  fails its schema gives none; `parseTeardownTemplate` says so loudly. */
function beatsOf(template: unknown): BeatInput[] {
  const beats = parseTeardownTemplate(template)?.beats ?? [];
  return beats.map((b) => ({ name: b.name, startSec: b.startSec ?? null, endSec: b.endSec ?? null }));
}

/**
 * The library video `id`, or null when `id` is not a library video's id (no query is made) or the
 * library no longer holds it. A read error throws: the page says it couldn't load, as the hub does.
 * `client` defaults to the corpus client, made only once the id is known to be one.
 */
export async function getLibraryVideo(id: string, client?: SupabaseClient): Promise<LibraryVideo | null> {
  if (!isLibraryVideoRef(id)) return null;

  const { data, error } = await (client ?? getCorpusClient())
    .from("outlier_teardowns")
    .select(SELECT)
    .eq("id", id)
    .eq("status", "extracted")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as LibraryVideoRow;
  return {
    ...toCardVideo(toCorpusVideo(row)),
    videoUrl: row.video_url,
    whyItWorks: row.why_it_works?.trim() || null,
    beats: beatsOf(row.template),
  };
}
