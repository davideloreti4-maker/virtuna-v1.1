# Phase 11: Extraction - Research

**Researched:** 2026-01-30
**Domain:** Browser automation, screenshot capture, video recording
**Confidence:** HIGH

## Summary

This research investigates how to implement comprehensive screenshot and video capture of app.societies.io using Playwright. The goal is to capture every screen, state, and interactive element across desktop (1440px) and mobile (375px) viewports.

Playwright is the industry-standard choice for this task, providing robust screenshot and video recording capabilities with built-in support for authentication state persistence, viewport emulation, and scroll handling. The key challenge is organizing captures systematically to serve Phase 12 comparison work.

**Primary recommendation:** Use Playwright with TypeScript, organize captures by feature/component in a structured folder hierarchy, and save authentication state from an existing browser session using `storageState()`.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @playwright/test | ^1.51 | Browser automation & screenshots | Microsoft-backed, cross-browser, built-in screenshot/video |
| playwright | ^1.51 | Core library (if not using test runner) | Same as above, for script-based capture |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| typescript | ^5 | Type safety | Already in project, ensures capture scripts are type-safe |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Playwright | Puppeteer | Puppeteer is Chromium-only; Playwright supports Firefox/WebKit and has better API |
| Playwright | Cypress | Cypress is test-focused, not extraction-focused; limited screenshot customization |

**Installation:**
```bash
pnpm add -D @playwright/test
npx playwright install chromium
```

Note: Only install chromium browser to minimize disk space since the target app can be tested in a single browser for extraction purposes.

## Architecture Patterns

### Recommended Project Structure
```
extraction/
├── playwright.config.ts          # Playwright configuration
├── auth/
│   └── .auth/
│       └── state.json            # Saved authentication state (gitignored)
├── scripts/
│   ├── capture-auth.ts           # One-time script to save auth state
│   ├── capture-dashboard.ts      # Dashboard screens capture
│   ├── capture-selectors.ts      # Dropdowns and selectors
│   ├── capture-forms.ts          # All form types
│   ├── capture-modals.ts         # All modal dialogs
│   ├── capture-settings.ts       # Settings pages
│   └── capture-flows.ts          # Complete user flows with video
├── screenshots/
│   ├── desktop/                  # 1440px viewport captures
│   │   ├── dashboard/
│   │   │   ├── default.png
│   │   │   ├── loading.png
│   │   │   └── society-selected.png
│   │   ├── selectors/
│   │   │   ├── society-selector-closed.png
│   │   │   ├── society-selector-open.png
│   │   │   └── society-selector-hover-[item].png
│   │   ├── forms/
│   │   ├── modals/
│   │   ├── results/
│   │   └── settings/
│   └── mobile/                   # 375px viewport captures
│       └── [same structure as desktop]
└── videos/
    └── flows/
        ├── simulation-flow.webm
        ├── society-creation-flow.webm
        └── test-history-flow.webm
```

### Pattern 1: Authentication State Persistence
**What:** Save authentication cookies/localStorage once, reuse across all capture scripts
**When to use:** Always - avoids re-login for each script
**Example:**
```typescript
// Source: https://playwright.dev/docs/auth
// Step 1: Save auth state (run once manually)
import { chromium } from 'playwright';

async function saveAuthState() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://app.societies.io/login');
  // Manually log in via the browser window
  // Wait for user to complete login
  await page.waitForURL('**/dashboard**', { timeout: 120000 });

  // Save authentication state
  await context.storageState({ path: './auth/.auth/state.json' });
  await browser.close();
}
```

```typescript
// Step 2: Use saved state in capture scripts
import { chromium } from 'playwright';

async function captureWithAuth() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    storageState: './auth/.auth/state.json',
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  await page.goto('https://app.societies.io/dashboard');
  // Page loads already authenticated
}
```

### Pattern 2: Viewport-Specific Capture
**What:** Capture same screens at different viewport sizes
**When to use:** For desktop (1440px) and mobile (375px) requirement
**Example:**
```typescript
// Source: Context7 /microsoft/playwright.dev
const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 375, height: 812 }
};

async function captureAtViewports(url: string, name: string) {
  const browser = await chromium.launch();

  for (const [device, viewport] of Object.entries(viewports)) {
    const context = await browser.newContext({
      storageState: './auth/.auth/state.json',
      viewport
    });
    const page = await context.newPage();

    await page.goto(url);
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: `./screenshots/${device}/${name}.png`,
      fullPage: true
    });

    await context.close();
  }

  await browser.close();
}
```

### Pattern 3: Interactive State Capture
**What:** Capture hover, focus, and open states for interactive elements
**When to use:** For dropdowns, buttons, modals
**Example:**
```typescript
// Source: Context7 /microsoft/playwright.dev - page.hover() and screenshots
async function captureDropdownStates(page: Page, selector: string, baseName: string) {
  // Closed state
  await page.screenshot({ path: `${baseName}-closed.png` });

  // Hover state - IMPORTANT: use page.screenshot, not locator.screenshot
  // locator.screenshot may lose hover state in some environments
  await page.hover(selector);
  await page.screenshot({ path: `${baseName}-hover.png` });

  // Open state
  await page.click(selector);
  await page.waitForSelector('[data-state="open"]');
  await page.screenshot({ path: `${baseName}-open.png` });
}
```

