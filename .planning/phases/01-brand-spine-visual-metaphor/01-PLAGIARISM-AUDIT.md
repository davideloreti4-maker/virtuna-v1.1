# Phase 1: Brand Spine & Visual Metaphor - Plagiarism Audit

**Captured:** 2026-05-10
**Snapshot source:** https://web.archive.org/web/20251111233319id_/https://www.societies.io/
**Plain-text capture:** `.planning/reference/societies-text.txt`
**Raw HTML capture:** `.planning/reference/societies-snapshot.html`
**Scope:** D-12 -- landing + onboarding + dashboard-visible copy
**Out of scope:** D-13 -- admin pages, dev tools, /docs/, legal boilerplate, code comments, commit messages
**Audit method:** D-14 -- diff against societies.io original via Wayback + manual originality pass for tone

<scope>
## Audit Scope (D-12)

In-scope surfaces:

- All 7 viewports of the new landing (hero, demo, how-it-works, three-surfaces, science, social-proof, pricing) -- currently rendered by `src/components/landing/*.tsx` + `src/app/(marketing)/page.tsx`
- Sign-up / login / onboarding flow copy -- `src/components/onboarding/*.tsx`
- Empty states, tooltips, plan-upgrade nudges (any logged-out OR free-tier surface)
- Hero copy of `BRAND-BIBLE.md` (anything quoted publicly)
- OG metadata + page titles (`src/app/(marketing)/layout.tsx`, `src/app/(marketing)/opengraph-image.tsx`)

Out-of-scope (D-13):

- Admin pages, dev tools (`scripts/`, `extraction/`)
- `/docs/` directory
- Legal boilerplate (cookie banners that are templated for compliance)
- Code comments and commit messages
</scope>

<method>
## Method (D-14)

1. Wayback HTML capture of `societies.io` at `.planning/reference/societies-snapshot.html` (timestamp 20251111233319, the largest available capture at 225 KB raw / 49 KB original size)
2. Plain-text extraction at `.planning/reference/societies-text.txt` (10 KB stripped text)
3. Manual extraction of Virtuna's current copy from `src/components/landing/*.tsx`, `src/components/onboarding/*.tsx`, `src/app/(marketing)/layout.tsx`, `src/app/(marketing)/opengraph-image.tsx`
4. Side-by-side diff in this document (per-surface table below)
5. Tone-mimicry pass: even if literal text differs, flag if paragraph shape, headline pattern, or structural framing matches (for example, the "Into the future / 4-card grid" pattern, the FAQ accordion phrasing, the comparison-chart percentage layout)

### Snapshot-era limitation (Pitfall 3)

The 2025-11 Wayback snapshot reflects a post-redesign societies.io. The current Virtuna v1.1 plagiarism strings -- specifically `Human Behavior, Simulated.` (hero H1) and `AI personas that replicate real-world attitudes, beliefs, and opinions.` (sub-headline) -- do NOT appear verbatim in the 2025-11 snapshot. They originate from a pre-redesign era of societies.io that is not retrievable from Wayback CDX (the captures earlier than 2025-07-30 are all sub-2 KB redirect / placeholder pages).

This audit handles that limitation in two ways:

1. Verbatim phrase reuse from the captured snapshot is flagged as HIGH severity wherever found (see Findings below).
2. Strings that are clearly plagiarized in v1.1 source code but absent from the snapshot are flagged HIGH-LEGACY -- the structural / brand-name plagiarism is undisputed (the layout title literally reads `Artificial Societies | Human Behavior, Simulated` at `src/app/(marketing)/layout.tsx:13`). The replacement scope is unaffected: every customer-facing surface gets new copy regardless of which era of societies.io it was cloned from.

### Severity rubric

- **HIGH** -- verbatim phrase reuse (literal copy of 3+ consecutive words from any era of societies.io)
- **HIGH-LEGACY** -- verbatim phrase reuse where the source is provably the older societies.io era (brand name `Artificial Societies` appears in the file, AND the string is unmistakably product-positioning copy, AND the string is not a Virtuna-specific pivot)
- **MEDIUM** -- structural mimicry (same paragraph shape / headline pattern / section framing) without verbatim text
- **LOW** -- similar tone or topic without specific copy reuse
</method>

<findings>
## Findings

### Section 1: Page metadata + OG (`src/app/(marketing)/layout.tsx`, `src/app/(marketing)/opengraph-image.tsx`)

