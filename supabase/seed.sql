-- Rule Library Seed Data
-- 25 expert rules across hook, retention, platform, audio, text, timing, and creator categories
-- Uses fixed UUIDs for idempotent ON CONFLICT (id) DO NOTHING

INSERT INTO rule_library (id, name, description, category, pattern, score_modifier, platform, evaluation_prompt, weight, max_score, accuracy_rate, sample_count, is_active)
VALUES
-- =====================================================
-- HOOK RULES (cross-platform)
-- =====================================================
(
  'a1000000-0000-0000-0000-000000000001',
  'Question Hook',
  'Content opens with a direct question that compels the viewer to engage',
  'hook',
  'question_hook',
  15,
  NULL,
  'Evaluate if the content opens with a compelling question that creates curiosity. Consider: Is it specific enough to feel personal? Does it target a pain point or desire? Would a scroller stop to find the answer? Score 0-10 where 10 means an irresistible question hook that demands engagement.',
  1.0, 10.0, NULL, 0, true
),
(
  'a1000000-0000-0000-0000-000000000002',
  'Curiosity Gap',
  'Creates an information gap that compels viewing to completion',
  'hook',
  'curiosity_gap',
  12,
  NULL,
  'Evaluate if the content creates a strong curiosity gap in the opening. Does it promise a reveal, transformation, or surprising outcome? Does it withhold just enough to make viewers need to watch? Score 0-10 where 10 means an expertly crafted gap that makes skipping feel impossible.',
  1.0, 10.0, NULL, 0, true
),
(
  'a1000000-0000-0000-0000-000000000003',
  'Negative Bias Hook',
  'Leverages negativity bias for immediate attention capture',
  'hook',
  'negative_bias',
  10,
  NULL,
  'Evaluate if the content leverages negativity bias effectively. Does it highlight a mistake, warning, or controversial take? Does the negative framing feel authentic rather than clickbait? Score 0-10 where 10 means a masterful use of negative framing that stops the scroll without feeling manipulative.',
  1.0, 10.0, NULL, 0, true
),
(
  'a1000000-0000-0000-0000-000000000004',
  'Bold Claim Hook',
  'Opens with a surprising or contrarian statement that challenges expectations',
  'hook',
  'bold_claim',
  8,
  NULL,
  'Evaluate if the content opens with a bold, surprising, or contrarian claim. Does it challenge conventional wisdom? Is it specific enough to be credible? Would it make someone pause and think "wait, really?" Score 0-10 where 10 means a perfectly calibrated bold claim that demands attention.',
  1.0, 10.0, NULL, 0, true
),
(
  'a1000000-0000-0000-0000-000000000005',
  'Story Hook',
  'Opens with a personal story or narrative setup that draws viewers in',
  'hook',
  'story_hook',
  10,
  NULL,
  'Evaluate if the content opens with an engaging personal story or narrative. Does it create empathy or relatability in the first few seconds? Is the story setup compelling enough to make viewers want the resolution? Score 0-10 where 10 means an instantly captivating narrative opening.',
  1.0, 10.0, NULL, 0, true
),

-- =====================================================
-- RETENTION RULES (cross-platform)
-- =====================================================
(
  'b1000000-0000-0000-0000-000000000001',
  'Loop Structure',
  'Content structure encourages rewatching by connecting the end to the beginning',
  'retention',
  'loop_structure',
  12,
  NULL,
  'Evaluate if the content has a loop structure where the ending connects back to the beginning, encouraging rewatches. Does the final moment recontextualize the opening? Would a viewer naturally want to watch again? Score 0-10 where 10 means a seamless loop that makes rewatching feel natural.',
  1.0, 10.0, NULL, 0, true
),
(
  'b1000000-0000-0000-0000-000000000002',
  'Payoff Delay',
  'Delays the key reveal or payoff to maintain watch time through the content',
  'retention',
  'payoff_delay',
  10,
  NULL,
  'Evaluate if the content effectively delays its key payoff or reveal. Does it build anticipation without losing the viewer? Is the pacing right — not too slow to bore, not too fast to underwhelm? Score 0-10 where 10 means perfect pacing that keeps viewers locked in until the payoff.',
  1.0, 10.0, NULL, 0, true
),
(
  'b1000000-0000-0000-0000-000000000003',
  'Pattern Interrupt',
  'Breaks expected patterns to recapture wandering attention mid-content',
  'retention',
  'pattern_interrupt',
  8,
  NULL,
  'Evaluate if the content uses pattern interrupts effectively. Are there unexpected shifts in tone, visual, or topic that recapture attention? Do the interrupts feel natural rather than jarring? Score 0-10 where 10 means well-timed interrupts that keep the viewer engaged throughout.',
  1.0, 10.0, NULL, 0, true
),
(
  'b1000000-0000-0000-0000-000000000004',
  'Information Density',
  'High value-per-second keeps viewers engaged by packing useful information tightly',
  'retention',
  'info_density',
  10,
  NULL,
  'Evaluate the information density of the content. Is there high value per second without feeling rushed? Does every sentence contribute something new? Would removing any part make it worse? Score 0-10 where 10 means maximum density without sacrificing clarity.',
  1.0, 10.0, NULL, 0, true
),
(
  'b1000000-0000-0000-0000-000000000005',
  'Emotional Arc',
  'Content follows a clear emotional progression that sustains viewer investment',
  'retention',
  'emotional_arc',
  12,
  NULL,
  'Evaluate if the content follows a compelling emotional arc. Does it take the viewer on a journey — setup, tension, resolution? Does the emotional progression feel authentic? Score 0-10 where 10 means a masterful emotional journey that keeps viewers invested throughout.',
  1.0, 10.0, NULL, 0, true
),