### Pattern 4: Video Recording for User Flows
**What:** Record complete user flows as WebM videos
**When to use:** For capturing animations, transitions, loading states
**Example:**
```typescript
// Source: https://playwright.dev/docs/videos
async function recordSimulationFlow() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    storageState: './auth/.auth/state.json',
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: './videos/flows/',
      size: { width: 1440, height: 900 }  // Match viewport to avoid scaling
    }
  });

  const page = await context.newPage();

  await page.goto('https://app.societies.io/dashboard');
  // Perform the simulation flow...
  await page.click('[data-testid="create-test"]');
  await page.click('[data-testid="test-type-tiktok"]');
  await page.fill('textarea', 'Test content...');
  await page.click('[data-testid="simulate"]');
  // Wait for all loading phases
  await page.waitForSelector('[data-testid="results-panel"]', { timeout: 180000 });

  // CRITICAL: Close context to save video
  await context.close();

  // Get video path
  const video = page.video();
  if (video) {
    const path = await video.path();
    console.log('Video saved:', path);
  }

  await browser.close();
}
```

### Anti-Patterns to Avoid
- **Taking screenshots before page load complete:** Always `waitForLoadState('networkidle')` or wait for specific elements
- **Using locator.screenshot() for hover states:** May lose hover in certain environments; use page.screenshot() instead
- **Hardcoded waits for dynamic content:** Use `waitForSelector()` with appropriate conditions instead of `waitForTimeout()`
- **Capturing lazy-loaded content without scrolling:** Always scroll to bottom before full-page screenshots
- **Not closing context before checking videos:** Videos only save when context closes

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Waiting for page load | Custom polling loops | `page.waitForLoadState()` | Built-in network idle detection |
| Scrolling into view | Manual scroll calculations | `element.scrollIntoViewIfNeeded()` | Handles edge cases automatically |
| Element visibility checks | Manual DOM inspection | `locator.isVisible()` | Handles all visibility conditions |
| Cookie management | Manual cookie parsing | `context.storageState()` | Handles cookies, localStorage, IndexedDB |
| Screenshot comparison | Pixel-diff algorithms | Playwright's `toHaveScreenshot()` | Built-in comparison with thresholds |

**Key insight:** Playwright has mature APIs for every common browser automation task. Custom solutions introduce bugs and maintenance burden.

## Common Pitfalls

### Pitfall 1: Screenshots Fail on Lazy-Loaded Content
**What goes wrong:** Full-page screenshots show blank areas where content hasn't loaded
**Why it happens:** Images and content below fold don't load until scrolled into view
**How to avoid:** Scroll to bottom of page before screenshot, wait for images
```typescript
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForLoadState('networkidle');
await page.waitForTimeout(500); // Brief pause for lazy load triggers
await page.screenshot({ fullPage: true, path: 'screenshot.png' });
```
**Warning signs:** Blank sections, placeholder images in screenshots

### Pitfall 2: Hover State Lost During Screenshot
**What goes wrong:** Screenshot shows default state, not hover state
**Why it happens:** Known issue with `locator.screenshot()` in certain environments
**How to avoid:** Use `page.screenshot()` instead of `locator.screenshot()` when capturing hover states
**Warning signs:** Interactive states look identical to default states

### Pitfall 3: Video Not Saved
**What goes wrong:** Video file is empty or doesn't exist
**Why it happens:** Video is only written when context closes
**How to avoid:** Always `await context.close()` before accessing video
**Warning signs:** "File not found" errors when trying to access video path

### Pitfall 4: Authentication State Expires
**What goes wrong:** Capture scripts redirect to login page
**Why it happens:** Session cookies have expired (typically 24 hours)
**How to avoid:** Re-run auth capture script when sessions expire; add expiration check
**Warning signs:** Unexpected login page screenshots, 401 errors in console

### Pitfall 5: Inconsistent Screenshot Dimensions
**What goes wrong:** Screenshots have different sizes across runs
**Why it happens:** Content height varies, especially with dynamic data
**How to avoid:** Either use fixed viewport (not fullPage) or accept dimension variance
**Warning signs:** Screenshots can't be visually compared due to size differences

### Pitfall 6: Animations Cause Flaky Captures
**What goes wrong:** Screenshots capture mid-animation state
**Why it happens:** Timing between animation and screenshot is non-deterministic
**How to avoid:** Disable animations in capture context
```typescript
const context = await browser.newContext({
  // ... other options
});
// Inject CSS to disable animations
await context.addInitScript(() => {
  const style = document.createElement('style');
  style.textContent = `
    *, *::before, *::after {
      animation-duration: 0s !important;
      transition-duration: 0s !important;
    }
  `;
  document.head.appendChild(style);
});
```
**Warning signs:** Same screen has different appearances in different captures

