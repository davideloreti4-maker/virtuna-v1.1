# Pitfalls Research

**Domain:** Mobile-first AI content-intelligence rebrand (thread-per-video "Reading") on Next.js 15 / Tailwind v4 / Supabase / Vercel, engine v4.1 untouched
**Researched:** 2026-06-11
**Confidence:** HIGH on iOS share-target + Vercel streaming + Tailwind oklch (verified against MDN/WebKit/Vercel/Tailwind docs); MEDIUM on verdict-calibration UX (research-backed but project-specific); HIGH on scope/integration pitfalls (derived from this repo's own history + vision)

> Two non-negotiable gates run through everything below:
> 1. **SMOKE GATE** (vision §7b) — one real-video E2E proving honest, sane engine output BEFORE building the Reading against it. Watch DashScope-429 on the live rig.
> 2. **Verdict-honesty banding gate** — the noisy score (~26–86) must map to a *calibrated* band or "the oracle confidently lies and trust dies" (vision §7, the explicit failure mode).

---

## Critical Pitfalls

### Pitfall 1: iOS share-target as "acquisition hero" — the feature does not exist in Safari PWAs

**What goes wrong:**
The vision names native share-sheet from TikTok/Reels as "the acquisition hero, lowest friction." But **iOS Safari does not support the Web Share Target API.** An installed PWA cannot register as a system share destination on iOS — `share_target` in the manifest is silently ignored. The app simply will not appear in TikTok's share sheet. This is the single most over-assumed feature in the vision: the headline acquisition path is unbuildable as a pure PWA on the platform the audience lives on. (WebKit bug #194593 has been open since 2019, still unimplemented as of 2026.)

**Why it happens:**
Web Share Target is well-documented on MDN and works great on Android/Chrome, so it reads as a standard PWA capability. The iOS-specific gap is buried in caniuse/WebKit-bug land. Teams build the manifest, test on Android, ship, and only discover at iOS UAT that the share sheet is empty — with no error, no console log, nothing.

**How to avoid:**
- Treat iOS share-sheet ingestion as requiring a **native share extension**, not a PWA manifest. That means the **Capacitor wrapper** (already on PROJECT.md's future-milestones list) + a `capacitor-share-extension` / Capawesome Share Target plugin + an App Group + URL-scheme handoff to the web view. This is a *native iOS build*, not presentation-layer work — it likely belongs to the Capacitor milestone, NOT this one.
- For THIS milestone, make **in-app paste-URL / upload the primary ingestion path** and treat share-sheet as: (a) working on Android PWA, (b) deferred-to-Capacitor on iOS. Do not let the roadmap promise iOS share-sheet as a v5.0 deliverable.
- If iOS share-in is required sooner, the cheap interim is a **manual "copy link → open Numen → auto-detect clipboard URL"** flow (clipboard read is allowed on user gesture). Friction is higher but it ships in the PWA.

**Warning signs:**
- A phase plan lists "share_target manifest entry" as the iOS acquisition solution.
- Testing happens only on Android/desktop Chrome (where it works) and never on a real iPhone with a real TikTok share.
- The roadmap couples "acquisition hero" to this milestone's ship date.

**Phase to address:**
Ingestion phase — must open with a platform-capability spike (Android PWA vs iOS reality). Scope decision: iOS share-in → defer to Capacitor milestone; v5.0 leads with paste/upload.

---

### Pitfall 2: Stage-reveal pipeline outlives the Vercel function — silent 504 mid-Reading

**What goes wrong:**
The engine runs ~45–74s E2E. The stage-reveal streams blocks as stages complete. But Vercel function duration is capped: **Hobby = 60s default/300s Fluid; Pro = up to 300s (800s Enterprise) with explicit `maxDuration`.** A 45–74s pipeline sits dangerously close to the 60s line and *will* exceed it on a slow DashScope day. When the function hits its limit it returns **504 FUNCTION_INVOCATION_TIMEOUT** — mid-stream the connection just dies. The throne verdict (which crystallizes *last*, the climax) is exactly the block most likely to never arrive. The user watches evidence assemble, then the screen freezes one beat before the payoff. Worst possible place to fail.

**Why it happens:**
Default `maxDuration` is low; teams forget to raise it. Latency is measured on a warm local rig, not a cold Vercel function under a 429-throttled DashScope. The verdict-last reveal order maximizes exposure: the longest-latency block is the one users care about most.

**How to avoid:**
- Set `export const maxDuration = 300` on the streaming route (requires Pro plan — confirm the deploy target is Pro, not Hobby).
- Add `export const dynamic = "force-dynamic"` or streaming is buffered/cached and never flushes.
- **Return the Response object immediately, then write to the stream from a background loop** — Next.js buffers the whole response if you `await` the pipeline before returning. This is the #1 "streaming silently doesn't stream" bug.
- Send a **heartbeat comment (`: ping\n\n`) every ~15s** so proxies/mobile radios don't kill an idle-looking connection during a long stage.
- Design the reveal so a **timeout is recoverable**: persist each completed stage server-side (Supabase) as it lands; if the stream dies, the client can re-fetch the partial Reading and resume — never make the verdict only-exist-in-the-stream.
- Budget against the *worst* case (DashScope 429 backoff), not the median 45s.

**Warning signs:**
- No `maxDuration` export on the route. Deploy target is Hobby plan.
- Latency measured locally only; no cold-Vercel timing with DashScope under load.
- Completed stages live only in stream memory, not persisted — a dropped connection loses the whole Reading.

**Phase to address:**
The Reading / streaming-infrastructure phase. Gate it on the **SMOKE GATE** (which yields the real ENG-03 latency number on the live rig + flushes out DashScope-429).

---

### Pitfall 3: The oracle confidently lies — noisy score → overconfident band

**What goes wrong:**
Engine scores are known-noisy (~26–86; same video can land in different spots run-to-run). The vision demands a *confident verdict band* ("This will likely travel"). If a noisy 58 is rendered as a crisp "Will travel" with mentor-confident voice, the system **over-claims certainty it doesn't have.** Research is unambiguous: LLM-as-judge outputs are systematically overconfident, and users equate confident phrasing with reliability — so when the confident verdict is wrong (and on a ±15-point-noisy score it often will be near the boundaries), **trust collapses and doesn't come back.** This is the vision's named death condition.

**Why it happens:**
The band is computed from a single point estimate with no uncertainty band attached. Banding thresholds are picked by eye ("70+ = travels") with no calibration against real outcomes. The mentor-voice spec pushes toward confident language regardless of how close the score sat to a boundary. The number's noise is invisible by the time it becomes a sentence.

**How to avoid:**
- **Calibration gate before the band ships.** Run the same video N times, measure score variance, and set band boundaries with **buffer zones wider than the noise.** A score within the noise band of a boundary must land in **"Mixed signals,"** not flip confidently across it.
- Make **"Mixed signals" a first-class, common verdict** — not a rare fallback. Honesty about uncertainty IS the trust mechanism. A system that says "mixed" when it's genuinely unsure reads as *more* credible than one that's always confident.
- Express confidence in the band's **language**, never a hidden hedge or a confidence % (vision §4: "confidence shows in the band's language, never as a hedge"). Three honest registers: confident-positive / mixed / confident-negative.
- The **one-line "why" must cite a concrete signal** ("your hook earns the first 3 seconds"), not restate the score. A grounded reason survives noise; a number doesn't.
- Demote the number to evidence, never the headline (resolves F41/F45).

**Warning signs:**
- Band thresholds are hardcoded constants with no variance analysis behind them.
- "Mixed" almost never fires in testing — means thresholds are too confident.
- The "why" line is generated from the score, not from a specific engine signal.
- No same-video-twice determinism/variance check exists.

**Phase to address:**
Data-contract / verdict-banding phase (this is ENG-06 D-12 folded in, vision §7b). Hard-gated by the **SMOKE GATE** (proves honest output) AND a **calibration sub-gate** (proves the band survives the noise). Do not build the throne UI before this passes.

---

### Pitfall 4: Agentic tool failure rendered as a red error-toast (breaks the persona)

**What goes wrong:**
Apify tools (competitor scrape, back-catalog, trends) are slow and *do* fail — rate limits, dead TikTok handles, partial results, timeouts. The vision is explicit: **tool failures must be voiced in-persona, never red error-toasts.** The default React pattern (try/catch → toast.error("Something went wrong")) shatters the "warm confident mentor" illusion the moment it fires — and it fires often, because Apify is unreliable by nature. One generic red toast inside a calm oracle thread reads as a broken toy to an elite-visual-literacy creator.

**Why it happens:**
Error handling is an afterthought wired with the team's default toast util. Partial Apify results (got 3 of 5 competitors) get treated as all-or-nothing failures. No in-persona copy is written for the failure paths, so devs reach for the generic component.

**How to avoid:**
- Every tool turn needs **in-persona failure + partial-result copy authored as a first-class deliverable**, not a fallback. ("I couldn't reach two of those creators — here's what the other three tell us.")
- Treat **partial success as success**: render what came back, name what didn't, in-voice.
- Tool turns get a **visible "working…" beat** (latency forgiven inside a thread, per vision) with a sane ceiling, then a graceful in-persona "this is taking longer than usual — want me to keep trying or move on?" — never a spinner that hangs forever.
- Make **agentic taps visually distinct** from instant ones (vision: "they cost time + can fail") so the user has the right expectation before tapping.
- Persist tool results so a thread reload doesn't re-run a slow/expensive Apify call.

**Warning signs:**
- `toast.error` / generic error boundary anywhere in a tool turn.
- Tool calls are all-or-nothing (no partial-result handling).
- No copy written for timeout/partial/failure states.
- A failed tool leaves the thread in a stuck or blank state.

**Phase to address:**
Follow-ups + agentic-tools phase. Failure-voice copy is a deliverable, not polish.

---

### Pitfall 5: Tailwind v4 warm-dark tokens compile WRONG (this repo has already hit it)

**What goes wrong:**
The new palette is **warm neutral, very dark, NO pure black** — base ~`#1a1714`–`#17150f`, panels `#211e1a`→`#2a2622`. These are exactly the **L < ~0.15 dark colors that Tailwind v4 compiles incorrectly when authored as `oklch()` in `@theme`** — a problem this repo has *already* documented and worked around (PROJECT.md Key Decision: "Dark gray tokens in hex (not oklch) — workaround for Tailwind v4 compilation inaccuracy"). Ground-up rebuilding the kit re-opens this trap: a fresh designer authoring the warm-neutral scale in oklch will get visibly-off dark tones and chase a ghost. Compounding it: Tailwind v4 oklch + `color-mix()` opacity syntax has its own broken-class bug (#14499), and v4 requires Safari 16.4+ for oklch/`@property` at all.

**Why it happens:**
oklch is the v4 default and the "modern" way; a ground-up kit naturally reaches for it. The repo's hard-won hex workaround lives in a Key Decision table that a new design-system author won't read. The error is *subtle* (slightly-off dark tone), not a crash, so it survives review.

**How to avoid:**
- **Author all dark warm-neutral tokens (L < ~0.15) as exact hex in `@theme`,** per the existing repo decision. Carry this rule into the new design-system phase explicitly — don't let "ground-up" mean "forget the known v4 bug."
- Verify rendered tokens against design hex with a color picker on a real build, not the oklch source values.
- Confirm the Safari 16.4+ baseline is acceptable for the audience (it is for current iOS, but note it).

**Warning signs:**
- New token file authored in oklch for the dark base/panel steps.
- Warm neutrals look slightly "off" / muddy on device but match in Figma.
- Opacity-modifier classes (`bg-base/50`) silently missing from the build.

**Phase to address:**
Design-system foundation phase. First task: port the hex-not-oklch dark-token rule into the new kit's contributing rules.

---

### Pitfall 6: Lightning CSS strips `backdrop-filter` — the "rare glass" silently flattens

**What goes wrong:**
The vision keeps glass for *ephemeral elements only* (composer, tool sheet). But this repo's build pipeline (Lightning CSS, Tailwind v4) **strips `backdrop-filter` from CSS classes** (PROJECT.md Known Issue). So a glass composer authored as a Tailwind/CSS class will render as a flat opaque panel — the one place glass is intentionally kept will be the place it silently breaks.

**Why it happens:**
It's a build-tool quirk, not a code error — the class is valid, it just gets dropped. New kit authors won't know the repo-specific workaround (apply blur via React inline `style={{ backdropFilter: 'blur(Npx)' }}`).

**How to avoid:**
- Apply `backdrop-filter` via **React inline styles**, never CSS classes, per the existing repo workaround.
- Bake this into the glass-component (composer/tool-sheet) as the only sanctioned glass primitive so it can't be done wrong elsewhere.

**Warning signs:**
- Composer/tool-sheet glass looks flat/opaque on the deployed build but fine in some local configs.
- `backdrop-filter` appears in a CSS/Tailwind class anywhere in the new kit.

**Phase to address:**
Design-system foundation phase (glass primitive) + composer/tool-sheet phase.

---

### Pitfall 7: Scope creep — rebuilding the engine when this is presentation-only

**What goes wrong:**
The milestone charter is explicit: **engine v4.1 (3.19.0) is untouched; the surface re-presents existing output.** The most expensive failure is letting the Reading-build leak into engine changes — "the band needs a confidence field, let me add one to the engine," "the why-line needs a new signal, let me add a stage." That re-entangles surface and engine (the clean seam the whole milestone depends on, vision §7) and balloons a presentation milestone into an engine rewrite.

**Why it happens:**
The data-contract design (ENG-06 D-12) sits right at the engine boundary and feels like an invitation to "just tweak" the engine. The noisy-score problem (Pitfall 3) tempts an engine-calibration fix when the correct fix is presentation banding.

**How to avoid:**
- **Hard rule: the Reading consumes existing engine output; if a field is missing, the band/why adapts to what exists, or the gap is logged for a *future* engine milestone** — not patched mid-rebrand.
- ENG-06 D-12 is a **field-consumption + prune** exercise (what does the Reading read, what's dead) — a *contract-reading* step, not a contract-*changing* step.
- Verdict honesty (Pitfall 3) is solved in **presentation banding** (buffer zones, "mixed"), not engine recalibration.

**Warning signs:**
- A Reading-phase plan touches `src/lib/engine/`.
- "We need a new engine field for the verdict" appears in a plan.
- ENGINE_VERSION bumps during this milestone.

**Phase to address:**
Charter-level guardrail; enforce at every Reading/data-contract phase plan review.

---

### Pitfall 8: Over-romancing the oracle into mysticism (explicitly cut)

**What goes wrong:**
The vision *repeatedly* warns: "oracle" is an internal UX principle (verdict-first, did-the-work-for-you), and an earlier exploration that made it literal — temple, light-as-presence, amber, solemn gravitas — was **explicitly cut as gimmicky.** A designer re-reading "the throne," "crystallizes," "the oracle pronounces" can drift back into reverent theater: dramatic fade-ins, mystical glow, solemn copy. For an audience that reads "corporate SaaS dashboard" as scam, it reads "spiritual woo" as equally fake. Pompous = death with creators (vision §5).

**Why it happens:**
The oracle metaphor is evocative; the vocabulary ("throne," "crystallize") invites literal interpretation. "Calm + premium" gets misread as "solemn + reverent."

**How to avoid:**
- Tone target is **"warm confident mentor with weight" — NOT solemn/reverent, NOT chummy buddy.** Litmus: would this animation/copy feel at home in WHOOP/Linear/Things? If it feels like a meditation app or a temple, cut it.
- The stage-reveal is **legible progress, not ritual.** Motion is calm/soft, never "presence theater" (vision §6).
- Color stays out of the chrome — energy comes from the user's keyframes + the verdict scale, not mystical glow.

**Warning signs:**
- Amber/gold glows, slow reverent fades, candle/temple/light imagery.
- Verdict copy reads like prophecy rather than a sharp mentor note.
- Any "presence" / ambient-light effect.

**Phase to address:**
Design-language + Reading-reveal phases; enforce via the WHOOP/Linear litmus in design review.

---

### Pitfall 9: Half-migrated brand — coral + Raycast bleed into the warm-neutral kit

**What goes wrong:**
Replacing a coherent 36-component Raycast kit (cold `#07080a`, 5px-blur glass everywhere, scattered hardcoded coral) with a ground-up warm-neutral kit is a big swap. The classic failure is **half-migration**: new thread screens are warm-neutral, but shared chrome (nav, modals, settings, auth) still renders cold `#07080a` + raw `#FF7F50` + Raycast glass. The result is two visual languages in one app — exactly the incoherence an elite-visual-literacy audience punishes hardest (craft = credibility, §5).

**Why it happens:**
36 components + scattered hardcoded coral across ~43k LOC. The Reading is the exciting part; shared shell screens get deprioritized. Hardcoded `#FF7F50` (not all tokenized) hides in dozens of files.

**How to avoid:**
- **Audit + inventory every surface and every hardcoded coral/`#07080a` first** (grep the codebase) so the migration scope is known, not discovered screen-by-screen in production.
- Evolve coral → warm clay as a **token swap at the source** so continuity is automatic where tokenized, and grep-fix the hardcoded stragglers.
- Define a **migration boundary**: which screens are in-scope for v5.0 (thread, home, ingestion) vs. which stay on the old kit behind a route until a later pass — explicit, not accidental.
- Old kit and new kit must not co-render on the *same* screen.

**Warning signs:**
- Cold `#07080a` or raw `#FF7F50` appears next to warm-neutral tokens on the same screen.
- 5px-blur glass on a screen that's supposed to be the new kit.
- "We'll migrate the settings page later" with no tracked boundary.

**Phase to address:**
Design-system foundation phase (audit/inventory) + an explicit migration-boundary decision in the roadmap.

---

### Pitfall 10: Building desktop before mobile ships

**What goes wrong:**
The vision is mobile-first; desktop = "same thread widened + instrument layer," explicitly the *only* place the dense board survives, for ~10% of users. The trap: the team's familiarity with the existing desktop canvas pulls effort toward rebuilding/keeping the Konva instrument before the mobile Reading is shippable. The acquisition audience is mobile; desktop-first inverts the priority and risks shipping nothing the core audience can use.

**Why it happens:**
The existing board is desktop-Konva; "keep what works" bias. Desktop is where the current team is most comfortable. The "still-open" desktop-canvas-vs-linear decision (§9) invites premature engineering.

**How to avoid:**
- **Mobile Reading ships first and standalone.** Desktop instrument is a *later* phase, gated on mobile being live.
- Defer the Konva-keep-vs-retire decision (§9) until after mobile ships — don't let it block or front-load the roadmap.

**Warning signs:**
- A desktop-instrument / Konva phase scheduled before the mobile Reading is shippable.
- Engineering time spent on the dense board before mobile thread works end-to-end.

**Phase to address:**
Roadmap sequencing — mobile Reading phases precede any desktop-instrument phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Ship `share_target` manifest, test only on Android | "Share works" demo on Android | iOS share sheet silently empty; acquisition hero unbuildable as PWA | Only if iOS share-in is explicitly deferred to Capacitor milestone |
| Hardcode band thresholds by eye | Verdict ships fast | Overconfident verdict on noisy score → trust collapse | Never — calibration gate is non-negotiable |
| `await` pipeline then return Response | Simpler handler code | Streaming silently buffers; no stage-reveal | Never for the Reading route |
| Generic `toast.error` on tool failure | One-line error handling | Breaks persona; reads as broken toy | Never inside a thread; allowed only on infra/auth screens |
| Author dark tokens in oklch | "Modern" v4 idiom | Wrong dark tones (repo-known v4 bug) | Never for L<0.15 — use hex |
| "Migrate settings/auth screens later" (untracked) | Focus on the Reading | Half-migrated two-language app | Only with an explicit, tracked migration boundary |
| Keep Konva canvas as-is for desktop | Reuse existing code | Front-loads desktop, delays mobile | Only after mobile ships; decision deferred per §9 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| iOS Web Share Target | Assuming PWA `share_target` registers on iOS | Not supported in Safari (WebKit #194593); needs Capacitor native share extension + App Group + URL scheme |
| Vercel streaming function | Default `maxDuration`, Hobby plan, no `force-dynamic` | `maxDuration = 300` (Pro), `dynamic = "force-dynamic"`, return Response then stream from background loop |
| SSE behind Vercel/proxy | Compression/proxy buffers chunks; no heartbeat | `X-Accel-Buffering: no`, disable compression on the route, `: ping` heartbeat every ~15s, event IDs for resumability |
| Engine output (v4.1) | Adding fields to engine for the verdict | Read-only consume; band adapts to existing fields; log gaps for a future engine milestone |
| Apify tools | All-or-nothing; generic error on failure | Partial-result rendering + in-persona failure copy + result persistence |
| DashScope (engine LLM) | Latency measured warm/local | Budget for 429 backoff; SMOKE GATE measures real cold latency on live rig |
| Tailwind v4 `@theme` | Dark warm tokens in oklch | Exact hex for L<0.15 (repo Key Decision) |
| Lightning CSS | `backdrop-filter` in a CSS/Tailwind class | Apply via React inline `style` (repo Known Issue) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Pipeline near 60s function cap | Mid-Reading freeze, verdict never arrives, 504 | `maxDuration=300` on Pro; persist stages; budget worst-case | First slow/429 DashScope day; immediately on Hobby |
| No stage persistence | Dropped mobile connection loses whole Reading | Persist each completed stage to Supabase; resumable re-fetch | Any mobile network handoff (cell↔wifi) mid-stream |
| Re-running Apify on thread reload | Slow + costly repeat scrapes | Persist tool results per thread | Every revisit of a thread with tool turns |
| Keyframe-heavy chrome | Janky scroll on mid-tier phones | Lazy-load / size keyframes; keep chrome lightweight | Long home list of past Readings on older devices |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Unvalidated pasted TikTok/Reels URL → Apify/engine | SSRF / abuse via crafted URL | Reuse existing SSRF guard pattern (repo already added SSRF guard on sound_url); validate + allowlist host at the boundary |
| Public share/permalink of a Reading leaks private content | Exposes a creator's unpublished video analysis | Explicit visibility model; default private; signed/expiring share links |
| Clipboard auto-read ingestion | Reading clipboard without gesture/consent | Only on explicit user gesture; show what was detected before acting |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Dead spinner during 45–74s pipeline | Mobile bounce before first block | Stage-reveal: each completed stage materializes its block (vision) |
| Confident verdict on a boundary score | Wrong-confident → trust dies | Buffer zones; "Mixed signals" is first-class and common |
| Verdict = a naked number "/100" | False precision, reads as metric not judgment | Band + grounded one-line why; number demoted to evidence |
| Engine jargon surfaced to user | Reads as clinical/SaaS scam | Plain mentor language (resolves F38) |
| Red error toast inside thread | Breaks the calm-mentor persona | In-persona failure copy; partial results shown |
| Mystical/reverent reveal theater | Reads as woo/fake to high-taste eye | Calm legible progress; WHOOP/Linear litmus |
| Cold + warm kit on same screen | Reads as unfinished/scam (craft=credibility) | Migration boundary; no co-rendering of kits |

## "Looks Done But Isn't" Checklist

- [ ] **iOS share-sheet:** Often "works" only on Android — verify on a real iPhone sharing a real TikTok; confirm iOS path is Capacitor-deferred, not assumed-PWA.
- [ ] **Stage-reveal stream:** Often buffers — verify blocks actually arrive incrementally on a deployed Vercel function (not just local), with `maxDuration` set and Response returned-then-streamed.
- [ ] **Verdict band:** Often overconfident — verify "Mixed signals" fires for boundary scores; run same-video-N-times variance check; confirm thresholds have buffer zones.
- [ ] **Tool failure:** Often a red toast — verify timeout/partial/failure all render in-persona; verify partial results show.
- [ ] **Warm-dark tokens:** Often oklch — verify dark tokens (L<0.15) authored as hex; color-pick rendered output against design.
- [ ] **Glass composer:** Often flat — verify `backdrop-filter` via inline style and visible on the deployed build.
- [ ] **Brand migration:** Often half-done — grep for `#07080a` / `#FF7F50` / 5px-blur glass on new-kit screens.
- [ ] **SMOKE GATE:** Often skipped — verify one real-video E2E returned honest, sane output (F46/F47/F22/F23 hold live) and produced the real latency number BEFORE the Reading was built.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| iOS share-target assumed in PWA | MEDIUM | Re-scope ingestion to paste/upload primary; move iOS share to Capacitor milestone; ship clipboard-detect interim |
| Function timeout mid-Reading | LOW (if stages persisted) / HIGH (if not) | Set `maxDuration`; persist stages; add resumable re-fetch — cheap if designed in, expensive to retrofit |
| Overconfident verdict shipped | HIGH | Trust damage is sticky; recalibrate bands, widen buffer zones, make "mixed" common, re-earn over time |
| Half-migrated brand | MEDIUM | Inventory + grep sweep; set boundary; finish or gate old-kit screens behind routes |
| oklch dark tokens | LOW | Convert L<0.15 tokens to hex; re-pick against design |
| Engine-scope creep | MEDIUM | Revert engine changes; re-route fix to presentation banding or future engine milestone |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| iOS share-target unbuildable as PWA | Ingestion (open with capability spike) | Real iPhone share test; iOS explicitly Capacitor-deferred |
| Pipeline outlives Vercel function | Reading/streaming infra (gated on SMOKE GATE) | Incremental blocks arrive on deployed function; stages persisted; heartbeat present |
| Oracle confidently lies (noisy→band) | Data-contract/verdict-banding (SMOKE GATE + calibration sub-gate) | Same-video variance check; "Mixed" fires on boundaries; why-line is signal-grounded |
| Tool failure as red toast | Follow-ups + agentic tools | All failure/partial paths render in-persona; results persisted |
| Tailwind v4 dark oklch wrong | Design-system foundation | Dark tokens are hex; rendered = design hex |
| Lightning CSS strips backdrop-filter | Design-system foundation + composer | Glass visible on deployed build (inline style) |
| Engine-scope creep | Charter guardrail (all Reading phases) | No `src/lib/engine/` edits; ENGINE_VERSION unchanged |
| Mysticism drift | Design-language + reveal phases | WHOOP/Linear litmus passes in design review |
| Half-migrated brand | Design-system foundation + migration-boundary decision | No cold+warm co-render; grep clean on new-kit screens |
| Desktop before mobile | Roadmap sequencing | Mobile Reading shipped before any desktop-instrument phase |
| SMOKE GATE skipped (meta) | Hard precondition before Reading build | One real-video E2E proves honest output + real latency; DashScope-429 surfaced |

## Sources

- [share_target — Web app manifest, MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target) — HIGH
- [WebKit Bug 194593 — Add support for Web Share Target API](https://bugs.webkit.org/show_bug.cgi?id=194593) — HIGH (still open; iOS unsupported)
- [PWA iOS Limitations and Safari Support (2026)](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) — MEDIUM
- [Capawesome Share Target Plugin for Capacitor](https://capawesome.io/docs/plugins/share-target/) — HIGH (iOS share extension approach)
- [capacitor-share-extension (calvinckho)](https://github.com/calvinckho/capacitor-share-extension) — MEDIUM
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations) — HIGH
- [Configuring Maximum Duration for Vercel Functions](https://vercel.com/docs/functions/configuring-functions/duration) — HIGH
- [New execution duration limit for Edge Functions — Vercel](https://vercel.com/changelog/new-execution-duration-limit-for-edge-functions) — HIGH
- [Fixing Slow SSE Streaming in Next.js and Vercel (Medium)](https://medium.com/@oyetoketoby80/fixing-slow-sse-server-sent-events-streaming-in-next-js-and-vercel-99f42fbdb996) — MEDIUM
- [SSE don't work in Next API routes — vercel/next.js Discussion #48427](https://github.com/vercel/next.js/discussions/48427) — MEDIUM
- [Overconfidence in LLM-as-a-Judge: Diagnosis and Confidence-Driven Solution (arXiv 2508.06225)](https://arxiv.org/html/2508.06225v1) — MEDIUM
- [Mind the Confidence Gap (arXiv 2502.11028)](https://arxiv.org/pdf/2502.11028) — MEDIUM
- [Tailwind CSS v4 — oklch opacity-syntax bug, Issue #14499](https://github.com/tailwindlabs/tailwindcss/issues/14499) — HIGH
- [Tailwind CSS v4 blog (oklch palette, Safari 16.4+ baseline)](https://tailwindcss.com/blog/tailwindcss-v4) — HIGH
- Repo PROJECT.md Key Decisions / Known Issues (hex-not-oklch dark tokens; Lightning CSS backdrop-filter) — HIGH (project ground truth)
- `.planning/NUMEN-SURFACE-VISION.md` §3/§5/§6/§7/§7b (anti-mysticism, audience, design demands, SMOKE GATE, DashScope-429) — HIGH (project ground truth)

---
*Pitfalls research for: Numen Surface — mobile-first AI content-intelligence rebrand on Next.js 15 / Tailwind v4 / Supabase / Vercel*
*Researched: 2026-06-11*
