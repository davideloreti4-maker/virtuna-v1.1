// Re-export from fixtures for cleaner imports in test files
export {
  test,
  expect,
  screenshot,
  waitForStable,
  SELECTORS,
  TEST_TYPES
} from '../fixtures/auth';

/**
 * Capture hover state
 */
export async function captureHover(
  page: import('@playwright/test').Page,
  category: string,
  selector: string,
  name: string
): Promise<string> {
  const { screenshot } = await import('../fixtures/auth');
  await page.hover(selector);
  await page.waitForTimeout(150);
  return screenshot(page, category, `${name}-hover`);
}

/**
 * Capture open/closed states of a dropdown or modal
 */
export async function captureToggle(
  page: import('@playwright/test').Page,
  category: string,
  triggerSelector: string,
  name: string
): Promise<{ closed: string; open: string }> {
  const { screenshot } = await import('../fixtures/auth');

  // Closed state
  const closed = await screenshot(page, category, `${name}-closed`);

  // Open state
  await page.click(triggerSelector);
  await page.waitForTimeout(300);
  const open = await screenshot(page, category, `${name}-open`);

  // Close
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  return { closed, open };
}