## Code Examples

Verified patterns from official sources:

### Full Page Screenshot with Scroll Handling
```typescript
// Source: https://playwright.dev/docs/screenshots
async function captureFullPage(page: Page, outputPath: string) {
  // Scroll to load all lazy content (per context: "always scroll to bottom")
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

  // Wait for any triggered lazy loads
  await page.waitForLoadState('networkidle');

  // Capture full page
  await page.screenshot({ path: outputPath, fullPage: true });
}
```

### Capturing Modal State
```typescript
// Source: Context7 /microsoft/playwright.dev
async function captureModal(page: Page, triggerSelector: string, outputPath: string) {
  // Trigger modal open
  await page.click(triggerSelector);

  // Wait for modal to be visible
  await page.waitForSelector('[role="dialog"]', { state: 'visible' });

  // Optional: wait for any entrance animations
  await page.waitForTimeout(300);

  // Capture with modal visible
  await page.screenshot({ path: outputPath });

  // Close modal for next capture
  await page.keyboard.press('Escape');
  await page.waitForSelector('[role="dialog"]', { state: 'hidden' });
}
```

### Naming Convention Helper
```typescript
// Recommended naming for Phase 12 comparison work
function getScreenshotPath(
  viewport: 'desktop' | 'mobile',
  category: string,
  screen: string,
  state?: string
): string {
  const base = `./screenshots/${viewport}/${category}`;
  const filename = state ? `${screen}-${state}.png` : `${screen}.png`;
  return `${base}/${filename}`;
}

// Usage examples:
// getScreenshotPath('desktop', 'dashboard', 'main', 'default')
// -> ./screenshots/desktop/dashboard/main-default.png

// getScreenshotPath('mobile', 'selectors', 'society-selector', 'open')
// -> ./screenshots/mobile/selectors/society-selector-open.png
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Puppeteer for Chrome-only | Playwright for cross-browser | 2020 | Single API for all browsers |
| Manual cookie handling | `storageState()` API | Playwright 1.10 | Simpler auth persistence |
| ffmpeg for video | Built-in WebM recording | Playwright 1.0 | No external dependencies |
| Static waits | Auto-waiting & actionability | Playwright 1.0 | Less flaky automation |

**Deprecated/outdated:**
- `page.setViewport()` on existing pages: Use viewport in `newContext()` instead for consistency
- `elementHandle.screenshot()`: Prefer `locator.screenshot()` for auto-waiting

## Open Questions

Things that couldn't be fully resolved:

1. **Video quality limitations**
   - What we know: WebM recording uses 1Mbps bitrate by default, scaled to 800x800
   - What's unclear: Cannot increase quality via Playwright API
   - Recommendation: Set video size to match viewport exactly (1440x900) to avoid scaling; accept quality limitations

2. **Session storage persistence**
   - What we know: `storageState()` saves cookies and localStorage, not sessionStorage
   - What's unclear: Whether app.societies.io uses sessionStorage for critical state
   - Recommendation: Test first; if needed, manually save/restore sessionStorage

3. **Optimal capture parallelization**
   - What we know: Multiple browser instances can run in parallel
   - What's unclear: Whether app.societies.io rate limits or has concurrency issues
   - Recommendation: Start sequential; parallelize only if slow and confirmed safe

## Sources

### Primary (HIGH confidence)
- Context7 `/microsoft/playwright.dev` - screenshot, video, authentication, viewport APIs
- [Playwright Screenshots Documentation](https://playwright.dev/docs/screenshots) - official screenshot guide
- [Playwright Videos Documentation](https://playwright.dev/docs/videos) - video recording options
- [Playwright Authentication](https://playwright.dev/docs/auth) - storageState and auth patterns
- [Playwright Best Practices](https://playwright.dev/docs/best-practices) - official recommendations

### Secondary (MEDIUM confidence)
- [ZenRows Playwright Screenshot Guide](https://www.zenrows.com/blog/playwright-screenshot) - fullPage best practices
- [BrowserStack Playwright Best Practices 2026](https://www.browserstack.com/guide/playwright-best-practices) - environment standardization
- [ZenRows Scroll Guide](https://www.zenrows.com/blog/playwright-scroll) - lazy load handling

### Tertiary (LOW confidence)
- GitHub issues for hover state bug (#12077) - environment-specific behavior
- GitHub feature request for video quality (#31424) - quality limitations confirmed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Playwright is unambiguously the right tool, verified via Context7 and official docs
- Architecture: HIGH - Folder structure and patterns follow official documentation patterns
- Pitfalls: HIGH - All pitfalls documented in official sources or verified GitHub issues

**Research date:** 2026-01-30
**Valid until:** 2026-03-01 (Playwright stable, 30-day validity)
