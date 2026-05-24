# Phase 4: Wave 0 — Content Type + Niche Detection - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 4-Wave 0 — Content Type + Niche Detection
**Areas discussed:** Model choice, Wave 0 input source, Niche fallback behavior, Content-type signal weights, Content type edge cases

---

## Area Selection

User selected ALL 4 proposed gray areas + raised model choice as a 5th area to verify upfront:

> "Wave 0 input source, Niche fallback behavior, Content-type signal weights, Content type edge cases, i dont have much technical knowleadge, but verify model choice should be gemini 3 vision and deepseek v4 flash. if not lets discuss this too"

User's instinct on Gemini 3 + DeepSeek V4 Flash proved load-bearing. Research confirmed DeepSeek V3 (`deepseek-reasoner`) deprecates 2026-07-24 — V4 migration is forced regardless of Phase 4 scope.

---

## Model Choice — First Pass

| Option | Description | Selected |
|--------|-------------|----------|
| V4 Flash for both (text-only) | Both classifiers text-only, ~$0.002 total | |
| Hybrid: V4 Flash niche + Gemini 3 single frame for content type | Niche text + content type from 1 frame | |
| Gemini 3 Pro Vision for content type + V4 Flash for niche | Full-video Pro analysis | |
| Keep V3 + decide V4 migration separately | Defer model upgrade | |

**User's response:** Did not pick — asked instead: "should we go for gemini 3.1 for video analysis and rest on v4 flash? gemini pro or flash? lets compare quality, cost etc on a 30s video"

Triggered cost/quality research showing Flash is sufficient for 6-way perceptual classification; Pro's reasoning unused for this task.

---

## Model Choice — Second Pass (after research)

| Option | Description | Selected |
|--------|-------------|----------|
| Gemini 3 Flash on first 2s + V4 Flash text niche (Recommended) | Visual sample + text niche, ~$0.0004 | ✓ |
| Gemini 3 Flash on full 30s + V4 Flash text niche | Full video, ~$0.005 | |
| Fold content type INTO Phase 5 hook call + V4 Flash niche now | Zero added cost; breaks Wave 0 architecture | |
| Gemini 3.1 Pro on first 2s + V4 Flash text niche | Pro overkill for 6-way classification | |

**User's choice:** Gemini 3 Flash on first 2s + V4 Flash text niche (Recommended).

**Notes:** Later expanded the Gemini window from 2s → 5s during the niche disagreement question to boost confidence. Final: Gemini 3 Flash on first 5s + V4 Flash text niche.

---

## Niche Fallback — Low Confidence + No Card 1

| Option | Description | Selected |
|--------|-------------|----------|
| Return AI's best guess + warning (Recommended) | Use low-confidence AI value + warning | ✓ |
| Return null + warning | No niche; downstream uses defaults | |
| Trigger Card 1 prompt in UI on the result page | Mixes engine + UI scope | |
| Use a 'general' / 'mixed' niche bucket | Fallback bucket with no real signal | |

**User's choice:** Return AI's best guess + warning (Recommended).

---

## Niche Fallback — AI vs Card 1 Disagreement

| Option | Description | Selected |
|--------|-------------|----------|
| AI wins, emit warning (Recommended) | Trust per-video AI signal over static profile | ✓ (with modification) |
| Card 1 wins (trust the human) | Conservative, profile-grounded | |
| Return both, let aggregator decide | Most flexible, most complex | |
| AI wins only if confidence very high (>0.85) | Stricter threshold | |

**User's response:** "ai wins but extend gemini analysis from 2s to 5s for more confidence?"

**Resulting decision:** AI wins disagreements (per recommended option) AND Gemini content-type window extended from 2s → 5s (carried back to update D-01 model decision). Niche detector evidence base also expanded to include Card 5 reference creators + Card 6 past wins (~free at text-input scale).

---

## Micro Niche — Low AI Confidence

