# Pitfalls Research: Trending Page (v1.5)

**Domain:** TikTok trending feed with AI tagging and storyboard remix features
**Researched:** 2026-02-02
**Overall Confidence:** MEDIUM-HIGH

---

## Executive Summary

**Top 5 Risks to Watch:**

1. **TikTok ToS Violations** - Unauthorized scraping violates TikTok's Terms of Service. TikTok actively combats scrapers with CAPTCHAs, rate limiting, and legal action. Post-2026 ownership changes have introduced new terms that make enforcement more aggressive.

2. **Data Completeness & Reliability** - Scraped data is inherently incomplete. Comments require hidden APIs, deleted/private videos return nulls, and programs can break without warning when TikTok changes data structures.

3. **AI Tagging Accuracy** - 30-40% of AI outputs contain inaccuracies if unchecked. Mis-tagging videos destroys feed quality and user trust. Visual/audio content analysis is more limited than text-based classification.

4. **LLM Hallucination in Remixes** - Generated scripts may contain fabricated techniques, impossible filming suggestions, or brand-inconsistent advice. Without guardrails, bad scripts damage creator content quality.

5. **PDF/Storyboard Memory Issues** - Puppeteer/Playwright PDF generation consumes 350-450MB per document. Large storyboards can crash with "Page crashed!" errors. Concurrent generation can exhaust server resources.

---

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: TikTok Terms of Service Violations

**What goes wrong:** TikTok explicitly prohibits "automation scripts, excessive server load that disrupts service quality, collecting personal data without consent, and fake accounts with false data." Under post-2026 U.S. ownership, enforcement has intensified. Accounts get banned, IPs blocked, and legal action is increasingly common against scraping operations.

**Why it happens:**
- Developers assume public data means freely scrapeable
- Apify handles the technical complexity, hiding the legal risk
- TikTok's anti-scraping measures evolve faster than scrapers adapt

**Consequences:**
- Apify accounts suspended mid-operation
- IP ranges blocked, requiring expensive residential proxy rotation ($12/GB)
- Potential legal exposure (CFAA, breach of contract claims)
- Complete data pipeline failure

**Warning Signs:**
- Increasing CAPTCHA failures in scraper logs
- Sudden drop in successful scrapes
- Apify rate-limiter triggering frequently
- Legal notices from TikTok or ByteDance

**Prevention:**
1. **Use TikTok Research API where possible** - Available in EEA, takes 4 weeks for approval
2. **Implement conservative rate limiting** - Each query must fetch at least 10 posts per Apify guidelines
3. **Rotate residential proxies** - Datacenter proxies are easily detected
4. **Monitor TikTok legal/policy changes** - Post-2026 terms are still evolving
5. **Build fallback data sources** - Consider Instagram Reels as backup

**Phase to Address:** Phase 1 (Data Pipeline) - Establish legally defensible data sourcing strategy

**Confidence:** HIGH - TikTok explicitly documents anti-scraping stance; recent legal cases confirm enforcement

