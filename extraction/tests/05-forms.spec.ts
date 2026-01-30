import { test, expect, screenshot, waitForStable, SELECTORS, TEST_TYPES } from './helpers';

test.describe('Forms', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
  });

  // Content forms (10 types)
  const contentTypes = TEST_TYPES.filter(t => t !== 'survey');

  for (const testType of contentTypes) {
    test(`capture ${testType} form states`, async ({ page }) => {
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

  test('capture survey form states (unique)', async ({ page }) => {
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
    'instagram-post': 'Morning vibes. Nothing beats starting the day with a fresh perspective. What is your morning routine? Drop a comment below!',
    'x-post': 'Hot take: The best code is the code you do not have to write. Simplicity wins every time. What do you think?',
    'tiktok-script': '[Hook] Wait until you see this life hack! [Body] So I discovered this trick that saves me 2 hours every day... [CTA] Follow for more productivity tips!',
    'email-subject-line': 'Your exclusive early access is waiting',
    'email': 'Hi there,\n\nI hope this email finds you well. I wanted to reach out about an opportunity that I think would be perfect for you.\n\nBest regards',
    'product-proposition': 'Problem: Teams waste hours on repetitive tasks.\nSolution: Our AI automation platform handles the busywork so you can focus on what matters.\nBenefit: Save 10+ hours per week.',
  };
  return samples[type] || 'Sample content for testing purposes.';
}
