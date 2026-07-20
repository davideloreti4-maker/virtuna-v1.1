/**
 * PHASE 1.5 — the ad-hoc composer spike.
 *
 * The riskiest bet in THE STREAM concept, tested before any migration: can the
 * production chat model (qwen3.7-plus, temp 0.3 — the CONVERSE row of MODEL-POLICY)
 * compose good stream UI from the 16-primitive vocabulary on arbitrary asks?
 *
 * 20 asks: the 12 sketch shapes + the 5 future-skill shapes (competitor / trends /
 * performance / scheduling / audit) + 3 restraint probes (conversational asks that
 * should stay prose). Each ask carries a CONTEXT payload simulating tool results —
 * the only numbers the composer may state (honesty spine).
 *
 * Output: src/app/(app)/dev/cards/spike-results.json (summary + per-ask), rendered
 * by the "Stream (composer spike)" /dev/cards section. Invalid compositions are kept
 * verbatim — they render as UnsupportedBlock, which is the honest failure display.
 *
 * Run: node --experimental-strip-types scripts/composer-spike.mts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import OpenAI from 'openai';
import { z } from 'zod';
import { ComposedBlockSchema } from '../src/lib/tools/stream-primitives.ts';

// ── env (.env.local is not auto-loaded outside next) ─────────────────────────
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const client = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY!,
  baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  maxRetries: 0,
});
const MODEL = process.env.QWEN_REASONING_MODEL ?? 'qwen3.7-plus';

// ── the composer prompt (the spike's approximation of the phase-5 production prompt) ──
const VOCAB_JSON_SCHEMA = JSON.stringify(z.toJSONSchema(ComposedBlockSchema));

const SYSTEM = `You are Maven's response composer. Maven is a warm, direct short-video content advisor.
You answer the creator's ask as ONE stream composition: a JSON object {"type":"composed","props":{"items":[...]}} that MUST conform to this JSON Schema:

${VOCAB_JSON_SCHEMA}

THE LAWS (violations make the answer invalid):
- Prose is the backbone. Open in voice (a "prose" item). Structure appears ONLY where the content earns it: numbers, ranked sets, comparisons, before/after. A conversational or explanatory ask is answered in prose alone — forcing structure onto it is a violation of taste.
- A "receipt" item may appear ONLY as the FIRST item, and only when CONTEXT shows a tool/skill actually ran. No context run → no receipt.
- ONE frame: at most one "asset" item, only for a take-away deliverable (a script, a saveable artifact).
- Absence is prose: zero results = a sentence stating so WITH the basis, never padded structure.
- Accent marks one thing: at most one "accent" table cell, at most one "warn" stat.

HONESTY (the spine — never negotiable):
- Every measured number (views, multipliers, fractions, percentages, dates) MUST come verbatim from CONTEXT. No CONTEXT number → you may not state one. Never invent, estimate, or round differently.
- "evidence" rows and "media-strip" items may ONLY carry videos present in CONTEXT.
- Band words (Strong/Mixed/Weak) and stop-fractions only if CONTEXT contains audience reactions.
- If CONTEXT is "none", answer qualitatively — zero fabricated specifics.

Voice: second person, concrete, no hype. Answer the actual ask first.
Return ONLY the JSON object. No markdown fences, no commentary.`;

// ── the 20 asks ───────────────────────────────────────────────────────────────
type Ask = { id: string; tag: 'sketch' | 'future' | 'restraint'; ask: string; context: unknown };

const V = (title: string, posted: string, views: string, mult: string) => ({ title, posted, views, multiplier_vs_usual: mult });

const ASKS: Ask[] = [
  { id: 'why-flop', tag: 'sketch', ask: 'why did my gym transformation video do so well but the office vlog flopped?', context: { skill_ran: 'Compared 2 videos', videos: [V('Gym transformation', 'May 18', '2.1M', '9.2x up'), V('Office day-in-the-life', 'Jun 2', '38K', '0.4x down')], audience_note: '6 of your 10 reactors are scanners' } },
  { id: 'hooks', tag: 'sketch', ask: 'give me 3 hooks in that style', context: { skill_ran: 'Hooks · ran your audience · 3 steps · SIM-1 Flash', hooks: [{ text: "I trained wrong for six years. Here's what I'd keep.", band: 'Strong', stopped: '8/10', source: 'structure from @braedan.health · 90.7x vs followers · 621K views', quote: { text: 'Okay that opening got me — I need to know the rest.', by: 'The Aspirant' } }, { text: 'Your form was never the problem.', band: 'Mixed', stopped: '5/10', source: 'original — not drawn from a retrieved video' }, { text: 'Six years of gym advice. One lie holding it together.', band: 'Mixed', stopped: '5/10', quote: { text: "Heard this a hundred times — what's actually new?", by: 'The Skeptic' } }] } },
  { id: 'revision', tag: 'sketch', ask: 'make the second hook less clickbaity', context: { skill_ran: 'Hooks · re-ran your audience · 1 step', before: { text: 'Your form was never the problem.', stopped: '5/10' }, after: { text: 'I filmed my form for 30 days. The problem was never form.', band: 'Strong', stopped: '7/10' } } },
  { id: 'compare-aud', tag: 'sketch', ask: 'how would founders vs a general audience take the first hook?', context: { skill_ran: 'Read · 2 audiences · SIM-1 Flash', audiences: [{ name: 'Bootstrapped Founders', band: 'Strong', stop: '8/10', lever: 'Lead with the dollar amount you saved in the first two seconds.', quote: { text: "That's my exact problem, honestly.", by: 'The Scout' } }, { name: 'General', band: 'Mixed', stop: '5/10', lever: 'Add a concrete receipt early — that converts the skeptics.', quote: { text: 'The hook overpromises, I can smell the letdown.', by: 'The Critic' } }] } },
  { id: 'explore', tag: 'sketch', ask: "show me what's working in my niche right now", context: { skill_ran: 'Explore · scraped 214 videos · kept 3 outliers', outliers: [{ title: "The one habit that 10x'd my mornings", metric: '12x', fit: 'Strong', by: '@morning.mo · 2.4M', duration: '0:34' }, { title: "Why your content isn't landing", metric: '4.1x', fit: 'Mixed', by: '@candid.kay · 890K', duration: '0:51' }], basis: 'x = views vs that creator usual reach' } },
  { id: 'absence', tag: 'sketch', ask: 'anything worth stealing on cold plunges?', context: { skill_ran: 'Explore · scraped 61 videos · kept 0', note: 'top cold-plunge video is at 1.3x its creator usual — a normal week, not an outlier' } },
  { id: 'account', tag: 'sketch', ask: 'read my account — what should I double down on?', context: { skill_ran: 'Account read · your last 12 posts', strengths: [{ claim: 'Counter-intuitive claims in the first two seconds', basis: '9 of 12 posts' }, { claim: 'On-screen receipts backing the hook', basis: 'your top 3 all do it' }], weaknesses: [{ claim: 'Middles sag — 40% drop between 8s and 15s', basis: '7 of 12 posts' }, { claim: 'CTAs are vague ("follow for more")', basis: '10 of 12 posts' }] } },
  { id: 'perf-numbers', tag: 'future', ask: 'how did my last five posts actually do?', context: { skill_ran: 'Account read · your last 5 posts', totals: { views: '2.9M', vs_prior_5: '+212%', median: '210K (flat)' }, posts: [V('Gym transformation', 'May 18', '2.1M', '9.2x'), V('30 days of ugly sets', 'Jun 20', '480K', '2.4x'), V('Form myth, busted', 'Jun 9', '210K', '1.1x'), V('What I eat, training day', 'Jun 15', '96K', '0.5x'), V('Office day-in-the-life', 'Jun 2', '38K', '0.4x')] } },
  { id: 'script', tag: 'sketch', ask: 'write the full script for the first hook', context: { skill_ran: 'Script · wrote + pressure-tested the open · 2 steps · SIM-1 Flash', opener_test: { band: 'Strong', stopped: '7/10', note: 'opener only, full cut untested' }, script: { title: 'I trained wrong for six years', duration: '~40s', beats: [{ label: 'Hook', time: '0-3s', text: 'I trained wrong for six years — and kept every mistake on camera.' }, { label: 'Setup', time: '3-10s', text: 'Two hours a day, perfect form, textbook programs. The works.' }, { label: 'Turn', time: '10-20s', text: 'Then I noticed my worst-form months were my best-progress months.' }, { label: 'Payoff', time: '20-35s', text: "Intensity beats choreography — effort you can't fake is the variable." }, { label: 'CTA', time: '35-40s', text: 'Try one ugly set this week and tell me what happens.' }] } } },
  { id: 'plan-week', tag: 'sketch', ask: 'ok what should I actually post this week?', context: { skill_ran: 'Planned · from your account + audience · 2 steps', slots: [{ when: 'Tue', what: 'The "trained wrong" script — film it', why: 'your strongest opener' }, { when: 'Thu', what: 'Form-myth explainer', why: 'explainers over-index 2.1x for you' }, { when: 'Sat', what: '30-day receipts compilation', why: 'weekend = your loyalists' }] } },
  { id: 'remix-ask', tag: 'sketch', ask: 'can you remix a video I found for my audience?', context: 'none' },
  { id: 'persona', tag: 'sketch', ask: 'ask the skeptic what would make them stay', context: { skill_ran: 'persona sub-chat', persona: 'The Skeptic', voice_answer: 'The payoff, in the first breath. Give me the number up front and I will sit through every uncut second of it.' } },
  { id: 'competitor', tag: 'future', ask: 'how is @rival.fit doing this week?', context: { skill_ran: 'Tracked @rival.fit · last 7 days', account: { followers: '212K', delta: '+3.1%' }, posts: [V('I quit pre-workout for 30 days', 'Jul 15', '1.4M', '6.3x'), V('Gym anxiety is a setup problem', 'Jul 17', '380K', '1.7x'), V('My honest supplement stack', 'Jul 18', '92K', '0.4x')], note: 'their confession formats outperform; product content underperforms' } },
  { id: 'trends', tag: 'future', ask: "what's trending in fitness right now?", context: { skill_ran: 'Explore · scanned 480 videos · 3 rising patterns', trends: [{ pattern: 'Zero-cut single-take routines', momentum: 'rising 4 days', example: V('My whole morning, one take', 'Jul 16', '3.1M', '11x') }, { pattern: 'Anti-supplement confessions', momentum: 'rising 2 days', example: V('I quit pre-workout for 30 days', 'Jul 15', '1.4M', '6.3x') }], fit_note: 'zero-cut fits your receipts-on-camera strength' } },
  { id: 'period-compare', tag: 'future', ask: 'compare my January vs June performance', context: { skill_ran: 'Account read · 2 periods', january: { posts: 9, total_views: '410K', median: '38K', best: 'Form myth intro (110K)' }, june: { posts: 7, total_views: '2.8M', median: '96K', best: 'Gym transformation (2.1M)' }, driver: 'the jump is concentrated in receipts-on-camera posts; talking-head posts are flat across both periods' } },
  { id: 'schedule-2w', tag: 'future', ask: 'schedule my next two weeks', context: { skill_ran: 'Planned · from your account + audience', slots: [{ when: 'Tue 22', what: 'Trained-wrong script', why: 'strongest opener' }, { when: 'Thu 24', what: 'Form-myth explainer', why: 'explainers over-index for you' }, { when: 'Sat 26', what: '30-day receipts compilation', why: 'weekend loyalists' }, { when: 'Tue 29', what: 'Zero-cut morning routine', why: 'trending pattern, fits your strength' }, { when: 'Fri 1', what: 'Q&A from comments', why: 'comment velocity peaked Friday' }] } },
  { id: 'audit-setup', tag: 'future', ask: 'audit my profile setup', context: { skill_ran: 'Profile audit · @maven.creator', findings_good: [{ claim: 'Bio states the niche in the first line', basis: 'checked' }], findings_fix: [{ claim: 'No link-in-bio destination', basis: 'checked' }, { claim: 'Pinned videos are 8 months old', basis: 'oldest: Nov 18' }], needs_from_user: 'which goal to optimize the pinned row for: follows or product clicks' } },
  { id: 'explain-algo', tag: 'restraint', ask: "explain how the algorithm decides what to push, like I'm five", context: 'none' },
  { id: 'discouraged', tag: 'restraint', ask: "honestly I'm discouraged, nothing has worked for a month", context: 'none' },
  { id: 'plan-100k', tag: 'restraint', ask: 'give me a 30-day plan to hit 100k followers', context: 'none' },
];

// ── the loop ─────────────────────────────────────────────────────────────────
async function compose(ask: Ask): Promise<Record<string, unknown>> {
  const user = `ASK: ${ask.ask}\n\nCONTEXT (tool results — the ONLY numbers you may state): ${
    ask.context === 'none' ? 'none' : JSON.stringify(ask.context)
  }`;
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ];
  let attempt1Valid = false;
  let valid = false;
  let composition: unknown = null;
  let error = '';

  for (let attempt = 0; attempt < 2; attempt++) {
    const params = {
      model: MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: 'json_object' as const },
    };
    (params as Record<string, unknown>).enable_thinking = false;
    const res = await client.chat.completions.create(params);
    const text = res.choices[0]?.message?.content ?? '';
    try {
      composition = JSON.parse(text);
    } catch {
      composition = text;
      error = 'not JSON';
    }
    const parsed = ComposedBlockSchema.safeParse(composition);
    if (parsed.success) {
      valid = true;
      if (attempt === 0) attempt1Valid = true;
      composition = parsed.data;
      error = '';
      break;
    }
    error = parsed.error.issues.slice(0, 4).map((i) => `${i.path.join('.')}: ${i.message}`).join(' | ');
    if (attempt === 0) {
      messages.push({ role: 'assistant', content: text });
      messages.push({ role: 'user', content: `Your JSON failed schema validation: ${error}. Return the corrected JSON object only.` });
    }
  }

  const kinds = valid
    ? [...new Set(((composition as { props: { items: { kind: string }[] } }).props.items).map((i) => i.kind))]
    : [];
  return { id: ask.id, tag: ask.tag, ask: ask.ask, attempt1Valid, valid, error, kinds, composition };
}

const results: Record<string, unknown>[] = [];
for (let i = 0; i < ASKS.length; i += 5) {
  const chunk = ASKS.slice(i, i + 5);
  results.push(...(await Promise.all(chunk.map(compose))));
  console.log(`…${Math.min(i + 5, ASKS.length)}/${ASKS.length}`);
}

const summary = {
  model: MODEL,
  ranAt: new Date().toISOString(),
  total: results.length,
  validFirstTry: results.filter((r) => r.attempt1Valid).length,
  validAfterRetry: results.filter((r) => r.valid).length,
  kindsUsedOverall: [...new Set(results.flatMap((r) => r.kinds as string[]))].sort(),
  restraintProseOnly: results
    .filter((r) => r.tag === 'restraint' && r.valid)
    .map((r) => ({
      id: r.id,
      kinds: r.kinds,
      proseOnly: (r.kinds as string[]).every((k) => k === 'prose'),
    })),
};
writeFileSync('src/app/(app)/dev/cards/spike-results.json', JSON.stringify({ summary, results }, null, 1));
console.log(JSON.stringify(summary, null, 1));
console.log('failed:', results.filter((r) => !r.valid).map((r) => `${r.id}: ${r.error}`));