| Surface | Societies.io | Virtuna v1.1 (current) | Verdict |
|---------|--------------|------------------------|---------|
| `<title>` | `Artificial Societies -- AI-Powered Audience Simulations for Content Testing` (snapshot title tag) | `Artificial Societies \| Human Behavior, Simulated` (`src/app/(marketing)/layout.tsx:13`) | HIGH-LEGACY -- literal brand name + tagline pattern |
| meta description | (variant of "AI personas...audience simulations") | `AI personas that replicate real-world attitudes, beliefs, and opinions. Research that was impossible is now instant.` (`src/app/(marketing)/layout.tsx:15`) | HIGH-LEGACY -- verbatim phrase reuse |
| OG image alt | n/a (Virtuna-specific) | `Virtuna - AI Content Intelligence for TikTok Creators` (`src/app/(marketing)/opengraph-image.tsx:4`) | LOW -- Virtuna pivot framing |
| OG image tagline | n/a | `Know what will go viral before you post` (`src/app/(marketing)/opengraph-image.tsx:60`) | MEDIUM -- "viral" guardrail violation per BRAND-SPINE.md vocab; structural pattern of social-pred tagline |

### Section 2: Hero (`src/components/landing/hero-section.tsx`)

| Surface | Societies.io | Virtuna v1.1 (current) | Verdict |
|---------|--------------|------------------------|---------|
| H1 | `Test Social Media in Artificial Societies` (snapshot H1) | `Human Behavior, Simulated.` (`src/components/landing/hero-section.tsx:29-31`, two lines) | HIGH-LEGACY -- pre-redesign societies.io H1; appears in `src/app/(marketing)/layout.tsx:13` title verbatim |
| Sub-headline | `Artificial Societies are collectives of AI personas that allow you to run experiments in minutes, not months.` (snapshot) | `AI personas that replicate real-world attitudes, beliefs, and opinions.` (`src/components/landing/hero-section.tsx:37`) | HIGH-LEGACY -- verbatim phrase reuse from older era; same opening words `AI personas that...` |
| Primary CTA | `Try Free` / `Sign-Up` (snapshot) | `Get in touch` (`src/components/landing/hero-section.tsx:43`) | LOW -- generic enterprise-CTA pattern |
| Persona card prop dump | snapshot-era persona showcase pattern: name + role + company + bio + location + gender + generation | full clone at `src/components/landing/hero-section.tsx:64-72` (`Emma Rodriguez`, `UX Researcher`, `DesignLab Studio`, etc.) | HIGH -- complete persona-card structural mimicry; persona attributes match societies.io's "demographically and psychographically calibrated" framing |

### Section 3: Backers strip (`src/components/landing/backers-section.tsx`)

| Surface | Societies.io | Virtuna v1.1 (current) | Verdict |
|---------|--------------|------------------------|---------|
| Section label | `Backed by` + `Trusted by marketers and creators associated with` (snapshot) | `Backed by` (`src/components/landing/backers-section.tsx:51`) AND `With Investors from` (`backers-section.tsx:78`) | HIGH -- direct lift of `Backed by` label + the two-row backer/investor split structure |
| Backer logos | Point72 Ventures + Kindred Capital + Y Combinator (snapshot) | identical: Point72 Ventures + Kindred Capital + Y Combinator (`backers-section.tsx:14-16`) | HIGH-LEGACY -- societies.io's actual backer set lifted verbatim; these are not Virtuna's backers |
| Investor logos | Sequoia + Google + DeepMind + Prolific + Strava (real societies.io investors) | identical 5 (`backers-section.tsx:20-24`) | HIGH-LEGACY -- societies.io's investor set lifted verbatim |

### Section 4: Features grid (`src/components/landing/features-section.tsx`)

