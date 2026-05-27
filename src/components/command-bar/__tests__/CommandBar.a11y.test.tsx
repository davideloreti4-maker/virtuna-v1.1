/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';

vi.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}));

import { useBoardStore } from '@/stores/board-store';
import { CommandBar } from '../CommandBar';

beforeEach(() => useBoardStore.setState({ boardState: 'idle' } as any));

describe('CommandBar a11y', () => {
  it('idle: no violations', async () => {
    useBoardStore.setState({ boardState: 'idle' } as any);
    const { container } = render(<CommandBar />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });

  it('streaming: no violations', async () => {
    useBoardStore.setState({ boardState: 'streaming' } as any);
    const { container } = render(<CommandBar currentStage="Reading the hook…" />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });

  it('complete: no violations', async () => {
    useBoardStore.setState({ boardState: 'complete' } as any);
    const { container } = render(<CommandBar />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});
