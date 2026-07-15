-- ─────────────────────────────────────────────────────────────────────────────
-- Normalize the 532 curated (Sandcastles) teardowns onto OUR canonical shapes.
--
-- WHY: the 2026-07-14 import wrote Sandcastles' own vocabulary and key names straight
-- into our columns. Two silent forks resulted, neither of which any test or typecheck
-- could catch, because the reader casts raw JSONB to a TS interface:
--
--   1. KEY FORK    — curated rows carry `idea.common_belief` / `template.narrative_structure`
--                    where our readers expect `idea.belief` / `template.skeleton`. Every read
--                    returned undefined. `structureLine()` fell through to the spoken hook and
--                    nobody noticed, because grounding flags are off.
--   2. SLUG FORK   — curated facets are raw snake_case (`skit_humor`, `breakdown_explainer`)
--                    while our extractor emits classifyFacet slugs (`skit`,
--                    `breakdowns-explainers`). Same column, two vocabularies → any facet
--                    filter or cross-pool join silently sees half the corpus.
--
-- This migration rebuilds `idea`, `template`, and the three facet columns from `teardown`
-- (the lossless full raw Sandcastles record), so curated / scraped / personal rows all
-- present ONE shape to generation (handoff §1D).
--
-- GAINED, not just fixed: `template.beats` now carries the TIMED NAMED BEATS the outlier
-- actually ran (structure_sections → name/description/startSec/endSec) and `template.guidance`
-- carries Sandcastles' format_reasoning ("when to use this format"). Those are the script
-- skill's proven scaffold and they had nowhere to live in the old shape.
--
-- IDEMPOTENT: reads only from `teardown` (never from the columns it writes), scoped to
-- extraction_version='sandcastles-import-v1'. Safe to re-run.
--
-- EMBEDDINGS UNAFFECTED: buildTeardownEmbeddingText keys on caption/hashtags/onScreenText/
-- spoken_hook/idea.angle. `angle` keeps its key and value in both shapes, so cosine ranking
-- is byte-stable. Do NOT re-embed.
--
-- NOT IN SCOPE: `visual_hook` on these rows holds Sandcastles' visual_layout_category — a
-- SETTING (in_world_vlog / studio_set / greenscreen), not a first-frame DEVICE (crash-zoom /
-- match-cut). That is a semantic mismap, not a slug mismap, and its fix needs a new column +
-- an RPC recreate. It is deliberately left alone here and nothing reads it today.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Facet slug fork ───────────────────────────────────────────────────────
-- True synonyms collapse onto the slug we already had; genuinely-new concepts keep their
-- own (slugified) name and were added to the TS seed vocab in grounding/types.ts. The
-- soft-vocab rule (§13) is unchanged: unknown values are kept, never rejected.

UPDATE public.outlier_teardowns AS t
SET format = m.canonical
FROM (VALUES
  ('skit_humor',                  'skit'),
  ('breakdown_explainer',         'breakdowns-explainers'),
  ('ranking_rating_tier_list',    'tier-list'),
  ('about_me_origin_story',       'about-me'),
  ('scenario_hypothetical',       'scenarios'),
  ('day_in_the_life',             'day-in-the-life'),
  ('case_study',                  'case-study'),
  ('a_vs_b_comparison',           'a-vs-b-comparison'),
  ('heros_journey',               'heros-journey'),
  ('problem_solution',            'problem-solution'),
  ('q_and_a',                     'q-and-a'),
  ('personal_learning_epiphany',  'personal-learning-epiphany'),
  ('episodic_series_social_show', 'episodic-series-social-show'),
  ('personal_update',             'personal-update'),
  ('common_trap_mistake',         'common-trap-mistake')
) AS m(raw, canonical)
WHERE t.extraction_version = 'sandcastles-import-v1'
  AND t.format = m.raw;

