/** @vitest-environment happy-dom */
/**
 * ProgressChecklist — seeded-plan behaviour lock.
 *
 * The premium loading spine must render the WHOLE pipeline up front when a `plan` is passed —
 * the current step `active`, the rest `pending` ahead — so a long opaque await (e.g. the ~50s
 * hooks "Generating" phase) reads like a legible roadmap, not a lone spinner row. Live stage
 * events overlay their real status onto the plan.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act } from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';
import {
  ProgressChecklist,
  SkillProgress,
  STAGE_PLANS,
} from '@/components/thread/progress-checklist';
import type { RunEvidence } from '@/lib/tools/evidence';

afterEach(cleanup);

const OUTLIERS: RunEvidence = {
  headline: 'Drafting against 2 proven videos',
  items: [
    {
      kind: 'video',
      image: 'https://cdn.example/a.jpg',
      label: 'zachking',
      metric: '44× vs followers',
    },
    { kind: 'video', image: 'https://cdn.example/b.jpg', label: 'mrbeast', metric: '2M views' },
  ],
};

describe('ProgressChecklist — seeded plan (premium loading rhythm)', () => {
  it('renders the FULL plan up front, first step active, before any live event', () => {
    render(<ProgressChecklist stages={[]} plan={STAGE_PLANS.hooks} />);

    // Every hooks pipeline step is visible from the first frame — not revealed one-at-a-time.
    for (const name of STAGE_PLANS.hooks) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    // The first step reads active (aria-label "<name>: active"); the rest are pending ahead.
    expect(screen.getByLabelText('Generating: active')).toBeInTheDocument();
    expect(screen.getByLabelText('Ranking: pending')).toBeInTheDocument();
  });

  it('overlays a live stage status onto the seeded plan', () => {
    render(
      <ProgressChecklist
        stages={[
          { name: 'Generating', status: 'done' },
          { name: 'Self-judge', status: 'active' },
        ]}
        plan={STAGE_PLANS.hooks}
      />,
    );

    expect(screen.getByLabelText('Generating: done')).toBeInTheDocument();
    expect(screen.getByLabelText('Self-judge: active')).toBeInTheDocument();
    // Steps with no live event yet stay pending ahead.
    expect(screen.getByLabelText('Simulating your audience: pending')).toBeInTheDocument();
    expect(screen.getByLabelText('Ranking: pending')).toBeInTheDocument();
  });

  it('falls back to live-only stages (emit order) when no plan is passed', () => {
    render(<ProgressChecklist stages={[{ name: 'Pulling outliers', status: 'active' }]} />);

    expect(screen.getByText('Pulling outliers')).toBeInTheDocument();
    // No seeded steps invented.
    expect(screen.queryByText('Ranking')).not.toBeInTheDocument();
  });

  it('renders nothing when there is no plan and no live stages', () => {
    const { container } = render(<ProgressChecklist stages={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('PREPENDS an off-plan stage that fired before any plan stage (grounding pre-stage)', () => {
    // Grounding's "Finding proven outliers" is env-gated so it's not in the static plan, but it
    // runs BEFORE Generating. It must render FIRST (and the plan must not also claim active).
    render(
      <ProgressChecklist
        stages={[{ name: 'Finding proven outliers', status: 'active' }]}
        plan={STAGE_PLANS.hooks}
      />,
    );

    const rows = screen.getAllByLabelText(/: (active|done|pending)$/);
    expect(rows[0]).toHaveAccessibleName('Finding proven outliers: active');
    expect(screen.getByLabelText('Generating: pending')).toBeInTheDocument();
  });

  it('APPENDS an off-plan stage that fired after plan stages began (legacy defensive path)', () => {
    render(
      <ProgressChecklist
        stages={[
          { name: 'Generating', status: 'done' },
          { name: 'Surprise stage', status: 'active' },
        ]}
        plan={STAGE_PLANS.hooks}
      />,
    );

    const rows = screen.getAllByLabelText(/: (active|done|pending)$/);
    expect(rows[rows.length - 1]).toHaveAccessibleName('Surprise stage: active');
    expect(rows[0]).toHaveAccessibleName('Generating: done');
  });
});

/**
 * The evidence rail — the artifacts the engine touched, shown INSIDE the wait.
 *
 * The placement rule is the whole design: evidence hangs off the step CURRENTLY RUNNING, not off
 * the step that produced it. A grounded run retrieves its outliers during "Finding proven outliers"
 * and then spends ~40s in "Generating" drafting against them — so the rail belongs under
 * `Generating`, where it answers "what is it doing right now", rather than under a finished step
 * the creator has already stopped reading.
 */
