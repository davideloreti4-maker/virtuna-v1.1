import { test as setup } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_STATE_PATH = path.join(__dirname, 'auth', 'state.json');

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Missing E2E_USER_EMAIL or E2E_USER_PASSWORD env vars. ' +
      'Set them in .env.local or pass inline: E2E_USER_EMAIL=x E2E_USER_PASSWORD=y pnpm e2e'
    );
  }

  const authDir = path.dirname(AUTH_STATE_PATH);
  fs.mkdirSync(authDir, { recursive: true });

  // NEVER `networkidle` on this app — the dev HMR socket keeps the page permanently
  // "busy" and the wait never settles. `domcontentloaded` + an explicit locator wait is
  // the only reliable pairing here.
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  // `/login` is emailed-CODE-first: the only field on arrival is the OTP form's email.
  // Password sign-in lives behind a disclosure button and must be opened before its
  // fields exist at all. Waiting on the toggle also doubles as the hydration gate —
  // clicking before React attaches the handler is a silent no-op.
  const passwordToggle = page.getByRole('button', { name: 'Sign in with a password instead' });
  await passwordToggle.waitFor({ state: 'visible' });
  await passwordToggle.click();

  // Two `input[name="email"]` now exist — the OTP form's and this one — so an unscoped
  // selector is a strict-mode violation, not a lucky guess. Scope every field to the
  // form that actually owns the password input.
  const passwordForm = page.locator('form').filter({
    has: page.locator('input[name="password"]'),
  });
  await passwordForm.locator('input[name="email"]').fill(email);
  await passwordForm.locator('input[name="password"]').fill(password);
  await passwordForm.locator('button[type="submit"]').click();

  // Landing depends on account state (`/home` for an established account, `/welcome`
  // for a first run), so assert only what sign-in actually guarantees: we left /login.
  // The previous `dashboard|welcome` check named a route this app does not have.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 });

  // The session cookie is what this file exists to capture — fail loudly here rather
  // than writing a storageState that silently authenticates nobody.
  const cookies = await page.context().cookies();
  const authCookie = cookies.find(
    (c) => c.name.startsWith('sb-') && c.name.includes('auth-token'),
  );
  if (!authCookie) {
    throw new Error(
      `Signed in and landed on ${new URL(page.url()).pathname}, but no Supabase auth cookie was set. ` +
      'The saved state would authenticate nobody.'
    );
  }

  // Save auth state
  await page.context().storageState({ path: AUTH_STATE_PATH });
  console.log(`Auth state saved to: ${AUTH_STATE_PATH}`);
});