UPDATE public.outlier_teardowns AS t
SET hook_archetype = m.canonical
FROM (VALUES
  ('personal_experience',     'personal-experience'),
  ('secret_reveal_breakdown', 'secret-reveal-breakdown'),
  ('scenario_hypothetical',   'scenario-hypothetical'),
  ('case_study',              'case-study'),
  ('ranking_rating',          'ranking-rating'),
  ('trap_mistake',            'trap-mistake')
) AS m(raw, canonical)
WHERE t.extraction_version = 'sandcastles-import-v1'
  AND t.hook_archetype = m.raw;

-- editing_style ← Sandcastles visual_layout_type, which genuinely IS this dimension.
-- Pure slugification (snake → hyphen); no synonym collapsing needed.
UPDATE public.outlier_teardowns
SET editing_style = replace(editing_style, '_', '-')
WHERE extraction_version = 'sandcastles-import-v1'
  AND editing_style LIKE '%\_%';

-- ── 2. `idea` key fork → IdeaFacet ───────────────────────────────────────────
-- {seed, angle, belief, reality, evidence, topic?}. supporting_evidence is an ARRAY in the
-- raw record and a string in IdeaFacet → joined. The 8 rows Sandcastles could not analyse
-- (source went private/deleted) get NULL, not an object full of empty strings: an idea with
-- no content is not an idea, and retrieval now drops signal-less rows outright.

UPDATE public.outlier_teardowns AS t
SET idea = CASE
  WHEN NULLIF(btrim(COALESCE(t.teardown->>'seed', '')), '') IS NULL
   AND NULLIF(btrim(COALESCE(t.teardown->>'angle', '')), '') IS NULL
  THEN NULL
  ELSE jsonb_strip_nulls(jsonb_build_object(
    'seed',     COALESCE(t.teardown->>'seed', ''),
    'angle',    COALESCE(t.teardown->>'angle', ''),
    'belief',   COALESCE(t.teardown->>'common_belief', ''),
    'reality',  COALESCE(t.teardown->>'contrarian_reality', ''),
    'evidence', COALESCE(
      (
        SELECT string_agg(e, ' · ')
        FROM jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof(t.teardown->'supporting_evidence') = 'array'
            THEN t.teardown->'supporting_evidence'
            ELSE '[]'::jsonb
          END
        ) AS e
      ),
      COALESCE(t.teardown->>'supporting_evidence', '')
    ),
    'topic',    NULLIF(btrim(COALESCE(t.teardown->>'topic', '')), '')
  ))
END
WHERE t.extraction_version = 'sandcastles-import-v1'
  AND t.teardown IS NOT NULL;

-- ── 3. `template` key fork → TeardownTemplate (+ the timed beats) ────────────
-- {name, slots, skeleton, guidance, beats?, flavor?}
--   name     ← narrative_structure.structure_summary
--   skeleton ← ordered section_name list          (keeps structureLine() working)
--   beats    ← the full timed sections            (NEW — the script skill's scaffold)
--   guidance ← format_reasoning                   (NEW — "when to use this format")
--   flavor   ← format_flavor                      (NEW — the one-line specific read)
-- `slots` stays [] — Sandcastles does not decompose a template into fillable slots the way
-- our own extractor does; the madlib (hook_template) is the curated corpus's slot carrier.

UPDATE public.outlier_teardowns AS t
SET template = CASE
  WHEN jsonb_typeof(t.teardown->'narrative_structure') <> 'object' THEN NULL
  ELSE jsonb_strip_nulls(jsonb_build_object(
    'name',     COALESCE(t.teardown->'narrative_structure'->>'structure_summary', ''),
    'slots',    '[]'::jsonb,
    'guidance', COALESCE(t.teardown->>'format_reasoning', ''),
    'flavor',   NULLIF(btrim(COALESCE(t.teardown->>'format_flavor', '')), ''),
    'skeleton', COALESCE((
      SELECT jsonb_agg(s.value->>'section_name' ORDER BY s.ordinality)
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(t.teardown->'narrative_structure'->'structure_sections') = 'array'
          THEN t.teardown->'narrative_structure'->'structure_sections'
          ELSE '[]'::jsonb
        END
      ) WITH ORDINALITY AS s(value, ordinality)
      WHERE NULLIF(btrim(COALESCE(s.value->>'section_name', '')), '') IS NOT NULL
    ), '[]'::jsonb),
    'beats', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'name',        s.value->>'section_name',
          'description', COALESCE(s.value->>'section_description', ''),
          'startSec',    CASE WHEN jsonb_typeof(s.value->'start_second') = 'number'
                              THEN s.value->'start_second' ELSE 'null'::jsonb END,
          'endSec',      CASE WHEN jsonb_typeof(s.value->'end_second') = 'number'
                              THEN s.value->'end_second' ELSE 'null'::jsonb END
        ) ORDER BY s.ordinality
      )
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(t.teardown->'narrative_structure'->'structure_sections') = 'array'
          THEN t.teardown->'narrative_structure'->'structure_sections'
          ELSE '[]'::jsonb
        END
      ) WITH ORDINALITY AS s(value, ordinality)
      WHERE NULLIF(btrim(COALESCE(s.value->>'section_name', '')), '') IS NOT NULL
    ), '[]'::jsonb)
  ))
