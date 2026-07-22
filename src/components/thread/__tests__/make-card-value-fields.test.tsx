/** @vitest-environment happy-dom */
/**
 * Owner value pass (2026-07-22) — the new information fields on the Make cards:
 *  - Hook card: a VISUAL hook (first-frame technique + on-screen setup) rendered beside the
 *    spoken hook line. Optional → absent renders nothing (honesty spine).
 *  - Script card: per-beat FILMING cues + a consolidated "How to film" production summary +
 *    the topic·format meta line. All optional → absent renders nothing.
 *
 * These fields are additive/optional; the guards assert both the present and the honest-absent
 * states so a production run that omits them stays byte-identical to today.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HookCardRenderer } from '@/components/thread/hook-card-block';
import { ScriptCardRenderer } from '@/components/thread/script-card-block';
import { IdeaCardRenderer } from '@/components/thread/idea-card-block';
import { RemixCardRenderer } from '@/components/thread/remix-card-block';
import type { HookCardBlock, ScriptCardBlock, IdeaCardBlock, RemixCardBlock } from '@/lib/tools/blocks';

function renderWithClient(ui: Parameters<typeof render>[0]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function makeHook(overrides: Partial<HookCardBlock['props']> = {}): HookCardBlock {
  return {
    type: 'hook-card',
    props: {
      hookLine: 'Stop editing your videos. Do this instead.',
      audienceArchetype: 'The Busy Pro',
      mechanism: 'Pattern-interrupt via a permission to quit a painful task.',
      seedHook: 'Stop editing your videos.',
      rank: 1,
      band: 'Strong',
      fraction: '7/10 stop',
      scrollQuote: 'Fast and to the point.',
      model: 'sim1-flash',
      channel: 'spoken',
      ...overrides,
    },
  };
}

function makeIdea(overrides: Partial<IdeaCardBlock['props']> = {}): IdeaCardBlock {
  return {
    type: 'idea-card',
    props: {
      title: 'The unglamorous edit that tripled my views',
      angle: 'Show the boring change nobody talks about.',
      whyItFits: 'fits your growth-focused fitness niche',
      mechanism: 'Curiosity gap on an unexpected lever.',
      seedHook: 'I stopped editing and my views tripled.',
      needsTake: false,
      topic: 'Editing',
      take: 'Less is more',
      format: 'Talking-head',
      band: 'Strong',
      fraction: '8/10 stop',
      scrollQuote: 'Wait, less editing?',
      model: 'sim1-flash',
      ...overrides,
    },
  };
}

function makeRemix(overrides: Partial<RemixCardBlock['props']> = {}): RemixCardBlock {
  return {
    type: 'remix-card',
    props: {
      adaptedHook: 'The real reason 90% of beginners quit',
      angle: 'Cold-open pattern interrupt for your niche.',
      whoItsFor: 'Beginner fitness creators',
      formatBorrowed: 'open-loop cold open',
      sourceDecode: {
        hookPattern: 'Pattern interrupt in the first frame.',
        structure: 'Fast setup then payoff.',
        theTurn: 'Unexpected pivot.',
        emotionalBeat: 'Hope and resolve.',
      },
      band: 'Strong',
      fraction: '8/10 stop',
      scrollQuote: 'Okay that got me.',
      model: 'sim1-flash',
      ...overrides,
    },
  };
}

function makeScript(overrides: Partial<ScriptCardBlock['props']> = {}): ScriptCardBlock {
  return {
    type: 'script-card',
    props: {
      openingBeatSeed: 'I stopped editing my videos and my views tripled.',
      beats: [
        {
          label: 'Hook',
          content: 'I stopped editing my videos and my views tripled.',
          timing: '0–3s',
          retentionMarker: 'Outcome-first claim creates a how-gap.',
          filming: 'Close-up, handheld · text slams in on tripled · deadpan.',
        },
      ],
      band: 'Strong',
      fraction: '7/10 stop',
      scrollQuote: 'Fast and to the point.',
      model: 'sim1-flash',
      ...overrides,
    },
  };
}

beforeEach(() => cleanup());

describe('HookCardRenderer — visual hook', () => {
  it('renders the technique name + on-screen line when visualHook is present', () => {
    renderWithClient(
      <HookCardRenderer
        block={makeHook({
          visualHook: { technique: 'crash-zoom', onScreen: 'Hard cut to your face as the words slam on.' },
        })}
      />,
    );
    expect(screen.getByText('crash-zoom')).toBeTruthy();
    expect(screen.getByText(/Hard cut to your face/i)).toBeTruthy();
    // The "Visual" label marks the row.
    expect(screen.getByText('Visual')).toBeTruthy();
  });

  it('renders nothing visual-hook-shaped when the field is absent (honesty spine)', () => {
    renderWithClient(<HookCardRenderer block={makeHook()} />);
    expect(screen.queryByText('Visual')).toBeNull();
  });
});

describe('HookCardRenderer — projected vs measured provenance (honesty spine)', () => {
  // New Qwen call system (2026-07-22): a generation-time card's /10 is the WRITER'S estimate, no
  // persona SIM ran. It MUST NOT claim a measured room reaction — no past-tense "stopped", no
  // "SIM-1 Flash" badge. "would stop" + "· projected" is the honest read; "See the room →" measures.
  it('a projected card reads in the conditional and never claims a measurement', () => {
    const { container } = renderWithClient(
      <HookCardRenderer block={makeHook({ provenance: 'projected', fraction: '8/10 stop' })} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('would stop'); // conditional, not past tense
    expect(text).toContain('projected'); // the honest provenance tag
    expect(text).not.toContain('SIM-1 Flash'); // must not wear the measured-panel badge
    expect(text).not.toContain('stopped'); // must not claim a completed reaction
  });

  it('a card WITHOUT provenance is a legacy MEASURED card — unchanged wording (back-compat)', () => {
    const { container } = renderWithClient(<HookCardRenderer block={makeHook({ fraction: '8/10 stop' })} />);
    const text = container.textContent ?? '';
    expect(text).toContain('stopped'); // measured past tense
    expect(text).toContain('SIM-1 Flash'); // the measured-panel provenance
    expect(text).not.toContain('would stop');
    expect(text).not.toContain('projected');
  });
});

describe('ScriptCardRenderer — filming instructions', () => {
  it('renders the per-beat filming cue by default (not behind the caret)', () => {
    renderWithClient(<ScriptCardRenderer block={makeScript()} />);
    expect(screen.getByText(/Close-up, handheld/i)).toBeTruthy();
  });

  it('renders the consolidated "How to film" summary when production is present', () => {
    renderWithClient(
      <ScriptCardRenderer
        block={makeScript({
          production: {
            shots: '1 talking-head + 2 b-roll.',
            onScreenText: 'Hook caption; one payoff card.',
            setup: 'Phone at eye level, window light.',
            edit: 'Hard cuts only.',
          },
        })}
      />,
    );
    expect(screen.getByText('How to film')).toBeTruthy();
    expect(screen.getByText(/1 talking-head/i)).toBeTruthy();
    expect(screen.getByText(/Hard cuts only/i)).toBeTruthy();
  });

  it('renders the topic · format meta line when present', () => {
    renderWithClient(<ScriptCardRenderer block={makeScript({ topic: 'Creator growth', format: 'Talking-head' })} />);
    expect(screen.getByText(/Talking-head · Creator growth/i)).toBeTruthy();
  });

  it('omits production + meta when absent (honesty spine)', () => {
    renderWithClient(<ScriptCardRenderer block={makeScript()} />);
    expect(screen.queryByText('How to film')).toBeNull();
  });
});

// New Qwen call system (2026-07-22) — the projected/measured honesty seam, fanned out to the other
// Make cards. A generation-time card's /10 is the WRITER'S estimate (no persona SIM ran), so it MUST
// read in the conditional ("would stop") and MUST NOT wear a measurement badge ("SIM-1 Flash") or
// past-tense ("stopped"). Absent provenance ⇒ legacy MEASURED (back-compat).

describe('IdeaCardRenderer — projected vs measured provenance (honesty spine)', () => {
  it('a projected card reads in the conditional and never claims a measurement', () => {
    const { container } = renderWithClient(
      <IdeaCardRenderer block={makeIdea({ provenance: 'projected' })} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('would stop');
    expect(text).toContain('projected');
    expect(text).not.toContain('SIM-1 Flash');
    expect(text).not.toContain('stopped');
  });

  it('a card WITHOUT provenance is a legacy MEASURED card — unchanged wording (back-compat)', () => {
    const { container } = renderWithClient(<IdeaCardRenderer block={makeIdea()} />);
    const text = container.textContent ?? '';
    expect(text).toContain('stopped');
    expect(text).toContain('SIM-1 Flash');
    expect(text).not.toContain('would stop');
    expect(text).not.toContain('projected');
  });
});

describe('ScriptCardRenderer — projected vs measured provenance (honesty spine)', () => {
  // NOTE: assert on the fraction-verb of the ProofUnit ("7/10 would stop" / "7/10 stopped"), not a
  // bare "stopped" — the beat CONTENT ("I stopped editing…") also contains the word.
  it('a projected card reads the opener count in the conditional, never past tense', () => {
    const { container } = renderWithClient(
      <ScriptCardRenderer block={makeScript({ provenance: 'projected' })} />,
    );
    const text = container.textContent ?? '';
    expect(text).toMatch(/\d+\/10 would stop/);
    expect(text).not.toMatch(/\d+\/10 stopped/);
  });

  it('a card WITHOUT provenance keeps the measured past tense (back-compat)', () => {
    const { container } = renderWithClient(<ScriptCardRenderer block={makeScript()} />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/\d+\/10 stopped/);
    expect(text).not.toMatch(/\d+\/10 would stop/);
  });
});

describe('RemixCardRenderer — projected vs measured provenance (honesty spine)', () => {
  it('a projected card reads in the conditional and never claims a measurement', () => {
    const { container } = renderWithClient(
      <RemixCardRenderer block={makeRemix({ provenance: 'projected' })} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('would stop');
    expect(text).toContain('projected');
    expect(text).not.toContain('SIM-1 Flash');
    expect(text).not.toContain('stopped');
  });

  it('a card WITHOUT provenance is a legacy MEASURED card — unchanged wording (back-compat)', () => {
    const { container } = renderWithClient(<RemixCardRenderer block={makeRemix()} />);
    const text = container.textContent ?? '';
    expect(text).toContain('stopped');
    expect(text).toContain('SIM-1 Flash');
    expect(text).not.toContain('would stop');
    expect(text).not.toContain('projected');
  });
});
