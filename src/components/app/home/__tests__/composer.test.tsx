/** @vitest-environment happy-dom */
/**
 * Composer — TikTok URL validation + upload mount (SHELL-02/03, D-21).
 *
 * London-style: useAnalysisStream, useProfile, next/navigation, and the
 * motion/viewport hooks are mocked so the test drives the composer's pure
 * UX behavior deterministically.
 *  - A TikTok URL (tiktok.com / vm.tiktok.com) enables the submit control.
 *  - A non-TikTok URL (youtube / instagram) shows the exact D-21 copy and
 *    keeps submit disabled.
 *  - The `+` control mounts VideoUpload (its hidden "Upload video file" input).
 *
 * Written first (Task 1) — RED until the slim composer (Task 2) lands.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// ── controllable stream mock ────────────────────────────────────────────
const start = vi.fn();
let analysisId: string | null = null;

vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: () => ({
    start,
    analysisId,
    result: null,
    stages: [],
    partial: { personas: [] },
    panelReady: {},
    phase: 'idle',
    error: null,
    reconnect: vi.fn(),
    filmstrips: {},
    abort: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock('@/hooks/queries/use-profile', () => ({
  useProfile: () => ({ data: { name: 'Davide' }, isLoading: false }),
}));

const push = vi.fn();
// id absent by default → composer is in the centered/empty layout
let routeId: string | undefined;
vi.mock('next/navigation', () => ({
  useParams: () => (routeId ? { id: routeId } : {}),
  usePathname: () => '/home',
  useRouter: () => ({ push, replace: vi.fn() }),
}));

vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}));

// Supabase client is only touched on an upload submit; stub it so a stray
// import never throws under happy-dom.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
    },
    storage: {
      from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }),
    },
  }),
}));

import { Composer } from '../composer';

const D21 = 'Numen reads TikTok videos for now';

function urlInput(): HTMLInputElement {
  // The single URL/text input — match by its empty-state placeholder.
  return screen.getByPlaceholderText(/paste a tiktok link/i) as HTMLInputElement;
}

function submitButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /simulate|submit|send/i }) as HTMLButtonElement;
}

beforeEach(() => {
  start.mockClear();
  push.mockClear();
  analysisId = null;
  routeId = undefined;
  cleanup();
});

describe('Composer — TikTok URL validation (D-21)', () => {
  it('enables submit when a tiktok.com URL is pasted', () => {
    render(<Composer />);
    fireEvent.change(urlInput(), {
      target: { value: 'https://www.tiktok.com/@creator/video/123' },
    });
    expect(submitButton()).not.toBeDisabled();
  });

  it('enables submit for a vm.tiktok.com short link', () => {
    render(<Composer />);
    fireEvent.change(urlInput(), { target: { value: 'https://vm.tiktok.com/AbCdEf/' } });
    expect(submitButton()).not.toBeDisabled();
  });

  it('rejects a non-TikTok URL with the exact D-21 copy and keeps submit disabled', () => {
    render(<Composer />);
    fireEvent.change(urlInput(), {
      target: { value: 'https://www.youtube.com/watch?v=abc' },
    });
    expect(screen.getByText(new RegExp(D21, 'i'))).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('rejects an Instagram URL (TikTok-only — ContentForm allowed IG, the slim composer must not)', () => {
    render(<Composer />);
    fireEvent.change(urlInput(), {
      target: { value: 'https://www.instagram.com/reel/abc/' },
    });
    expect(screen.getByText(new RegExp(D21, 'i'))).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('does not fire stream.start while the URL is invalid', () => {
    render(<Composer />);
    fireEvent.change(urlInput(), { target: { value: 'not-a-url' } });
    const btn = submitButton();
    fireEvent.click(btn);
    expect(start).not.toHaveBeenCalled();
  });
});

describe('Composer — upload control (SHELL-03)', () => {
  it('mounts VideoUpload (its hidden file input) for the + control', () => {
    render(<Composer />);
    // VideoUpload renders an <input type=file aria-label="Upload video file">.
    expect(screen.getByLabelText(/upload video file/i)).toBeInTheDocument();
  });
});
