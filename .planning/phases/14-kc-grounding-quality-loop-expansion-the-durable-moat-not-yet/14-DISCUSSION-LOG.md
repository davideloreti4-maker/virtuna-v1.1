# Phase 14: KC Grounding & Quality-Loop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 14-kc-grounding-quality-loop
**Areas discussed:** Exemplar source + honesty, Quality-loop depth vs cost, Cited-research pass scope, Must-ship moat core (+ two owner-initiated follow-ups: curated grounding / the 26 hook templates, and citation-pill value)

---

## Area 1 — Exemplar source + honesty (KCQ-03 + HONESTY-01)

| Option | Description | Selected |
|--------|-------------|----------|
| P8 Discover outliers | Already-scraped, outlier-scored, niche-tagged; zero new infra | ✓ (as blueprint) |
| Creator's own history | Richer voice match but usage-gated + heavier scrape | |
| Curated per-niche seed | Highest control, manual, doesn't scale | |

**User's choice:** P8 Discover as the source — but raised the cold-start problem ("what if the user hasn't used Discover / it's a random search?").
**Notes:** Resolution captured as a blueprint for the *deferred* RAG phase (pool niche-keyed & shared across users — public videos, not user data; background pre-fetch on cold niche; 2–3 exemplars hook+format+why; hybrid niche-filter→semantic-rank; silent corpus-floor fallback). Then the user questioned the core premise ("how much does this really improve quality?"), leading to the deprioritization below.

| HONESTY-01 option | Description | Selected |
|--------|-------------|----------|
| Drop fake now, light real on RAG | Stop fake pills now; cite real retrieved item when RAG lands | ✓ (initially) |
| Ground in place | Leave pills, wire to real RAG later | |
| Drop permanently | Remove pills entirely | ✓ (final — see citation follow-up) |

**User's choice (RAG bet):** **Deprioritize RAG** — lead the phase with the cheaper, more-certain #2 (live-profile grounding) + #3 (generate-critique-regenerate); push exemplar RAG to a later phase.
**Notes:** Honest assessment given: RAG's lift is *asserted not measured*, it's the priciest lever, carries a parrot/slop downside. Owner chose to deprioritize rather than commit-and-build or validate-first.

---

## Area 2 — Quality-loop depth vs cost (KCQ-02 + KCQ-04)

| Option | Description | Selected |
|--------|-------------|----------|
| N=3, regenerate losers once (serial) | Meaningful lift, ~2-4x serial latency | |
| N=2, no regen | Cheapest, no self-correction | |
| N=5 + iterate to threshold | Highest ceiling, 5-10x cost | |
| **Parallel N + conditional regen** | Parallel over-generate (~1x latency), regen only if all fail floor | ✓ |