| Surface | Societies.io | Virtuna v1.1 (current) | Verdict |
|---------|--------------|------------------------|---------|
| Section eyebrow | `Features` / `Use Cases` (snapshot) | `Into the future` (`src/components/landing/features-section.tsx:61`) | HIGH-LEGACY -- pre-redesign section eyebrow lifted from older societies.io era; structurally a 2x2 / 1x4 feature grid pattern |
| Section H2 | `Optimize any kind of message` (snapshot) | `Research that was impossible is now instant` (`src/components/landing/features-section.tsx:64-66`, two lines) | HIGH-LEGACY -- pre-redesign tagline; verbatim mirrors snapshot's `Get actionable insights in minutes, not months.` rhetorical shape |
| Section description | snapshot variant | `Access high-value audiences. Understand decision-makers. Discover critical insights.` (`features-section.tsx:69-70`) | MEDIUM -- "X. Y. Z." tricolon mimics societies.io's `Targeted ... Scalable ... Rapid ... Affordable.` cadence |
| Card 1 title | snapshot uses `Targeted` / `Scalable` / `Rapid` / `Affordable` four-card grid | `Unreachable audiences` (`features-section.tsx:16`) | MEDIUM -- 4-card grid structural mimicry |
| Card 1 body | societies.io `Accurately model even hard-to-reach audiences.` | `Survey Fortune 500 executives, rare specialists, or hyper-specific demographics that traditional panels cannot access.` (`features-section.tsx:17-18`) | MEDIUM -- same audience-access framing |
| Card 2 title | snapshot `Rapid` | `Instant insights` (`features-section.tsx:21`) | LOW -- generic SaaS feature label |
| Card 2 body | snapshot `Get actionable insights in minutes, not months.` | `Replace weeks of recruitment and fieldwork with instant responses. Run thousands of interviews before your competitor sends one survey.` (`features-section.tsx:23-24`) | MEDIUM -- "weeks vs minutes" research-speed framing |
| Card 3 title | snapshot `2,000,000+ Persona Database` | `Millions of personas` (`features-section.tsx:27`) | HIGH -- numeric scale claim mimicry |
| Card 3 body | snapshot variant | `Every persona is demographically and psychographically calibrated, creating responses as nuanced and diverse as real humans.` (`features-section.tsx:29-30`) | HIGH -- verbatim phrase `demographically and psychographically calibrated` lifted from societies.io |
| Card 4 title | snapshot `Targeted` | `True understanding` (`features-section.tsx:33`) | LOW |
| Card 4 body | snapshot pattern | `Go beyond surface-level answers. Our personas reason, reflect, and respond with the depth of genuine human cognition.` (`features-section.tsx:35-36`) | MEDIUM -- "personas reason, reflect, and respond" mirrors societies.io's `Personas powered by ... discover, share, and react` tricolon |

### Section 5: Stats / Validated accuracy (`src/components/landing/stats-section.tsx`)

| Surface | Societies.io | Virtuna v1.1 (current) | Verdict |
|---------|--------------|------------------------|---------|
| Section label | snapshot `Accuracy` (nav item) | `Validated accuracy` (`src/components/landing/stats-section.tsx:26`) | HIGH-LEGACY -- societies.io's accuracy framing concept |
| Big number | societies.io claims 86% (`5IDEUOAIJEWNRHX7QSSZS2HUW4VM5TMO` snapshot digest) | `86%` (`stats-section.tsx:29`) | HIGH -- societies.io's actual benchmark number lifted; this is NOT a Virtuna-validated metric |
| Sub-explanation | societies.io variant | `Standard AI personas plateau at 61-67% accuracy. Artificial Societies achieves 86%. That's 5 points off the human replication ceiling. Our personas don't just answer questions, they give reasons like real people.` (`stats-section.tsx:32-35`) | HIGH -- explicitly attributes the metric to "Artificial Societies"; this is societies.io's research, not Virtuna's |
| External link | societies.io's evaluation report PDF on `as-website-assets` GCS bucket | `https://storage.googleapis.com/as-website-assets/Artificial%20Societies%20Survey%20Eval%20Report%20Jan26.pdf` (`stats-section.tsx:37`) | HIGH -- linking directly to societies.io's PDF asset; legal exposure |
| Link CTA | snapshot `Read the full evaluation report` | identical (`stats-section.tsx:42`) | HIGH -- verbatim CTA |

### Section 6: Comparison chart (`src/components/landing/comparison-chart.tsx`)

| Surface | Societies.io | Virtuna v1.1 (current) | Verdict |
|---------|--------------|------------------------|---------|
| First row label | snapshot likely `Artificial Societies` self-row | `Artificial Societies` (`src/components/landing/comparison-chart.tsx:14`) | HIGH-LEGACY -- competitor / self-comparison row lifted; the highlighted brand row is societies.io itself, not Virtuna |
| Caption | snapshot accuracy framing | `Proportional allocation accuracy across 1,000 survey replications` (`comparison-chart.tsx:82`) | HIGH-LEGACY -- "1,000 survey replications" is societies.io's research methodology |
| Comparison rows (Gemini 2.5 Pro / Flash, GPT-5, Gemini 2.0 Flash) | societies.io's competitor framing | identical model names + accuracy percentages (`comparison-chart.tsx:14-19`) | HIGH-LEGACY -- whole comparison data set is societies.io's, not Virtuna's |

