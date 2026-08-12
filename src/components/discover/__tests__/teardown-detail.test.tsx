/** @vitest-environment happy-dom */
/**
 * The teardown detail, and the action it makes reachable (2026-08-02).
 *
 * Two backlog items collapse into one fix here:
 *
 *   §5.1 — Remix was `opacity-0 → group-hover:opacity-100` with no pointer-events guard. On a
 *          touch device it could not be SEEN, while still occupying its slot and taking the
 *          tap: a thumb on the lower third of a card fired a remix nobody chose and landed on
 *          /home. Not merely unreachable — mis-firing.
 *   §5.3 — `why_it_works` was read into every card and rendered by nothing.
 *
 * The card now opens a detail that carries the analysis AND a plain visible Remix, so there is
 * one path for every input device. These assert both halves of that, and they are written to
 * FAIL against the pre-2026-08-02 card.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { OutliersPanel } from '@/components/discover/outliers-panel';
import { TeardownDetailDialog } from '@/components/discover/teardown-detail';
import type { CorpusVideo } from '@/lib/discover/corpus-reads';

const mocks = vi.hoisted(() => ({ getTeardownDetail: vi.fn(), push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: vi.fn() }),
}));
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/app/actions/discover/teardown', () => ({
  getTeardownDetail: mocks.getTeardownDetail,
}));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const VIDEO: CorpusVideo = {
  id: '11111111-1111-4111-8111-111111111111',
  videoUrl: 'https://www.tiktok.com/@garyvee/video/1',
  coverUrl: null,
  handle: 'garyvee',
  spokenHook: 'Which of these two videos got more views?',
  template: 'Which of these two [X] got more [Y]?',
  archetype: 'question',
  niche: 'content-creation',
  views: 1_240_000,
  platform: 'tiktok',
  engagement: 0.041,
  postedAt: '2026-06-01T00:00:00Z',
  multiplier: 11.5,
  baselineLabel: 'vs own',
  proven: true,
  extreme: false,
};

/** Longer than the 220-char excerpt this replaces — the tail is what proves it is not cut. */
const WHY =
  'The spoken hook, text overlay, and visual of the creator comparing two videos are perfectly ' +
  'aligned to set up a binary choice. To replicate this, ensure your text overlay states the ' +
  'exact question you ask out loud, and immediately show the two subjects you are comparing. ' +
  'THE TAIL THAT A 220-CHARACTER EXCERPT WOULD HAVE CUT.';

const DETAIL = {
  whyItWorks: WHY,
  format: 'a-vs-b-comparison',
  visualHook: 'greenscreen',
  editingStyle: 'full-screen-hybrid',
};

function renderPanel(onOpen = vi.fn()) {
  render(
    <OutliersPanel
      videos={[VIDEO]}
      query=""
      refreshedLabel="Newest video in the library: Jun 10."
      onOpen={onOpen}
    />,
  );
  return onOpen;
}

describe('§5.1 — the outlier card is reachable without a mouse', () => {
  it('exposes the card itself as the action target', async () => {
    const onOpen = renderPanel();
    const card = screen.getByRole('button', { name: /open teardown: which of these two/i });

    await userEvent.click(card);

    expect(onOpen).toHaveBeenCalledWith(VIDEO.id);
  });

  it('the hover Remix cannot take a tap while it is invisible', () => {
    renderPanel();
    // Queried by class, not by role: it is aria-hidden precisely because it duplicates an
    // action the detail already offers accessibly.
    const remix = document.querySelector('article button[aria-hidden="true"]') as HTMLElement;

    expect(remix).toBeTruthy();
    expect(remix.className).toContain('opacity-0');
    // The whole defect in one assertion — an opacity-0 button with pointer events still
    // swallows the tap that was meant for the card underneath it.
    expect(remix.className).toContain('pointer-events-none');
    expect(remix.className).toContain('group-hover:pointer-events-auto');
    expect(remix.getAttribute('tabindex')).toBe('-1');
  });

  it('leaves exactly one tab stop per card, and it is the one that opens the teardown', () => {
    renderPanel();
    const card = document.querySelector('article') as HTMLElement;
    const focusable = within(card)
      .queryAllByRole('button')
      .filter((b) => b.getAttribute('tabindex') !== '-1');

    expect(focusable).toHaveLength(1);
    expect(focusable[0]!.getAttribute('aria-label')).toMatch(/^Open teardown:/);
  });
});

