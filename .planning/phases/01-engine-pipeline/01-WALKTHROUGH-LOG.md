# Phase 1 engine walkthrough — running flags & questions log

> Co-review record (D-00). Audit-inline observations surfaced while walking the
> pipeline e2e with Davide. Not decisions — candidates for the fix passes.
> Started 2026-06-11. Companion to 01-ENGINE-ASBUILT-MAP.md.

## Step 3 — signed-URL resolution → READ call (omni-flash)

### F7 — tiktok_url derive-and-drop may delete the video BEFORE the models read it (HIGH — verify, ENG-01)
pipeline.ts:482-496 schedules the re-host temp-object delete FIRE-AND-FORGET, inline,
BEFORE Omni runs (:510) and before Fold/Apollo consume the same signed URL. Comment
calls it "finally-equivalent" but it's NOT in a finally. If the delete lands before
DashScope fetches the object, the signed URL 404s → Read fails → silent zeroed analysis.
Verify on a real tiktok_url whether this races. If real: move the delete to a true
post-pipeline finally (after all 3 sighted calls resolve).

### F8 — Read model = flash, picked on a 2-video A/B (ENG-05/D-10)
omni-flash is the substrate quality ceiling for the whole engine. D-10 reopens
flash-vs-plus on real videos (plan 01-02). Latency budget allows plus now.

### F9 — retry only on whole-response fail, not empty critical field (ENG-05/D-11)
omni-analysis.ts MAX_RETRIES=1 fires on JSON/Zod fail only — NOT on valid-but-empty
emotion_arc / null hook_verbatim on a speech video. No drift logging. The D-11 gap:
add bounded retry on empty critical fields + drift telemetry.

### F10 — emotion_arc + hook_verbatim ride an `as GeminiVideoAnalysis` cast (low — D-14)
Not declared on GeminiVideoAnalysis; threaded via cast (omni-analysis.ts:289-296).
Inline warnings: do NOT remove (re-introduces the historical 100%-null-rows drop).
Any D-14 schema tighten MUST preserve these cast-threaded fields.

### F11 — Read blocks the parallel pair (latency, ENG-03)
Read is serial in front of Fold+Apollo (both need its segments/verbatim). ~17s before
the ~54s critical path even starts. Inherent (substrate dependency); note for ENG-03.

### F12 — wave0 content_type/niche confidence hardcoded 1.0 (low)
omni-analysis.ts:260-265 stamps confidence:1.0 — the model never produces it. Fake
certainty if any consumer trusts it.

### F13 — signalAvailability gemini_hook/body/cta is whole-call binary (medium)
omni-analysis.ts:308 sets all three true on success / false on fail — NOT real
per-segment. aggregator CR-03 (degrade failed-segment signals to null) keys off these
but a segment never partially fails in the unified omni path → CR-03 branch is dead code.

### F14 — Read does double duty: sensor + generic judge (HIGH — ENG-06 core)
Read emits perception (verbatim/segments/emotion_arc/audio) AND generic judgment
(5 factor SCORES + overall_impression + improvement_tip). Judgment overlaps Apollo and
its scores feed mostly provenance/dead paths (gemini_score provenance-only, FeatureVector
unscored). Apollo gets the rationales (scores stripped — good). Question: should Read
score at all, or be a pure sensor and leave ALL judgment to Apollo? Token + clarity + moat.

### F15 — emotion_arc prompt "REQUIRED" but schema .optional() (low)
Prompt says required for video; schema optional + downstream null-safe. Intentional
backward-compat but prompt/schema disagree.

### F16 — audio_description Zod min(10) is a sharp edge (low)
A terse legit audio ("music") <10 chars fails the whole parse → retry/degrade. Loosen min.

## DECISIONS (captured co-review, D-00)

### D-R1 — Read becomes a PURE SENSOR (Davide, 2026-06-11)
Read stops emitting generic JUDGMENT; Apollo is the sole judge (aligns Apollo north star).
- KEEP (perception): segments, hook_verbatim, emotion_arc, audio_signals/audio_description,
  content_type, niche, video_signals (borderline-keep), audio_perceptual_score (TS-derived).
