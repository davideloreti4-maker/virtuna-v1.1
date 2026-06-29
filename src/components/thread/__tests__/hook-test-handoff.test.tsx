/** @vitest-environment happy-dom */
/**
 * Hook card chain handoff — the "Write script →" seam (CHAIN_HANDOFFS hooks→script).
 *
 * Asserts the forward-chain seam:
 *  1. HookCardRenderer reads onWriteScript from HookWriteScriptContext.
 *  2. Clicking "Write script →" invokes the context callback with (hookLine, audienceArchetype).
 *  3. When no context is set, the button renders as a stub (no crash).
 *  4. The onWriteScript prop override takes precedence over context.
 *
 * lane/polish §1.7 (2026-06-27): the hook card no longer carries a "Test full →" CTA — a hook
 * is only an opener and its handoff sent the same lone line already Flash-read, so "full"
 * referred to nothing. Deep-testing the full script is the Script card's terminal step. The
 * last test guards that the Test-full affordance stays removed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HookCardRenderer } from '@/components/thread/hook-card-block';
import { HookWriteScriptContext } from '@/lib/hook-test-context';
import type { HookCardBlock } from '@/lib/tools/blocks';

// HookCardRenderer mounts SaveAffordance (useSaveItem → useQueryClient), so every
// render must sit under a QueryClientProvider (Phase 10 Saved-shelf integration).
function renderWithClient(ui: Parameters<typeof render>[0]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const mockBlock: HookCardBlock = {
  type: 'hook-card',
  props: {
    hookLine: 'Why protein timing is a myth (and what actually works)',
    audienceArchetype: 'Stops the skeptic',
    mechanism: 'Challenges a deeply held belief with specificity that forces re-evaluation',
    seedHook: 'protein timing myth',
    rank: 1,
    band: 'Strong',
    fraction: '8/10 stop',
    scrollQuote: '"Wait, I thought you had to eat within 30 minutes…"',
    model: 'sim1-flash',
    channel: 'spoken',
  },
};

beforeEach(() => {
  cleanup();
});

describe('HookCardRenderer — "Write script →" handoff seam (CHAIN_HANDOFFS hooks→script)', () => {
  it('calls the HookWriteScriptContext callback with hookLine + audienceArchetype on click', () => {
    const onWriteScript = vi.fn();

    renderWithClient(
      <HookWriteScriptContext.Provider value={onWriteScript}>
        <HookCardRenderer block={mockBlock} />
      </HookWriteScriptContext.Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /write a full script from this hook/i }));

    expect(onWriteScript).toHaveBeenCalledTimes(1);
    expect(onWriteScript).toHaveBeenCalledWith(
      mockBlock.props.hookLine,
      mockBlock.props.audienceArchetype,
    );
  });

  it('renders the CTA enabled when HookWriteScriptContext provides a callback', () => {
    renderWithClient(
      <HookWriteScriptContext.Provider value={vi.fn()}>
        <HookCardRenderer block={mockBlock} />
      </HookWriteScriptContext.Provider>,
    );

    expect(screen.getByRole('button', { name: /write a full script from this hook/i })).not.toBeDisabled();
  });

  it('renders the CTA as a stub (disabled) when no context callback is set', () => {
    renderWithClient(<HookCardRenderer block={mockBlock} />);

    expect(screen.getByRole('button', { name: /write a full script from this hook/i })).toBeDisabled();
  });

  it('prop override (onWriteScript) takes precedence over context callback', () => {
    const contextFn = vi.fn();
    const propFn = vi.fn();

    renderWithClient(
      <HookWriteScriptContext.Provider value={contextFn}>
        <HookCardRenderer block={mockBlock} onWriteScript={propFn} />
      </HookWriteScriptContext.Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /write a full script from this hook/i }));

    expect(propFn).toHaveBeenCalledTimes(1);
    expect(contextFn).not.toHaveBeenCalled();
  });
});

describe('HookCardRenderer — no "Test full" CTA on the hook (lane/polish §1.7)', () => {
  it('renders no Test-full affordance — a hook is only an opener', () => {
    renderWithClient(<HookCardRenderer block={mockBlock} />);
    expect(screen.queryByRole('button', { name: /test/i })).toBeNull();
    expect(screen.queryByText(/test full/i)).toBeNull();
  });
});