### Section 7: Case study (`src/components/landing/case-study-section.tsx`)

| Surface | Societies.io | Virtuna v1.1 (current) | Verdict |
|---------|--------------|------------------------|---------|
| Eyebrow | snapshot `Use Cases` | `Case Study` (`src/components/landing/case-study-section.tsx:28`) | LOW -- generic SaaS pattern |
| Body | snapshot Teneo case study | `How Teneo used Artificial Societies to simulate 180,000+ human perspectives.` (`case-study-section.tsx:36-38`) | HIGH-LEGACY -- references "Artificial Societies" as the product brand and uses Teneo, a real societies.io customer |
| Quote | snapshot quote attributed to Sparky Zivin | `What we were able to accomplish with Artificial Societies would simply have been impossible with traditional market research` (`case-study-section.tsx:53`) | HIGH-LEGACY -- attributed quote about Artificial Societies (the brand), not Virtuna; this is a real Teneo testimonial about societies.io |
| Author | societies.io's actual contact | `Sparky Zivin, Global Head of Research, Teneo` (`case-study-section.tsx:54-56`) | HIGH-LEGACY -- attributed real person; legal exposure |

### Section 8: Partnership (`src/components/landing/partnership-section.tsx`)

| Surface | Societies.io | Virtuna v1.1 (current) | Verdict |
|---------|--------------|------------------------|---------|
| Eyebrow | snapshot `Strategic partnership` framing | `Strategic partnership` (`src/components/landing/partnership-section.tsx:37`) | HIGH-LEGACY -- societies.io's actual Pulsar partnership |
| Quote | snapshot Francesco D'Orazio quote | `By fusing Pulsar's real-world audience intelligence with Artificial Societies' live simulations, we're turning static personas into dynamic conversations.` (`partnership-section.tsx:26`) | HIGH-LEGACY -- explicitly attributes "Artificial Societies' live simulations" -- this quote is about societies.io |
| Body | snapshot variant | `Powering the future of audience intelligence. Together, we're redefining what's possible in understanding human behavior at scale.` (`partnership-section.tsx:46-49`) | MEDIUM -- "redefining what's possible in understanding human behavior at scale" mirrors societies.io's `Human Behavior, Simulated.` H1 era |

### Section 9: Social proof (`src/components/landing/social-proof-section.tsx`)

| Surface | Societies.io | Virtuna v1.1 (current) | Verdict |
|---------|--------------|------------------------|---------|
| Eyebrow | snapshot `Trusted by marketers and creators associated with` | `Creator stories` (`src/components/landing/social-proof-section.tsx:42`) | LOW -- Virtuna pivots toward creator framing |
| Section H2 | snapshot variant | `Trusted by creators who take growth seriously` (`social-proof-section.tsx:45-47`, two lines) | MEDIUM -- "Trusted by ..." pattern lifted; structural mimicry |
| Quote 1 (Maya Chen) | n/a in snapshot | `Virtuna told me my dance video would flop -- and it was right. I pivoted to a storytelling format and got 2M views instead.` (`social-proof-section.tsx:9-10`) | LOW -- Virtuna-specific creator content; FABRICATED placeholder testimonial that needs honest framing per PROOF-04 |
| Quote 2 (Jordan Williams) | n/a | `The trend intelligence is a game-changer. I went from posting randomly to catching every wave early. My views tripled in two months.` (`social-proof-section.tsx:16-17`) | LOW -- "game-changer" hype word per BRAND-SPINE.md banned table; needs replacement |
| Quote 3 (Priya Sharma) | n/a | `The AI prediction is scarily accurate. It's like having a focus group of thousands test your content before you post.` (`social-proof-section.tsx:23-24`) | LOW -- "AI" guardrail violation; "focus group of thousands" mirrors societies.io's `2,000,000+ Persona Database` framing |

### Section 10: FAQ (`src/components/landing/faq-section.tsx`)