- DROP (judgment): factors[].score, factors[].rationale, improvement_tip, overall_impression,
  content_summary → gemini_score dies with them.
- OPEN sub-decisions (decide at scope time): (1) hook_decomposition 0-10 modality scores keep
  vs downgrade to presence — leaning keep; (2) audio_perceptual_score keep (derived); (3) what
  perception skeleton Apollo's user message receives once factor rationales are gone.
- RIPPLES (why it's a planned change, not a quick edit):
  * Apollo prompt rebuild (formatGeminiSignals/buildDeepSeekUserMessage) — ENG-06 / plan 01-03.
  * Aggregator: gemini_score removed; Stage-10 gap (|gemini_score - behavioral_score|) needs new
    basis (apollo-vs-fold) or removal.
  * Board (Phase 2): Content-Analysis frame + impact-score `apollo: gemini_score` mislabel must
    re-source from Apollo. CROSS-PHASE — flag for Phase 2 BTEST.
  * version.ts bump 3.13.0 → 3.14.0 (output-shape change, cache invalidation).
  * Persisted rows: gemini_score/factor scores go empty; back-compat read for old permalinks.
- CONFIRMED dead code to delete alongside: applyCtaPenalty (defined, never called).
- CONFIRMED honesty bug to fix: impact-score.tsx:64 shows gemini_score labeled "Apollo".

## Step 5 — Fold ∥ Apollo (parallel pair)

### F17 — fold.ts header + D-08 bounds comments STALE; thinking budget is a no-op (medium)
Comments describe a qwen3.6-plus THINKING fold (budget 4000/8000). Reality: FOLD_MODEL=
qwen3.5-omni-plus, FOLD_USE_THINKING defaults false (omni doesn't think) → FOLD_THINKING_BUDGET
(1000) never applied in prod. Clean up comments; confirm we don't want thinking on the fold.

### F18 — fold has ZERO retry; single failure silently halves the score (HIGH — ENG-01)
Any fold failure (parse / timeout / one archetype segment-count mismatch) → fold_success=false →
score silently switches from 0.5·apollo+0.5·fold ENSEMBLE to apollo-only blend. Only a filtered
warning surfaces. RESEARCH ENG-01 option C: add ONE bounded retry (D-09 tolerates latency).

### F19 — diversity guard is warn-only; homogenized curves still drive 50% of score (medium — quality)
DIVERSITY_FLOOR=0.10 warn-only. The exact failure the "Critical Divergence Requirement" prompt
guards against still feeds 50% of overall_score ungated. Decide: gate / retry-nudge / accept.

### F20 — segment-count guard is all-or-nothing (medium — robustness)
One archetype with wrong reaction count kills the ENTIRE fold (all 10 dropped). Could salvage
valid personas instead.

### F21 — 90s hard ceiling, thin margin (low — latency/ENG-03)
A/B: budget=1000 → 89.9s. Long/dense video risks timeout → silent audience-half drop.

## Step 5b — Apollo deep-dive flags

### F22 — confidence "model agreement" is Apollo agreeing with ITSELF (HIGH — ENG-04)
calculateConfidence compares apollo_score vs behavioral_score; both come from the SAME
Apollo call → self-agreement, meaningless in video mode. Should be apollo-vs-fold.

### F23 — §-cites unvalidated (HIGH — ENG-02, plan 01-01)
lever/evidence/ceiling_capper free-text §-cites, no resolution check vs lean core.
Dangling: §2.6/§7/§8/§9. The 01-01 thread.

### F24 — component_scores[7] near-dead on video (medium — ENG-06/D-14)
Don't enter video overall (fold does), FeatureVector unscored, only feed self-agreement
confidence (F22). Drop on video like T3.3 behavioral_predictions; keep for text mode.

### F25 — 3-band rigid score (85/50/20) + hook 80% = coarse/hook-dominated (medium — quality)
Few distinguishable score levels; hook alone sets ~16/40/68 of 0-100. Verify spread on real
videos; consider finer bands.

### F26 — composite_score emitted then discarded (low — ENG-06)
Rubric-sum overwrites it; minor token/reasoning waste.

### F27 — Apollo input overlap (medium — ENG-06/D-12)
Sighted model also gets content_text + verbatim + segments + omni factor signals + 9-card
creator dump. Heavy redundant context. Trim (pairs D-R1 + F6).

### F28 — dual output-contract source (low — ENG-06)
APOLLO_INSTRUCTION (system) + JSON contract (user) both specify grading. Redundant, drift risk.

### F29 — credibility treated as equal body dim, corpus says bonus (low)
§4 says credibility "rewards, doesn't punish absence"; rubric-sum docks for weak/absent
credibility. Corpus mismatch.

### F30 — §-cites LEAK to the user-facing board (HIGH — ENG-02 reframe; Davide observed)
InsightHeroFrame renders dimension.lever / ceiling_capper as opaque strings → cryptic
"(§2.1)" tokens show to creators with no legend. Not just internal honesty — confusing
output on the happy path TODAY. Strengthens the REDESIGN option (structured lever taxonomy:
enum IDs + human-readable labels) over restore/remap (which keep the leak unless board strips).
Board render = Phase 2, but a redesign fixes engine + board + Phase 4 chat at the source.
EVIDENCE TO GATHER before 01-01 decision: (1) Davide's board screenshot, (2) faithful runtime
§-cite capture.

## Board evidence (real run run7lFjtb9IH, 2026-06-11) — sharpens ENG-02

### F31 — §-leak is PROSE-ONLY, not the dimension list (ENG-02 reframe, downgrades redesign)
Board renders Apollo ceiling_capper verbatim in the Insight lead: "...per §2.5, a vague topic
and non-contrarian take cannot achieve outlier performance...". Dimension Scores list renders
CLEAN names (Hook/Retention/Clarity/Share pull/Substance/Credibility) — NO § tokens. So the leak
is confined to free-prose fields (ceiling_capper, likely confidence_scope/suggestions), NOT lever.
→ Lighter fix beats redesign: (1) remap guard (validate §-cites resolve to lean core, strip/flag
danglers in lever/evidence), (2) prose discipline (instruct Apollo to keep § tokens OUT of
user-facing prose; cites stay only in auditable lever/evidence metadata). Redesign (enum lever IDs)
deferred unless Phase 4 chat wants the shared taxonomy. UPDATES 01-01 options.

### F32 — board "What drives it" renders Omni's 5 generic factors → D-R1 ripple confirmed visually
Score panel "WHAT DRIVES IT" = Completion Pull 9 / Scroll-Stop 8 / Share Trigger 8 / Rewatch 7 /
Emotional Charge 6 = Omni factor scores (the generic judgment D-R1 removes). When D-R1 lands this
board section must re-source (→ Apollo dimensions or drop). Concrete cross-phase ripple (Phase 2).

### F33 — Apollo measured ~92s and GATES the path; total 113s; over cost cap (ENG-03)
Logs: Apollo duration_ms 91834 (~92s) at thinking_budget 1500 — NOT the ~49s version.ts claims.
No fold line near it → Apollo gated the critical path; pipeline total 112753ms (~113s). Apollo cost
1.79c (over 1c soft cap); Read 0.255c; total 2.37c. RESEARCH A1 ("fold gates, ~70s E2E") is STALE
on this real 29s video — Apollo is the bottleneck. Measure-first before any ENG-03 latency claim.
Confidence rendered 0.75 HIGH — consistent with F22 self-agreement inflation (agreement term 0.4).

## Phase routing note
Phase 2 (Board/Test Mode) IS the UI/UX board phase in this milestone. Board-side ripples
route there, NOT Phase 1: F31 (§-prose render strip), F32 (re-source "What drives it" off
Apollo dims after D-R1), impact-score apollo-mislabel. Phase 1 engine just emits honest+clean
data; Phase 2 owns display.

## Step 6 — aggregator: score assembly + honesty tail

### F34 — Stage-10 "critique" is deterministic TS, basis dies with D-R1 (medium — ENG-04)
stage10_critique ms:0 (not an LLM). Nudges confidence via |gemini_score - behavioral_score|.
D-R1 removes gemini_score → gap basis dies. Re-base on apollo-vs-fold (also fixes F22) or retire
Stage-10. Question whether a heuristic named "critique" earns its keep.

### F35 — dead constants persisted on every PredictionResult (low — honesty)
rule_score:50, trend_score:0, ml_score:0, platform_fit:null, audio_fingerprint:null — leftover
from stripped stages. Prune from type or mark dead; cross-check Phase 2 doesn't render as real.

### Stage-6 note — all latency is in the 3 LLM calls
Aggregation = 2ms; Stage-10 = 0ms; full tail trivial. ENG-03 work targets the calls (Apollo F33),
not the aggregator. "Honest banding" (ENG-04) = F22 + F25 + F18 + F34 together, not one fix.

## Stage 6 OUTPUT→DISPLAY→VALUE audit (UX/value lens; shapes engine output contract + Phase 2)

### F36 — THREE parallel scorecards for one video (HIGH — value/trust)
User sees the same video graded 3 ways: (1) Omni 5 factors ("What drives it"), (2) Apollo 6
dimensions (Insight), (3) Creator Rulebook 7/11 (Hoyos/Ava/Hormozi). Plus 4 intents shown TWICE
(Input + Score). ~26 numbers / 3 frameworks that DON'T agree (Omni hook 8/10 "strong" vs Apollo
Hook 50 "Mid") → user can't tell which is real → erodes trust. Collapse to ONE canonical framework
(Apollo dims = moat; D-R1 kills Omni factors; DECIDE Rulebook fate: reconcile into Apollo or demote
to opt-in deep-dive). Engine-output-contract decision + Phase 2 display.

### F37 — the MOAT (Apollo insight) is buried at board bottom (HIGH — value)
ceiling_capper "the ONE thing capping you + the fix" is the most valuable output but sits below
3 scorecards, and its lead leaks §2.5. Engine should emit a clean first-class HERO INSIGHT + single
#1 FIX (not buried in ceiling_capper prose). Inverts the Apollo north star (insight hero, score
demoted) — board currently does the opposite. → Phase 2 promotes it; Phase 1 emits it cleanly.

