-- Reclassify 13 rules from 'regex' (default) to 'semantic' evaluation tier.
-- These rules cannot be meaningfully evaluated with regex patterns and require
-- DeepSeek semantic evaluation for accurate scoring.
--
-- See src/lib/engine/rules.ts header comment for rationale per rule.

UPDATE rule_library SET evaluation_tier = 'semantic' WHERE name IN (
  'Loop Structure',
  'Emotional Arc',
  'TikTok Text Overlay',
  'TikTok Trending Sound',
  'Trending Audio Usage',
  'Original Audio Quality',
  'Optimal Post Timing',
  'Content Pacing',
  'Niche Authority',
  'Instagram Carousel Depth',
  'YouTube Thumbnail Bait',
  'TikTok Duet Stitch Potential',
  'Instagram Reel Hook Speed'
);