**User's choice:** Initially rejected best-of-N on latency ("2-4x latency and cost not worth it for UX"); accepted after the **parallel** reframe (parallel over-generate ≈ 1× latency; only conditional regeneration costs a round-trip). **N=3.**
**Notes:** Critic model = **Flash** (cheap/fast, rubric doesn't need Max). Flop pass (KCQ-04) = **internal filter + opt-in reveal**. Loop scope narrowed to **Ideas + Hooks only** (excluded Script = costly long-form/weak rubric; Test = judges existing content; Chat = conversational, per-message latency).

---

## Area 3 — Cited-research pass scope (KCQ-03 N2)

| Option | Description | Selected |
|--------|-------------|----------|
| Defer with RAG | Travels to the future grounding phase | ✓ |
| Thin Script-only opt-in | Manual "research this topic" on Script | |
| Build it automatic | Always-on cited-research pre-pass | |

**User's choice:** **Defer with RAG.**
**Notes:** Best home is Script (kept one-pass this phase); no web-search infra wired (brave/firecrawl/exa all off). Consistent with deprioritizing unproven/expensive grounding.

---

## Area 4 — Must-ship moat core

| Option | Description | Selected |
|--------|-------------|----------|
| **SIM spine + grounding + loop** | KCQ-06→05 + 01 + 02 + 04 (+08) | ✓ |
| SIM spine only | Just KCQ-06 + 05 | |
| Everything except deferred | All 8 remaining levers | |

**User's choice (core):** **SIM spine + grounding + loop.**
**Notes:** Dependency insight surfaced — KCQ-06 (niche-fix + threshold recalibration) must precede KCQ-05 (formalize the SIM gate), the foresight centerpiece.

| Tail option | Description | Selected |
|--------|-------------|----------|
| **08 core; thin 07/09** | Voice to core, thin runtime reject + thin legibility | ✓ |
| 08 + 07 core; thin 09 | | |
| 08 core; defer 07+09 | | |

**User's choice (tail):** **KCQ-08 promoted to core; thin KCQ-07 + KCQ-09.**
**Notes:** Owner challenged the initial "defer KCQ-08" — correctly. Code check confirmed the N1 voice sample is already shipped (`d2f121e7`) + `writing_voice_sample` plumbed in `assembler.ts:111–115`. So KCQ-08 needs no new infra (just prompt calibration) — cheap + certain → promoted to core.

---

## Follow-up A (owner-initiated) — curated grounding / the 26 hook templates

**Round 1 (general curated library):** Owner floated using a curated hook/format library instead of live RAG. Discussed honestly (cheaper, more accurate, resolves HONESTY-01 positively, BUT discipline-tier not structural moat + slop risk + IP risk if lifting Sandcastles' content). **User chose: defer it for now.**

**Round 2 (concrete asset):** Owner revealed they have **26 ready, owner-owned hook templates**.

| Option | Description | Selected |
|--------|-------------|----------|
| **Yes — thin P14 add** | Fold the 26 in under the archetype table, compile pipeline, silent grounding | ✓ |
| Defer with grounding phase | Hand to the future phase | |
| Let me show you first | Hold decision | |

**User's choice:** **Yes — thin P14 add.**
**Notes:** Materially different from "build a library" — owner-owned (no IP) + pre-curated (no build cost) = cheapest grounding win. Slot under `hooks.md` archetype table; private-reasoning use only (never emitted templates); map-before-merge at planning. The *larger* library beyond the 26 stays deferred.

---

## Follow-up B (owner-initiated) — citation-pill value

**Owner question:** "Why even add citation pills? Adds nothing for the user — the user doesn't need to know what was cited."

| Option | Description | Selected |
|--------|-------------|----------|
| **Drop pills, keep KCQ-09 why-for-you** | Delete pills (no re-light); keep plain-language made-for-you rationale | ✓ |
| Drop pills AND drop KCQ-09 | Cut all output-explanation | |
| Keep some citation surface | Keep a lightweight source indicator | |

**User's choice:** **Drop citation pills entirely (never re-light); keep KCQ-09 "made-for-you" rationale.**
**Notes:** Owner was right — source-citation is internal plumbing with no user value for content. It only earns its place for *verifiable factual claims* (deferred cited-research), and even there optionally. The 26 templates ground **silently**. KCQ-09 (plain-language "made for you because [audience / your last videos]") is a *different* thing with real value (personalization-trust + steering) — kept thin.

---

## Claude's Discretion

- Exact Flash-critic rubric wording (extend Value Bar / BASE Test B), the precise recalibrated threshold values (from the slop-vs-strong test), and the KCQ-09 inline micro-copy/placement — left to research + planning within the locked decisions.

## Deferred Ideas

- KCQ-03 live-exemplar RAG → future grounding phase (validate-first if revived; full blueprint in CONTEXT.md).
- N2 cited-research pass → future grounding phase (travels with RAG).
- Larger scraped/curated exemplar library *beyond* the owner's 26 templates → future grounding phase (build-our-own, never lift competitor content).
- KCQ-08 deeper voice via own-transcript RAG (REQUIREMENTS line 222, usage-gated) → deferred; P14 uses only the shipped voice sample.
- KCQ-09 full field-legibility surface → P12 IA (P14 = thin inline only).
- Performance-feedback flywheel (lever #8) → its own track; P10 reconciliation data feeds it.