-- =====================================================
-- PLATFORM RULES (platform-specific)
-- =====================================================
(
  'c1000000-0000-0000-0000-000000000001',
  'TikTok Short Duration',
  'Videos under 30 seconds perform best for algorithmic distribution on TikTok',
  'platform',
  'short_duration',
  10,
  'tiktok',
  'Evaluate if the content is optimized for TikTok''s short-form format. Is it concise enough to maintain attention for the full duration? Could the same message be delivered faster? Score 0-10 where 10 means perfectly paced for TikTok''s under-30-second sweet spot.',
  1.0, 10.0, NULL, 0, true
),
(
  'c1000000-0000-0000-0000-000000000002',
  'TikTok Trending Sound',
  'Uses a currently trending sound which boosts algorithmic distribution',
  'platform',
  'trending_sound',
  15,
  'tiktok',
  'Evaluate if the content references or could effectively use a trending sound. Does the concept align well with popular audio trends? Would adding a trending sound enhance rather than distract from the content? Score 0-10 where 10 means perfect sound-content synergy.',
  1.0, 10.0, NULL, 0, true
),
(
  'c1000000-0000-0000-0000-000000000003',
  'Instagram Carousel Depth',
  'Multi-slide carousels with progressive value drive saves and shares on Instagram',
  'platform',
  'carousel_depth',
  8,
  'instagram',
  'Evaluate if the content is structured for an effective Instagram carousel. Does each slide add progressive value? Is there a compelling reason to swipe through all slides? Would viewers save it for reference? Score 0-10 where 10 means a perfectly structured carousel that maximizes saves.',
  1.0, 10.0, NULL, 0, true
),
(
  'c1000000-0000-0000-0000-000000000004',
  'YouTube Thumbnail Bait',
  'Title and thumbnail combination creates a click-worthy curiosity gap',
  'platform',
  'thumbnail_bait',
  10,
  'youtube',
  'Evaluate the title/thumbnail potential of this content. Does the concept lend itself to a compelling thumbnail? Can the title create a curiosity gap without being misleading? Score 0-10 where 10 means a concept with incredible thumbnail and title potential.',
  1.0, 10.0, NULL, 0, true
),
(
  'c1000000-0000-0000-0000-000000000005',
  'TikTok Duet Stitch Potential',
  'Content invites duets or stitches which amplify organic reach',
  'platform',
  'duet_stitch',
  8,
  'tiktok',
  'Evaluate if the content invites duets, stitches, or other collaborative responses. Does it pose a challenge, ask for opinions, or create a template others want to use? Score 0-10 where 10 means content that practically begs for collaborative responses.',
  1.0, 10.0, NULL, 0, true
),
(
  'c1000000-0000-0000-0000-000000000006',
  'TikTok Text Overlay',
  'On-screen text reinforces the message and aids silent viewing',
  'platform',
  'text_overlay',
  6,
  'tiktok',
  'Evaluate if the content concept would benefit from on-screen text overlays. Does the message need visual reinforcement? Would text help viewers watching without sound? Score 0-10 where 10 means text overlays are essential for maximum impact.',
  1.0, 10.0, NULL, 0, true
),
(
  'c1000000-0000-0000-0000-000000000007',
  'Instagram Reel Hook Speed',
  'First frame grabs attention immediately for Instagram Reels algorithmic boost',
  'platform',
  'reel_hook_speed',
  10,
  'instagram',
  'Evaluate the opening speed and impact for Instagram Reels. Does the first frame grab attention? Is there immediate visual or verbal impact within the first second? Score 0-10 where 10 means an opening that stops the Instagram scroll instantly.',
  1.0, 10.0, NULL, 0, true
)
-- =====================================================
-- AUDIO RULES (cross-platform)
-- =====================================================
(
  'd1000000-0000-0000-0000-000000000001',
  'Trending Audio Usage',
  'Content uses a currently trending or viral audio track',
  'audio',
  'trending_audio',
  12,
  NULL,
  'Evaluate if the content uses or references a trending audio track. Is the audio choice current and relevant to the target audience? Does the audio enhance the message or feel forced? Score 0-10 where 10 means perfect audio-content alignment with a trending track.',
  1.0, 10.0, NULL, 0, true
),
(
  'd1000000-0000-0000-0000-000000000002',
  'Original Audio Quality',
  'Original voiceover or audio is clear, well-paced, and professionally produced',
  'audio',
  'original_audio',
  8,
  NULL,
  'Evaluate the quality of original audio (voiceover, narration, speaking). Is it clear, confident, and well-paced? Does the tone match the content mood? Score 0-10 where 10 means broadcast-quality audio that enhances credibility and engagement.',
  1.0, 10.0, NULL, 0, true
),

