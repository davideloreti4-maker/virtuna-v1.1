/**
 * Where signup sends a brand-new account (2026-08-04).
 *
 * WHAT SHIPPED BROKEN. The action redirected to
 * `/login?message=Check your email to confirm your account` UNCONDITIONALLY, on the
 * assumption that a confirmation was always pending. It is not: this Supabase project has
 * email confirmation OFF — it stamps `email_confirmed_at` ~0.09s after creation, sends no
 * mail, and returns a live session which the server client has already written to the
 * cookie. So a signed-in user was told to wait for a message that would never arrive and
 * dropped on /login, which is code-first (the password field sits behind a toggle). The
 * momentum right after the one commitment a visitor makes was spent on a dead end.
 *
 * The fix asks the RESPONSE instead of assuming, which is why these are two tests and not
 * one: the old copy is still correct when confirmation is on, and a fix that simply always
 * sent people to /welcome would strand a genuinely unconfirmed account in the middleware
 * bounce. Both project settings have to keep working, with no flag to keep in sync.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ signUp: vi.fn() }));

// `redirect()` throws a control-flow signal in Next; capture the destination instead.
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    const e = new Error(`REDIRECT:${url}`);
    (e as Error & { __redirect: string }).__redirect = url;
    throw e;
  },
}));
vi.mock('next/headers', () => ({
  headers: async () => new Map([['origin', 'https://numenmachines.com']]),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { signUp: mocks.signUp } }),
}));

import { signup } from '../actions';

const form = () => {
  const f = new FormData();
  f.set('email', 'new-creator@example.com');
  f.set('password', 'a-real-password');
  return f;
};

/** Runs the action and returns the URL it redirected to. */
async function destinationOf(): Promise<string> {
  try {
    await signup(undefined, form());
  } catch (e) {
    const url = (e as Error & { __redirect?: string }).__redirect;
    if (url) return url;
    throw e;
  }
  throw new Error('signup returned without redirecting');
}

beforeEach(() => vi.clearAllMocks());

describe('confirmation OFF — signUp hands back a session', () => {
  it('sends the new account into onboarding, not to a mailbox', async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: { access_token: 'tok' }, user: { id: 'u1' } },
      error: null,
    });
    expect(await destinationOf()).toBe('/welcome');
  });

  it('does not mention email at all on that path', async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: { access_token: 'tok' }, user: { id: 'u1' } },
      error: null,
    });
    expect(await destinationOf()).not.toMatch(/email|confirm/i);
  });
});

describe('confirmation ON — signUp hands back no session', () => {
  it('keeps the check-your-email copy, because then it is true', async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null, user: { id: 'u1' } }, error: null });
    const url = await destinationOf();
    expect(url).toContain('/login');
    expect(url).toMatch(/confirm/i);
  });
});

describe('the confirmation link still comes back through our own callback', () => {
  it('points emailRedirectTo at /auth/callback?next=/welcome on this origin', async () => {
    // A staging Site URL on the Supabase project is how a production signup gets stranded;
    // the action passes an explicit origin so the project setting cannot decide this.
    mocks.signUp.mockResolvedValue({ data: { session: null, user: { id: 'u1' } }, error: null });
    await destinationOf();
    const arg = mocks.signUp.mock.calls[0]?.[0] as
      | { options?: { emailRedirectTo?: string } }
      | undefined;
    expect(arg?.options?.emailRedirectTo).toBe(
      'https://numenmachines.com/auth/callback?next=/welcome',
    );
  });
});

describe('errors still land back on the form', () => {
  it('maps an existing-account error to the signup page', async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'User already registered' },
    });
    const url = await destinationOf();
    expect(url).toContain('/signup?error=');
    expect(decodeURIComponent(url)).toContain('already exists');
  });
});
