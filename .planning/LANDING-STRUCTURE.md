# LANDING-STRUCTURE.md — Numen Landing Base Spec

> The buildable skeleton for the new Numen landing. Captures the locked reference
> set, the design discipline, the section wireframe, and open decisions.
> Forked from `milestone/numen-surface @ 148930a` (Phase 1 design system mid-flight).
> Created 2026-06-11.

---

## 0. Scope & relationship to the app

- **Net-new landing**, separate worktree (`~/virtuna-numen-landing`, branch
  `milestone/numen-landing`). The old `~/virtuna-landing` (Raycast/coral) is dead — rebuild from scratch.
- The landing **consumes** the new in-app design system built in Numen Surface
  **Phase 1** (`.numen-surface` token layer, Tailwind v4 CSS-first, primitives,
  StageBlock stage-reveal). It does **not** fork or reinvent those tokens.
- **Build timing:** start structure / copy / layout / motion **now** against
  current (placeholder) tokens; **swap to final tokens once Phase 1 calibration
  signs off.** Accept minor token-swap rework as the cost of parallelism.

---

## 1. Locked reference set (each a distinct job)

| Reference | Role | What we take | What we DON'T take |
|---|---|---|---|
| **kero** (`kero-ai.framer.website`) | Spine + intelligence voice | Section skeleton + intelligence copy register (cognitive-automation language, "vs manual", decision-ready, calm-confident) | Its **skin**: cool grey-green tone, glass-over-photo staging, stock imagery, fake window chrome |
| **krea** (`krea.ai`) | Content-as-hero staging | Real content full-bleed as hero; chrome tucked to near-nothing; content is **both demo and navigation** ("seeing = doing") | Its multi-model/generation framing (we're intelligence, not generation) |
| **luma** (`lumalabs.ai`) | Content-as-hero staging | Outputs treated as **gallery-quality** centerpieces; whitespace lets content dominate; **specificity** over abstract claims; credibility anchored early | Generation positioning |
| **live Reading** | THE hero artifact | A real verdict on a real creator video, stage-revealed — our authentic "hero video" | — |
| **virality snake-oil rivals** (Viralocity, Virality Cortex, quso, StreamLadder, Otto) | Anti-reference | Define what NOT to be | Their "95% accuracy!" fake-precision, loud hype |

**Explicitly NOT a landing reference:** Anthropic (its palette only ever informed
the *in-app* warm-neutral kit; already absorbed by Phase 1). Whoop (its *app UX*
verdict-compression maps to the in-app Reading screen, **not** the landing — it
sells fitness hardware to athletes; wrong category/audience for the landing).

---

## 2. Design discipline (guardrails)

1. **Copy the skeleton, not the skin.** kero gives proven *bones + voice*. All
   visuals are Numen; the visitor never sees kero.
2. **Product-as-hero, not decoration.** The hero is the live Reading, not a
   stock photo in a fake browser window. Content-first (krea/luma), not
   decoration-first (= generic SaaS).
3. **Palette = OPEN.** Shares Numen brand DNA (logo, the verdict color
   language) for coherence with the app, but the landing is **not bound to the
   app's warm-neutral**. Staging may run cooler / more cinematic. → see Open Decisions.
4. **Anti-snake-oil posture.** Where rivals scream "95% accuracy / predict
   virality," Numen reads calm + honest: **verdict = calibrated band + one-line
   why, never a naked number.** This is the copy moat.
5. **Specificity over claims** (luma): concrete Readings across real niches beat
   abstract "AI-powered insights" copy.
6. **Motion = the in-app language.** Reuse the calm stage-reveal (StageBlock /
   `numen-ease-calm`); no bouncy/snappy, no presence theater. kero pacing.

---

## 3. Positioning / message spine

- **One-line:** the intelligence that tells creators whether their content will
  resonate — an honest verdict they can believe, not a hype score.
- **Against:** the "virality score" snake-oil tier (fake precision).
- **Audience:** TikTok creators (primary) + investor credibility (secondary).
- **Voice:** calm, confident-mentor, plain-language, NO engine jargon (inherits
  the in-app voice baseline / READ-07).

---

## 4. Section wireframe (kero spine → Numen content → krea/luma staging)

> MVP = ship-first. Later = post-MVP.

1. **Hero** *(MVP)* — intelligence/verdict headline + subhead + primary CTA.
   Centerpiece = **live Reading on a real creator video**, full-bleed, chrome
   minimal (krea). Verdict throne visible. NOT stock-under-glass.
2. **How the Reading works** *(MVP)* — kero's 3-feature-cards adapted to the
   real flow: *upload → engine reads → verdict + why*. Content is demo +
   navigation (krea).
3. **Why trust it / the honesty moat** *(MVP)* — the anti-snake-oil section.
   Calibrated band, not fake 95%. Can borrow kero's comparison-table move:
   Numen vs "virality score" tools.
4. **Real Readings gallery** *(MVP)* — luma move: gallery-quality real Readings
   across creator niches. Specificity = depth.
5. **Use cases / personas** *(later)* — kero's segmented use cases (solo
   creators, agencies, brands).
6. **Social proof** *(MVP-light)* — creator testimonials / waitlist count;
   investor-credible signals where available (luma anchors credibility early).
7. **Final CTA** *(MVP)* — try / join.
8. **Footer** *(MVP)*.

---

## 5. Open decisions (resolve during build)

- **D-L1 — Landing palette direction:** (a) inherit the app's warm-neutral for
  brand continuity, vs (b) run cooler / more cinematic (krea/luma) to let creator
  keyframes pop. Lean: keyframes carry chroma either way; chrome tone TBD.
- **D-L2 — Hero implementation:** live interactive Reading demo vs recorded
  stage-reveal loop (perf + reliability tradeoff).
- **D-L3 — Final token swap:** gated on Phase 1 calibration sign-off (colors are
  placeholders until then).
- **D-L4 — Credibility assets:** what real social proof exists at launch
  (testimonials, waitlist, investor logos)?

---

## 6. Build sequencing

1. **Now (token-independent):** section architecture, copy, layout scaffold,
   motion choreography, responsive shape.
2. **On Phase 1 token lock:** swap in final `.numen-surface` tokens + primitives;
   wire the real Reading hero.
3. **Formalize:** run `/gsd-new-milestone Landing` inside this worktree to derive
   REQUIREMENTS + ROADMAP from this spec (also cleans the inherited
   numen-surface `.planning/` state).

---

## 7. References (URLs)

- kero — https://kero-ai.framer.website/
- krea — https://www.krea.ai/
- luma — https://lumalabs.ai/
- (anti) Viralocity — https://www.getviralocity.com/ · Virality Cortex — https://www.viralitycortex.com/
- In-app design contract — `~/virtuna-numen-surface/.planning/phases/01-design-system-foundation-brand-migration/01-UI-SPEC.md`
- Vision (authoritative brand) — `~/virtuna-numen-surface/.planning/NUMEN-SURFACE-VISION.md`