-- =====================================================
-- TEXT RULES (cross-platform)
-- =====================================================
(
  'e1000000-0000-0000-0000-000000000001',
  'Caption Hook Alignment',
  'Caption/text reinforces the visual hook and adds context',
  'text',
  'caption_hook',
  10,
  NULL,
  'Evaluate if the caption or on-screen text reinforces the hook. Does it add context the visual alone cannot? Is it concise and punchy? Would removing it weaken the content? Score 0-10 where 10 means the text is essential to the hook and perfectly crafted.',
  1.0, 10.0, NULL, 0, true
),
(
  'e1000000-0000-0000-0000-000000000002',
  'Call to Action Clarity',
  'Content includes a clear, compelling call to action',
  'text',
  'cta_clarity',
  8,
  NULL,
  'Evaluate the call to action in the content. Is there a clear ask (follow, share, comment, save)? Is it naturally integrated rather than forced? Does it give the viewer a reason to act? Score 0-10 where 10 means a perfectly integrated CTA that feels like a natural next step.',
  1.0, 10.0, NULL, 0, true
),

-- =====================================================
-- TIMING RULES (cross-platform)
-- =====================================================
(
  'f1000000-0000-0000-0000-000000000001',
  'Optimal Post Timing',
  'Content is optimized for peak audience activity windows',
  'timing',
  'post_timing',
  6,
  NULL,
  'Evaluate if the content concept is time-sensitive or evergreen. Does it reference current events, trends, or seasons? Is it the kind of content that benefits from posting at a specific time? Score 0-10 where 10 means the content is perfectly timed for maximum relevance.',
  1.0, 10.0, NULL, 0, true
),
(
  'f1000000-0000-0000-0000-000000000002',
  'Content Pacing',
  'The pacing matches the content type and platform expectations',
  'timing',
  'content_pacing',
  10,
  NULL,
  'Evaluate the pacing of the content. Does it move fast enough to retain attention but slow enough to communicate clearly? Is the rhythm varied to prevent monotony? Score 0-10 where 10 means impeccable pacing that keeps viewers engaged from start to finish.',
  1.0, 10.0, NULL, 0, true
),

-- =====================================================
-- CREATOR RULES (cross-platform)
-- =====================================================
(
  'g1000000-0000-0000-0000-000000000001',
  'Authenticity Signal',
  'Content feels genuine and authentic rather than overly produced or scripted',
  'creator',
  'authenticity',
  12,
  NULL,
  'Evaluate how authentic the content feels. Does it come across as genuine and relatable? Is there a personal touch that distinguishes it from generic content? Score 0-10 where 10 means the content feels deeply personal and impossible to fake.',
  1.0, 10.0, NULL, 0, true
),
(
  'g1000000-0000-0000-0000-000000000002',
  'Niche Authority',
  'Creator demonstrates clear expertise or authority in their niche',
  'creator',
  'niche_authority',
  10,
  NULL,
  'Evaluate if the content demonstrates niche authority. Does the creator show expertise, insider knowledge, or unique perspective? Would viewers trust this person on this topic? Score 0-10 where 10 means undeniable authority that makes the content a must-follow.',
  1.0, 10.0, NULL, 0, true
)
ON CONFLICT (id) DO NOTHING;