describe('ProgressChecklist — the evidence rail', () => {
  it('renders the artifacts under the step that is RUNNING, not the one that found them', () => {
    render(
      <ProgressChecklist
        stages={[
          { name: 'Finding proven outliers', status: 'done' },
          { name: 'Generating', status: 'active' },
        ]}
        plan={STAGE_PLANS.hooks}
        evidence={OUTLIERS}
      />,
    );

    const activeRow = screen.getByLabelText('Generating: active');
    expect(within(activeRow).getByTestId('run-evidence')).toBeInTheDocument();
    expect(
      within(activeRow).getByText('Drafting against 2 proven videos'),
    ).toBeInTheDocument();
    expect(within(activeRow).getAllByTestId('run-evidence-item')).toHaveLength(2);

    // …and NOT under the step that retrieved them.
    const doneRow = screen.getByLabelText('Finding proven outliers: done');
    expect(within(doneRow).queryByTestId('run-evidence')).not.toBeInTheDocument();
  });

  it('honours a payload that NAMES its row, over the row that happens to be active', () => {
    // A concurrent run breaks the active-row rule. The account read fires two independent Apify
    // scrapes and a live run measured the posts landing 18s before the profile — so the posts row
    // is done while the profile row is still going, and "hangs off the active row" would draw the
    // creator's own covers under "Finding your profile".
    const PLAN = ['Finding your profile', 'Reading your recent posts'];
    render(
      <ProgressChecklist
        stages={[
          { name: 'Finding your profile', status: 'active' },
          { name: 'Reading your recent posts', status: 'done' },
        ]}
        plan={PLAN}
        evidence={{ ...OUTLIERS, step: 'Reading your recent posts' }}
      />,
    );

    const postsRow = screen.getByLabelText('Reading your recent posts: done');
    expect(within(postsRow).getByTestId('run-evidence')).toBeInTheDocument();

    // The active row must NOT claim artifacts that belong to the other step.
    const profileRow = screen.getByLabelText('Finding your profile: active');
    expect(within(profileRow).queryByTestId('run-evidence')).not.toBeInTheDocument();
  });

  it('narrates ONE row even when several are genuinely live', () => {
    // A concurrent pipeline (the account read's two Apify scrapes) can have two rows live at once.
    // Letting each wear the full live treatment put two coral nodes and two running clocks on
    // screen for half the wait, undoing the craft pass that took accent-filled elements 4 → 1.
    const PLAN = ['Finding your profile', 'Reading your recent posts'];
    render(
      <ProgressChecklist
        stages={[
          { name: 'Finding your profile', status: 'active' },
          { name: 'Reading your recent posts', status: 'active' },
        ]}
        plan={PLAN}
      />,
    );

    // Exactly one shimmering label — the answer to "where am I".
    expect(document.querySelectorAll('.text-shimmer')).toHaveLength(1);
    const lead = screen.getByLabelText('Finding your profile: active');
    expect(lead.querySelector('.text-shimmer')).not.toBeNull();

    // …and the second live row is still LIVE, just quiet: no shimmer, no second clock.
    const quiet = screen.getByLabelText('Reading your recent posts: active');
    expect(quiet.querySelector('.text-shimmer')).toBeNull();
    expect(within(quiet).queryByTestId('stage-elapsed')).not.toBeInTheDocument();
  });

  it('falls back to the active row when the payload names a row that is not in the plan', () => {
    // Defensive: a stale or mistyped name must degrade to the old behaviour, never to no rail.
    render(
      <ProgressChecklist
        stages={[
          { name: 'Finding proven outliers', status: 'done' },
          { name: 'Generating', status: 'active' },
        ]}
        plan={STAGE_PLANS.hooks}
        evidence={{ ...OUTLIERS, step: 'A row that does not exist' }}
      />,
    );

    const activeRow = screen.getByLabelText('Generating: active');
    expect(within(activeRow).getByTestId('run-evidence')).toBeInTheDocument();
  });

  it('renders no rail at all when the run produced no evidence', () => {
    // An ungrounded generation is the DEFAULT path (grounding is env-gated and explicit-scrape
    // only), so "no evidence" must be a silent, unlabelled non-event — not an empty rail.
    render(<ProgressChecklist stages={[]} plan={STAGE_PLANS.hooks} evidence={null} />);
    expect(screen.queryByTestId('run-evidence')).not.toBeInTheDocument();
  });

  it('draws every planned filmstrip slot up front, so the strip fills instead of growing', () => {
    render(
      <ProgressChecklist
        stages={[{ name: 'Watching it frame by frame', status: 'active' }]}
        evidence={{
          headline: 'Reading your footage',
          slots: 8,
          items: [
            { kind: 'frame', image: '/f/0.jpg', idx: 0 },
            { kind: 'frame', image: '/f/1.jpg', idx: 1 },
          ],
        }}
      />,
    );

    const strip = screen.getByTestId('run-evidence-strip');
    // 8 slots drawn; 2 of them carry a real frame.
    expect(strip.children).toHaveLength(8);
    expect(screen.getAllByTestId('run-evidence-frame')).toHaveLength(2);
  });

  it('keeps the evidence visible in the final beat, when every step has landed', () => {
    // The run settles a moment before the cards swap in. With no active row the rail falls to the
    // last step rather than blinking out of the wait it belonged to.
    render(
      <ProgressChecklist
        stages={STAGE_PLANS.hooks.map((name) => ({ name, status: 'done' as const }))}
        plan={STAGE_PLANS.hooks}
        evidence={OUTLIERS}
      />,
    );
    expect(screen.getByTestId('run-evidence')).toBeInTheDocument();
  });
});

