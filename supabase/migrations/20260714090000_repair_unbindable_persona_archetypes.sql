-- Repair personas whose `archetype` is outside the engine's fixed 10-slug vocabulary.
--
-- WHY: `archetype` is the engine's BINDING KEY. buildAudienceRepaint projects personas into a
-- Record<archetype, repaint>, and the Flash prompt builders look that map up by the archetype of
-- each of the 10 engine slots. A slug outside the vocabulary matches NO slot in ANY niche, so its
-- repaint reaches the model never — silently, with every test green.
--
-- The row "Fitness Creators" (hand-written straight to the DB on 2026-06-20: fabricated
-- scraped_at, no signature, 6 personas instead of 10) stored `fitness` (share .25) and `learner`
-- (share .20). 45% of that audience's own declared weight was dead. No live code path can produce
-- this — the scrape/description path is held to the same 10 slugs by SynthSchema — and as of this
-- change neither can the API: CalibratedPersonaSchema now gates POST + PATCH + the repo.
--
-- MAPPING (owner-approved, by the repaint's own words):
--   fitness  "Hardcore gym regular who screenshots form tutorials and judges sloppy reps hard."
--            -> niche_deep_scout  (knows the niche cold; high bar; recognises cliché instantly)
--   learner  "Beginner learning routines from scratch"
--            -> purposeful_viewer (here to learn/accomplish; completes what has utility)
--
-- temperature/disposition are realigned to TEMPERATURE_DISPOSITION (the engine's canonical map,
-- src/lib/audience/temperature-disposition.ts) for the new slug — the seeded row's values were
-- those of the invented archetype, and carrying them over would just mint a fresh inconsistency.
--
-- Idempotent: matches only the two dead slugs, so a second run updates nothing.

update audiences a
set
  personas   = repaired.personas,
  updated_at = now()
from (
  select
    src.id,
    jsonb_agg(
      case p.elem ->> 'archetype'
        when 'fitness' then p.elem || '{"archetype":"niche_deep_scout","temperature":"hot","disposition":"skeptic"}'::jsonb
        when 'learner' then p.elem || '{"archetype":"purposeful_viewer","temperature":"warm","disposition":"scanner"}'::jsonb
        else p.elem
      end
      order by p.ord
    ) as personas
  from audiences src
  cross join lateral jsonb_array_elements(src.personas) with ordinality as p(elem, ord)
  where src.personas @> '[{"archetype": "fitness"}]'::jsonb
     or src.personas @> '[{"archetype": "learner"}]'::jsonb
  group by src.id
) as repaired
where a.id = repaired.id;