### F38 — engine jargon + redundancy shown to user (medium — UX)
"11 of 17 signals" (Engine panel) = transparency theater, ~zero user value. 4 behavioral intents
duplicated (Input + Score panels). Cut jargon; de-dup.

### F39 — monetization value-gap (product — flag)
Core value promise = "connects creators to monetization." Board shows NONE. Likely own phase/
backlog, but named so it's not lost.

### User-perspective summary (for Phase 2 progressive disclosure)
- Novice: wants 1 verdict + 1 fix + when-to-post; gets 26 numbers/3 frameworks → overwhelm.
- Pro: wants retention curve + persona drop-off (strong) in ONE framework, not three.
- Skeptic: killed by redundancy + §-leak + jargon + self-graded confidence (F22); honest 44-56
  band is the one win.
- Default = verdict + #1 fix + post-time; expand → dimensions / retention / personas (tabs exist).

## Stage 6 SECOND-PASS audit (output contract → value; verified vs consumers/persistence)

### F40 — projected-views (the #1 creator question) intentionally absent → value vacuum (HIGH strategic)
VerdictNode.tsx:283-288 CUT the "projected views" block: predicted_engagement = followers×(score/100)²
×0.20 is a score transform, not a real view model → honestly refused. Correct honesty, but leaves the
biggest creator question ("how many views?") unanswered. Filling it honestly = a GROUNDED OUTCOME MODEL
(corpus/learning, currently DEFERRED per apollo-direction). Biggest single value lever in the product;
decide consciously, don't leave silently parked. Engine computes a range, hides (board) AND drops it
(not persisted) — wasted.

