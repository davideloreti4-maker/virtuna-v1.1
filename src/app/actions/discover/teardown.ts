"use server";

/**
 * getTeardownDetail — the one teardown row behind an open Discover detail dialog.
 *
 * Why a per-id read instead of more columns on the hub's corpus read: `why_it_works` is a
 * p50 of 578 characters across all 524 extracted rows (min 234, max 760), so there is no
 * excerpt that is both cheap and whole — the 220-char one this replaces broke mid-sentence
 * on ~95% of rows, and it was never rendered anywhere. Shipping the full essay to every
 * visitor measured 173KB gzip of page payload against 75KB without it, for text that only
 * one open dialog ever reads. So the corpus read dropped the field and this fetches it,
 * plus the three taxonomy columns (`format`, `visual_hook`, `editing_style`) that the hub
 * never selected at all — every one of them populated on all 524 rows.
 *
 * ⚠️ Reads through `getCorpusClient()` (the grounding SERVICE client), not the caller's.
 * `outlier_teardowns` has RLS enabled with NO policies, so a browser session reads zero
 * rows — the corpus is global curated content, not user data. The auth check below is what
 * keeps it behind the app: a server action is a public POST endpoint, and this one would
 * otherwise hand the whole teardown library to anyone who could guess a uuid.
 */

import { getCorpusClient } from "@/lib/grounding/corpus";
import { createClient } from "@/lib/supabase/server";

export interface TeardownDetail {
  /** The full teardown analysis — never truncated here; the dialog scrolls. */
  whyItWorks: string | null;
  /** Taxonomy slugs (`a-vs-b-comparison`, `greenscreen`, …) — humanized at the renderer. */
  format: string | null;
  visualHook: string | null;
  editingStyle: string | null;
}

/** `id` arrives from the client. PostgREST parameterizes it, but a malformed value returns
 *  a 400 that reads to the caller as "the corpus is broken" — so reject it as a bad id. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getTeardownDetail(
  id: string,
): Promise<{ detail?: TeardownDetail; error?: string }> {
  if (!UUID.test(id)) return { error: "Not a teardown we hold." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await getCorpusClient()
    .from("outlier_teardowns")
    .select("why_it_works, format, visual_hook, editing_style")
    .eq("id", id)
    .eq("status", "extracted")
    .maybeSingle();

  if (error) {
    console.error("[getTeardownDetail] read failed", id, error);
    return { error: "Couldn't load the teardown just now." };
  }
  if (!data) return { error: "That teardown is no longer in the library." };

  const row = data as {
    why_it_works: string | null;
    format: string | null;
    visual_hook: string | null;
    editing_style: string | null;
  };

  return {
    detail: {
      whyItWorks: row.why_it_works,
      format: row.format,
      visualHook: row.visual_hook,
      editingStyle: row.editing_style,
    },
  };
}
