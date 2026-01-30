import { Page, BrowserContext, chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 375, height: 812 },
} as const;

export type ViewportName = keyof typeof VIEWPORTS;

export const AUTH_STATE_PATH = './extraction/auth/.auth/state.json';
export const SCREENSHOTS_DIR = './extraction/screenshots';
export const VIDEOS_DIR = './extraction/videos';

/**
 * Scroll to bottom of page to trigger lazy-loaded content
 * Per CONTEXT.md: "always scroll to bottom — top banner may push content down"
 */
export async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
  await page.waitForLoadState('networkidle');
}

/**
 * Capture screenshot with consistent naming
 */
export async function captureScreen(
  page: Page,
  viewport: ViewportName,
  category: string,
  name: string,
  state?: string
): Promise<string> {
  const dir = path.join(SCREENSHOTS_DIR, viewport, category);
  fs.mkdirSync(dir, { recursive: true });

  const filename = state ? `${name}-${state}.png` : `${name}.png`;
  const filepath = path.join(dir, filename);

  await scrollToBottom(page);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`Captured: ${filepath}`);
  return filepath;
}

/**
 * Create authenticated browser context
 */
export async function createAuthContext(
  browser: ReturnType<typeof chromium.launch> extends Promise<infer T> ? T : never,
  viewport: ViewportName,
  options?: { recordVideo?: boolean }
): Promise<BrowserContext> {
  const contextOptions: Parameters<typeof browser.newContext>[0] = {
    storageState: AUTH_STATE_PATH,
    viewport: VIEWPORTS[viewport],
  };

  if (options?.recordVideo) {
    contextOptions.recordVideo = {
      dir: VIDEOS_DIR + '/flows/',
      size: VIEWPORTS[viewport],
    };
  }

  return browser.newContext(contextOptions);
}

/**
 * Ensure directory exists
 */
export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}