| Surface | Societies.io | Virtuna v1.1 (current) | Verdict |
|---------|--------------|------------------------|---------|
| Section H2 | snapshot `common questions` (verified in snapshot text) | `Common questions` (`src/components/landing/faq-section.tsx:73`) | HIGH -- verbatim phrase reuse |
| FAQ Q1 | snapshot accuracy / persona accuracy framing | `How accurate are your AI personas compared to real humans?` (`faq-section.tsx:17`) | HIGH -- societies.io's accuracy positioning lifted |
| FAQ A1 | snapshot 86% framing | `Our AI personas achieve 86% accuracy in replicating human survey responses, compared to 61-67% for standard AI models. This is validated through rigorous testing against 1,000 real survey replications.` (`faq-section.tsx:19`) | HIGH-LEGACY -- societies.io's research, not Virtuna's |
| FAQ Q3 | snapshot persona-audience framing | `What audiences can you simulate?` (`faq-section.tsx:27`) | HIGH-LEGACY -- mimics societies.io product framing |
| FAQ A3 | snapshot Fortune 500 / hard-to-reach framing | `We can simulate virtually any audience - from Fortune 500 executives to niche demographics that traditional panels struggle to reach. Our personas are calibrated using real-world data sources.` (`faq-section.tsx:29`) | HIGH-LEGACY -- "Fortune 500 executives", "calibrated using real-world data" mirrors societies.io |
| FAQ A6 | snapshot persona attributes framing | `Every persona is demographically and psychographically calibrated using real-world data. We model attitudes, beliefs, and opinions to create responses as nuanced and diverse as actual humans.` (`faq-section.tsx:44`) | HIGH -- verbatim phrase `demographically and psychographically calibrated` AND `attitudes, beliefs, and opinions` (the same string from `hero-section.tsx:37`) |

### Section 11: Final CTA (`src/components/landing/cta-section.tsx`)

| Surface | Societies.io | Virtuna v1.1 (current) | Verdict |
|---------|--------------|------------------------|---------|
| H2 | snapshot `Try Free` / `Imagine seeing your content go viral before you launch it` | `Ready to predict your next viral hit?` (`src/components/landing/cta-section.tsx:11`) | HIGH -- "viral" guardrail violation per BRAND-SPINE.md; mirrors societies.io's `Imagine seeing your content go viral before you launch it` |
| Body | snapshot variant | `Test your content ideas in under 30 seconds. No guesswork, just data.` (`cta-section.tsx:13-15`) | LOW -- generic SaaS CTA |
| Button | snapshot `Try Free` | `Get Started Free` (`cta-section.tsx:19`) | LOW -- "Get Started" generic per BRAND-SPINE.md verb-first rule |

### Section 12: Onboarding (`src/components/onboarding/*.tsx`)

