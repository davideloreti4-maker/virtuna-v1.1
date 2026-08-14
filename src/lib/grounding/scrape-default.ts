/**
 * scrape-default.ts — let an environment authorize the live Apify scrape that a request did not.
 *
 * ─── WHAT THIS REVERSES, AND WHY IT IS A FLAG RATHER THAN A NEW DEFAULT ──────────────────────
 *
 * `gather-for-run.ts` states the shipped rule: *"The SCRAPE IS EXPLICIT-ONLY (`allowScrape`,
 * default false — owner call 2026-07-17). Spending the owner's money is a decision the user makes,
 * not a consequence of the corpus being thin on their subject."*
 *
 * That ruling stands for production. What it does not serve is the owner testing the live path on
 * their own machine: every run silently degrades to the cached corpus, so the Apify → Qwen decode
 * that Phase 1 built (`decode/live-decode.ts`, merged #468) is never exercised end to end unless
 * you tap "Find new outliers" on every single send.
 *
 * So this is an ENV flag, default OFF, not a changed default:
 *
 *   - The request-level contract is untouched. `allowScrape: true` in the body still means what it
 *     always meant, and nothing about the "Find new outliers" affordance changes.
 *   - A future deploy carries the owner's 2026-07-17 rule intact. Had this shipped as a flipped
 *     default, the first deploy would make EVERY send of ideas/hooks/script scrape live, for every
 *     user, against a $5/month cap — a spend landmine armed by an unrelated merge.
 *   - Turning it off is deleting one line from `.env.local`, not a revert.
 *
 * ⚠️ **This spends real money on EVERY eligible run.** A run is eligible when grounding is on and
 * the platform is scrapable. The cache no longer spares you: as of the live-first ordering (owner
 * call 2026-08-15) an authorized run reaches Apify BEFORE the read-back, so a full cache hit does
 * not skip the scrape. That is the entire point — this flag was previously unreachable on ~95% of
 * asks, because the corpus answered first — but it means turning it on locally costs roughly one
 * Apify run per send against a $5/month cap. Budget accordingly.
 *
 * ⚠️ Apify is on a $5/month hard cap on a rotating FREE account. At the cap Apify 403s and the app
 * has historically surfaced that as *"check your handle is public"* — a budget failure wearing a
 * broken-video costume. If scrapes start failing, check the ACCOUNT before debugging the handle.
 *
 * Server-only. Read per request rather than captured at module load, so flipping it in `.env.local`
 * takes effect on the next request without restarting a long-running dev server.
 */

/**
 * May a run reach for Apify when the request body did not explicitly authorize it?
 *
 * DEFAULT OFF — opt in with `LIVE_SCRAPE_DEFAULT="true"`. The strict `=== "true"` is deliberate and
 * is the opposite of the house `!== "false"` switch used by shipped-ON flags: a half-set or
 * mistyped value must fall back to NOT spending. For a money flag, ambiguity resolves to free.
 */
export function isScrapeDefaultEnabled(): boolean {
  return process.env.LIVE_SCRAPE_DEFAULT === "true";
}

/**
 * The value the route should hand to `gatherForRun`.
 *
 * @param bodyAllowScrape the raw `allowScrape` field off the request body, unvalidated.
 * @returns true when the request asked for a scrape, OR when the environment authorizes one.
 *
 * The body check stays `=== true` so a truthy-but-wrong value (`"false"`, `1`, `{}`) cannot
 * authorize spend, exactly as before.
 */
export function resolveAllowScrape(bodyAllowScrape: unknown): boolean {
  return bodyAllowScrape === true || isScrapeDefaultEnabled();
}
