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
 * placeholder entries for hooks→script, script→test, remix→hooks are pre-registered
 * so P6 fills endpoint + wires the renderer, not this file's structure.
 *
 * Pure data + types module — NO React, NO fetch. Tree-shakeable on the client.
 */

// ─── Skill ID union ───────────────────────────────────────────────────────────

/**
 * Canonical set of skill identifiers.
 * P6 extends this union — add "script" | "remix" when implementing Phase 6.
 */
export type SkillId =
  | "idea"
  | "hooks"
  | "script"   // Phase 6 — not yet implemented
  | "remix"    // Phase 6 — not yet implemented
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

  // ── P6 PLACEHOLDER: Hooks → Script ───────────────────────────────────────────
  // P6 sets endpoint to the script route once the Script runner is implemented.
  // anchorFrom "card" — hookLine is the anchor the script develops.
  {
    from: "hooks",
    to: "script",
    ctaLabel: "Write script →",
    endpoint: null,           // P6: set to "/api/tools/script" when implemented
    anchorFrom: "card",
  },

  // ── P6 PLACEHOLDER: Script → Test ────────────────────────────────────────────
  // After a script is generated, "Test full →" carries it into the Test reading.
  // anchorFrom "context" mirrors the hooks→test pattern.
  {
    from: "script",
    to: "test",
    ctaLabel: "Test full →",
    endpoint: null,           // P6: context handoff (same HookTestContext pattern)
    anchorFrom: "context",
  },

  // ── P6 PLACEHOLDER: Remix → Hooks ────────────────────────────────────────────
  // Remix is an alternate funnel-top entry; its output feeds the Hooks chain.
  // Remix decodes a trending/competitor video → generates ideas/hooks from it.
  // Prior art: src/app/api/remix/adapt/route.ts + milestone/viral-remix worktree.
  {
    from: "remix",
    to: "hooks",
    ctaLabel: "Develop into hooks →",
    endpoint: null,           // P6: set to "/api/tools/remix/adapt" when implemented
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