### F41 — "Verdict" tab shows the SCORE, not the verdict (medium — IA/UX)
Nav "Verdict" = VerdictNode = virality score + confidence + distribution. The actual expert verdict
(Apollo ceiling_capper + #1 fix + rewrites) is a separate Insight panel at the bottom. Tab label ≠
content. Compounds F37 (moat buried). Phase 2 IA, but engine should emit a clean hero-insight field.

### F42 — permalink/shared board shows LESS than live run (medium — value/virality)
predicted_engagement live-only; anything absent from buildInsertRow vanishes on reload. Shared/saved
boards degrade vs live. Persist everything the board shows, or consciously accept the gap.

### F43 — output bloat: ~40 PredictionResult fields, ~10 create value (medium — ENG-06/D-14)
Dead tail emitted/persisted every run: reasoning="" (ALWAYS empty), rule_score:50/trend_score:0/
ml_score:0, feature_vector (persisted, never scored — offline only), audio_fingerprint/platform_fit
null, score_weights 6 dead keys, gemini_score (D-R1), behavioral_score (near-dead video). Prune the
contract: less compute/persist/maintenance + stops dead numbers leaking to UI as meaningful.

### F44 — trust anchor doubly soft (medium — ENG-04/trust)
Headline confidence is self-graded (F22 apollo-vs-itself) AND the displayed "· likely lo–hi" band is
board-derived from that same soft number. The skeptic's key trust signal is the least grounded thing
on screen. Fix F22 (apollo-vs-fold) first.

### F45 — score "/100" is false precision vs 3-band engine (low-medium — honesty)
3-band anchors (20/50/85) + hook-80% (F25) → ~9 distinct values, but UI shows X/100. Tier
("Solid contender") + distribution histogram are honest; the /100 overstates resolution. Lead tier,
demote raw number.

### OUTPUT-CONTRACT THESIS (Phase 1 deliverable shape)
Value concentrates in 3 outputs: (1) moment retention drop + reason, (2) persona who-leaves sim,
(3) Apollo ceiling insight + verbatim rewrites — plus the honest score band. Phase 1 output contract:
emit ONE framework (Apollo dims) + first-class hero insight + #1 fix; prune dead tail (F43, D-R1);
make confidence real (F22); persist what's shown (F42); name the grounded-outcome model (F40) as the
deferred top value lever. Carryover: single-signal death (F18) still silent — surface it.

## VALUE VISION — the "wow cheatcode" hero outputs (capstone; drives output contract)

Cheatcode feeling = certainty + specificity + done-for-you, BEFORE posting. Oracle, not dashboard.
Wow lands in first 3s of the result; depth on demand. Five hero outputs:

1. "I see the exact second you lose them + why" — moment retention drop + reason, simulated across
   10 archetypes pre-post. MOST differentiated output. Source: Fold + heatmap. HAVE IT → make it the
   SPINE. Guard: F18/F20 (never silently vanish; retry + salvage).
2. "The one thing capping you — already fixed" — Apollo ceiling + #1 verbatim-grounded rewrite in
   creator's voice. Cheatcode = the FIX handed over, not the critique. HAVE IT but buried/§-leaked/
   competing with 2 scorecards → promote, strip §, kill redundant scorecards (D-R1/F36/F37).
3. "Post this, you'll likely land HERE" — grounded outcome/views range. THE ultimate cheatcode + #1
   creator question. ABSENT (F40, correctly cut as fake score-transform). Wow only if REAL corpus/
   learning model. DEFERRED → highest-ceiling value lever. Honest band, never fake precision.
4. "Who it's for / who bounces" — persona who-stays/leaves = audience fit, not just a score. HAVE IT
   (bubbles) → convert to plain-language verdict.
5. "Don't post yet / Post it, Tue 7pm" — go/no-go + when. HAVE signals (anti_virality + optimal_post)
   → surface as confident verdict, not buried flag.

What turns 5 good outputs into a CHEATCODE:
- One confident verdict first, depth on demand (oracle not dashboard).
- Specificity = authority under honest uncertainty (true specifics win; band the score, drop /100).
- The ITERATE loop is the real edge: test → fix → re-score variant before posting (Remix/test, Ph 2/3).
- It compounds: learns creator style + tracks real outcomes (closes #3's outcome model).

Engine output contract to enable it:
- First-class HERO block: { verdict_line, ceiling, the_one_fix(rewrite), go_no_go, post_window } —
  not buried in ceiling_capper prose.
- moment-drop+reason and persona who-leaves as clean plain-language fields.
- ONE craft framework (Apollo dims), dead tail pruned (F43), REAL confidence (F22), § internal (F31).
- grounded outcome range (#3 deferred model) = top value bet.
THROUGHLINE: engine already produces 3 of 5 cheatcode outputs; it buries them under generic
scorecards and withholds the one creators want most. Job = emit LESS, lead with the moat, honestly
build the outcome model.

## Step 1 — request entry → route gauntlet → pipeline Stage 1/2

### F1 — Input Zod-parsed twice (low)
INFRA-04 manual checks + route `AnalysisInputSchema.parse` (route.ts:559), then
pipeline Stage 1 re-parses (pipeline.ts:320). Harmless redundancy; pipeline can't
trust caller. Leave unless we want to drop the pipeline re-parse for callers that
already validated.

### F2 — `computeContentHash` falls back to `content_text` for video_upload (medium)
Route doesn't hold the video bytes (route.ts:603-605), so an uploaded video's cache
key derives from the CAPTION text, not the video. Two different videos with the
same/empty caption could collide on the cache key. Probe: confirm hash inputs +
whether storage_path/bytes should factor in. ENG-01 / cache correctness.

### F3 — hashtag extraction is dead signal (medium — ENG-06/D-14 prune candidate)
`extractHashtags(content_text)` (normalize.ts:60) only parses `#word` from pasted
text — never the video. video_upload + tiktok_url almost always → `[]`. Lands only
in `FeatureVector.hashtagCount` (aggregator.ts:422); siblings already dead
(`hashtagRelevance = trendEnrichment.hashtag_relevance` hardcoded 0; `captionScore`
hardcoded 0). FeatureVector persisted but NOT scored (ml.ts dormant). Corpus doesn't
score hashtags. **Drop candidate.** Davide's instinct: hashtags add ~nothing for
video/url; even real scraped tags are noisy.

### F4 — tiktok_url uses billable Apify actor; free alternatives are fragile (medium — infra/backlog)
`apify-provider.ts:161` resolveVideoUrl = one billable actor run per analyze (bounded
by daily-limit guard). Free options: yt-dlp (needs self-hosted service, not Vercel
serverless; TikTok obfuscation + IP-block risk) or public APIs (tikwm/ssstik — no SLA,
fragile, 3rd-party leak). RECOMMENDATION: keep Apify for MVP (reliable, SSRF-controlled,
no leak); backlog a yt-dlp microservice spike IF volume/cost grows; do NOT use public
free APIs in prod. This is ingestion (adjacent to engine; ENG-01 stability touches it).

### F5 — creator_profiles read twice + dead fetch (low — ENG-06)
Route SELECTs 3 cols (route.ts:500); pipeline fetchCreatorContext SELECTs ~18 cols by
handle (creator.ts:170) → two round-trips to same table, consolidatable. `display_name`
selected but never rendered in formatCreatorContext = dead fetch.

### F6 — full 9-card creator profile dumped into Apollo prompt, unreviewed (medium — ENG-06/D-12)
formatCreatorContext renders target_platforms/niche/target_audience/primary_goal/
creator_stage/content_style/cuts_per_second/reference_creators/past_wins/past_flops/
time_of_day_aware/pain_points into the Apollo creator_context string. Creator data is
CONTEXT-ONLY (creator.ts:131) — does NOT touch the score; only follower_count → engagement
range computes. ENG-06 co-review: does Apollo actually USE these fields well, or is it
prompt bloat / token cost? (pain_points + reference_creators are user free-text, correctly
wrapped in <<<USER_CONTENT>>> anti-injection sentinels.)

DAVIDE NOTE (product): the 9-card creator interview is TOO LONG — optimize/trim it.
Two-sided: (a) UX — shorten onboarding (fewer/smarter cards); (b) engine — only feed
Apollo the fields that demonstrably move the assessment. Pair the onboarding trim with
the ENG-06 "which fields does Apollo actually use" audit so we cut collection AND prompt
bloat from the same evidence. (Onboarding UX likely Phase 5 / separate; engine-side
field prune is ENG-06 here.)
