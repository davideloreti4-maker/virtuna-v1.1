'use client';

/**
 * DEV-ONLY board design-language preview. Renders the shared board kit
 * (_kit/) in each of the 5 frames' Hero + tiles + tabs composition with
 * representative data — no auth, no data hooks. Lets us QA the new visual
 * language (premium, not busy) against the analytics design refs. The live
 * frames wire this same kit to real analysis data.
 *
 * Route: /board-preview
 */
import {
  FrameHero,
  StatTileRow,
  FrameTabs,
  FrameTabPanel,
  TrendChart,
  DataTable,
  PersonaGraph,
  type PersonaNode,
  type TrendPoint,
} from '@/components/board/_kit';
import { CreatorRulebookCard } from '@/components/board/content-analysis/CreatorRulebookCard';
import type { CreatorRulebook } from '@/lib/engine/creator-rulebook';
import { cn } from '@/lib/utils';

/* Pre-derived Creator Rulebook (preview only — the live frame derives this from the
   analysis via deriveCreatorRulebook). Realistic mix: strong hook, missing close. */
const RULEBOOK_PREVIEW: CreatorRulebook = {
  checks: [
    { id: 'cta_architecture', rule: 'CTA / Conversion Architecture Built In', creator: 'Hormozi', status: 'fail', actual: 'absent', target: 'present', note: 'The ending emotion / ask decides the viewer verdict — build it in.' },
    { id: 'audio_off_text', rule: 'Burned-in text for audio-off viewers', creator: 'Hormozi', status: 'warn', actual: '5/10', target: 'readable on mute', numericRule: 19, note: '~50% watch muted — on-screen text is mandatory, not optional.' },
    { id: 'share_trigger', rule: 'Shareability trigger', creator: 'Hoyos', status: 'warn', actual: '6/10', target: '≥7/10', numericRule: 35, note: 'Shareability (not just retention) drives true viral growth.' },
    { id: 'hook_strength', rule: 'The Hook Decides Everything', creator: 'Hoyos', status: 'pass', actual: '8.2/10', target: '≥7/10', numericRule: 16, note: 'First 2–3s decides ~80% of performance — keep critique weight here.' },
    { id: 'three_hook_stack', rule: 'Three-Hook Stack (see + read + hear)', creator: 'Ava', status: 'pass', actual: '3/3', target: '3/3', numericRule: 2, note: 'Stack a visual, a text, and an audio hook inside the first 3 seconds.' },
    { id: 'length_fit', rule: 'Optimal Short length', creator: 'Hoyos', status: 'pass', actual: '34s', target: '~34s · ≤60s', numericRule: 5, note: 'In the ~34s sweet spot.' },
    { id: 'pacing', rule: 'Clean cuts / pace breaks', creator: 'Hormozi', status: 'pass', actual: '7/10', target: '≥7/10', numericRule: 20, note: 'Clean cut every 3–4s; cut filler before the hook lands.' },
    { id: 'cognitive_load', rule: 'Low cognitive load (reading-level proxy)', creator: 'Ava', status: 'unknown', actual: null, target: '≤4/10 load', note: 'Needs richer video signal.' },
  ],
  passCount: 4,
  warnCount: 2,
  failCount: 1,
  knownCount: 7,
  coveragePct: 88,
};

/* ── faux video stills (preview only — the live frames render real keyframe
 *    <img>s graded by energy; this just communicates the treatment) ── */
const SCENES = [
  'radial-gradient(115% 90% at 34% 26%, #3a2740 0%, #0c0a12 70%)',
  'radial-gradient(120% 90% at 66% 30%, #45301d 0%, #110c09 72%)',
  'linear-gradient(155deg, #1f2d36 0%, #0a0e11 76%)',
  'radial-gradient(120% 100% at 50% 82%, #3a2630 0%, #0e0a0c 72%)',
  'radial-gradient(105% 90% at 26% 40%, #2d2536 0%, #0b0a10 70%)',
  'linear-gradient(165deg, #38291d 0%, #100b08 78%)',
  'radial-gradient(120% 90% at 70% 60%, #233036 0%, #0a0d10 72%)',
  'radial-gradient(112% 90% at 46% 30%, #3c2433 0%, #0f0a0d 70%)',
];

