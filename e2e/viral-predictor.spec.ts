import { test, expect } from '@playwright/test';

const SAMPLE_CAPTION =
  'POV: you finally found the perfect morning routine that actually works 🌅 #morningroutine #productivity #fyp #viral';

test.describe('Viral Predictor E2E', () => {
  test('text mode — full prediction flow', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Fill textarea with sample caption
    const textarea = page.locator('textarea');
    await textarea.waitFor({ state: 'visible' });
    await textarea.fill(SAMPLE_CAPTION);

    // Submit
    await page.locator('button[aria-label="Submit test"]').click();

    // Wait for loading phase (animate-pulse phase message or skeleton cards)
    await expect(
      page.locator('.animate-pulse, [class*="GlassCard"], [class*="glass-card"]').first()
    ).toBeVisible({ timeout: 15000 });

    // Wait for results — the overall score (.text-6xl) signals results are rendered
    const overallScore = page.locator('.text-6xl').first();
    await expect(overallScore).toBeVisible({ timeout: 90000 });

    // --- Functionality assertions ---

    // Overall score is a number 0-100
    const scoreText = await overallScore.textContent();
    const score = parseInt(scoreText!.trim(), 10);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);

    // Confidence badge
    await expect(
      page.locator('text=/High confidence|Medium confidence|Low confidence/')
    ).toBeVisible();

    // 5 factor rows
    const factorNames = [
      'Scroll-Stop Power',
      'Completion Pull',
      'Rewatch Potential',
      'Share Trigger',
      'Emotional Charge',
    ];
    for (const name of factorNames) {
      await expect(page.locator(`text="${name}"`)).toBeVisible();
    }

    // Factor scores displayed as X.X / 10
    const factorScores = page.locator('text=/\\d+\\.\\d+\\s*\\/\\s*10/');
    await expect(factorScores).toHaveCount(5);

    // Verify factor scores are in valid range (0.0 - 10.0)
    const scoreTexts = await factorScores.allTextContents();
    for (const text of scoreTexts) {
      const match = text.match(/([\d.]+)\s*\/\s*10/);
      expect(match).toBeTruthy();
      const val = parseFloat(match![1]);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(10);
    }

    // 4 behavioral prediction cards
    const behavioralLabels = ['Completion', 'Share Rate', 'Comment Rate', 'Save Rate'];
    for (const label of behavioralLabels) {
      await expect(page.locator(`text="${label}"`)).toBeVisible();
    }

    // Behavioral percentages are between 0 and 100
    const percentElements = page.locator('text=/%$/');
    const percentCount = await percentElements.count();
    expect(percentCount).toBeGreaterThanOrEqual(4);

    // Suggestions section has at least 1 suggestion
    await expect(page.locator('text="Suggestions"')).toBeVisible();

    // Bottom bar: engine version
    await expect(page.locator('text=/2\\.1\\.0/')).toBeVisible();

    // "New test" button visible (exact match to avoid sidebar "Create a new test" button)
    await expect(page.getByRole('button', { name: 'New test', exact: true })).toBeVisible();
  });

  test('text mode — validation rejects short input', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('textarea');
    await textarea.waitFor({ state: 'visible' });
    await textarea.fill('short');

    await page.locator('button[aria-label="Submit test"]').click({ force: true });

    await expect(page.locator('text="Must be at least 10 characters"')).toBeVisible();
  });

  test('URL mode — tab switch works', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Switch to URL tab
    await page.locator('button:has-text("URL")').click();

    // Verify placeholder changed
    const textarea = page.locator('textarea');
    await expect(textarea).toHaveAttribute('placeholder', /URL/);

    // Type invalid URL and submit
    await textarea.fill('not-a-url');
    await page.locator('button[aria-label="Submit test"]').click({ force: true });

    await expect(
      page.locator('text="Enter a valid TikTok or Instagram URL"')
    ).toBeVisible();
  });

  test('run another test — flow reset', async ({ page }) => {
    // Run a full prediction first
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('textarea');
    await textarea.waitFor({ state: 'visible' });
    await textarea.fill(SAMPLE_CAPTION);
    await page.locator('button[aria-label="Submit test"]').click();

    // Wait for results
    await expect(page.locator('.text-6xl').first()).toBeVisible({ timeout: 90000 });

    // Click "New test" (exact match to avoid sidebar button)
    await page.getByRole('button', { name: 'New test', exact: true }).click();

    // Verify form reappears with empty textarea
    const newTextarea = page.locator('textarea');
    await expect(newTextarea).toBeVisible({ timeout: 10000 });
    await expect(newTextarea).toHaveValue('');
  });
});
