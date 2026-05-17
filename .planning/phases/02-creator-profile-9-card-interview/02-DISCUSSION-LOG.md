# Phase 2: Creator Profile & 9-Card Interview - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 02-creator-profile-9-card-interview
**Areas discussed:** Onboarding alignment, Reference creators (Card 5), Niche taxonomy (Card 1), Settings page integration, Re-prompt cadence (PROFILE-16)

---

## Initial Gray-Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Schema strategy | Extend existing creator_profiles vs. new normalized side tables | (user routed to Claude's discretion) |
| Onboarding integration | How 9-card coexists with existing /welcome 3-step flow | ✓ |
| Niche taxonomy | Hierarchical depth + storage shape | ✓ |
| Reference creators (Card 5) | Storage / scrape-queue handling | ✓ |

**User's choice (free text):** "i dont have much technical knowleadge ask me all questions you need to know, the cards shouldnt be with onboarding but at the video upload, mandatory but skipably and with clear info that this is really important for prediction accurac"

**Notes:** User self-identified as non-technical and asked me to lead. Also pre-committed to: (1) 9-card lives at video upload, not in onboarding; (2) mandatory-but-skippable semantics; (3) truthfulness messaging is important for prediction accuracy. This collapsed multiple decisions into one product directive — UI-SPEC was already consistent. Schema strategy moved to Claude's discretion based on the non-technical framing. Added "Settings page integration" and "Re-prompt cadence" as additional user-vision areas worth their input.

---

## Onboarding alignment

### Q1: Welcome flow disposition

| Option | Description | Selected |
|--------|-------------|----------|
| Trim welcome to just TikTok handle | Welcome stays minimal — just asks for TikTok handle. Goal/platforms come from the deeper 9-card. No duplicate questions. | ✓ |
| Remove welcome entirely | Skip welcome at signup completely. Lowest friction but loses any pre-upload context (e.g., personalized empty state). | |
| Keep welcome as-is | Existing welcome runs as it does today (handle + goal + preview). Simplest to ship but feels redundant. | |

**User's choice:** Trim welcome to just TikTok handle (Recommended).

**Notes:** User picked the most-aggressive-de-duplication option. Carries through to D-03 (remove goal-step.tsx, primary_goal becomes Card 3 output).

---

## Reference creators (Card 5)

### Q1: What happens to the 3 references entered in Card 5

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-add to Competitors tool + use for predictions | The 3 references become tracked competitors automatically. AI uses them to shape persona allocation + suggestion framing. User sees them in /competitors with a 'from your profile' badge. Highest value, most surprising. | ✓ |
| Use for predictions only, don't track | AI uses them in prompts but never appear in Competitors tool. Cleaner, but loses ongoing data refresh on creators they care most about. | |
| Just store text, ask later if they want to track | Store the strings only. Post-save toast asks 'Add these to your competitors?' Most transparent, adds a step. | |

**User's choice:** Auto-add to Competitors tool + use for predictions (Recommended).

**Notes:** User picked the deepest integration option. D-06 + D-07 capture the dual side-effect; D-08 adds the `source: "profile_reference"` schema field for future UI badging.

---

## Niche taxonomy

### Q1: Niche picker depth

| Option | Description | Selected |
|--------|-------------|----------|
| 2 levels: primary + sub | User picks primary then sub-niche (~8-12 per primary). Phase 4 AI infers micro-niche. Matches UI-SPEC's optional level-3 + simplest to ship. | ✓ |
| 3 levels (matches UI-SPEC exactly) | Full primary → sub → micro hierarchy. Most precise input but more taxonomy work upfront, and most creators won't know their micro-niche. | |
| 1 level only: primary niche | Just the 5 corpus niches. AI infers everything below. Fastest input, but loses sub-niche fidelity Phase 7 + Phase 8 would benefit from. | |

**User's choice:** 2 levels: primary + sub (Recommended).

**Notes:** User effectively dropped Card 1's optional level-3 from the UI; Phase 4 niche detector inherits responsibility for micro_niche. D-09 captures this as a UI-SPEC adjustment.