function FilmCell({
  scene,
  energy = 0.6,
  timecode,
  label,
  marked,
  ratio = 'vertical',
  className,
}: {
  scene: string;
  energy?: number;
  timecode?: string;
  label?: string;
  marked?: boolean;
  ratio?: 'vertical' | 'square' | 'wide';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[6px] border',
        ratio === 'vertical' ? 'aspect-[9/16]' : ratio === 'wide' ? 'aspect-video' : 'aspect-square',
        marked ? 'border-accent/60' : 'border-white/[0.07]',
        className,
      )}
    >
      <div
        className="absolute inset-0"
        style={{ background: scene, filter: `saturate(${(0.65 + energy * 0.7).toFixed(2)}) brightness(${(0.68 + energy * 0.55).toFixed(2)})` }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 100% at 50% 32%, transparent 42%, rgba(0,0,0,0.55) 100%)' }}
      />
      {label && (
        <span className="absolute left-1 top-1 rounded-[3px] bg-accent px-1 text-[8px] font-semibold uppercase tracking-wide text-[#1a0f0a]">
          {label}
        </span>
      )}
      {timecode && (
        <span className="absolute bottom-1 left-1 rounded-[3px] bg-black/55 px-1 text-[8px] tabular-nums text-white/85">
          {timecode}
        </span>
      )}
    </div>
  );
}

function VideoPoster({ scene, duration }: { scene: string; duration: string }) {
  return (
    <div className="relative aspect-[9/16] w-[60px] shrink-0 overflow-hidden rounded-[8px] border border-white/[0.1]">
      <div className="absolute inset-0" style={{ background: scene }} />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 100% at 50% 30%, transparent 44%, rgba(0,0,0,0.5) 100%)' }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15">
          <div className="ml-[2px] h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-white/90" />
        </div>
      </div>
      <span className="absolute bottom-1 right-1 rounded-[3px] bg-black/55 px-1 text-[8px] tabular-nums text-white/85">
        {duration}
      </span>
    </div>
  );
}

const STILLS = [0.3, 0.72, 0.5, 0.86, 0.6, 0.4, 0.55, 0.7].map((energy, i) => ({
  scene: SCENES[i % SCENES.length] as string,
  energy,
  tc: `0:${String(i * 2).padStart(2, '0')}`,
  label: i === 0 ? 'Hook' : undefined,
  weak: i === 1,
}));

const FIXES = [
  { text: 'Tighten the text overlay to land by 0:01', tc: '0:01', scene: SCENES[1] as string },
  { text: 'Hold the cold-open frame ~0.5s longer', tc: '0:00', scene: SCENES[0] as string },
  { text: 'Add an explicit CTA card at the end', tc: '0:14', scene: SCENES[7] as string },
];

const AUD_DROPS = [
  { tc: '0:00', label: 'Open', scene: SCENES[2] as string },
  { tc: '0:03', label: 'Cold-open drop', scene: SCENES[0] as string, worst: true },
  { tc: '0:09', label: 'Mid drop', scene: SCENES[3] as string },
];

const WHO_LEAVES = [
  { seg: 'Cold-open skeptics', wt: '31%', drop: '0:03', scene: SCENES[0] as string },
  { seg: 'Trend hoppers', wt: '48%', drop: '0:09', scene: SCENES[3] as string },
  { seg: 'Casual viewers', wt: '61%', drop: '0:11', scene: SCENES[6] as string },
  { seg: 'Core + fans', wt: '88%', drop: '—', scene: SCENES[7] as string },
];

