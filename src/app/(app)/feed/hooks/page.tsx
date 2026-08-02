import { redirect } from "next/navigation";

/**
 * /feed/hooks — RETIRED 2026-08-02, redirects to the Collections tab.
 *
 * The Hooks tab was a vault of 12 hooks hardcoded in `lib/hooks/default-hooks.ts`, whose
 * multipliers and view counts were — per that file's own comment — "static illustration",
 * rendered in the same green multiplier pill as the measured numbers two tabs over, sorted
 * by "Biggest outlier", with a working CSV export. It promised a corpus and shipped a
 * placeholder.
 *
 * Collections is what it should have been: the same idea (reusable hook patterns, grouped)
 * over the 105 curated collections of the real teardown corpus, where every row is a video
 * we tore down and every number is measured against that creator's own baseline. The
 * redirect keeps old links and bookmarks alive.
 */
export default function HooksRedirect() {
  redirect("/feed?tab=collections");
}
