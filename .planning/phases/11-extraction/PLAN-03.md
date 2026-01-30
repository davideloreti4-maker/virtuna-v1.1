---
phase: 11-extraction
plan: 03
type: execute
wave: 3
depends_on: [PLAN-02]
files_modified:
  - extraction/tests/05-forms.spec.ts
  - extraction/tests/06-simulation.spec.ts
autonomous: true

must_haves:
  truths:
    - "Form tests capture empty, focused, filled, and validation states"
    - "Survey form unique structure captured separately"
    - "Simulation captures all 4 loading phases"
    - "Videos recorded for loading animation"
  artifacts:
    - path: "extraction/tests/05-forms.spec.ts"
      provides: "Form state captures for all test types"
      contains: "test.describe('Forms'"
    - path: "extraction/tests/06-simulation.spec.ts"
      provides: "Simulation loading phases and completion"
      contains: "test.describe('Simulation'"
---

<objective>
Create Playwright tests for Parts 5-6 of EXTRACTION-PLAN.md: Forms and Simulation.

Purpose: Capture all form states and the complete simulation loading flow.
Output: Test files for forms and simulation with video recording.
</objective>

<context>
@.planning/phases/11-extraction/EXTRACTION-PLAN.md
@extraction/tests/helpers.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Forms Tests (Part 5)</name>
  <files>
    - extraction/tests/05-forms.spec.ts
  </files>
  <action>
Create extraction/tests/05-forms.spec.ts:

```typescript
import { test, expect, screenshot, waitForStable, SELECTORS, TEST_TYPES } from './helpers';

test.describe('Forms', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
  });

  // Content forms (10 types)
  const contentTypes = TEST_TYPES.filter(t => t !== 'survey');

  for (const testType of contentTypes) {
    test(`capture ${testType} form states`, async ({ page }, testInfo) => {
      // Desktop only

      // Open test type selector
      const newTestBtn = page.locator(SELECTORS.newTestBtn).first();
      if (!await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        test.skip();
        return;
      }

      await newTestBtn.click();
      await page.waitForTimeout(400);

      // Select the test type
      const typeButton = page.locator(SELECTORS.testTypeOption(testType)).first();
      const altButton = page.locator(`button:has-text("${testType.replace(/-/g, ' ')}")`).first();

      const button = await typeButton.isVisible({ timeout: 1000 }).catch(() => false)
        ? typeButton
        : altButton;

      if (!await button.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`Test type ${testType} not found`);
        return;
      }

      await button.click();
      await page.waitForTimeout(400);

      // Empty form state
      await screenshot(page, 'forms', `form-${testType}-empty`);

      // Focused state
      const textarea = page.locator(SELECTORS.textarea).first();
      if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
        await textarea.focus();
        await page.waitForTimeout(150);
        await screenshot(page, 'forms', `form-${testType}-focused`);

        // Filled state
        const sampleContent = getSampleContent(testType);
        await textarea.fill(sampleContent);
        await page.waitForTimeout(200);
        await screenshot(page, 'forms', `form-${testType}-filled`);

        // Character count (if visible)
        const charCount = page.locator('[class*="char"], [class*="count"], [data-testid*="count"]').first();
        if (await charCount.isVisible({ timeout: 1000 }).catch(() => false)) {
          await screenshot(page, 'forms', `form-${testType}-char-count`);
        }

        // Clear and try validation error
        await textarea.fill('');
        const submitBtn = page.locator(SELECTORS.submitBtn).first();
        if (await submitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await submitBtn.click();
          await page.waitForTimeout(300);
          await screenshot(page, 'forms', `form-${testType}-validation-error`);
        }
      }

      await page.keyboard.press('Escape');
    });
  }

  test('capture survey form states (unique)', async ({ page }, testInfo) => {
    // Desktop only

    // Open test type selector
    const newTestBtn = page.locator(SELECTORS.newTestBtn).first();
    if (!await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await newTestBtn.click();
    await page.waitForTimeout(400);

    // Select Survey type
    const surveyBtn = page.locator('button:has-text("Survey"), [data-testid*="survey"]').first();
    if (!await surveyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Survey type not found');
      return;
    }

    await surveyBtn.click();
    await page.waitForTimeout(400);

    // Empty survey form
    await screenshot(page, 'forms', 'form-survey-empty');

    // Add question button
    const addQuestionBtn = page.locator(
      'button:has-text("Add Question"), ' +
      'button:has-text("Add"), ' +
      '[data-testid*="add-question"]'
    ).first();

    if (await addQuestionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Add one question
      await addQuestionBtn.click();
      await page.waitForTimeout(300);
      await screenshot(page, 'forms', 'form-survey-question-added');

      // Add more questions
      for (let i = 0; i < 2; i++) {
        if (await addQuestionBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await addQuestionBtn.click();
          await page.waitForTimeout(200);
        }
      }
      await screenshot(page, 'forms', 'form-survey-multiple-questions');

      // Hover on an option
      const option = page.locator('[data-testid*="option"], [class*="option"], input[type="radio"]').first();
      if (await option.isVisible({ timeout: 1000 }).catch(() => false)) {
        await option.hover();
        await page.waitForTimeout(100);
        await screenshot(page, 'forms', 'form-survey-option-hover');
      }

      // Validation error (submit without completing)
      const submitBtn = page.locator(SELECTORS.submitBtn).first();
      if (await submitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(300);
        await screenshot(page, 'forms', 'form-survey-validation');
      }
    }

    await page.keyboard.press('Escape');
  });
});

// Sample content for each test type
function getSampleContent(type: string): string {
  const samples: Record<string, string> = {
    'article': 'The Future of AI in Healthcare\n\nArtificial intelligence is revolutionizing how we approach medical diagnosis and treatment. From early disease detection to personalized treatment plans, AI is transforming patient care.',
    'website-content': 'Welcome to our platform. We help businesses grow by providing cutting-edge solutions that drive results. Start your free trial today.',
    'advertisement': 'Discover the power of productivity. Our all-in-one solution helps teams work smarter, not harder. Try it free for 30 days!',
    'linkedin-post': 'Excited to share that we just launched our new feature! After months of hard work, our team has created something truly special. #innovation #startup #tech',
    'instagram-post': 'Morning vibes ✨ Nothing beats starting the day with a fresh perspective. What is your morning routine? Drop a comment below! 👇',
    'x-post': 'Hot take: The best code is the code you do not have to write. Simplicity wins every time. What do you think?',
    'tiktok-script': '[Hook] Wait until you see this life hack! [Body] So I discovered this trick that saves me 2 hours every day... [CTA] Follow for more productivity tips!',
    'email-subject-line': 'Your exclusive early access is waiting 🎉',
    'email': 'Hi there,\n\nI hope this email finds you well. I wanted to reach out about an opportunity that I think would be perfect for you.\n\nBest regards',
    'product-proposition': 'Problem: Teams waste hours on repetitive tasks.\nSolution: Our AI automation platform handles the busywork so you can focus on what matters.\nBenefit: Save 10+ hours per week.',
  };
  return samples[type] || 'Sample content for testing purposes.';
}
```
  </action>
  <verify>