describe('§5.3 — the detail renders the analysis the corpus already held', () => {
  it('shows why_it_works IN FULL, plus the template and the taxonomy', async () => {
    mocks.getTeardownDetail.mockResolvedValue({ detail: DETAIL });
    render(<TeardownDetailDialog video={VIDEO} onClose={vi.fn()} />);

    expect(mocks.getTeardownDetail).toHaveBeenCalledWith(VIDEO.id);
    await waitFor(() => expect(screen.getByText(new RegExp(WHY.slice(0, 40)))).toBeTruthy());

    // Not an excerpt: the tail beyond 220 characters is present.
    expect(screen.getByText(/THE TAIL THAT A 220-CHARACTER EXCERPT WOULD HAVE CUT/)).toBeTruthy();
    // The reusable pattern is a different column from the line the video actually spoke —
    // the card shows the spoken hook, the detail shows both.
    expect(screen.getByText(VIDEO.template!)).toBeTruthy();
    expect(screen.getByText('A vs b comparison')).toBeTruthy();
    expect(screen.getByText('Greenscreen')).toBeTruthy();
  });

  it('carries a Remix that needs no hover to exist', async () => {
    mocks.getTeardownDetail.mockResolvedValue({ detail: DETAIL });
    render(<TeardownDetailDialog video={VIDEO} onClose={vi.fn()} />);

    const remix = screen.getByRole('button', { name: /remix/i });
    expect(remix.className).not.toContain('opacity-0');
    expect(remix.className).not.toContain('group-hover');
  });

  it('says it could not read rather than rendering an empty analysis', async () => {
    mocks.getTeardownDetail.mockResolvedValue({ error: "Couldn't load the teardown just now." });
    render(<TeardownDetailDialog video={VIDEO} onClose={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByText(/couldn't load the teardown just now/i)).toBeTruthy(),
    );
    // The frame still stands — the card's own data never depended on the fetch.
    expect(screen.getByText(VIDEO.spokenHook!)).toBeTruthy();
  });

  it('does not fetch at all while closed', () => {
    render(<TeardownDetailDialog video={null} onClose={vi.fn()} />);
    expect(mocks.getTeardownDetail).not.toHaveBeenCalled();
  });
});

// axe walks the whole rendered tree and is CPU-heavy. Under the full suite's worker
// contention these two overran vitest's 5s default and failed a run that passed in isolation
// — a flaky gate is worse than no gate, so the budget is explicit and generous.
const AXE_TIMEOUT = 20_000;

describe('a11y — the two patterns this pass introduced', () => {
  // Both are the kind that pass review by eye and fail for a screen reader: a button hidden
  // from AT (legal only because it duplicates a reachable action, and only while it is also
  // unfocusable) and a control stretched over content it does not name.
  //
  // This pair earned its keep immediately: it caught the detail's cover rendering as an
  // `<a href>` whose only child is a decorative image, so a screen reader announced a bare
  // URL (axe: link-name). The desktop one looked named only because its "Watch original"
  // overlay sits in the DOM at opacity-0 — text revealed on hover is not an accessible name.
  it('the outliers grid has no violations', async () => {
    const { container } = render(
      <OutliersPanel
        videos={[VIDEO]}
        query=""
        refreshedLabel="Newest video in the library: Jun 10."
        onOpen={vi.fn()}
      />,
    );
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  }, AXE_TIMEOUT);

  it('the open detail has no violations', async () => {
    mocks.getTeardownDetail.mockResolvedValue({ detail: DETAIL });
    render(<TeardownDetailDialog video={VIDEO} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/THE TAIL THAT A 220/)).toBeTruthy());
    // The dialog portals out of `container`, so scan the element itself.
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(dialog)).toHaveNoViolations();
  }, AXE_TIMEOUT);
});
