# Requirements — v4.1 MVP Ready

> **Brownfield refinement milestone.** These are not new-feature user stories.
> Each pillar is a category; each category maps to exactly one loose phase run as
> *audit → fix-list → verify*. The bullets below are the **starting audit
> backlog** — known issues to confirm and fix. Real to-do discovery happens at
> `/gsd-discuss-phase` time, and new items get added via `/gsd-phase` or
> `/gsd-quick` without reopening this file.
>
> "Done" for a pillar = audited end-to-end, known issues resolved or explicitly
> deferred, surface holds together for a real user.

---

## Pillar 1 — Engine Pipeline (ENG)

The Apollo 3-call flow: Omni verbatim sensor → fold ∥ Apollo reasoner. Qwen
inputs/outputs, prompt quality, latency, correctness, honesty.

- [ ] **ENG-01**: Full E2E analyze run is correct and stable on real videos — every Qwen call returns usable output, no silent fallbacks, no thrown frames
- [ ] **ENG-02**: Apollo reasoner stays grounded in the knowledge core (§ citations resolve to real corpus, not flat fake legend labels)
- [ ] **ENG-03**: Latency held under target (Vercel cap safe; pursue the <90s E2E goal where free-tier allows)
- [ ] **ENG-04**: Score is deterministic (same video twice → identical score) and honestly banded; engagement range stays grounded (follower_count × quality read), no fabrication
- [ ] **ENG-05**: omni-flash drift hardened (emotion_arc.label, weakest_modality, verbatim hook/segments hold across runs)
- [ ] **ENG-06**: Qwen prompt inputs/outputs reviewed end-to-end for quality and token efficiency

## Pillar 2 — Board / Test Mode (BTEST)

The analyze board UI/UX: frames, rendering, wiring, mobile.

- [ ] **BTEST-01**: All board frames render end-to-end with real engine output — no throwing frames, no grey-cell / warm-gradient fallbacks masking missing data
- [ ] **BTEST-02**: Insight-hero frame leads the board (dual-read, copyable rewrites, demoted band) and reads correctly
- [ ] **BTEST-03**: Filmstrip / keyframes persist across reload; content-craft frame stable
- [ ] **BTEST-04**: Mobile card-stack view coherent (auto <768px + manual toggle)
- [ ] **BTEST-05**: Dead UI removed (dead percentile rank, fake-engagement remnants, number overload, aria-live storm)

## Pillar 3 — Board / Remix Mode (BRMX)

The remix board UI/UX.

- [ ] **BRMX-01**: Remix mode runs end-to-end and renders correctly against the shared Apollo reasoner (R12 one-brain path)
- [ ] **BRMX-02**: Remix board UI/UX audited and refined to match Test-mode quality bar (frames, wiring, mobile)
- [ ] **BRMX-03**: Remix ↔ Test mode transitions and shared components behave consistently

## Pillar 4 — Chat Feature (CHAT)

The "ask the expert" chat dock: UI/UX + grounding.

- [ ] **CHAT-01**: Chat citations are real and grounded (resolve the §-scheme mismatch — inject KNOWLEDGE-CORE / fix taxonomy, or drop fake citations) so the chat is trustworthy
- [ ] **CHAT-02**: Chat dock UI/UX refined (markdown, frame-tags, streaming/stop, composer, mobile full-height sheet) — verified desktop + mobile
- [ ] **CHAT-03**: Chat answers stay tied to the analyzed video's engine output (context grounding), not generic

## Pillar 5 — General UI/UX (UIUX)

Cross-cutting polish toward a coherent MVP surface.

- [ ] **UIUX-01**: Numen rebrand fully consistent (logo, wordmark, titles, meta, OG, copy) — no stray "Virtuna" anywhere user-facing
- [ ] **UIUX-02**: Raycast design language adherence audited (6% borders, 10% hover, 12px card radius, Inter, glass pattern) across all surfaces
- [ ] **UIUX-03**: Mobile responsiveness + accessibility (WCAG AA) pass on the core flow (analyze → board → chat)
- [ ] **UIUX-04**: End-to-end first-run flow holds together for a real user (auth → analyze → result → chat), no dead routes or broken handoffs

---

## Out of Scope (this milestone)

- **Net-new features** — idea generator, A/B variants, cross-platform repurposing, watermark detection, hook archetype library, outcome feedback loop, trend velocity → backlog (refinement milestone, not feature build)
- **Landing rebuild** — deferred (separate `milestone/landing` worktree)
- **iOS Capacitor wrapper** — future milestone
- **Domain research** — refining shipped surfaces, no upfront research
- **Brand-deals / competitors / trending pillars** — not part of the core MVP-ready loop unless surfaced as blockers

## Future Requirements (deferred)

Carried from PROJECT.md backlog; reactivate selectively post-MVP-ready:
- History view connected to real prediction results
- Analytics dashboard (confidence distributions, cost trends, model drift)
- Outcomes feedback loop (auto-scrape posted content after 48h)

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| ENG-01 | Phase 1 — Engine Pipeline | Pending |
| ENG-02 | Phase 1 — Engine Pipeline | Pending |
| ENG-03 | Phase 1 — Engine Pipeline | Pending |
| ENG-04 | Phase 1 — Engine Pipeline | Pending |
| ENG-05 | Phase 1 — Engine Pipeline | Pending |
| ENG-06 | Phase 1 — Engine Pipeline | Pending |
| BTEST-01 | Phase 2 — Board / Test Mode | Pending |
| BTEST-02 | Phase 2 — Board / Test Mode | Pending |
| BTEST-03 | Phase 2 — Board / Test Mode | Pending |
| BTEST-04 | Phase 2 — Board / Test Mode | Pending |
| BTEST-05 | Phase 2 — Board / Test Mode | Pending |
| BRMX-01 | Phase 3 — Board / Remix Mode | Pending |
| BRMX-02 | Phase 3 — Board / Remix Mode | Pending |
| BRMX-03 | Phase 3 — Board / Remix Mode | Pending |
| CHAT-01 | Phase 4 — Chat Feature | Pending |
| CHAT-02 | Phase 4 — Chat Feature | Pending |
| CHAT-03 | Phase 4 — Chat Feature | Pending |
| UIUX-01 | Phase 5 — General UI/UX | Pending |
| UIUX-02 | Phase 5 — General UI/UX | Pending |
| UIUX-03 | Phase 5 — General UI/UX | Pending |
| UIUX-04 | Phase 5 — General UI/UX | Pending |