### Q2: Taxonomy storage

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded TypeScript module | `src/lib/niches/taxonomy.ts` exports a typed tree. Versioned in git, type-safe, easy to import in both Card 1 and Phase 4. | ✓ |
| Supabase table (`niche_taxonomy`) | Database-driven, editable without deploy. Adds a query per render + Phase 4 call, and another migration. | |
| JSON config file | Plain JSON in repo. Less type-safe than TS module but easier for a non-engineer to edit. | |

**User's choice:** Hardcoded TypeScript module (Recommended).

**Notes:** Locked in D-10. Cross-phase reuse with Phase 4 was a key driver.

---

## Settings page integration

### Q1: Where the 9-card edit form lives in /settings

| Option | Description | Selected |
|--------|-------------|----------|
| New 'Creator Profile' tab, separate from 'Profile' | Adds a 6th tab. 'Profile' stays for identity. 'Creator Profile' holds the 9 cards. Each tab stays scannable. Matches UI-SPEC. | ✓ |
| Expand existing 'Profile' tab with all 9 sections | One tab becomes long-scroll: identity at top, 9 cards below. Simpler routing, harder to scan. | |
| Both: keep 'Profile' simple + add 9-card link | Profile tab shows basic fields + a link to a separate `/settings/creator-profile` route. Extra navigation but cleanest separation. | |

**User's choice:** New 'Creator Profile' tab, separate from 'Profile' (Recommended).

**Notes:** Locked in D-12 / D-13. Existing 5 tabs + this becomes 6 in `SettingsPage`.

---

## Re-prompt cadence (PROFILE-16)

### Q1: When and how to build the every-10-analyses re-prompt

| Option | Description | Selected |
|--------|-------------|----------|
| Defer ALL re-prompt work to Phase 11 | Don't build counter + trigger + UI now. UI-SPEC defers the UI surface; this also defers the mechanism. Phase 11 ships end-to-end. | ✓ |
| Build counter + trigger now, defer only UI | Add an analysis_count column + trigger logic in Phase 2. Phase 11 wires the UI. Risk: counter sits unused. | |
| Build it all in Phase 2 including UI | Full mechanism + inline card + toast. Defies UI-SPEC's deferral. Adds scope to an already-large phase. | |

**User's choice:** Defer ALL re-prompt work to Phase 11 (Recommended).

**Notes:** Locked in D-14. Clean phase boundary.

---

## Convergence check

### Q1: Ready for context or explore more?

| Option | Description | Selected |
|--------|-------------|----------|
| Ready for context | Write CONTEXT.md and prepare to plan. Remaining technical details handled as Claude's discretion. | ✓ |
| Explore more gray areas | Surface 2-3 additional decisions for input. | |

**User's choice:** Ready for context.

**Notes:** Closing the discussion loop. CONTEXT.md captures the 5 areas + the Claude's-discretion list for the researcher and planner to lock without further user input.

---

## Claude's Discretion

User explicitly delegated technical decisions. Captured in CONTEXT.md `<decisions>` §"Claude's Discretion":

- Reference creator handle parsing & normalization (regex + util location)
- Competitor auto-add transactional shape (single tx vs sequential w/ idempotency)
- Engine handling of missing card data (each consumer's null defaults)
- `goal-step.tsx` + `preview-step.tsx` removal details + onboarding-store state machine cleanup
- `creator_profiles` migration file structure (single vs split per-card)
- Pain points (Card 8) engine usage shape (verbatim vs LLM-classified) — Phase 9 decision
- Niche taxonomy primary list extension (researcher proposes, planner locks)
- Settings save UX optimistic-vs-wait pattern
- Test surface (Vitest + Playwright coverage targets)

## Deferred Ideas

(See CONTEXT.md `<deferred>` for the full list.)

- PROFILE-16 re-prompt micro-card — entire mechanism deferred to Phase 11.
- Card 1 level-3 micro-niche UI picker — dropped; Phase 4 AI inference handles it.
- `/competitors` UI badge for `source: "profile_reference"` — basic badge in M2 Intelligence Surface milestone.
- Pain points LLM extraction — Phase 9 consideration.
- Onboarding state machine collapse refactor — planner's call.
- `creator_profiles.niches[]` legacy column drop — planner's call (keep for backwards-compat or drop).