function Frame({
  label,
  children,
  width = 380,
}: {
  label: string;
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <section
      className="w-full overflow-hidden rounded-[12px] border border-white/[0.06] bg-transparent"
      style={{ width, maxWidth: '100%' }}
    >
      <div className="flex h-9 items-center justify-between border-b border-white/[0.06] px-3">
        <span className="text-xs font-semibold text-white">{label}</span>
        <span className="text-[10px] text-white/30">preview</span>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

const PERSONAS: PersonaNode[] = [
  { id: 'p1', label: 'Skeptical scroller', weight: 0.9, watchThrough: 0.34, segment: 'Cold open drop', dropAt: '0:03', tone: 'accent' },
  { id: 'p2', label: 'Niche regular', weight: 0.8, watchThrough: 0.82, segment: 'Core' },
  { id: 'p3', label: 'Casual viewer', weight: 0.6, watchThrough: 0.61, segment: 'Mid drop', dropAt: '0:11' },
  { id: 'p4', label: 'Super fan', weight: 0.55, watchThrough: 0.93, segment: 'Core' },
  { id: 'p5', label: 'Trend hopper', weight: 0.7, watchThrough: 0.48, segment: 'Mid drop', dropAt: '0:09', tone: 'accent' },
  { id: 'p6', label: 'Lurker', weight: 0.5, watchThrough: 0.57, segment: 'Mid' },
  { id: 'p7', label: 'Commenter', weight: 0.45, watchThrough: 0.71, segment: 'Engaged' },
  { id: 'p8', label: 'Sharer', weight: 0.4, watchThrough: 0.66, segment: 'Engaged' },
  { id: 'p9', label: 'Saver', weight: 0.35, watchThrough: 0.78, segment: 'Engaged' },
  { id: 'p10', label: 'Drive-by', weight: 0.6, watchThrough: 0.29, segment: 'Cold open drop', dropAt: '0:02', tone: 'accent' },
];

const RETENTION: TrendPoint[] = [
  { x: '0s', current: 100, previous: 100 },
  { x: '3s', current: 71, previous: 64 },
  { x: '6s', current: 63, previous: 55 },
  { x: '9s', current: 54, previous: 44 },
  { x: '12s', current: 49, previous: 38 },
  { x: '15s', current: 46, previous: 33 },
];

const DISTRIBUTION: TrendPoint[] = [
  { x: 30, current: 2 },
  { x: 45, current: 7 },
  { x: 60, current: 16 },
  { x: 70, current: 24 },
  { x: 78, current: 19 },
  { x: 85, current: 11 },
  { x: 95, current: 4 },
];

function EngineStepper() {
  const stages = ['done', 'done', 'done', 'active', 'wait'] as const;
  return (
    <div className="flex items-center gap-1.5">
      {stages.map((s, i) => (
        <div
          key={i}
          className="h-1 flex-1 rounded-full"
          style={{
            background:
              s === 'done'
                ? 'color-mix(in oklch, var(--color-accent) 45%, transparent)'
                : s === 'active'
                  ? 'var(--color-accent)'
                  : 'rgba(255,255,255,0.07)',
          }}
        />
      ))}
    </div>
  );
}

export default function BoardPreviewPage() {
  return (
    <main className="min-h-screen bg-[#07080a] px-4 py-10 sm:px-8">
      <header className="mx-auto mb-8 max-w-[1240px]">
        <h1 className="text-[15px] font-semibold text-white">Board · design-language preview</h1>
        <p className="mt-1 text-[12px] text-white/45">
          Hero + tiles + tabs · one accent (coral) · the shared kit every frame composes.
        </p>
      </header>

      <div className="mx-auto flex max-w-[1240px] flex-wrap items-start gap-5">
        {/* INPUT + ENGINE */}
        <Frame label="Input · Engine" width={300}>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <FrameHero
                label="Predicted rank"
                prefix="Top"
                value="12"
                unit="%"
                status={{ word: 'Strong reach', tone: 'good' }}
                insight="Beats 88% of similar posts in your niche"
              />
            </div>
            <VideoPoster scene={SCENES[0] as string} duration="0:15" />
          </div>
          <div className="mt-4">
            <StatTileRow
              tiles={[
                { k: 'Shares', v: 'Top 8', u: '%' },
                { k: 'Completion', v: 'Top 26', u: '%' },
                { k: 'Comments', v: 'Top 30', u: '%' },
                { k: 'Saves', v: 'Top 32', u: '%' },
              ]}
            />
          </div>
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.08em] text-white/45">Engine</span>
              <span className="text-[11px] tabular-nums text-white/55">5 / 6 signals</span>
            </div>
            <EngineStepper />
            <div className="text-[11px] text-white/40">Niche corpus still warming up</div>
          </div>
        </Frame>

        {/* SCORE */}
        <Frame label="Score">
          <FrameHero
            label="Virality score"
            value={78}
            unit="/100"
            delta={{ value: 10, suffix: ' vs median' }}
            status={{ word: 'Strong — likely to travel', tone: 'good' }}
          />
          <div className="mt-4">
            <StatTileRow
              tiles={[
                { k: 'Share', v: '80', u: 'th', delta: { value: 12 } },
                { k: 'Completion', v: '74', u: 'th', delta: { value: 6 } },
                { k: 'Comment', v: '70', u: 'th', delta: { value: -3 } },
                { k: 'Save', v: '68', u: 'th', delta: { value: 4 } },
              ]}
            />
          </div>
          <div className="mt-5">
            <FrameTabs
              tabs={[
                { value: 'breakdown', label: 'Breakdown' },
                { value: 'distribution', label: 'Distribution' },
                { value: 'history', label: 'History' },
              ]}
            >
              <FrameTabPanel value="breakdown">
                <div className="space-y-2.5">
                  {[
                    ['Hook strength', 82],
                    ['Retention curve', 71],
                    ['Shareability', 79],
                    ['Trend alignment', 64],
                    ['CTA', 31],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex items-center gap-3">
                      <span className="w-[120px] shrink-0 text-[12px] text-white/60">{k}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${v}%` }} />
                      </div>
                      <span className="w-8 shrink-0 text-right text-[12px] tabular-nums text-white/80">{v as number}</span>
                    </div>
                  ))}
                </div>
              </FrameTabPanel>
              <FrameTabPanel value="distribution">
                <TrendChart data={DISTRIBUTION} height={150} fill xFormat={(v) => `${v}`} />
                <p className="mt-1 text-[11px] text-white/40">
                  You scored <span className="text-accent">78</span> · niche median 68 · top quartile 78
                </p>
              </FrameTabPanel>
              <FrameTabPanel value="history">
                <DataTable
                  columns={[
                    { key: 'run', label: 'Run' },
                    { key: 'score', label: 'Score', align: 'right' },
                  ]}
                  rows={[
                    { run: 'This video', score: '78' },
                    { run: '3 days ago', score: '71' },
                    { run: 'Last week', score: '69' },
                  ]}
                  rowKey={(r) => r.run}
                  dense
                />
              </FrameTabPanel>
            </FrameTabs>
          </div>
        </Frame>

        {/* AUDIENCE */}
        <Frame label="Audience" width={400}>
          <FrameHero label="Audience" insight="Cold-open skeptics bail by 0:03 — the core stays to the end.">
            <div className="relative">
              <PersonaGraph personas={PERSONAS} height={200} reducedMotion />
              <div className="pointer-events-none absolute left-0 top-0">
                <div
                  className="text-[44px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-white"
                  style={{ textShadow: '0 2px 14px rgba(0,0,0,0.75)' }}
                >
                  61<span className="ml-0.5 text-[16px] font-medium text-white/40">%</span>
                </div>
                <div className="mt-1.5 text-[13px] font-semibold text-warning">Leaky retention</div>
              </div>
            </div>
          </FrameHero>
          <div className="mt-4">
            <div className="mb-1.5 text-[10px] uppercase tracking-[0.08em] text-white/45">
              Where they drop
            </div>
            <div className="flex gap-1.5">
              {AUD_DROPS.map((d) => (
                <div key={d.tc} className="min-w-0 flex-1">
                  <FilmCell scene={d.scene} ratio="wide" timecode={d.tc} marked={d.worst} />
                  <div className="mt-1 truncate text-[10px] text-white/45">{d.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <StatTileRow
              tiles={[
                { k: 'Niche completion', v: '54', u: '%' },
                { k: 'Finishing', v: '4', u: '/10' },
                { k: 'Biggest drop', v: '0:03', s: 'cold open' },
              ]}
            />
          </div>
          <div className="mt-5">
            <FrameTabs
              tabs={[
                { value: 'retention', label: 'Retention' },
                { value: 'leaves', label: 'Who leaves' },
                { value: 'mix', label: 'Mix' },
              ]}
            >
              <FrameTabPanel value="retention">
                <TrendChart
                  data={RETENTION}
                  height={150}
                  yDomain={[0, 100]}
                  yFormat={(v) => `${v}%`}
                  currentLabel="Weighted"
                  previousLabel="Niche avg"
                />
              </FrameTabPanel>
              <FrameTabPanel value="leaves">
                <div>
                  {WHO_LEAVES.map((r) => (
                    <div
                      key={r.seg}
                      className="flex items-center gap-3 border-b border-white/[0.04] py-2 last:border-0"
                    >
                      <FilmCell
                        scene={r.scene}
                        ratio="square"
                        timecode={r.drop !== '—' ? r.drop : undefined}
                        className="w-8 shrink-0"
                      />
                      <span className="min-w-0 flex-1 text-[13px] text-white/80">{r.seg}</span>
                      <span className="shrink-0 text-[12px] tabular-nums text-white/60">{r.wt}</span>
                    </div>
                  ))}
                </div>
              </FrameTabPanel>
              <FrameTabPanel value="mix">
                <p className="text-[12px] text-white/55">
                  Re-weight the persona mix to match your real audience and the curve recomputes.
                </p>
              </FrameTabPanel>
            </FrameTabs>
          </div>
        </Frame>

        {/* ACTIONS */}
        <Frame label="Actions">
          <FrameHero
            label="Next move"
            value="Fix before posting"
            size="prose"
            status={{ word: 'One quick pass', tone: 'warn' }}
            insight="Text overlay is your weakest modality — tighten it and you clear the bar."
          />
          <div className="mt-4 rounded-[11px] border border-white/[0.06] bg-white/[0.016] p-3">
            <div className="text-[10px] uppercase tracking-[0.08em] text-white/45">Best time to post</div>
            <div className="mt-1 text-[15px] font-semibold text-white">Tue 6:00–9:00 PM</div>
            <div className="mt-0.5 text-[11px] text-white/45">Your niche peaks here (n=42)</div>
          </div>
          <div className="mt-4">
            <div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-white/45">
              Fixes
            </div>
            <div>
              {FIXES.map((f) => (
                <div
                  key={f.text}
                  className="flex items-center gap-3 border-b border-white/[0.04] py-2 last:border-0"
                >
                  <FilmCell scene={f.scene} ratio="square" timecode={f.tc} className="w-9 shrink-0" />
                  <span className="min-w-0 flex-1 text-[13px] text-white/80">{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </Frame>

        {/* CONTENT CRAFT */}
        <Frame label="Content craft" width={400}>
          <p className="text-[20px] font-[450] leading-[1.32] tracking-[-0.014em] text-white" style={{ textWrap: 'balance' }}>
            Strong visual hook and clean pacing, but the{' '}
            <span className="text-accent">text overlay</span> is the weak link.
          </p>
          <div className="mt-3 flex gap-1">
            {STILLS.map((s, i) => (
              <FilmCell
                key={i}
                scene={s.scene}
                energy={s.energy}
                timecode={s.tc}
                label={s.label}
                marked={s.weak}
                className="flex-1"
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-white/40">
            <span>
              Energy arc · <span className="text-accent/80">weak overlay at 0:02</span>
            </span>
            <span className="tabular-nums">0:15</span>
          </div>
          <div className="mt-4">
            <StatTileRow
              tiles={[
                { k: 'Hook', v: '8.2', u: '/10', s: 'visual stop power' },
                { k: 'Pacing', v: '7.0', u: '/10', s: 'slight drag 0:11' },
                { k: 'Audio', v: '6.5', u: '/10', s: 'clear mix' },
                { k: 'CTA', v: '3.1', u: '/10', s: 'weak end ask', tone: 'accent' },
              ]}
            />
          </div>
          {/* Creator Rulebook — the real card (deterministic, attributed scorecard). */}
          <CreatorRulebookCard className="mt-4" rulebook={RULEBOOK_PREVIEW} />
        </Frame>
      </div>
    </main>
  );
}
