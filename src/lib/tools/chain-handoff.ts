/**
 * chain-handoff.ts — Generic skill→skill CTA registry (Plan 05-04, Task 1).
 *
 * SINGLE SSOT: every skill's available downstream CTAs are declared here.
 * Card components, thread views, and the composer read this registry — they do NOT
 * hard-code their own chain shape.
 *
 * ## How to extend (Phase 6: Script + Remix)
 *
 * P6 plugs in by APPENDING entries to CHAIN_HANDOFFS. No card-component edits needed.
 *
 * Steps for P6:
 *  1. Add the new skill id(s) to `SkillId` below.
 *  2. Append `ChainHandoff` entries for the new skill's downstream CTAs.
 *  3. Implement the runner + card renderer that the CTA launches.
 *  4. If the handoff uses a new server endpoint, set `endpoint` to the route path.
 *     If it hands off via a React context (like hooks→test), set `endpoint: null`
 *     and wire the context in the thread view (same pattern as HookTestContext).
 *
 * No other files require changes for a new skill to appear in the chain.
 *
 * ## Anchor-carry shape
 *
 * `anchorFrom` declares where the handoff's anchor value is sourced:
 *  - "card"    — the CTA card's own props are the anchor (e.g., idea→hooks carries
 *                title+angle as the anchor to /api/tools/ideas/develop).
 *  - "context" — the anchor flows via a React context (e.g., hooks→test carries the
 *                hookLine+audienceArchetype via HookTestContext; no server call
 *                on the card click itself — the composer initiates the test).
 *
 * ## Security note
 *
 * The `endpoint` strings are NOT executed here — they are metadata. The actual fetch
 * lives in the card component. anchor length is capped server-side on each endpoint
 * (WARNING-5, consistent with P3/P4 caps).
 *
 * ## D-09 compliance
 *
 * Spine: [Remix or Idea] → Hooks → Script → Test.
 * LIVE entries for hooks→script ("/api/tools/script"), script→test (null/context),
 * and remix→hooks ("/api/tools/ideas/develop") — all wired in 06-05.
 *
 * Pure data + types module — NO React, NO fetch. Tree-shakeable on the client.
 */

// ─── Skill ID union ───────────────────────────────────────────────────────────

/**
 * Canonical set of skill identifiers.
 * P6 extends this union — add "script" | "remix" when implementing Phase 6.
 */
export type SkillId =
  | "discover" // Phase 8 — live (08-03): the Discover front door, tile CTA launches discover→remix
  | "idea"
  | "hooks"
  | "script"   // Phase 6 — live (06-05)
  | "remix"    // Phase 6 — live (06-05)
  | "test";

// ─── ChainHandoff interface ───────────────────────────────────────────────────

/**
 * Describes one downstream CTA a skill can offer.
 *
 * @field from        The skill that owns the CTA button.
 * @field to          The downstream skill the CTA launches.
 * @field ctaLabel    Human-readable CTA label shown on the card (e.g. "Develop this →").
 * @field endpoint    Server route the CTA posts to, or null for context-handoff CTAs.
 *                    null = the handoff is mediated by a React context (e.g. HookTestContext)
 *                    rather than a direct card-level fetch.
 * @field anchorFrom  Where the anchor value originates — "card" (card props) or "context"
 *                    (React context / lifted state in the parent view).
 */
export interface ChainHandoff {
  from: SkillId;
  to: SkillId;
  ctaLabel: string;
  endpoint: string | null;
  anchorFrom: "card" | "context";
}

// ─── CHAIN_HANDOFFS registry ──────────────────────────────────────────────────

/**
 * The complete chain-handoff registry.
 *
 * Existing chains (P3/P4) expressed declaratively — the card components already
 * implement these; this registry is the SSOT that documents their shape.
 *
 * Placeholder entries (endpoint: null, not yet implemented) give P6 a zero-plumbing
 * seam: P6 sets the endpoint + wires the renderer; the CTA label + chain shape are
 * already declared here.
 */
