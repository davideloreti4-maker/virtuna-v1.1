// Dump the sketch's real data straight to disk (never through the model's context).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd(); // run from the repo root
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function q(table, params) {
  const res = await fetch(`${SUPA}/rest/v1/${table}?${params}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

const cols = 'id,platform,creator_handle,cover_url,hook_template,spoken_hook,hook_archetype,format,visual_hook,editing_style,niche,outlier_multiplier,baseline_label,views,posted_at,why_it_works,video_url';
const teardowns = await q('outlier_teardowns', `select=${cols}&status=eq.extracted&limit=600`);

// THE curated collections — category / subcategory / name, exactly the reference's taxonomy.
const memberships = await q('teardown_collections', 'select=teardown_id,category,subcategory,name,slug&limit=1000');

// The one real slice of scraped_videos worth showing: the watched-channel outliers.
const watched = await q(
  'scraped_videos',
  'select=platform_video_id,creator_handle,description,views,likes,comments,shares,outlier_multiplier,baseline_label,posted_at,metadata,video_url' +
  '&outlier_multiplier=not.is.null&archived_at=is.null&order=outlier_multiplier.desc&limit=60',
);

fs.writeFileSync(path.join(ROOT, '.scratch/corpus.json'), JSON.stringify({ teardowns, memberships, watched }));
console.log('teardowns:', teardowns.length, '| memberships:', memberships.length, '| watched:', watched.length);
console.log('collections:', new Set(memberships.map((m) => m.category + '/' + m.name)).size);
console.log('watched w/ cover:', watched.filter((w) => w.metadata?.cover_url).length);