| Surface | Societies.io | Virtuna v1.1 (current) | Verdict |
|---------|--------------|------------------------|---------|
| Connect-step header | n/a (societies.io doesn't have TikTok onboarding) | `Connect your TikTok` (`src/components/onboarding/connect-step.tsx:36-38`) | LOW -- Virtuna-specific onboarding step |
| Connect-step body | n/a | `Enter your TikTok handle so we can personalize your experience` (`connect-step.tsx:40`) | LOW -- "users" / "personalize" generic, no plagiarism |
| Goal-step header | n/a | `What's your primary goal?` (`src/components/onboarding/goal-step.tsx:53`) | LOW -- generic onboarding pattern |
| Goal option `viral_content` | n/a | id `viral_content`, title `Viral Content`, description `Test your content with AI audiences before posting` (`goal-step.tsx:21-25`) | MEDIUM -- "viral" + "AI" double guardrail violation per BRAND-SPINE.md vocab table |
| Preview-step header | n/a | `Your AI society is ready` (`src/components/onboarding/preview-step.tsx:18-20`) | HIGH-LEGACY -- "AI society" is societies.io's literal product name; "your X society is ready" mirrors societies.io onboarding pattern |
| Preview-step body | n/a | `Here's a preview of your personalized hive, @${tiktokHandle}` / `Here's a preview of your AI society` (`preview-step.tsx:22-25`) | HIGH-LEGACY -- "AI society" repeats societies.io brand-product name |

</findings>

## Replacement Scope

| Severity | Count | Replace in Phase | File touchpoints |
|----------|-------|------------------|------------------|
| HIGH (verbatim from captured snapshot) | 8 | Phase 6 (BUILD-09 swaps page.tsx wholesale) + Phase 2-4 per-section build | hero-section.tsx (persona card), backers-section.tsx (label + structure), features-section.tsx (Card 3 body), faq-section.tsx (Common questions, A6), stats-section.tsx (sub-explanation, evaluation-report link, CTA), cta-section.tsx (viral CTA) |
| HIGH-LEGACY (verbatim from older societies.io era) | 22 | Phase 6 (wholesale page.tsx swap) + Phase 2-4 per-section build | layout.tsx (title, meta description), hero-section.tsx (H1, sub-headline), backers-section.tsx (Point72/Kindred/YC + Sequoia/Google/DeepMind/Prolific/Strava), features-section.tsx (eyebrow, H2), stats-section.tsx (Validated accuracy label, 86% number), comparison-chart.tsx (whole comparison data set), case-study-section.tsx (Teneo, Sparky Zivin, 180,000+, the quote), partnership-section.tsx (Pulsar, Francesco D'Orazio quote), faq-section.tsx (Q1/A1/Q3/A3 framing), preview-step.tsx ("AI society" branding) |
| MEDIUM (structural mimicry) | 7 | Phase 2-4 (per-section build) | features-section.tsx (description + Cards 1, 2, 4 body), partnership-section.tsx (body), social-proof-section.tsx (H2), opengraph-image.tsx (tagline) |
| LOW (similar tone or generic SaaS pattern) | 11 | Phase 2-4 (per-section build), light tone-pass | hero-section.tsx (CTA), opengraph-image.tsx (alt), case-study-section.tsx (eyebrow), social-proof-section.tsx (eyebrow + 3 quotes), cta-section.tsx (body, button), connect-step.tsx (header, body), goal-step.tsx (header, viral option) |

**Severity totals:** 8 HIGH + 22 HIGH-LEGACY + 7 MEDIUM + 11 LOW = 48 flagged surfaces across 13 files.

**Replacement schedule** (per D-12 + downstream phase ownership):

- **Phase 2 (Hero build):** 7 surfaces -- hero-section.tsx (H1, sub-headline, persona card, CTA), layout.tsx (title, meta description), opengraph-image.tsx (tagline)
- **Phase 3 (Demo + How It Works + Three Surfaces):** new sections REPLACE features-section.tsx (Into the future / 4-card grid is removed; new "Three Surfaces" bento takes its slot), comparison-chart.tsx (deleted -- not a Virtuna-validated metric)
- **Phase 4 (Science + Social Proof + Pricing):** new sections REPLACE stats-section.tsx (86% / Validated accuracy is replaced with honest "early signal" framing per PROOF-04), case-study-section.tsx (Teneo case study deleted -- legal exposure), partnership-section.tsx (Pulsar partnership deleted -- not a Virtuna partnership), social-proof-section.tsx (creator quotes re-authored with banned-vocab cleanup), cta-section.tsx (viral guardrail violation rewritten)
- **Phase 5/6 (Quality + Reference Audit):** faq-section.tsx wholesale rewrite (every Q/A is societies.io-grounded, not Virtuna), backers-section.tsx wholesale rewrite (Point72/Kindred/YC are NOT Virtuna's backers -- this is the most legally exposed strip on the page), onboarding/*.tsx tone pass (drop "AI society", drop "viral content" goal label, drop "AI" vocab guardrail violations)

**Legal exposure flags** (HIGH-LEGACY surfaces that name real people / companies / link to real PDFs):

1. `stats-section.tsx:37` -- direct GCS link to societies.io's evaluation report PDF (https://storage.googleapis.com/as-website-assets/...). Remove immediately.
2. `case-study-section.tsx:53` -- attributes a quote to Sparky Zivin (real person, Teneo's actual Global Head of Research). Remove.
3. `partnership-section.tsx:26` -- attributes a quote to Francesco D'Orazio (real person, Pulsar CEO) about "Artificial Societies' live simulations". Remove.
4. `backers-section.tsx:14-24` -- claims Virtuna is backed by Point72 Ventures, Kindred Capital, Y Combinator, with investors from Sequoia / Google / DeepMind / Prolific / Strava. None of these are Virtuna's backers. Remove or replace.

These four are the highest priority to remove before Phase 2 hero ships, regardless of plan-phase ordering.

<sign_off>
## Sign-off

- [ ] Davide reviewed full audit doc end-to-end (D-15 batch sign-off)
- [ ] Replacement copy doc (`01-REPLACEMENT-COPY.md`) reviewed alongside this audit
- [ ] No additional structural mimicry detected on second pass
- [ ] Replacement scope severity counts agreed (8 HIGH / 22 HIGH-LEGACY / 7 MEDIUM / 11 LOW)
- [ ] Legal-exposure flags actioned in the replacement plan
</sign_off>

---

*Phase: 1-Brand Spine & Visual Metaphor*
*Audit captured: 2026-05-10*
