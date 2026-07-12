/** @vitest-environment happy-dom */
/**
 * ProgressChecklist — seeded-plan behaviour lock.
 *
 * The premium loading spine must render the WHOLE pipeline up front when a `plan` is passed —
 * the current step `active`, the rest `pending` ahead — so a long opaque await (e.g. the ~50s
 * hooks "Generating" phase) reads like a legible roadmap, not a lone spinner row. Live stage
 * events overlay their real status onto the plan.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ProgressChecklist, STAGE_PLANS } from '@/components/thread/progress-checklist';

afterEach(cleanup);

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