/**
 * The per-step clock. It reports only what it MEASURED, which makes one case load-bearing: a
 * reloaded turn replays its plan as done (thread-turn.tsx settledStages) without ever having timed
 * a thing, and a reconstructed receipt must not wear a duration nobody recorded.
 */
describe('ProgressChecklist — the measured clock', () => {
  it('stamps no duration on a step that was never seen running', () => {
    render(
      <ProgressChecklist
        stages={STAGE_PLANS.hooks.map((name) => ({ name, status: 'done' as const }))}
        plan={STAGE_PLANS.hooks}
      />,
    );
    expect(screen.queryAllByTestId('stage-elapsed')).toHaveLength(0);
  });

  it('shows nothing yet on a step that just went active (under a second is jitter, not data)', () => {
    render(<ProgressChecklist stages={[]} plan={STAGE_PLANS.hooks} />);
    expect(screen.queryAllByTestId('stage-elapsed')).toHaveLength(0);
  });

  it('counts up while a step runs, then FREEZES the true duration when it lands', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <ProgressChecklist stages={[{ name: 'Generating', status: 'active' }]} />,
      );

      act(() => {
        vi.advanceTimersByTime(4_000);
      });
      expect(screen.getByTestId('stage-elapsed')).toHaveTextContent('4s');

      // The step lands 2.6s after the last tick. The frozen stamp must be the REAL total, not the
      // last value the 1s interval happened to write — a 6.6s step reading "4s" forever is a small
      // lie told on every single run.
      act(() => {
        vi.advanceTimersByTime(2_600);
      });
      rerender(<ProgressChecklist stages={[{ name: 'Generating', status: 'done' }]} />);
      expect(screen.getByTestId('stage-elapsed')).toHaveTextContent('6.6s');

      // …and it stays put: the interval is gone, so time passing no longer moves a finished step.
      act(() => {
        vi.advanceTimersByTime(30_000);
      });
      expect(screen.getByTestId('stage-elapsed')).toHaveTextContent('6.6s');
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops the decimal past 10s, where tenths are noise', () => {
    vi.useFakeTimers();
    try {
      render(<ProgressChecklist stages={[{ name: 'Generating', status: 'active' }]} />);
      act(() => {
        vi.advanceTimersByTime(47_000);
      });
      expect(screen.getByTestId('stage-elapsed')).toHaveTextContent('47s');
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * The craft pass (2026-08-01). The owner's brief was that the dot+line had to read like something
 * ChatGPT/Perplexity/Claude would release. The diagnosis was that the progress CHROME out-shouted
 * the creator's own retrieved material, so these lock the inversion — not the pixel values, but
 * the decisions that would silently rot back.
 */
describe('SkillProgress — one clock, not four', () => {
  it('shows the run clock in the head and NO per-step stamps while live', () => {
    vi.useFakeTimers();
    try {
      render(
        <SkillProgress
          stages={[{ name: 'Generating', status: 'active' }]}
          plan={STAGE_PLANS.hooks}
          isStreaming
          summaryLabel="Ran your audience"
          runningLabel="Writing hooks"
          tookLabel="Generated in"
        />,
      );
      act(() => {
        vi.advanceTimersByTime(12_000);
      });

      // ONE clock, in the surface head.
      expect(screen.getByTestId('run-elapsed')).toHaveTextContent('0:12');
      // …and not a tabular number on every row competing with it.
      expect(screen.queryAllByTestId('stage-elapsed')).toHaveLength(0);
      // The run's own name leads the surface.
      expect(screen.getByText('Writing hooks')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('collapses to the MEASURED total, and keeps each step’s duration in the expanded receipt', () => {
    vi.useFakeTimers();
    try {
      const props = {
        plan: ['Generating', 'Ranking'],
        summaryLabel: 'Ran your audience',
        runningLabel: 'Writing hooks',
        tookLabel: 'Generated in',
      };
      const { rerender } = render(
        <SkillProgress {...props} stages={[{ name: 'Generating', status: 'active' }]} isStreaming />,
      );

      // Generating runs 20s, then lands; Ranking runs 12s.
      act(() => {
        vi.advanceTimersByTime(20_000);
      });
      rerender(
        <SkillProgress
          {...props}
          stages={[
            { name: 'Generating', status: 'done' },
            { name: 'Ranking', status: 'active' },
          ]}
          isStreaming
        />,
      );
      act(() => {
        vi.advanceTimersByTime(12_000);
      });
      rerender(
        <SkillProgress
          {...props}
          stages={[
            { name: 'Generating', status: 'done' },
            { name: 'Ranking', status: 'done' },
          ]}
          isStreaming={false}
        />,
      );

      // The receipt wears the real 32s total — the v3.2 sketch's "Generated in 0:32".
      expect(screen.getByTestId('run-elapsed')).toHaveTextContent('0:32');

      // The per-step durations were lifted out of the rows before they unmounted, and surface here.
      act(() => {
        screen.getByTestId('run-receipt').click();
      });
      const stamps = screen.getAllByTestId('stage-elapsed').map((n) => n.textContent);
      expect(stamps).toEqual(['20s', '12s']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a RELOADED turn wears no duration — it measured nothing', () => {
    // thread-turn replays a persisted turn's plan as done without ever streaming. The receipt must
    // fall back to the step count; a reconstructed receipt must not claim a time nobody recorded.
    render(
      <SkillProgress
        stages={STAGE_PLANS.hooks.map((name) => ({ name, status: 'done' as const }))}
        plan={STAGE_PLANS.hooks}
        isStreaming={false}
        summaryLabel="Ran your audience"
        runningLabel="Writing hooks"
        tookLabel="Generated in"
      />,
    );
    expect(screen.queryByTestId('run-elapsed')).not.toBeInTheDocument();
    expect(screen.getByText(/3 steps/)).toBeInTheDocument();
  });
});

describe('ProgressChecklist — the evidence headline replaces the sub-detail', () => {
  it('does not stack a rotation line above the rail saying the same thing', () => {
    render(
      <ProgressChecklist
        stages={[{ name: 'Generating', status: 'active' }]}
        plan={STAGE_PLANS.hooks}
        evidence={OUTLIERS}
      />,
    );
    // The rail's headline is the sub-line…
    expect(screen.getByText('Drafting against 2 proven videos')).toBeInTheDocument();
    // …and STAGE_COPY_ROTATION's near-identical phrasing does not also render above it.
    expect(screen.queryByText('Drafting angles against your audience')).not.toBeInTheDocument();
  });

  it('still shows the rotating sub-detail on a step with no evidence', () => {
    render(
      <ProgressChecklist stages={[{ name: 'Generating', status: 'active' }]} plan={STAGE_PLANS.hooks} />,
    );
    expect(screen.getByText('Drafting angles against your audience')).toBeInTheDocument();
  });
});

describe('SkillProgress — the settled receipt carries no live rail', () => {
  it('drops the evidence when the run collapses to its receipt', () => {
    // Evidence is in-flight furniture. Once the cards land they ARE the evidence, and a rail of
    // sources under a receipt would compete with the receipts already on the cards.
    render(
      <SkillProgress
        stages={[{ name: 'Generating', status: 'done' }]}
        plan={STAGE_PLANS.hooks}
        isStreaming={false}
        summaryLabel="Ran your audience"
        evidence={OUTLIERS}
      />,
    );
    expect(screen.getByText('Ran your audience')).toBeInTheDocument();
    expect(screen.queryByTestId('run-evidence')).not.toBeInTheDocument();
  });
});
