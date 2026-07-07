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
});
