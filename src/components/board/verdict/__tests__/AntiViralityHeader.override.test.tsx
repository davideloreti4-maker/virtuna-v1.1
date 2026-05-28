/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AntiViralityHeader } from '../AntiViralityHeader';
import { fixtures } from './fixtures/prediction-result';
import { AV_OVERRIDE_LOCALSTORAGE_PREFIX } from '../verdict-constants';

// logger.info is used for telemetry (logger has no .event method — deviation documented in SUMMARY).
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
}));

import { logger } from '@/lib/logger';

// happy-dom localStorage.clear is not available in all versions — stub with Map-backed impl.
const localStorageStore = new Map<string, string>();
const localStorageMock: Storage = {
  get length() { return localStorageStore.size; },
  key: (i) => Array.from(localStorageStore.keys())[i] ?? null,
  getItem: (k) => localStorageStore.get(k) ?? null,
  setItem: (k, v) => { localStorageStore.set(k, v); },
  removeItem: (k) => { localStorageStore.delete(k); },
  clear: () => { localStorageStore.clear(); },
};
vi.stubGlobal('localStorage', localStorageMock);
// Also stub window.localStorage for component code that accesses it via window
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

describe('AntiViralityHeader — override flow', () => {
  beforeEach(() => {
    localStorageStore.clear();
    vi.clearAllMocks();
  });

  it('clicking Post anyway writes the localStorage key with the exact prefix', () => {
    render(<AntiViralityHeader result={fixtures.antiVirality} analysisId="abc-123" />);
    fireEvent.click(screen.getByTestId('av-override-link'));
    const key = `${AV_OVERRIDE_LOCALSTORAGE_PREFIX}abc-123`;
    expect(window.localStorage.getItem(key)).toBe('1');
  });

  it('header dismisses immediately after clicking Post anyway', () => {
    render(<AntiViralityHeader result={fixtures.antiVirality} analysisId="abc-124" />);
    expect(screen.getByTestId('av-header')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('av-override-link'));
    expect(screen.queryByTestId('av-header')).toBeNull();
  });

  it('header does not render on mount if localStorage already has dismissal key', () => {
    const analysisId = 'abc-125';
    window.localStorage.setItem(`${AV_OVERRIDE_LOCALSTORAGE_PREFIX}${analysisId}`, '1');
    const { container } = render(
      <AntiViralityHeader result={fixtures.antiVirality} analysisId={analysisId} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('clicking Post anyway calls logger.info with verdict_anti_virality_override event + analysisId', () => {
    render(<AntiViralityHeader result={fixtures.antiVirality} analysisId="abc-126" />);
    fireEvent.click(screen.getByTestId('av-override-link'));
    expect(logger.info).toHaveBeenCalledWith(
      'verdict_anti_virality_override',
      expect.objectContaining({ analysisId: 'abc-126' }),
    );
  });

  it('localStorage key uses the exact prefix AV_OVERRIDE_LOCALSTORAGE_PREFIX from verdict-constants', () => {
    render(<AntiViralityHeader result={fixtures.antiVirality} analysisId="abc-127" />);
    fireEvent.click(screen.getByTestId('av-override-link'));
    const expectedKey = `${AV_OVERRIDE_LOCALSTORAGE_PREFIX}abc-127`;
    expect(window.localStorage.getItem(expectedKey)).toBe('1');
    // Verify no other keys written (only the correct prefixed key exists)
    expect(window.localStorage.length).toBe(1);
  });
});