**Sources:**
- [TikTok: How We Combat Unauthorized Data Scraping](https://www.tiktok.com/privacy/blog/how-we-combat-scraping/en)
- [TikTok Terms of Service](https://www.tiktok.com/legal/page/us/terms-of-service/en)
- [Apify TikTok Scraper Limitations](https://apify.com/clockworks/tiktok-scraper/issues/scraper-limitations-PZaIeYVOBMB4rgxWr)

---

### Pitfall 2: Incomplete or Unreliable Scraped Data

**What goes wrong:** TikTok video metadata is fragmented across multiple endpoints. Profile data doesn't include video details. Videos don't include comments. Comments require hidden APIs. Deleted or private videos return nulls. The baseline calculation (creator's average views) requires historical data that may be incomplete.

**Why it happens:**
- TikTok protects data across multiple API boundaries
- No single endpoint provides complete video + creator context
- Historical data requires multiple scraping sessions over time
- Programs break when TikTok changes internal data structures

**Consequences:**
- Views multiplier calculation fails (missing baseline)
- Videos display with incomplete metadata
- Niche classification fails without creator context
- Feed shows stale or broken content

**Warning Signs:**
- Null values in critical fields (view_count, creator_stats)
- Baseline calculations returning invalid results
- Increasing error rates in data pipeline
- User reports of incorrect multiplier values

**Prevention:**
1. **Implement robust null handling** - Use try-except blocks for every field extraction
2. **Require minimum data completeness** - Don't display videos missing critical fields
3. **Build separate scrapers for different data types** - Profile scraper + video scraper + comments scraper
4. **Cache creator baselines** - Don't recompute on every request
5. **Show data freshness indicators** - "Baseline from 2h ago" prevents confusion
6. **Graceful degradation** - Show videos without multiplier if baseline unavailable

**Phase to Address:** Phase 1 (Data Pipeline) - Design schema to handle incomplete data gracefully

**Confidence:** HIGH - Multiple Apify users report incomplete data issues

**Sources:**
- [Apify TikTok Scraper Issues](https://apify.com/apidojo/tiktok-scraper/issues/getting-only-limited-Z7WcRMb9w9jtOY3dl)
- [Pyktok GitHub](https://github.com/dfreelon/pyktok)
- [TikTok Scraping Guide 2026](https://scrapfly.io/blog/posts/how-to-scrape-tiktok-python-json)

---

### Pitfall 3: AI Tagging Inaccuracy Destroying Feed Quality

**What goes wrong:** AI content classification has 30-40% inaccuracy rate without validation. Videos get tagged with wrong niches, incorrect content types, or missing strategic tags. A fitness video tagged as "Comedy" ruins discovery. Auto-tagging audio/video is "generally more limited" than text classification.

**Why it happens:**
- LLMs rely on captions/titles, not actual video content
- Ambiguous content (educational AND entertaining) confuses classifiers
- Training data doesn't reflect TikTok's unique content styles
- No feedback loop to correct misclassifications

**Consequences:**
- Users see irrelevant content in their niche feed
- "High Remix Potential" tags on unsuitable videos
- Trust erosion ("this platform doesn't understand my niche")
- Wasted time analyzing poorly-tagged content

**Warning Signs:**
- User complaints about irrelevant recommendations
- High bounce rates from category drill-downs
- Manual spot-checks reveal obvious misclassifications
- Engagement metrics lower than expected for "viral" content

**Prevention:**
1. **Multi-signal classification** - Combine caption, hashtags, audio metadata, creator profile
2. **Confidence thresholds** - Only auto-tag above 85% confidence; flag uncertain cases
3. **Human-in-the-loop for strategic tags** - "High Remix Potential" requires validation
4. **User feedback mechanism** - "Wrong category?" button that feeds training
5. **Start with broader categories** - 6 content types easier to classify than 20
6. **Validate against creator-declared niche** - Cross-check with profile metadata

**Phase to Address:** Phase 2 (AI Classification) - Build validation pipeline before launch

**Confidence:** HIGH - Industry research confirms AI tagging accuracy challenges

**Sources:**
- [AI Content Tagging Challenges (Kontent.ai)](https://kontent.ai/blog/ai-based-auto-tagging-of-content-what-you-need-to-know/)
- [AI Video Tagging Challenges (VideoTap)](https://videotap.com/blog/ai-video-tagging-benefits-use-cases-challenges)
- [10 AI Content Mistakes (Wellows)](https://wellows.com/blog/ai-mistakes-marketers-should-avoid/)

---

### Pitfall 4: LLM Hallucination in Remix Generation

**What goes wrong:** Generated storyboards contain fabricated filming techniques, impossible equipment suggestions, inaccurate trend advice, or scripts that don't match the creator's brand voice. Air Canada-style failures where the AI "makes up" policies that don't exist.

**Why it happens:**
- LLMs predict next tokens without fact-checking
- No grounding in actual TikTok best practices database
- Creator's brand voice provided only through brief text input
- Contextual misalignment from oversimplified prompts

**Consequences:**
- Creator films content based on bad advice, wastes time
- Scripts suggest equipment creator doesn't have
- "Filming tips" that don't work in practice
- Brand voice inconsistency across generated content
- User loses trust in Remix feature entirely

**Warning Signs:**
- User feedback about impractical suggestions
- Scripts referencing non-existent TikTok features
- Filming tips that contradict basic video production
- Generated hooks that don't match trend patterns

**Prevention:**
1. **RAG grounding** - Retrieve actual successful scripts/hooks from database before generating
2. **Constraint validation** - Parse user constraints and verify outputs respect them
3. **Template-based generation** - Use proven script structures, let LLM fill details
4. **Equipment-aware prompting** - Include user's constraints in every generation
5. **Human review for "tips"** - Pre-validate generic filming advice
6. **Regenerate option prominent** - Make it easy to get alternatives
7. **Confidence disclosure** - "AI-generated, review before filming"

**Phase to Address:** Phase 3 (Remix Generation) - Implement RAG and validation pipeline

**Confidence:** HIGH - LLM hallucination is well-documented; 96% reduction possible with proper guardrails

**Sources:**
- [LLM Hallucination Examples (EvidentlyAI)](https://www.evidentlyai.com/blog/llm-hallucination-examples)
- [Reducing LLM Hallucinations (Voiceflow)](https://www.voiceflow.com/blog/prevent-llm-hallucinations)
- [Stop LLM Hallucinations (MasterOfCode)](https://masterofcode.com/blog/hallucinations-in-llms-what-you-need-to-know-before-integration)

---

### Pitfall 5: PDF Generation Memory Exhaustion

**What goes wrong:** Puppeteer/Playwright PDF generation consumes 350-450MB per document for even simple 3-page content. Storyboards with multiple visual frames can exceed 500MB. Concurrent generation exhausts server memory. Large documents hit Chrome DevTools 256MB WebSocket limit and crash with "Page crashed!" or "Connection closed."

**Why it happens:**
- Browser-based PDF generation requires full Chromium instance
- Each visual frame requires image processing
- Memory isn't freed between page renders
- Tab reuse accumulates memory over time
- No streaming for large documents

**Consequences:**
- PDF generation fails for detailed storyboards
- Server crashes under concurrent load
- Users see "generation failed" with no explanation
- Long generation times frustrate users

**Warning Signs:**
- Increasing PDF generation timeouts
- Server memory alerts
- "Page crashed!" errors in logs
- Generation times growing over days (memory leak)

**Prevention:**
1. **Use streaming output** - Generate PDF as stream, not buffer, for large documents
2. **Limit concurrent generation** - Queue system with max workers = CPU cores - 1
3. **Page limits** - Cap storyboard length (e.g., 10 frames max)
4. **Close tabs after use** - Don't reuse tabs indefinitely
5. **Consider alternatives** - PDFKit, jsPDF for simpler layouts (no browser overhead)
6. **Offload to dedicated service** - Browserless.io or similar managed PDF service
7. **Compress images before embedding** - Reduce visual frame sizes

**Phase to Address:** Phase 4 (PDF Export) - Choose generation approach before building

**Confidence:** HIGH - Puppeteer memory issues are well-documented

**Sources:**
- [Puppeteer Isn't Meant for PDFs (Medium)](https://medium.com/@onu.khatri/puppeteer-isnt-meant-for-pdfs-here-s-why-1e3a4419263f)
- [Optimizing Puppeteer PDF Generation (Medium)](https://medium.com/@danindu/optimizing-puppeteer-for-pdf-generation-overcoming-challenges-with-large-file-sizes-8b7777edbeca)
- [How to Generate PDFs in 2025 (dev.to)](https://dev.to/michal_szymanowski/how-to-generate-pdfs-in-2025-26gi)

---

## Moderate Pitfalls

Mistakes that cause delays or technical debt.

### Pitfall 6: TikTok Embed CORS and Display Issues

**What goes wrong:** Embedding TikTok videos requires TikTok's official embed script. Direct video URLs don't work. CORS errors block API calls to TikTok endpoints. Content Security Policy may block TikTok domains. Videos fail to load on certain browsers.

**Prevention:**
1. **Use TikTok's official embed code** - Include `<script async src="https://www.tiktok.com/embed.js"></script>`
2. **Allow TikTok domains in CSP** - `www.tiktok.com`, `v16m-default.tiktokcdn.com`
3. **Fallback to thumbnail** - If embed fails, show static thumbnail with "Watch on TikTok" link
4. **Test across browsers** - Safari, Firefox have stricter CORS than Chrome
5. **Monitor embed failures** - Log and alert on consistent embed issues

**Phase to Address:** Phase 2 (Video Display) - Test embedding approach early

**Confidence:** HIGH - TikTok provides official embed documentation

**Sources:**
- [TikTok Embed Documentation](https://developers.tiktok.com/doc/embed-videos/)
- [How to Embed TikTok Videos 2026 (EmbedSocial)](https://embedsocial.com/blog/embed-tiktok-video/)

---

### Pitfall 7: Fixed Category Taxonomy Rigidity

**What goes wrong:** Fixed categories (Challenge, Tutorial, Story, Comedy, Reaction, Aesthetic) can't adapt to emerging content types. TikTok trends evolve faster than taxonomy updates. "Grwm" (get ready with me) doesn't fit existing categories. Manual taxonomy maintenance becomes a burden.

**Prevention:**
1. **Build for taxonomy evolution** - Database schema supports adding categories
2. **Include "Other" category** - Catch-all for unclassified content
3. **Monitor classification failures** - Track what's landing in "Other"
4. **Quarterly taxonomy review** - Scheduled updates based on trend data
5. **Consider AI-generated sub-tags** - Fixed primary categories + dynamic secondary tags

**Phase to Address:** Phase 2 (Category System) - Design extensible taxonomy from start

**Confidence:** MEDIUM - Based on content management best practices

**Sources:**
- [AI & Taxonomy: The Good and Bad (Enterprise Knowledge)](https://enterprise-knowledge.com/ai-taxonomy-the-good-and-the-bad/)
- [Future of Taxonomies in Media (Hum)](https://blog.hum.works/posts/the-future-of-taxonomies-in-modern-media-organizations)

---

### Pitfall 8: Quality Filtering False Positives

**What goes wrong:** Aggressive quality filters reject legitimately viral content. Niche breakouts (5K followers getting 2M views) may look like spam. Educational content may be filtered as "low engagement." False positives frustrate users who don't see expected trending videos.

**Prevention:**
1. **Multi-signal quality scoring** - Views multiplier + engagement rate + time decay
2. **Niche-aware thresholds** - Different baselines for different content types
3. **Log filtered content** - Review what's being rejected
4. **User reporting for missing videos** - "I expected to see X" feedback
5. **Start permissive, tighten gradually** - Easier to add filters than remove

**Phase to Address:** Phase 2 (Quality Filtering) - Build with observability

**Confidence:** MEDIUM - Content moderation false positive rates are well-documented

**Sources:**
- [AI Content Moderation Challenges (Superpower)](https://superpower.social/blogs/ai-content-moderation)
- [Detection of Detrimental Content (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9444091/)

---

### Pitfall 9: Storyboard Visual Consistency Issues

**What goes wrong:** AI-generated visual frames show inconsistent character appearance, jarring style shifts between frames, or unclear shot compositions. "Despite marketing claims about improved AI consistency, users report ongoing character variation issues."

**Prevention:**
1. **Text-primary storyboards** - Focus on shot list, script, tips; visuals are supplementary
2. **Style lock prompting** - Include consistent style descriptors in all frame prompts
3. **Frame-to-frame context** - Pass previous frame description to next generation
4. **Skip visuals initially** - Launch with text-only storyboards, add visuals later
5. **User-uploaded reference images** - Let creator provide visual style guidance

**Phase to Address:** Phase 3 (Remix Output) - Decide visual approach early

**Confidence:** MEDIUM - AI storyboard consistency issues are reported but tools are improving

**Sources:**
- [Storyboarder.ai Review 2025 (Skywork)](https://skywork.ai/skypage/en/Storyboarder.ai-Review-2025-The-Ultimate-Guide-to-AI-Storyboarding/1974522243654021120)
- [AI Storyboarding Tools 2025 (Celtx)](https://blog.celtx.com/modern-storyboarding-ai-technology/)

---

### Pitfall 10: Apify Cost Escalation

**What goes wrong:** Apify costs grow non-linearly. Residential proxy rotation costs $12/GB. Large-scale scraping (1000s of videos + creator baselines) can cost hundreds per month. Budget blowouts when scaling.

**Prevention:**
1. **Estimate costs before building** - Model expected scrape volume vs budget
2. **Cache aggressively** - Don't re-scrape stable creator baselines
3. **Batch operations** - Fewer large requests vs many small ones
4. **Set Apify spending limits** - Hard caps prevent surprises
5. **Monitor cost per video** - Track and optimize over time

**Phase to Address:** Phase 1 (Data Pipeline) - Budget before implementation

**Confidence:** HIGH - Apify pricing is documented; residential proxy costs are standard

**Sources:**
- [Apify TikTok Scraper](https://apify.com/clockworks/tiktok-scraper)
- [Best TikTok Scrapers 2025 (Proxyway)](https://proxyway.com/best/tiktok-scrapers)

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

### Pitfall 11: Teleprompter Mode UX Issues

**What goes wrong:** Scrolling speed doesn't match creator's pace. Text too small/large for filming distance. Screen auto-locks during filming. Portrait vs landscape confusion.

**Prevention:**
1. **Adjustable scroll speed** - Manual control + auto-scroll options
2. **Text size presets** - Small/Medium/Large with preview
3. **Keep-awake implementation** - Prevent screen lock during teleprompter
4. **Orientation lock** - Let user choose and lock portrait/landscape
5. **Test on actual filming scenarios** - Real user testing critical

**Phase to Address:** Phase 4 (Teleprompter) - User testing before launch

---

### Pitfall 12: Clipboard Auto-Detect Privacy Concerns

**What goes wrong:** Users uncomfortable with app reading clipboard. iOS/Android show "pasted from" notifications. Privacy-conscious users avoid feature.

**Prevention:**
1. **Explicit opt-in** - Ask permission before reading clipboard
2. **Clear privacy explanation** - "We only check for TikTok URLs"
3. **Manual paste fallback** - Always allow manual URL entry
4. **Don't log clipboard contents** - Only use for URL detection

**Phase to Address:** Phase 4 (URL Input) - Design with privacy in mind

---

### Pitfall 13: Views Multiplier Edge Cases

**What goes wrong:** New creators with <10 videos have unreliable baselines. Viral accounts have inflated baselines. Deleted videos skew historical averages. Multiplier looks wrong for edge cases.

**Prevention:**
1. **Minimum sample size** - Require 10+ videos for baseline calculation
2. **Outlier exclusion** - Remove top/bottom 10% from baseline
3. **Recency weighting** - Recent videos weighted higher
4. **Display confidence indicator** - "Strong baseline (50 videos)" vs "Limited data (12 videos)"
5. **Fallback display** - Show absolute views if baseline unavailable

**Phase to Address:** Phase 2 (Metrics Calculation) - Define edge case handling

---

## Legal & Copyright Considerations

### Remix Copyright Ambiguity

**What goes wrong:** Generated storyboards are derivative works based on scraped content. Fair use is unpredictable. International users face different copyright regimes. Automated takedown systems can't distinguish transformative use.

**Prevention:**
1. **Inspire, don't copy** - Remixes should be "inspired by" not "copy of"
2. **No direct content reproduction** - Don't embed original video in remix output
3. **Attribution in exports** - Include "Inspired by @creator" in PDFs
4. **Terms of service clarity** - Explicit user agreement about derivative content
5. **Legal review** - Consult IP attorney on remix feature design

**Phase to Address:** Phase 1 (Foundation) - Legal review before building remix

**Confidence:** MEDIUM - Fair use is inherently unpredictable; international variation adds complexity

**Sources:**
- [Remix Culture and Copyright (WIPO)](https://www.wipo.int/web/wipo-magazine/articles/remix-culture-and-amateur-creativity-a-copyright-dilemma-39210)
- [Copyright for UGC Platforms (ScoreDetect)](https://www.scoredetect.com/blog/posts/copyright-considerations-for-user-generated-video-platforms-a-legal-framework)

---

## Phase-Specific Warning Summary

| Phase | Topic | Likely Pitfall | Mitigation |
|-------|-------|----------------|------------|
| 1 - Data Pipeline | TikTok Scraping | ToS violation, account bans | Rate limits, proxies, legal review |
| 1 - Data Pipeline | Data Completeness | Missing fields, null values | Graceful degradation, multiple scrapers |
| 1 - Data Pipeline | Apify Costs | Budget blowout | Cost modeling, caching, limits |
| 2 - Feed Display | AI Tagging | Misclassification, irrelevant content | Confidence thresholds, feedback loop |
| 2 - Feed Display | Video Embeds | CORS errors, display failures | Official embed code, CSP config |
| 2 - Feed Display | Quality Filtering | False positives hiding good content | Multi-signal scoring, logging |
| 2 - Feed Display | Category Taxonomy | Rigid categories, emerging trends | Extensible schema, quarterly review |
| 3 - Remix | LLM Hallucination | Bad scripts, impossible tips | RAG grounding, validation |
| 3 - Remix | Visual Consistency | Frame-to-frame variation | Text-first approach, style locking |
| 4 - Export | PDF Memory | Crashes, timeouts | Streaming, queue limits, alternatives |
| 4 - UX | Teleprompter | Scroll speed, screen lock | User testing, adjustable settings |
| Legal | Copyright | Derivative work ambiguity | "Inspired by" framing, legal review |

---

## Research Gaps / Open Questions

1. **TikTok Research API access** - Is it available outside EEA? What are current approval timelines?

2. **Post-2026 TikTok terms** - New U.S. ownership introduced new terms; need legal review of latest policies

3. **Apify reliability SLA** - What happens when Apify scrapers break? What's their response time?

4. **AI tagging accuracy benchmarks** - What's achievable accuracy for TikTok content classification specifically?

5. **PDF alternatives** - Would React-PDF or server-side LaTeX be more suitable than Puppeteer?

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| TikTok ToS | HIGH | Official TikTok documentation, recent enforcement actions |
| Scraping Reliability | HIGH | Multiple Apify users report issues, well-documented |
| AI Tagging Accuracy | HIGH | Industry research confirms 30-40% error rates |
| LLM Hallucination | HIGH | Extensive research, recent high-profile failures |
| PDF Memory Issues | HIGH | Puppeteer/Playwright limitations well-documented |
| Embed/CORS | HIGH | TikTok provides official embed docs |
| Category Taxonomy | MEDIUM | Based on content management best practices |
| Visual Consistency | MEDIUM | AI tools improving rapidly, current state mixed |
| Copyright/Fair Use | MEDIUM | Inherently unpredictable, jurisdiction-dependent |

---

## Sources Summary

**Official/Authoritative:**
- [TikTok Terms of Service](https://www.tiktok.com/legal/page/us/terms-of-service/en)
- [TikTok Anti-Scraping Blog](https://www.tiktok.com/privacy/blog/how-we-combat-scraping/en)
- [TikTok Embed Documentation](https://developers.tiktok.com/doc/embed-videos/)
- [WIPO Remix Culture](https://www.wipo.int/web/wipo-magazine/articles/remix-culture-and-amateur-creativity-a-copyright-dilemma-39210)

**Technical Research:**
- [Apify TikTok Scraper](https://apify.com/clockworks/tiktok-scraper)
- [Puppeteer PDF Issues (Medium)](https://medium.com/@onu.khatri/puppeteer-isnt-meant-for-pdfs-here-s-why-1e3a4419263f)
- [Optimizing Puppeteer PDF (Medium)](https://medium.com/@danindu/optimizing-puppeteer-for-pdf-generation-overcoming-challenges-with-large-file-sizes-8b7777edbeca)
- [TikTok Scraping Guide (Scrapfly)](https://scrapfly.io/blog/posts/how-to-scrape-tiktok-python-json)

**AI/ML Research:**
- [AI Content Tagging (Kontent.ai)](https://kontent.ai/blog/ai-based-auto-tagging-of-content-what-you-need-to-know/)
- [LLM Hallucination Examples (EvidentlyAI)](https://www.evidentlyai.com/blog/llm-hallucination-examples)
- [Reducing Hallucinations (Voiceflow)](https://www.voiceflow.com/blog/prevent-llm-hallucinations)
- [AI Storyboarding 2025 (Celtx)](https://blog.celtx.com/modern-storyboarding-ai-technology/)

**Legal/Compliance:**
- [Copyright for UGC Platforms (ScoreDetect)](https://www.scoredetect.com/blog/posts/copyright-considerations-for-user-generated-video-platforms-a-legal-framework)
- [Web Scraping Legality (AIMultiple)](https://research.aimultiple.com/is-web-scraping-legal/)