| Option | Description | Selected |
|--------|-------------|----------|
| Return null + use only primary + sub (Recommended) | Graceful, downstream filters on primary+sub only | ✓ |
| Always return AI's best guess for micro_niche | Forces a value even at low confidence | |
| Generate top-3 candidate micros + downstream picks | Flexible array return | |

**User's choice:** Return null + use only primary + sub (Recommended).

---

## Content-Type Weight Scope (Phase 4 vs Phase 10)

| Option | Description | Selected |
|--------|-------------|----------|
| Ship full content-type × signal weight matrix in Phase 4 (Recommended) | Lock full 7×4 matrix now | ✓ |
| Ship MINIMAL adjustments in Phase 4 (just the 2 spec examples) + defer rest | Slideshow + action only | |
| Defer all weighting to Phase 10 — Phase 4 only ships signals | Re-scope SC#5 | |

**User's choice:** Ship full content-type × signal weight matrix in Phase 4 (Recommended).

---

## Weight Matrix Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Lock my proposed matrix (Recommended) | 7×4 matrix with 0.5/1.5 caps + rationale | ✓ |
| Research-grounded matrix (corpus-driven) | Researcher derives from Phase 1 corpus | |
| Minimal matrix — just spec examples | Only slideshow + action adjustments | |

**User's choice:** Lock my proposed matrix (Recommended). Preview viewed and accepted as-is.

---

## Content Type Edge Types (Beyond Locked 6)

| Option | Description | Selected |
|--------|-------------|----------|
| Add 'other' as 7th type, weight passthrough (1.0×) (Recommended) | Catch-all bucket with neutral weights | ✓ |
| Force into nearest match (no 'other') | Always one of 6, may miscategorize | |
| Expand vocabulary to 9: add dance + ASMR + music | More accurate, more upfront work | |

**User's choice:** Add 'other' as 7th type, weight passthrough (1.0×) (Recommended).

---

## Mixed Content Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Pick dominant + emit 'mixed' warning (Recommended) | Single label + warning for downstream | ✓ |
| Multi-label: return primary + secondary | Most accurate, every consumer must handle | |
| Force single label, no warning | Simplest, loses information | |

**User's choice:** Pick dominant + emit 'mixed' warning (Recommended).

---

## Claude's Discretion

Areas where the user is non-technical and deferred to Claude / researcher / planner:

- Persona-archetype mapping content per niche (Phase 7 will consume — researcher proposes during planning)
- Benchmark-filter mapping content per niche (Phase 8 will consume — researcher proposes during planning)
- File organization (single `taxonomy.ts` extension vs split into `niche-mappings.ts`)
- Detector implementation file layout (separate detector files vs inline in wave0.ts)
- Confidence-threshold knob mechanism (env-overridable vs hardcoded)
- Gemini structured-output Zod schema exact shape
- DeepSeek niche detector prompt template (researcher locks)
- Aggregator weight-application location (inline in `aggregateScores` vs helper)
- Migration scope (likely no schema change needed — Wave 0 outputs flow through existing JSON columns)
- Test surface scope (specific Vitest coverage, mocks for both LLM clients)
- V4 Flash cache-header verification on V4 endpoint
- Niche slug normalization + Zod enum validation against NICHE_TREE
- DeepSeek V4 pricing constant updates if V4 differs from current V3 cache pricing

## Deferred Ideas

- Gemini 2.5 Pro/Flash → Gemini 3 upgrade for Wave 1 (Phase 5 scope, milestone-level question)
- Promoting frequent `other` content types to first-class (corpus-data driven, future phase)
- Phase 10 weight-matrix revision based on corpus evidence
- Per-content-type sub-classifier specialization (post-M1)
- Wave 0 cross-user content-hash cache (defer until hit-rate justifies complexity)
- DeepSeek V4 Pro evaluation if V4 Flash misclassifies on edges (defer until eval data)
- Aggregator soft-handling of `mixed_content_detected` warning (Phase 10 consideration)
- Niche taxonomy expansion 10 → 15-20 primaries (corpus-evidence-driven)
- `micro_niche` user-input field re-introduction (if AI proves unreliable)
