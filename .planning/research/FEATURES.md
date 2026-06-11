# Feature Research

**Domain:** Mobile-first AI content-intelligence app — "one thread per video" / answer-first reading + agentic tools (Numen Surface, v5.0)
**Researched:** 2026-06-11
**Confidence:** HIGH on the answer-first / progressive-reveal / suggested-prompts / verdict-band patterns (Context-equivalent: NN/g, Whoop docs, OpenAI Apps SDK UX, Perplexity behavior all converge). MEDIUM on share-sheet ingestion (web platform constrains it — flagged). MEDIUM on in-persona failure voicing (synthesized from conversation-design sources, not a single canonical spec).

> Scope note: this file covers ONLY the NEW user-facing capabilities of the Numen Surface surface rebuild. Already-built and explicitly out of re-research: the engine, the Apify competitors tool, auth/onboarding/payments, the retiring Konva board, the retiring chat dock. Design language is locked by the vision and out of scope. Every recommendation is checked against the vision's emphatic anti-features (no mysticism, no open assistant, no red error toasts, no naked-number verdict).

---

## Feature Landscape

The five capability areas map to five surfaces. Within each, behaviors are split into table-stakes (must exist or the surface feels broken/untrustworthy) vs differentiators (the moat) vs anti-features (cut explicitly).

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **AI pronounces first, unprompted** (no blank prompt on entry) | Answer-engine norm (Perplexity, Arc "Browse for me"): synthesized answer first, dialogue second. A blank chat box after a 45–60s analysis reads as "now what?" and bounces mobile users. | MEDIUM | Submitting ingestion kicks the Reading immediately; the thread opens already populated/populating. Pure composition over existing engine output — no new computation. Depends on engine data contract (ENG-06 / §7b). |
| **Stage-reveal under latency** (structured blocks materialize as engine stages complete) | Users tolerate latency only when they see *progression* toward completion (LogRocket, NN/g, Nextbuild). A dead spinner at 45–60s is a documented mobile bounce risk. Skeleton-then-fill is the established perceived-performance pattern. | MEDIUM | Engine already runs in stages (analyze → hook → cf → script → post); each stage completing materializes its block. This is structured-block reveal, NOT chatbot token-streaming. Each block gets a skeleton placeholder sized to final content. Needs streaming transport (SSE) from the staged engine. |
| **Verdict in a reserved top "throne" slot** | Verdict-first products (Whoop, Perplexity) put the answer at the top, persistently visible. Burying the verdict (today's board buries insight at the bottom — F37) breaks the contract. | LOW–MEDIUM | Slot reserved from frame one; shows a "forming" state while evidence assembles below; crystallizes last as the climax. Reveal builds *up* to it; the settled document *opens on* it. |
| **Verdict = calibrated band + one-line why** (not a naked number) | Whoop's whole model: a 0–100 score is grouped into green/yellow/red bands to make the signal *readable and actionable at a glance*; the band + plain-language guidance is the product, the number is supporting. Engine scores are known-noisy (~26–86), so a naked number is false precision (F45) and reads as a metric, not judgment. | LOW (presentation); the band-mapping logic is a data-contract decision (MEDIUM) | Three bands: travels / mixed / won't-spread → muted green / amber / clay-red. The "why" is one sentence grounded in the engine's hero insight. Confidence shown in the band's *language* ("likely," "mixed signals"), never as a separate hedge. Number demoted to evidence inside the body. |
| **Source/evidence grounding under the verdict** | Perplexity set the expectation that an AI verdict is trustworthy only when you can see what it's based on. The vision's "comprehension — understood THIS video" depends on visible grounding (keyframes, hook decomp, the specific signal). | LOW | The existing card components become the evidence blocks. Keyframes carry the grounding *and* the chroma (vision §6). |
| **3–4 suggested follow-ups as taps** | Recognition-over-recall: Perplexity predicts follow-ups because users are bad at composing them. Suggested prompts kill cold-start a second time and teach capability. NN/g: narrow scope makes suggestions highly relevant + teaches what the tool can do. | LOW–MEDIUM | Taps appear after the Reading settles. Must be *contextual* to this Reading, not generic. Free-text composer available but secondary. |
| **Free-text follow-up composer** | Any thread UI is incomplete without open input after the guided taps. | LOW | Ephemeral glass composer (one of the few sanctioned glass uses per vision §6). Scoped to competence — see anti-features. |
| **"Working…" beat for tool turns** | OpenAI Apps SDK / ChatGPT agent: an on-screen narration shows exactly what the tool is doing; tool latency is forgiven inside a thread when progress is visible. | MEDIUM | A tool turn inserts a progress block ("Pulling your competitors' recent posts…") that resolves into a result block. Latency is *expected* here, unlike the initial Reading. |
| **Tool result rendered as a structured in-thread block** | ChatGPT/Perplexity render tool output as structured, interactive blocks inside the conversation (not a link-out). Keeps the user in the thread. | MEDIUM | Reuse card vocabulary. The Apify competitor data already exists; this is a new *presentation* of it inside a thread turn. |
| **Home = vertical list of past Readings** | Chat-app spine (list → conversation) is the universal mental model for thread-based apps. Without it, threads have no home and no persistence. | LOW–MEDIUM | Each row = a compact verdict card (keyframe thumb + band + one-line why + date). One persistent "analyze new" action. Requires the deferred "history connected to real results" backlog item to finally land. |
| **In-app ingestion: upload + paste URL** | Baseline creator ingestion. Paste-a-TikTok-URL is the existing extraction path; file upload is the existing pipeline. | LOW (paths exist) | Both already exist in backlog/engine; this milestone wires them to the new thread-kickoff. Watermark/pre-flight is a later-milestone concern, not here. |
| **First-run: see value before commitment** | Documented highest-converting onboarding pattern (Lovable, Grammarly demo-doc, Slack Slackbot): put the user *inside* a working instance before asking for upload/signup. "Show the magic first." | MEDIUM | Lead with a live demo Reading on a recognizable viral video. The Reading IS the pitch. Can be a pre-baked/cached Reading (no live engine cost) to guarantee the wow + dodge DashScope 429 risk. |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Verdict-as-judgment, not metric** | This is the brand wedge made tangible. "This will likely travel — your hook earns the first 3 seconds" reads as a trusted mentor's call; "Score: 73/100" reads as a dashboard widget (which the audience equates with "scam," vision §5). Survives engine noise where a number can't. | LOW–MEDIUM | Aligns with Whoop's band model and resolves engine findings F36/F41/F45 in one move. The hard part is the band-mapping + why-sentence templating against the data contract, not the rendering. |
| **Two species of follow-up: instant vs agentic** | The agentic tools are explicitly "the real moat vs chat wrappers" (vision §4). Turning the AI from *interpreter* → *investigator* (fetches competitor data, back-catalog, trends, best-post-time) is what a generic GPT wrapper cannot do — Numen owns the Apify pipeline + the creator's history. | HIGH (agentic), LOW (instant) | Instant = re-interpret existing data (why this score, rewrite the hook, highest-leverage fix) — fast, free, no new fetch. Agentic = go fetch (competitor analysis via Apify, back-catalog comparison, trends). Must be **visually distinct** because they cost time + can fail (see below). |
| **Visual distinction for agentic taps** | OpenAI Apps SDK UX principle: set expectations for actions that take time. Mixing a free instant re-interpret with a 30s+ Apify scrape under identical-looking chips breaks the latency contract and erodes trust on the first slow tap. | LOW–MEDIUM | Agentic chips carry a different affordance (e.g., a "tool" glyph / subtle weight) signalling "this goes and fetches." Instant chips feel immediate. A concrete, testable distinction. |
| **In-persona failure voicing for tool turns** | Vision is emphatic: tool failures "must be voiced in-persona, never red error-toasts." Conversation-design research backs this: specificity + next-step ("I couldn't reach your competitors' data just now — want me to retry, or work from what we have?") beats a dead-end toast; users who recover from a voiced fallback rate the experience higher. | MEDIUM | The failed tool turn stays *in the thread* as a calm mentor message with a retry/alternative affordance. No modal, no red, no toast. A graceful-degradation hierarchy (full → partial → "here's what I can still tell you"). |
| **Past-Readings list as a content-intelligence portfolio** | Beyond list→conversation: the home accrues into a portfolio of the creator's intelligence over time, setting up cross-video insight later ("your hooks consistently underperform"). This is a retention + compounding-value moat a one-shot analyzer lacks. | MEDIUM (this milestone: just the list; cross-video insight is later) | Ship the list now; the cross-video synthesis is a future surface that this list makes possible. Don't build the synthesis yet. |
| **In-thread monetization as an oracle-initiated turn** | "Connect creators to monetization" is core product value. Surfacing it as a tool turn *inside the thread* ("your profile lands brand deals in X niche") — not a separate tab — keeps it contextual and non-salesy. Resolves engine finding F39. | MEDIUM | Oracle-initiated (the AI offers it), reuses the agentic-tool turn machinery. Lower priority than the core Reading + follow-ups; sequence after the thread spine works. |
| **Live demo Reading as the pitch** | First-run shows a *real* Reading on a recognizable viral video — far stronger than a feature tour. The demo IS the product; conversion becomes an informed decision. | MEDIUM | Pre-baked Reading recommended (guaranteed wow, no live cost/latency/429). The recognizable video makes the verdict legible — user already has an intuition to validate the call against. |

### Anti-Features (Cut Explicitly — from the vision)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Naked numeric score as the verdict** ("Score: 73/100", "PREDICTED RANK Top X%") | Feels precise, objective, gameable. Dashboards condition users to expect a number. | False precision on a known-noisy score (~26–86, F45); reads as a metric not a judgment; "/100" is dead/false (F41/F45); corporate-dashboard feel reads as scam to high-taste creators (§5). | Calibrated band + one-line why; number demoted to in-body evidence. |
| **Open-ended assistant / "ask me anything" chat** | "It's a chat, so it should answer anything." | Flexibility-usability tradeoff (NN/g): broad scope is *harder* to use, users don't discover capability, and it invites off-topic prompts the engine can't honor → trust failures. Numen is an interpreter of *this video*, not a general GPT. | Scope follow-ups + composer to competence: "about this Reading / your content." Suggested taps teach the boundary. |
| **Red error toasts / modal error dialogs for tool failures** | Standard web error UX; easy to bolt on. | Breaks the in-thread mentor persona; a red toast on a creator's anxious first slow tap signals "broken/scam." | In-persona voiced failure inside the thread + retry/alternative; graceful degradation to partial results. |
| **Chatbot token-by-token text streaming as the reveal** | It's what ChatGPT does; feels "AI." | The Reading is *structured engine output*, not prose. Token-typing a verdict trivializes a judgment and fights the "stage-reveal of structured blocks" model; also slower-feeling than block materialization. | Stage-reveal: skeleton blocks that fill as engine stages complete; verdict crystallizes last. |
| **Mysticism / oracle theater** (temple, light-as-presence, amber gravitas, solemn ritual) | "Oracle" framing tempts numinous visuals; feels premium-mysterious. | Explicitly cut as gimmicky (vision §3). The audience reads pomposity as untrustworthy. "Oracle" is an internal UX *principle* (verdict-first, did-the-work-for-you), never literal on screen. | Calm, restrained, neutral tool aesthetic — "the calm room you step into." Warm-confident-mentor tone, not reverent. |
| **The Konva canvas as the primary surface** | It exists, it's built, 60fps, impressive. | Desktop-poweruser paradigm; needed a bolted-on mobile fallback (the tell). A canvas says "you do the synthesis" — opposite of an interpreter. Fights mobile-first acquisition. | Thread is primary on all sizes. Canvas (or a dense linear successor) survives ONLY as the desktop instrument layer for the ~10% who came for depth. |
| **Three parallel scorecards / output bloat** (~40 fields, ~10 valuable) | More data looks more thorough. | F36/F43: three competing scorecards confuse; 30 dead fields bury the 10 that matter. | Reading collapses to ONE verdict; re-composes only value-bearing fields. The data-contract prune (ENG-06 / F27/F28/F43) is part of this milestone. |
| **Persistent single relationship / one mega-thread** | "It's a chat, keep one conversation." | A persistent assistant blurs which video is being discussed and can't be cleanly shared. | Per-video threads — clean, focused, shareable. Cross-video patterns surface at the home/list level later. |
| **Engine jargon surfaced to the user** (fold, percentile internals, model names) | It's in the output; show it. | F38: jargon breaks the calm-mentor plain-language voice; reads as a debug console. | Plain language; jargon stays internal. |
| **Separate monetization tab** | Conventional SaaS IA. | Decouples monetization from context; feels like an upsell page. | Oracle-initiated tool turn inside the thread. |
| **macOS-style fake window chrome / glass-everywhere** | Borrowed "premium app" costume. | No Numen-first reason (vision §6); glass-everywhere is the retiring Raycast language. | Glass becomes rare (composer + tool sheet only); warm-neutral flat chrome that recedes. |

---

## Feature Dependencies

```
[Engine data contract — ENG-06 / §7b SMOKE GATE]
    └──prerequisite for──> [The Reading]
                                ├──contains──> [Verdict band + why]   (needs band-mapping logic)
                                ├──contains──> [Evidence blocks / keyframes]
                                └──reveal needs──> [Stage-reveal transport (SSE)]

[The Reading]
    └──precedes──> [Suggested follow-ups]
                        ├── [Instant follow-ups]  (re-interpret existing data — no new fetch)
                        └── [Agentic tool turns]
                                ├──requires──> [Apify competitors pipeline] (EXISTS)
                                ├──requires──> ["working…" beat]
                                ├──requires──> [in-persona failure voicing]
                                └──requires──> [visual distinction from instant chips]

[Per-video thread]  ──spine for──>  [Home list of past Readings]
                                          └──requires──> [persisted real results] (backlog item, must land)

[Ingestion: share-sheet | upload | paste URL]  ──kicks off──>  [The Reading]

[First-run live demo Reading]  ──showcases──>  [The Reading]  (best as pre-baked, no live engine)

[In-thread monetization turn]  ──reuses──>  [Agentic tool turn machinery]

[Cross-video insight]  ──future, enabled by──>  [Home list as portfolio]   (NOT this milestone)
```

### Dependency Notes

- **The Reading requires the engine data contract (ENG-06 / SMOKE GATE):** A confident verdict band demands a calibrated, honest engine — "or the oracle confidently lies and trust dies" (§7). The data-contract design (consumed-vs-dead field prune, F27/F28/F43) is the SAME question as "what does the Reading consume" — fold them, don't do twice (§7b). The SMOKE GATE (one real-video E2E) is a hard precondition before building any Reading-against-real-output.
- **Stage-reveal requires a streaming transport:** Engine already runs in stages; the surface needs SSE (or equivalent) to materialize each block as its stage completes. Result Surface milestone already proved SSE-driven viz — reuse the transport pattern.
- **Agentic tool turns reuse the existing Apify pipeline:** The competitor data + scrape pipeline already exist; this milestone is a NEW in-thread *presentation* + the "working…"/failure-voicing/visual-distinction wrappers around it. Same for back-catalog (own-handle scrape) and best-post-time (existing engine signal).
- **Home list requires persisted real results:** The long-deferred "history connected to real prediction results" backlog item must finally land — the list has nothing to show otherwise.
- **Instant follow-ups conflict with the open-assistant anti-feature:** Keep follow-ups scoped to competence; the composer is constrained to "this Reading / your content," not a general chat.
- **Live demo conflicts with live-engine cost/latency/429 risk:** Pre-bake the demo Reading. A live first-run analysis risks a slow/failed first impression and DashScope 429.

---

## MVP Definition

### Launch With (v1 — the thread spine works end-to-end)

- [ ] **The Reading** — stage-revealed structured blocks over existing engine output. The core paradigm; nothing works without it.
- [ ] **Verdict band + one-line why in the throne slot** — the brand wedge; resolves F36/F41/F45.
- [ ] **Evidence blocks (keyframes + hero insight)** — grounding under the verdict; the "understood THIS video" payload.
- [ ] **Stage-reveal transport** — turns 45–60s latency into legible progress; mobile-bounce mitigation.
- [ ] **3–4 suggested instant follow-ups + free-text composer** — kills cold-start, teaches scope.
- [ ] **At least ONE agentic tool turn (competitor analysis via Apify)** — proves the moat; reuses existing pipeline. Includes "working…" beat + in-persona failure voicing + visual distinction.
- [ ] **Per-video thread + Home list of past Readings** — the app shell / spine; needs persisted results.
- [ ] **Ingestion: paste URL + upload, wired to thread kickoff** — entry path.

### Add After Validation (v1.x)

- [ ] **First-run live (pre-baked) demo Reading** — onboarding wow; add once the Reading render is polished enough to be the pitch.
- [ ] **Additional agentic tools** — back-catalog comparison, trends, best-post-time — once the first tool turn's UX is validated.
- [ ] **In-thread monetization turn** — oracle-initiated brand-deal-fit; reuses tool machinery once stable.
- [ ] **Richer instant follow-ups** (rewrite hook, highest-leverage fix) — expand the instant menu after the base set lands.

### Future Consideration (v2+)

- [ ] **Native share-sheet ingestion from TikTok/Reels** — the lowest-friction acquisition hero, BUT requires a native shell (iOS share extension). The product is web-first; the Capacitor/iOS wrapper is an explicitly *future* milestone. On web, a PWA share-target is a partial substitute but unreliable for share-from-TikTok. Defer until the native shell exists. (See complexity flag below.)
- [ ] **Cross-video insight** ("your hooks consistently underperform") — enabled by the portfolio list; needs accumulated history. Don't build until the list has data.
- [ ] **Desktop instrument layer** — same thread widened + dense board/linear successor for the ~10% poweruser. Mobile-first ships first; desktop density is a later pass (vision lean: minimal divergence).
- [ ] **Shareable exported Reading (image card vs link)** — the growth loop; mechanics still an open vision decision (§9).

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| The Reading (stage-reveal of engine blocks) | HIGH | MEDIUM | P1 |
| Verdict band + why (throne slot) | HIGH | MEDIUM | P1 |
| Stage-reveal transport (SSE) | HIGH | MEDIUM | P1 |
| Suggested instant follow-ups + composer | HIGH | LOW–MEDIUM | P1 |
| Per-video thread + Home list | HIGH | MEDIUM | P1 |
| Ingestion (upload + paste URL) | HIGH | LOW (paths exist) | P1 |
| First agentic tool turn (Apify competitors) | HIGH (the moat) | HIGH | P1–P2 |
| In-persona failure voicing | MEDIUM | MEDIUM | P1 (ships with tool turn) |
| Visual distinction instant vs agentic | MEDIUM | LOW–MEDIUM | P1 (ships with tool turn) |
| First-run pre-baked demo Reading | HIGH | MEDIUM | P2 |
| Additional agentic tools (back-catalog, trends, post-time) | MEDIUM | MEDIUM each | P2 |
| In-thread monetization turn | MEDIUM | MEDIUM | P2 |
| Cross-video insight | HIGH (later) | HIGH | P3 |
| Desktop instrument layer | MEDIUM (10% of users) | HIGH | P3 |
| Native share-sheet ingestion | HIGH (acquisition) | HIGH (needs native shell) | P3 (gated on Capacitor milestone) |
| Shareable exported Reading | MEDIUM (growth) | MEDIUM | P3 (mechanics undecided) |

---

## Competitor Feature Analysis

| Capability | Perplexity / Arc | ChatGPT (Apps SDK / agent) | Whoop | Numen Surface approach |
|---------|------------------|----------------------------|-------|------------------------|
| Cold-start | Synthesized answer first, dialogue second | Blank prompt (open assistant) | Verdict pushed daily, no prompt | AI pronounces the Reading first, unprompted — no blank prompt ever |
| Verdict form | Synthesized prose answer + citations | Prose | **Color band (green/yellow/red) + plain-language guidance**, number secondary | Calibrated band + one-line why; number demoted to evidence (Whoop model applied to content) |
| Latency UX | Streaming answer + visible source-fetching | "Working…" narration of tool steps | Computed overnight, no wait | Stage-reveal of structured blocks; verdict crystallizes last |
| Follow-ups | Predicted follow-up questions at answer end | Conversational refinement | n/a | Contextual suggested taps (instant) + a constrained composer, scoped to competence |
| Tool turns | Source-fetch shown inline | Tool result blocks inline, on-screen narration | n/a | In-thread agentic turns (Apify/back-catalog/trends) with "working…" + in-persona failure |
| Scope | Answer engine (narrow-ish) | Open assistant (broad) | Single competence (recovery/strain/sleep) | Deliberately narrow: interpreter of *this video* + your content — NOT an open assistant |
| Failure UX | Inline | Inline | n/a | In-persona voiced, never red toast |
| Home/spine | Library of threads | Conversation list | Daily dashboard + trends | List of past Readings = content-intelligence portfolio |

**Read:** Numen's posture = **Perplexity's answer-first + Whoop's band-verdict + ChatGPT-agent's tool-turn UX**, fused into a per-video thread, deliberately *narrower* than any of them in scope (the NN/g winning move) and *calmer* than the whole neon-AI category (the brand wedge).

## Sources

- [NN/g — Scope in Generative AI Features](https://www.nngroup.com/articles/scope-ai-features/) — narrow scope aids adoption, suggestion relevance, capability teaching; flexibility-usability tradeoff (HIGH)
- [Whoop — How Recovery Works](https://www.whoop.com/us/en/thelocker/how-does-whoop-recovery-work-101/) and [Whoop Support — Recovery Score](https://support.whoop.com/s/article/WHOOP-Recovery) — 0–100 grouped into green/yellow/red bands for at-a-glance actionable guidance; band > number (HIGH)
- [Perplexity's high bar for UX (mttmr.com)](https://mttmr.com/2024/01/10/perplexitys-high-bar-for-ux-in-the-age-of-ai/) and [Why Perplexity is rewriting AI UX (Medium)](https://medium.com/design-bootcamp/why-perplexity-ai-is-rewriting-the-rules-of-ai-powered-ux-design-dc72feef915b) — answer-first, predicted follow-ups, recognition-over-recall (MEDIUM, design-blog)
- [OpenAI Apps SDK — UX principles](https://developers.openai.com/apps-sdk/concepts/ux-principles) and [Introducing ChatGPT agent](https://openai.com/index/introducing-chatgpt-agent/) — on-screen narration of tool steps, structured interactive tool result blocks, setting expectations for time-costing actions (HIGH/MEDIUM)
- [LogRocket — Skeleton loading screen design](https://blog.logrocket.com/ux-design/skeleton-loading-screen-design/) and [Nextbuild — AI response latency & engagement](https://nextbuild.co/blog/ai-response-latency-user-engagement) — gradual progression, partial-results-over-waiting, latency tolerated when progression visible (MEDIUM)
- [Google PAIR — Errors + Graceful Failure](https://pair.withgoogle.com/chapter/errors-failing/), [AI UX Design Guide — Graceful Error Recovery](https://www.aiuxdesign.guide/patterns/error-recovery), [Clearly Design — Designing for AI Failures](https://clearly.design/articles/ai-design-4-designing-for-ai-failures) — degradation hierarchy, specificity + next-step over dead-end, recover-rate boost (MEDIUM)
- [Appcues — best user onboarding examples](https://www.appcues.com/blog/best-user-onboarding-examples) and [Supademo — interactive onboarding demos](https://supademo.com/blog/create-interactive-onboarding-demos) — put users inside a working instance; show value before commitment (Lovable, Grammarly, Slack) (MEDIUM)
- [TikTok Share Kit iOS](https://developers.tiktok.com/doc/share-kit-ios-quickstart-v2), [AppleInsider — iOS App Extensions / Share Sheets](https://appleinsider.com/articles/14/07/07/inside-app-extensions-apple-opens-up-social-share-sheets-to-third-parties), [GetStream — iOS Share Extension](https://getstream.io/chat/docs/sdk/ios/guides/share-extension/) — share-sheet ingestion requires a native iOS share extension; not available to a pure web app (MEDIUM — confirms the deferral)
- `.planning/NUMEN-SURFACE-VISION.md` — §3 (anti-mysticism), §4 (surface architecture, instant vs agentic, in-persona failure), §5 (brand/perception), §6 (anti-features: glass, window-chrome, naked number), §7a (engine-finding map F36–F45), §7b (SMOKE GATE, ENG-06 data contract) — the authoritative product source (HIGH)
- `.planning/PROJECT.md` — core value (monetization), prior milestones, web-first / Capacitor-future constraint (HIGH)

---
*Feature research for: mobile-first answer-first AI content-intelligence thread app (Numen Surface v5.0)*
*Researched: 2026-06-11*

## ⚠ Complexity / Dependency Flags for the Roadmapper

1. **Native share-sheet ingestion is gated on a native shell.** The vision calls it "the acquisition hero, lowest friction," but iOS share extensions require a native (Capacitor) wrapper — explicitly a *future* milestone in PROJECT.md. On web, only a PWA share-target is possible and it does NOT reliably receive shares from TikTok/Reels. **Recommendation: scope this milestone to upload + paste-URL ingestion; defer share-sheet to the Capacitor milestone.** Don't let it block the thread spine.
2. **The engine data contract (ENG-06 / SMOKE GATE) is a hard precondition** for the Reading, the verdict band, and the field-prune. It is the FIRST gating step (see §7b). The verdict-band mapping logic and the consumed-vs-dead field prune are data-contract work, not pure UI — sequence them with/before the Reading build.
3. **The first agentic tool turn is the highest-cost, highest-moat P1 item.** It bundles: in-thread tool presentation + "working…" beat + in-persona failure voicing + visual distinction from instant chips. Treat as its own phase chunk; it reuses the existing Apify pipeline but the in-thread UX is net-new.
4. **Home list depends on persisting real results** — a long-deferred backlog item. It must land for the spine to be real.
5. **Stage-reveal needs a streaming transport** (SSE). The Result Surface milestone already proved SSE-driven viz; reuse, don't reinvent.
6. **First-run demo should be pre-baked**, not a live analysis — guarantees the wow and dodges live latency + DashScope 429 risk.
