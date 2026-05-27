/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';

vi.mock('@/hooks/queries', () => ({
  useAnalysisHistory: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/hooks/queries/use-profile', () => ({
  useProfile: () => ({ data: null, isLoading: false }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/analyze',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { Sidebar } from '../Sidebar';

describe('Sidebar a11y', () => {
  it('no violations expanded', async () => {
    const { container } = render(<Sidebar />);
    const results = await axe(container);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(results).toHaveNoViolations();
  });
});