- All content form types have tests
- Survey form has unique test
- States: empty, focused, filled, validation error captured
  </verify>
</task>

<task type="auto">
  <name>Task 2: Simulation Tests with Video (Part 6)</name>
  <files>
    - extraction/tests/06-simulation.spec.ts
  </files>
  <action>
Create extraction/tests/06-simulation.spec.ts:

```typescript
import { test, expect, screenshot, waitForStable, SELECTORS, getViewport } from './helpers';
import * as path from 'path';
import * as fs from 'fs';

const VIDEOS_DIR = path.join(__dirname, '..', 'videos', 'flows');

test.describe('Simulation', () => {
  // Enable video recording for simulation tests
  test.use({
    video: {
      mode: 'on',
      size: { width: 1440, height: 900 },
    },
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
  });

  test('capture simulation loading phases with video', async ({ page }, testInfo) => {
    // Desktop only

    // Open test type selector and select TikTok (quick test type)
    const newTestBtn = page.locator(SELECTORS.newTestBtn).first();
    if (!await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await newTestBtn.click();
    await page.waitForTimeout(400);

    // Select TikTok
    const tiktokBtn = page.locator('button:has-text("TikTok"), [data-testid*="tiktok"]').first();
    if (!await tiktokBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('TikTok type not found');
      return;
    }

    await tiktokBtn.click();
    await page.waitForTimeout(400);

    // Fill form
    const textarea = page.locator(SELECTORS.textarea).first();
    if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await textarea.fill('[Hook] Check this out! [Body] This is a sample TikTok script for testing. #test #demo');
    }

    // Submit form
    const submitBtn = page.locator(SELECTORS.submitBtn).first();
    if (!await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Submit button not found');
      return;
    }

    await submitBtn.click();

    // Capture loading phases
    // Phase 1
    await page.waitForTimeout(500);
    await screenshot(page, 'simulation', 'simulation-phase1');

    // Wait for phase indicators and capture each
    const phaseTexts = [
      'Analyzing', 'Processing', 'Generating', 'Finalizing',
      'Phase 1', 'Phase 2', 'Phase 3', 'Phase 4'
    ];

    for (let phase = 2; phase <= 4; phase++) {
      // Wait a bit for phase transition
      await page.waitForTimeout(2000);

      // Check if still loading
      const loader = page.locator('[class*="loading"], [class*="spinner"], [data-testid*="loading"]').first();
      if (await loader.isVisible({ timeout: 1000 }).catch(() => false)) {
        await screenshot(page, 'simulation', `simulation-phase${phase}`);
      }
    }

    // Wait for completion (results appear)
    try {
      await page.waitForSelector(
        SELECTORS.resultsPanel + ', [data-testid*="result"], [class*="result"]',
        { timeout: 60000 }
      );
      await screenshot(page, 'simulation', 'simulation-complete');
    } catch {
      console.log('Results did not appear within timeout');
    }

    // Capture specific loading state details
    await captureLoadingDetails(page, viewport);
  });

  test('capture loading states detail', async ({ page }, testInfo) => {
    // Desktop only

    // This test captures static loading state screenshots if we can mock them
    // or if there's a way to pause during loading

    // Look for any visible loading elements
    const loadingSpinner = page.locator('[class*="spinner"], [class*="loading"], svg[class*="animate"]').first();
    if (await loadingSpinner.isVisible({ timeout: 1000 }).catch(() => false)) {
      await screenshot(page, 'simulation', 'loading-spinner');
    }

    const progressBar = page.locator('[role="progressbar"], [class*="progress"]').first();
    if (await progressBar.isVisible({ timeout: 1000 }).catch(() => false)) {
      await screenshot(page, 'simulation', 'loading-progress-bar');
    }
  });
});

async function captureLoadingDetails(page: import('@playwright/test').Page, viewport: 'desktop' | 'mobile') {
  // Try to capture specific loading text phases
  const loadingTexts = page.locator('[class*="loading"] p, [data-testid*="loading-text"]');

  const count = await loadingTexts.count();
  for (let i = 0; i < Math.min(count, 4); i++) {
    const textEl = loadingTexts.nth(i);
    if (await textEl.isVisible({ timeout: 500 }).catch(() => false)) {
      const text = await textEl.textContent();
      console.log(`Loading text ${i + 1}: ${text}`);
    }
  }
}

test.describe('Simulation Video Flow', () => {
  // Record full simulation flow as video
  test.use({
    video: {
      mode: 'on',
      size: { width: 1440, height: 900 },
    },
  });

  test('record complete simulation flow', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForStable(page);

    // Open test type selector
    const newTestBtn = page.locator(SELECTORS.newTestBtn).first();
    if (!await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await newTestBtn.click();
    await page.waitForTimeout(600);

    // Select a test type
    const emailBtn = page.locator('button:has-text("Email Subject"), [data-testid*="email-subject"]').first();
    if (await emailBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailBtn.click();
    } else {
      // Fallback to any available type
      const anyType = page.locator('[role="dialog"] button').first();
      await anyType.click();
    }
    await page.waitForTimeout(400);

    // Fill and submit
    const textarea = page.locator(SELECTORS.textarea).first();
    if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await textarea.fill('Your exclusive early access is here! Limited time offer.');
    }

    const submitBtn = page.locator(SELECTORS.submitBtn).first();
    if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.click();

      // Wait for results
      try {
        await page.waitForSelector(
          '[data-testid*="result"], [class*="result"], [class*="score"]',
          { timeout: 90000 }
        );
        await page.waitForTimeout(2000); // Let results fully render
      } catch {
        console.log('Results timeout');
      }
    }

    // Video will be saved automatically
    // Copy to designated location
    const video = page.video();
    if (video) {
      await testInfo.attach('simulation-loading-phases', {
        path: await video.path(),
        contentType: 'video/webm',
      });
    }
  });
});
```
  </action>
  <verify>
- Simulation phases captured (1-4)
- Video recording enabled for flow
- Loading spinner and progress captured
  </verify>
</task>

</tasks>

<verification>
- [ ] `extraction/tests/05-forms.spec.ts` captures all 10 content form types + survey
- [ ] `extraction/tests/06-simulation.spec.ts` captures loading phases 1-4
- [ ] Video recording configured for simulation flow
- [ ] States: empty, focused, filled, validation error for forms
</verification>

<success_criteria>
- All form states captured per EXTRACTION-PLAN.md Part 5
- Simulation loading phases captured per Part 6
- Video recorded for complete simulation flow
</success_criteria>
