# Phase 7: Audience Manager — calibrated audience as shared substrate across all skills (the moat) - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Connect the dangling wiring: today the engine simulates against 10 hardcoded universal archetypes, blind to the creator's actual audience. Make a calibrated **Audience** the shared substrate skills query through a 3-position loop (steer → react → refine).

**Locked object (from ROADMAP + memory `audience-manager-phase7.md`):**
`Audience = { name, type (personal|target), platform, goal (free-set), 10 calibrated personas, calibration data }`. Personal = scrape-anchored (TikTok+IG presets, Apify, no OAuth v1); Target = described (custom = all other platforms). Creator profile slimmed to **name only** — niche/voice/content-history become per-audience calibration inputs.

**P7 ships (this phase):**
- Audience object + Manager CRUD UI (sidebar) + 3 presets + composer chip (`platform · name`).
- Calibration pipeline (scrape/description → structured Audience Profile → per-audience persona repaint + weight override).
- General audience (current universal 10) as default across all tools + **regression gate** (must reproduce today's scores).
- Audience wired into the **react** position (SIM/Flash path) + **one steer proof** (ideas-runner).
- Goal → structured scoring reweight via fixed goal-intent taxonomy.

**Out of scope (this phase → post-P7 refinement run or post-v1):**
- Persona **values** tuning (prompt wording, signal→score weight fitting via fold A/B) — P7 locks **structure**, not values.
- Steer position-① wired into the *remaining* skills (hook/script/test/remix/chat) — only ideas-runner steers in P7.
- Persona **editing** by the creator (read-only in v1 until values tuned).
- Multi-select audience compare (killer feature — object built `audience_id`→`audience_ids[]`-ready), real social OAuth, spread/virality prediction in the Read — **post-v1**.

</domain>

<decisions>
## Implementation Decisions

### Area 1 — P7 cut line (scope within the fixed boundary)
- **D-01 (Substrate + react-wiring + 1 steer proof):** P7 builds the Audience object, Manager CRUD UI, calibration pipeline, general-audience default + regression gate, and wires audience into the **SIM/react** path (Flash already emits per-archetype personas — minimal new surface). Position-① **steer** is proven in **ONE skill only — `ideas-runner`** (it already takes `profileRow` + calls `buildGroundingLine`; swap to audience-grounding there, making GROUND-03 literally true for ideas). Steer-everywhere + value tuning = the post-P7 refinement run. **Rationale:** gate-able slice; values are deferred anyway so steer-everywhere yields little extra now; avoids touching all 5 runners + the separate chat-runner in one phase.

### Area 2 — Persona model reconciliation (regression-gate-critical)
- **D-02 (Layer over existing 10 — reweight + repaint, do NOT rebuild):** Keep the 10 archetype IDs (`high_engager/saver/lurker/sharer/tough_crowd/purposeful_viewer/niche_deep_buyer/niche_deep_scout/loyalist/cross_niche_curiosity`) and their **byte-stable** system prompts in `wave3/persona-registry.ts` untouched (preserves cache discipline + general-audience score-identity → **regression gate survives by construction**). Calibration produces a **`PersonaWeights` override** (the `creator_overrides`/`analysis_override` precedence in `persona-weights.ts` is literally built for this) plus a **per-audience persona description repaint**. The design's **Temperature (cold/warm/hot) × Disposition (scanner/skeptic/collector/connector/converter/lurker)** is a **presentation/label lens mapped onto the existing 10**, NOT a new engine vocabulary. (Temperature already maps to the existing slot-types `fyp/niche_deep/loyalist/cross_niche`.)

### Area 3 — Calibration UX & persona visibility
- **D-03 (Visible read-only profile + persona list):** After calibration, show the **Audience Profile** (platform, goal, temperature mix, top dispositions) AND the **10 calibrated personas read-only** (name, temperature, disposition, share %). **No editing in v1** — persona values aren't tuned until the post-P7 refinement run, so editing would let creators "fix" untuned noise. **Rationale:** makes "your audience" feel real (the hero-object moat pitch) + builds trust, without the UI/state surface + risk of premature editing. Editing arrives post-tuning.

### Area 4 — Presets + active-audience selection
- **D-04 (General + 2 goal-leaning templates, per-thread active):** Sidebar presets = **General** (locked default 10) + **2 ready-made templates** (a growth/cold-share-leaning audience + a conversion/converter-leaning audience). Active audience is chosen at the **composer chip** and **pinned per-thread** (the studio's native unit — chain handoffs already carry context per-thread). New threads pick fresh; switching mid-thread re-grounds **future turns only** (existing cards keep the audience they were generated under). **Rationale:** immediate value without forcing calibration; per-thread fits the existing thread-scoped state model (global single-active fights it).

### Area 5 — Goal → scoring reweight
- **D-05 (Fixed goal-intent taxonomy with free-text label):** The creator types **any goal label** (free-set, for display), but it maps to one of a **small fixed set of weight intents** — e.g. `grow / sell / authority / nurture` — chosen by the creator (dropdown) or LLM-classified **once at calibration time** (cached per-audience, not per-run). Each intent = a **deterministic `PersonaWeights` bias** layered on the audience's base mix (grow→cold-share, sell→converter, authority→skeptic). **Rationale:** deterministic + cache-stable + testable; free-text alone can't drive reproducible weights, and per-run LLM classification would inject nondeterminism into the scoring path (fights the determinism + regression-gate constraints).

### Area 6 — Personal-audience scrape flow
- **D-06 (Creator's own handle → calibrate → graceful General fallback):** A **Personal** audience scrapes the **creator's OWN account** (their real followers = "my audience") via the existing Apify follower-scrape infra. Calibration runs scrape → Audience Profile. If the scrape is **empty/thin/fails**, fall back to a described/General calibration with an **honest notice** ("couldn't read enough — using General") — **never fabricate** a calibrated audience (honesty spine). **Rationale:** matches the "personal = my audience" intent + honesty spine; reuses shipped scrape infra. ("Any handle / competitor" was rejected — it blurs the personal-vs-target type distinction and widens scope this phase.)

### Claude's Discretion
- Exact `PersonaWeights` bias values per goal-intent (within D-05's deterministic-bias shape) — structure now, values tuned in the refinement run.
- The exact mapping table from the 10 archetypes → Temperature×Disposition labels (D-02's presentation lens).
- Calibration sync/async UX detail (whether scrape blocks or streams) — researcher confirms Apify shape + latency (D-06).
- Whether goal-intent is creator-picked (dropdown) vs LLM-classified-once at calibration (D-05) — pick post-research on classification reliability; either must resolve to a cached, deterministic bias.
- Audience persistence shape (DB schema for the Audience object + calibration data) — planner discretion, must keep the object `audience_id`→`audience_ids[]`-ready for the deferred multi-select compare.
- THEME-06 flat-warm visual system is the design SSOT for the Manager UI, persona cards, and composer chip.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope & locked design
- `.planning/ROADMAP.md` §Phase 7 — goal + locked scope (object shape, persona redesign, 3-position wiring, guardrails, deferred list).
- `.planning/REQUIREMENTS.md` — formalize Phase 7 requirements here (currently TBD; ROADMAP marks "TBD — formalize in /gsd-discuss-phase 7").
- `.planning/STATE.md` — Hard Constraints (engine OPEN but regression-gate-PROTECTED, Qwen-only, fixed typed renderers, flat-warm SSOT, bump `ENGINE_VERSION` only on deliberate video-scoring changes).
- `.planning/PROJECT.md` — milestone identity + key decisions.
- Memory `audience-manager-phase7.md` (also summarized in this CONTEXT) — the full locked design + reusable-foundations list.

### Persona engine — the layer-over-10 target (D-02, regression-gate-critical)
- `src/lib/engine/wave3/persona-registry.ts` — the **10 archetype enum** (`ARCHETYPES`), byte-stable `ARCHETYPE_DEFINITIONS` (cache-discipline: do NOT mutate), `SlotType` (`fyp|niche_deep|loyalist|cross_niche` = Temperature lens), `MOTIVATORS`, `TIME_OF_DAY_TAGS`, deterministic `selectPersonaSlots`. **Reuse, do not rewrite.**
- `src/lib/engine/persona-weights.ts` — `PersonaWeights` + `PersonaWeightConfig` + `resolveWeights` precedence chain (`analysis > creator > niche > default`). **Calibration emits an override here**; `DEFAULT_PERSONA_WEIGHT_CONFIG` (FYP .65/niche .20/loyalist .10/cross .05) = the General audience baseline the gate protects.
- `src/lib/engine/wave3/persona-prompts.ts`, `persona-prompts-pass2.ts` — persona prompt assembly (the repaint target for per-audience descriptions).
- `src/lib/engine/__tests__/persona-weights.test.ts`, `__tests__/wave3-persona-registry.test.ts` — the regression-gate anchors for general-audience identity.

### The steer + react seams (D-01)
- `src/lib/tools/runners/ideas-runner.ts` — the ONE steer proof for P7: takes `profileRow: ProfileRow | null`, calls `buildGroundingLine(profileRow, platform)` (GROUND-03 "why it fits"), consumes Flash `personas` (verdict/quote/archetype) for the react signal. **Swap profile-grounding → audience-grounding here.**
- `src/lib/kc/grounding-line.ts` (`buildGroundingLine`), `src/lib/kc/profile-role-map.ts` (`ProfileRow`) — the grounding seam steer rewires.
- `src/lib/tools/runners/flash-runner.ts`, `src/lib/engine/flash/run-flash-text-mode.ts`, `flash-aggregate.ts` (`aggregateFlash`) — the react/SIM path the audience's calibrated personas + weights feed into.
- `src/lib/tools/hooks/audience-archetype.ts` — `deriveAudienceArchetype` (Flash per-persona stop verdicts → "stops the {persona}" tag); the existing audience-facing label surface (read for the Temp×Disposition label lens, D-02).

### Creator profile slim-down (name only) + scrape infra
- `src/lib/schemas/creator-profile.ts` — current 9-card profile schema (niche/voice/audience fields move to per-audience calibration inputs; profile slims to name only).
- Apify follower-scrape infra (per memory `numen-fixture-capture-auth`/reusable foundations) — the D-06 personal-scrape path; **researcher: confirm current scrape route + shape + failure modes.**

### Chain + thread substrate (for Manager UI + per-thread active audience, D-04)
- `src/lib/tools/chain-handoff.ts` — `SkillId` union (`idea|hooks|script|remix|test` — **note: `chat` is NOT in it**) + `CHAIN_HANDOFFS` (per-thread context-carry pattern the per-thread active-audience selection rides).
- `src/components/thread/*-thread-view.tsx` + composer — where the composer chip (`platform · name`) + per-thread audience pin live.

### Reusable design sketch
- `.planning/sketches/MANIFEST.md` + `001-hybrid-composer/` — composer mode-pill / skill-selector sketch (relevant to the composer audience chip placement).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`persona-weights.ts` override system** — `creator_overrides`/`analysis_override` precedence + normalization already shipped. Calibration = produce one override; General = untouched default → regression gate free.
- **`wave3/persona-registry.ts`** — 10 archetypes + slot-types + deterministic selection, byte-stable for cache. Temperature lens = existing `SlotType`; Disposition lens = existing archetypes relabeled.
- **`ideas-runner.ts` grounding seam** — `profileRow` + `buildGroundingLine` is the ready-made steer injection point (D-01).
- **Flash SIM `personas`** (verdict/quote/archetype) + `deriveAudienceArchetype` — the react-position signal + audience tag already exist.
- **Apify follower-scrape** — personal-audience calibration source (D-06).

### Established Patterns
- **Byte-stable prompts for cache discipline** (`persona-registry.ts` header) — any persona mutation must be additive/overridden, never in-place on the locked definitions (D-02).
- **Override precedence chain** (`resolveWeights`) — the canonical way to layer calibration without touching defaults.
- **Per-thread context carry** (`CHAIN_HANDOFFS`) — the model the per-thread active audience (D-04) extends.
- **Honesty spine** — never fabricate a signal/claim when data is absent (drives D-06's graceful fallback + D-03's no-edit-of-untuned-values).

### Integration Points
- Calibration writes a per-audience `PersonaWeights` override + repainted persona descriptions → consumed by the Flash/SIM react path and (for ideas) the steer grounding line.
- Goal-intent (D-05) → deterministic weight bias layered onto the audience base mix in `resolveWeights` flow.
- Composer chip → per-thread active `audience_id` → flows into runner calls as the grounding/sim substrate.

</code_context>

<specifics>
## Specific Ideas

- "Personal = my audience" — scrape the creator's OWN account; the whole point is the engine writing/testing FOR the creator's real followers, not generic archetypes.
- Temperature×Disposition is the creator-facing *language* of the audience; the engine keeps its proven 10-archetype machinery underneath.
- The moat pitch = "see your audience" → personas must be VISIBLE (read-only) even before they're individually tuned.
- Object must be built `audience_id`→`audience_ids[]`-ready so the deferred multi-select compare (retention vs growth side-by-side) is a later additive change, not a refactor.

</specifics>

<deferred>
## Deferred Ideas

- **Steer position-① across the remaining skills** (hook/script/test/remix/chat) — P7 proves steer in ideas-runner only; the rest land in the post-P7 refinement run.
- **Persona value tuning** — prompt wording, signal→score weight fitting (fold A/B), goal-intent bias values, live-context depth — the refinement run after P6+P7.
- **Persona editing by the creator** — read-only in v1; editing arrives once values are tuned.
- **Multi-select audience compare** (killer feature — retention vs growth side-by-side) — post-v1; object kept `audience_ids[]`-ready.
- **Real social OAuth** — no OAuth v1; Apify scrape + description only.
- **Spread/virality prediction in the Read** — post-v1.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 7-audience-manager-calibrated-audience-as-shared-substrate-acr*
*Context gathered: 2026-06-18*