END
WHERE t.extraction_version = 'sandcastles-import-v1'
  AND t.teardown IS NOT NULL;

-- ── 4. Empty is not absent ───────────────────────────────────────────────────
-- One of the 8 un-analysable videos carries a narrative_structure that is a present-but-
-- EMPTY object, so step 3 built it a template of {name:"", skeleton:[], beats:[]}. That
-- object is truthy: a presence check keeps it, and the prompt renderer — finding no name,
-- no skeleton, no hook — emits the literal string "(structure)" as its grounding line.
-- A row that has nothing to teach must hold NULL, not an empty shell.

UPDATE public.outlier_teardowns
SET template = NULL
WHERE extraction_version = 'sandcastles-import-v1'
  AND template IS NOT NULL
  AND COALESCE(template->>'name', '') = ''
  AND jsonb_array_length(COALESCE(template->'skeleton', '[]'::jsonb)) = 0
  AND jsonb_array_length(COALESCE(template->'beats', '[]'::jsonb)) = 0;

-- ── 5. The receipt must not assert what we cannot show ───────────────────────
-- Both of these print on the proof card under a generated hook. They were caught by
-- RENDERING the block, not by reading the code — no test could see them.
--
-- (a) baseline_label = 'curated' on all 532 rows. That is the SOURCE POOL, not a basis:
--     the card read "458× curated", which measures nothing.
--
--     The basis is VIEWS ÷ FOLLOWERS (owner-confirmed 2026-07-14, and corroborated against
--     the data rather than taken on faith): if the score were views÷followers, then
--     views ÷ score must imply the same follower count for every video by one creator — and
--     it does. @personalbrandlaunch implies 49k → 61k → 77k → 104k across 2024-25 (an account
--     growing, in order of posted_at), while @thebranding.ai sits flat at ~33k and @aronsogi
--     at ~17-21k. Those are follower magnitudes drifting like follower counts. A median-views
--     baseline would not climb smoothly with time. Hence 'vs followers'.
--
-- (b) outlier_multiplier = 0 on 136 rows (26%). Zero is not a result — it is a missing
--     measurement wearing a number's clothes, and it rendered as "proven by @creator ·
--     0.0× · 820K views": a receipt asserting the video performed ZERO times its baseline.
--     Absent is honest; zero is a false claim. (retrieve.ts also coerces this at the
--     boundary, so no future pool can reintroduce it.)

UPDATE public.outlier_teardowns
SET baseline_label = 'vs followers'
WHERE extraction_version = 'sandcastles-import-v1'
  AND baseline_label = 'curated';

UPDATE public.outlier_teardowns
SET outlier_multiplier = NULL
WHERE extraction_version = 'sandcastles-import-v1'
  AND outlier_multiplier <= 0;
