/** @vitest-environment happy-dom */
/**
 * Task 2: "Test full →" handoff — deep-link the chosen hook into the Test surface (D-05/D-06, HOOKS-03).
 *
 * Asserts the handoff seam:
 *  1. HookCardRenderer reads onTestHook from HookTestContext.
 *  2. Clicking "Test full →" invokes the context callback with (hookLine, audienceArchetype).
 *  3. When no context is set, the button renders as a stub (Plan 01 state — no crash).
 *  4. The onTest prop override takes precedence over context.
 *
 * These tests are RED until the context seam is wired (Task 1 lands the seam;
 * Task 2 verifies the behavior contract).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HookCardRenderer } from '@/components/thread/hook-card-block';
import { HookTestContext, HookWriteScriptContext } from '@/lib/hook-test-context';
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

describe('HookCardRenderer — "Test full →" handoff seam (D-05/D-06, HOOKS-03)', () => {
  it('calls the HookTestContext callback with hookLine + audienceArchetype on click', () => {
    const onTestHook = vi.fn();

    renderWithClient(
      <HookTestContext.Provider value={onTestHook}>
        <HookCardRenderer block={mockBlock} />
      </HookTestContext.Provider>,
    );

    const ctaBtn = screen.getByRole('button', { name: /test this hook/i });
    fireEvent.click(ctaBtn);

    expect(onTestHook).toHaveBeenCalledTimes(1);
    expect(onTestHook).toHaveBeenCalledWith(
      mockBlock.props.hookLine,
      mockBlock.props.audienceArchetype,
    );
  });

  it('renders the CTA button as enabled when HookTestContext provides a callback', () => {
    const onTestHook = vi.fn();

    renderWithClient(
      <HookTestContext.Provider value={onTestHook}>
        <HookCardRenderer block={mockBlock} />
      </HookTestContext.Provider>,
    );

    const ctaBtn = screen.getByRole('button', { name: /test this hook/i });
    expect(ctaBtn).not.toBeDisabled();
  });

  it('renders the CTA button as a stub (disabled) when no context callback is set', () => {
    // Default context value is null → stub behavior (Plan 01 state)
    renderWithClient(<HookCardRenderer block={mockBlock} />);

    const ctaBtn = screen.getByRole('button', { name: /test this hook/i });
    expect(ctaBtn).toBeDisabled();
  });

  it('prop override (onTest) takes precedence over context callback', () => {
    const contextFn = vi.fn();
    const propFn = vi.fn();

    renderWithClient(
      <HookTestContext.Provider value={contextFn}>
        <HookCardRenderer block={mockBlock} onTest={propFn} />
      </HookTestContext.Provider>,
    );

    const ctaBtn = screen.getByRole('button', { name: /test this hook/i });
    fireEvent.click(ctaBtn);

    expect(propFn).toHaveBeenCalledTimes(1);
    expect(contextFn).not.toHaveBeenCalled();
  });

  it('does NOT navigate to /analyze — handoff is UI-only (D-05 honesty spine)', () => {
    // The handoff only switches the composer state; no router.push should happen.
    // We verify this by ensuring the callback receives the hook data (UI only),
    // not by checking that an API was called (no API call is the assertion).
    const onTestHook = vi.fn();

    renderWithClient(
      <HookTestContext.Provider value={onTestHook}>
        <HookCardRenderer block={mockBlock} />
      </HookTestContext.Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /test this hook/i }));

    // The callback receives hook data — it's a UI handoff, not a navigation event.
    expect(onTestHook).toHaveBeenCalledWith(
      expect.stringContaining('protein timing'),
      expect.stringContaining('skeptic'),
    );
    // No window.location change (happy-dom doesn't navigate on callbacks)
    expect(window.location.pathname).not.toContain('/analyze');
  });
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

  it('Test and Write-script CTAs fire independently', () => {
    const onTestHook = vi.fn();
    const onWriteScript = vi.fn();

    renderWithClient(
      <HookTestContext.Provider value={onTestHook}>
        <HookWriteScriptContext.Provider value={onWriteScript}>
          <HookCardRenderer block={mockBlock} />
        </HookWriteScriptContext.Provider>
      </HookTestContext.Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /write a full script from this hook/i }));
    expect(onWriteScript).toHaveBeenCalledTimes(1);
    expect(onTestHook).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /test this hook/i }));
    expect(onTestHook).toHaveBeenCalledTimes(1);
    expect(onWriteScript).toHaveBeenCalledTimes(1);
  });
});
