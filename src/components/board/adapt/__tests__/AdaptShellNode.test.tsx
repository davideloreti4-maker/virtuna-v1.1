/** @vitest-environment happy-dom */
/**
 * AdaptShellNode tests — updated for Phase 4 (plan 04-04).
 *
 * Phase 4 replaced the static descriptor body with <AdaptFrameBody />,
 * so tests that checked for the old locked descriptor text are replaced
 * with structural checks that still confirm the shell properties hold.
 *
 * [Rule 1 - Bug] Auto-fixed: tests had no QueryClientProvider wrapper and
 * checked for the old static descriptor that AdaptFrameBody now replaces.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { AdaptShellNode } from '../AdaptShellNode';

// =====================================================
// Module mocks — hooks used by AdaptFrameBody
// =====================================================

vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: vi.fn(() => ({ result: null, status: 'idle' })),
}));

vi.mock('@/hooks/queries/use-permalink-analysis', () => ({
  usePermalinkAnalysis: vi.fn(() => ({ data: null, id: null, isLoading: false })),
}));

vi.mock('@/hooks/queries/use-creator-profile', () => ({
  useCreatorProfile: vi.fn(() => ({
    data: { niche_primary: 'fitness', niche_sub: 'strength-training' },
  })),
  useUpdateCreatorProfile: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

vi.mock('@/lib/niches/taxonomy', () => ({
  NICHE_TREE: [],
  getNicheBranches: vi.fn(() => []),
  getPrimaryLabel: vi.fn((slug: string) => slug),
  getSubLabel: vi.fn((_: string, sub: string) => sub),
}));

vi.mock('@/hooks/queries/use-adapt-concepts', () => ({
  useAdaptConcepts: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({ concepts: [] }),
    isPending: false,
    isError: false,
    error: null,
  })),
}));

// =====================================================
// Helper
// =====================================================

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  Wrapper.displayName = 'TestQueryWrapper';
  return Wrapper;
}

function renderShell() {
  return render(<AdaptShellNode />, { wrapper: createWrapper() });
}

// =====================================================
// Tests
// =====================================================

describe('AdaptShellNode', () => {
  it('renders a div with data-testid="adapt-shell"', () => {
    renderShell();
    expect(screen.getByTestId('adapt-shell')).toBeTruthy();
  });

  it('root element is a div (DOM component, not Konva)', () => {
    renderShell();
    const root = screen.getByTestId('adapt-shell');
    expect(root.tagName).toBe('DIV');
  });

  it('does not render a skeleton testid', () => {
    renderShell();
    expect(screen.queryByTestId('skeleton')).toBeNull();
  });

  it('does not contain "coming soon" text', () => {
    const { container } = renderShell();
    expect(container.textContent?.toLowerCase()).not.toContain('coming soon');
  });

  it('does not contain old static descriptor text (body replaced by AdaptFrameBody in Phase 4)', () => {
    const { container } = renderShell();
    expect(container.textContent).not.toContain('Niche-adapted concepts drawn from the source format.');
  });

  it('renders AdaptFrameBody as the frame body (Phase 4 wiring complete)', () => {
    const { container } = renderShell();
    // With niche present + no decode: AdaptFrameBody renders empty-state copy
    expect(container.textContent).toContain('Concepts generate once the source video is decoded.');
  });
});