export const CHAIN_HANDOFFS: ChainHandoff[] = [
  // ── P3: Idea → Hooks ─────────────────────────────────────────────────────────
  // "Develop this →" on IdeaCardRenderer POSTs title+angle to /develop.
  // anchorFrom "card" — IdeaCardRenderer builds anchor = `${title}\n\n${angle}`.
  // Endpoint PINNED CONTRACT (03-03-SUMMARY.md + 04-02-SUMMARY.md):
  //   POST /api/tools/ideas/develop
  //   Payload: { ideaId?, anchor: string, platform: string }
  //   Response: { threadId, messageId, fencedHooksBundle, ideaId }
  {
    from: "idea",
    to: "hooks",
    ctaLabel: "Develop this →",
    endpoint: "/api/tools/ideas/develop",
    anchorFrom: "card",
  },

  // ── P4: Hooks → Test ─────────────────────────────────────────────────────────
  // "Test full →" on HookCardRenderer fires via HookTestContext (no card-level fetch).
  // The composer + HooksThreadView lift handleTestHook and provide it via context.
  // anchorFrom "context" — hook hookLine + audienceArchetype flow via HookTestContext.
  {
    from: "hooks",
    to: "test",
    ctaLabel: "Test full →",
    endpoint: null,           // context handoff — HookTestContext mediates
    anchorFrom: "context",
  },

  // ── P6 LIVE: Hooks → Script ──────────────────────────────────────────────────
  // "Write script →" on HookCardRenderer POSTs hookLine as anchor to /api/tools/script.
  // anchorFrom "card" — hookLine is the anchor; the route accepts { anchor, ... }.
  // Card-POST model: HookCardRenderer builds the fetch directly (mirrors idea→hooks).
  // PINNED: /api/tools/script accepts { ask?, anchor, platform } (06-03-SUMMARY.md).
  {
    from: "hooks",
    to: "script",
    ctaLabel: "Write script →",
    endpoint: "/api/tools/script",   // P6 LIVE — set 2026-06-18 (06-05)
    anchorFrom: "card",
  },

  // ── P6 LIVE: Script → Test ────────────────────────────────────────────────────
  // After a script is generated, "Test full →" carries the script opener into Test.
  // anchorFrom "context" mirrors the hooks→test pattern (HookTestContext).
  // ScriptTestContext mediates the handoff — no card-level fetch on click.
  {
    from: "script",
    to: "test",
    ctaLabel: "Test full →",
    endpoint: null,           // context handoff — ScriptTestContext mediates (same as hooks→test)
    anchorFrom: "context",
  },

  // ── P6 LIVE: Remix → Hooks ───────────────────────────────────────────────────
  // "Develop into hooks →" on RemixCardRenderer POSTs the adapted hook to /develop.
  // anchorFrom "card" — the adaptedHook IS the anchor (ideaId omitted, anchor present).
  // REUSE PATH CONFIRMED: /api/tools/ideas/develop payload { ideaId?, anchor, platform }
  // accepts ideaId absent + anchor present — matches exactly (03-03-SUMMARY.md PINNED).
  // Payload contract asserted in chain-handoff.test.ts (payload-contract test).
  {
    from: "remix",
    to: "hooks",
    ctaLabel: "Develop into hooks →",
    endpoint: "/api/tools/ideas/develop",  // P6 LIVE — reuse path confirmed 2026-06-18 (06-05)
    anchorFrom: "card",
  },

  // ── P8 LIVE: Discover → Remix ────────────────────────────────────────────────
  // "Remix → Read" on the Discover OutlierTile POSTs the outlier's videoUrl to the
  // remix rehost route, which decode→adapts it and drops the result into the thread
  // chain (Remix → Hooks → Script → Test). This is the funnel-top moat coupling:
  // Discover is browsable, but the ACTION launches the chain (no save/watchlist — P10).
  // anchorFrom "card" — the tile's own videoUrl IS the anchor.
  // PINNED: /api/tools/remix/run accepts { url: string, platform: string }
  //   (08-03; tools/remix/run/route.ts schema = { url: z.string().min(1).max(2000), platform }).
  {
    from: "discover",
    to: "remix",
    ctaLabel: "Remix → Read",
    endpoint: "/api/tools/remix/run",   // P8 LIVE — set 2026-06-19 (08-03)
    anchorFrom: "card",
  },
];

// ─── handoffsFor ─────────────────────────────────────────────────────────────

/**
 * Return all downstream handoffs available for a given skill.
 *
 * Used by card components to enumerate their available CTAs, and by the composer
 * to know which chain steps to suggest.
 *
 * @param skill  The origin skill id.
 * @returns      All ChainHandoff entries where `from === skill`.
 */
export function handoffsFor(skill: SkillId): ChainHandoff[] {
  return CHAIN_HANDOFFS.filter((h) => h.from === skill);
}
