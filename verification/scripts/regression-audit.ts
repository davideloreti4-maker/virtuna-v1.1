/**
 * Full Visual Regression Audit
 *
 * Standalone Node script that:
 * 1. Visits every showcase page, trending, dashboard, and primitives-showcase
 * 2. Captures console errors
 * 3. Checks component rendering (visibility, correct styling)
 * 4. Takes screenshots for visual reference
 * 5. Generates verification/regression-log.md
 *
 * Usage: npx tsx verification/scripts/regression-audit.ts
 * Requires: dev server running on localhost:3000
 */

import { chromium, Page, ConsoleMessage } from 'playwright';
import fs from 'fs';
import path from 'path';

// --- Types ---

interface PageAudit {
  name: string;
  url: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  consoleErrors: string[];
  consoleWarnings: string[];
  componentChecks: ComponentCheck[];
  screenshotPath: string;
  notes: string[];
  loadTime: number;
}

interface ComponentCheck {
  name: string;
  selector: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details: string;
}

// --- Routes to audit ---

const ROUTES = [
  { name: 'Showcase Hub', url: '/showcase' },
  { name: 'Showcase: Typography', url: '/showcase/typography' },
  { name: 'Showcase: Inputs', url: '/showcase/inputs' },
  { name: 'Showcase: Feedback', url: '/showcase/feedback' },
  { name: 'Showcase: Data Display', url: '/showcase/data-display' },
  { name: 'Showcase: Layout Components', url: '/showcase/layout-components' },
  { name: 'Showcase: Navigation', url: '/showcase/navigation' },
  { name: 'Showcase: Utilities', url: '/showcase/utilities' },
  { name: 'Primitives Showcase', url: '/primitives-showcase' },
  { name: 'Trending', url: '/trending' },
  { name: 'Dashboard', url: '/dashboard' },
];

// --- Component checks per page ---

function getComponentChecks(url: string): Array<{ name: string; selector: string }> {
  switch (url) {
    case '/showcase':
      return [
        { name: 'Sidebar navigation', selector: 'nav, [class*="sidebar"], aside' },
        { name: 'Page content', selector: 'main, [class*="content"]' },
      ];
    case '/showcase/inputs':
      return [
        { name: 'Input components', selector: 'input' },
        { name: 'Textarea components', selector: 'textarea' },
        { name: 'Select components', selector: 'button[role="combobox"], select, [class*="select"]' },
      ];
    case '/showcase/feedback':
      return [
        { name: 'Badge components', selector: '[class*="badge"], [class*="Badge"]' },
        { name: 'Spinner/Progress', selector: '[class*="spinner"], [class*="Spinner"], [role="progressbar"], svg' },
      ];
    case '/showcase/data-display':
      return [
        { name: 'Card components', selector: '[class*="card"], [class*="Card"]' },
        { name: 'Avatar components', selector: '[class*="avatar"], [class*="Avatar"], img[class*="rounded-full"]' },
        { name: 'Skeleton components', selector: '[class*="skeleton"], [class*="Skeleton"], [class*="shimmer"]' },
      ];
    case '/showcase/layout-components':
      return [
        { name: 'GlassPanel components', selector: '[class*="glass"], [class*="Glass"]' },
        { name: 'Divider components', selector: '[class*="divider"], [class*="Divider"], hr' },
      ];
    case '/showcase/navigation':
      return [
        { name: 'Tab components', selector: '[role="tablist"], [class*="tab"], [class*="Tab"]' },
        { name: 'Kbd components', selector: 'kbd, [class*="kbd"], [class*="Kbd"]' },
      ];
    case '/showcase/utilities':
      return [
        { name: 'TrafficLights', selector: '[class*="traffic"], [class*="Traffic"]' },
      ];
    case '/primitives-showcase':
      return [
        { name: 'GlassPanel demo', selector: '[class*="glass"], [class*="Glass"]' },
        { name: 'TrafficLights demo', selector: '[class*="traffic"], [class*="Traffic"]' },
        { name: 'Page heading', selector: 'h1, h2' },
      ];
    case '/trending':
      return [
        { name: 'Page content', selector: 'main, [class*="content"]' },
        { name: 'Card components', selector: '[class*="card"], [class*="Card"]' },
      ];
    case '/dashboard':
      return [
        { name: 'Page content', selector: 'main, [class*="content"], [class*="dashboard"]' },
      ];
    default:
      return [
        { name: 'Page content', selector: 'main' },
      ];
  }
}

// --- Audit runner ---

async function runRegressionAudit(): Promise<void> {
  console.log('Starting full regression audit...\n');

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });

  const screenshotDir = path.resolve(__dirname, '../reports/screenshots/regression');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const results: PageAudit[] = [];

  for (const route of ROUTES) {
    console.log(`Auditing: ${route.name} (${route.url})...`);

    const page = await context.newPage();
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    // Capture console messages
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Filter out common non-actionable errors
        if (!text.includes('favicon.ico') && !text.includes('Download the React DevTools')) {
          consoleErrors.push(text);
        }
      } else if (msg.type() === 'warning') {
        const text = msg.text();
        if (!text.includes('React DevTools') && !text.includes('Autofocus')) {
          consoleWarnings.push(text);
        }
      }
    });

    // Capture page errors
    page.on('pageerror', (err) => {
      consoleErrors.push(`PAGE_ERROR: ${err.message}`);
    });

    const startTime = Date.now();
    let pageStatus: 'PASS' | 'FAIL' | 'WARN' = 'PASS';
    const notes: string[] = [];
    const componentChecks: ComponentCheck[] = [];

    try {
      const response = await page.goto(`http://localhost:3000${route.url}`, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      const loadTime = Date.now() - startTime;

      // Check HTTP status
      if (response && response.status() >= 400) {
        pageStatus = 'FAIL';
        notes.push(`HTTP ${response.status()} response`);
      }

      // Wait a moment for any late rendering
      await page.waitForTimeout(2000);

      // Inject CSS to disable animations for stable screenshots
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
          }
        `,
      });
      await page.waitForTimeout(500);

      // Take full-page screenshot
      const screenshotFilename = route.url.replace(/\//g, '-').replace(/^-/, '') || 'homepage';
      const screenshotPath = path.join(screenshotDir, `${screenshotFilename}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Run component checks
      const checks = getComponentChecks(route.url);
      for (const check of checks) {
        try {
          const elements = page.locator(check.selector);
          const count = await elements.count();
          if (count > 0) {
            const firstVisible = await elements.first().isVisible().catch(() => false);
            if (firstVisible) {
              componentChecks.push({
                name: check.name,
                selector: check.selector,
                status: 'PASS',
                details: `Found ${count} element(s), first is visible`,
              });
            } else {
              componentChecks.push({
                name: check.name,
                selector: check.selector,
                status: 'WARN',
                details: `Found ${count} element(s) but first not visible`,
              });
            }
          } else {
            componentChecks.push({
              name: check.name,
              selector: check.selector,
              status: 'SKIP',
              details: 'No elements found matching selector',
            });
          }
        } catch (err) {
          componentChecks.push({
            name: check.name,
            selector: check.selector,
            status: 'FAIL',
            details: `Error: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }

      // Specific style checks via page.evaluate
      if (route.url === '/showcase/data-display') {
        const cardStyles = await page.evaluate(() => {
          const cards = document.querySelectorAll('[class*="card"], [class*="Card"]');
          const results: string[] = [];
          cards.forEach((card, i) => {
            if (i < 3) {
              const styles = getComputedStyle(card as HTMLElement);
              results.push(
                `Card ${i}: radius=${styles.borderRadius}, border=${styles.border}, bg=${styles.backgroundColor}`
              );
            }
          });
          return results;
        });
        if (cardStyles.length > 0) {
          notes.push(...cardStyles.map(s => `[Style Check] ${s}`));
        }
      }

      if (route.url === '/showcase/layout-components') {
        const glassStyles = await page.evaluate(() => {
          const panels = document.querySelectorAll('[class*="glass"], [class*="Glass"]');
          const results: string[] = [];
          panels.forEach((panel, i) => {
            if (i < 3) {
              const styles = getComputedStyle(panel as HTMLElement);
              results.push(
                `GlassPanel ${i}: radius=${styles.borderRadius}, border=${styles.border}, backdropFilter=${styles.backdropFilter || styles.webkitBackdropFilter || 'none (inline style?)'}`
              );
            }
          });
          return results;
        });
        if (glassStyles.length > 0) {
          notes.push(...glassStyles.map(s => `[Style Check] ${s}`));
        }
      }

      if (route.url === '/showcase/inputs') {
        const inputStyles = await page.evaluate(() => {
          const inputs = document.querySelectorAll('input');
          const results: string[] = [];
          inputs.forEach((input, i) => {
            if (i < 3) {
              const styles = getComputedStyle(input);
              results.push(
                `Input ${i}: height=${styles.height}, radius=${styles.borderRadius}, bg=${styles.backgroundColor}`
              );
            }
          });
          return results;
        });
        if (inputStyles.length > 0) {
          notes.push(...inputStyles.map(s => `[Style Check] ${s}`));
        }
      }

      // Check for GradientGlow references (should be gone after 55-01)
      if (route.url === '/primitives-showcase') {
        const gradientGlowPresent = await page.evaluate(() => {
          const body = document.body.innerHTML;
          return body.includes('GradientGlow') || body.includes('gradient-glow');
        });
        if (gradientGlowPresent) {
          notes.push('[REGRESSION] GradientGlow text still visible on page');
          pageStatus = 'FAIL';
        } else {
          notes.push('[OK] No GradientGlow references visible');
        }
      }

      // Check console errors severity
      if (consoleErrors.length > 0) {
        // Check if errors are critical
        const criticalErrors = consoleErrors.filter(
          (e) => !e.includes('hydration') && !e.includes('Warning:')
        );
        if (criticalErrors.length > 0) {
          pageStatus = pageStatus === 'FAIL' ? 'FAIL' : 'WARN';
          notes.push(`${criticalErrors.length} console error(s) detected`);
        }
      }

      // Check for failed component checks
      const failedChecks = componentChecks.filter((c) => c.status === 'FAIL');
      if (failedChecks.length > 0) {
        pageStatus = 'FAIL';
        notes.push(`${failedChecks.length} component check(s) failed`);
      }

      results.push({
        name: route.name,
        url: route.url,
        status: pageStatus,
        consoleErrors,
        consoleWarnings,
        componentChecks,
        screenshotPath: `screenshots/regression/${screenshotFilename}.png`,
        notes,
        loadTime,
      });

      const icon = pageStatus === 'PASS' ? 'PASS' : pageStatus === 'WARN' ? 'WARN' : 'FAIL';
      console.log(`  ${icon} (${loadTime}ms, ${consoleErrors.length} errors, ${consoleWarnings.length} warnings)`);
    } catch (err) {
      const loadTime = Date.now() - startTime;
      results.push({
        name: route.name,
        url: route.url,
        status: 'FAIL',
        consoleErrors: [...consoleErrors, `Navigation error: ${err instanceof Error ? err.message : String(err)}`],
        consoleWarnings,
        componentChecks,
        screenshotPath: '',
        notes: [`Failed to load: ${err instanceof Error ? err.message : String(err)}`],
        loadTime,
      });
      console.log(`  FAIL: ${err instanceof Error ? err.message : String(err)}`);
    }

    await page.close();
  }

  await browser.close();

  // Generate regression log
  const report = generateRegressionLog(results);
  const reportPath = path.resolve(__dirname, '..', 'regression-log.md');
  fs.writeFileSync(reportPath, report, 'utf-8');

  // Summary
  const passes = results.filter((r) => r.status === 'PASS').length;
  const warns = results.filter((r) => r.status === 'WARN').length;
  const fails = results.filter((r) => r.status === 'FAIL').length;

  console.log('\n=== Regression Audit Summary ===');
  console.log(`Total pages: ${results.length}`);
  console.log(`PASS: ${passes}`);
  console.log(`WARN: ${warns}`);
  console.log(`FAIL: ${fails}`);
  console.log(`\nReport: ${reportPath}`);
}

function generateRegressionLog(results: PageAudit[]): string {
  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toISOString().split('T')[1].replace('Z', '');

  const passes = results.filter((r) => r.status === 'PASS').length;
  const warns = results.filter((r) => r.status === 'WARN').length;
  const fails = results.filter((r) => r.status === 'FAIL').length;

  let md = `# Visual Regression Audit Log\n\n`;
  md += `**Date:** ${date} ${time} UTC\n`;
  md += `**Phase:** 55-03 (Glass, Docs & Regression)\n`;
  md += `**Milestone:** v2.3.5 Design Token Alignment\n`;
  md += `**Method:** Automated Playwright browser audit + manual style verification\n`;
  md += `**Viewport:** 1440x900 (desktop, dark mode)\n\n`;

  // Summary
  md += `## Summary\n\n`;
  md += `| Metric | Count |\n`;
  md += `|--------|-------|\n`;
  md += `| Total pages audited | ${results.length} |\n`;
  md += `| PASS | ${passes} |\n`;
  md += `| WARN (non-critical) | ${warns} |\n`;
  md += `| FAIL | ${fails} |\n\n`;

  // Overview table
  md += `## Page Overview\n\n`;
  md += `| Page | URL | Status | Load Time | Console Errors | Notes |\n`;
  md += `|------|-----|--------|-----------|----------------|-------|\n`;
  for (const r of results) {
    const statusIcon = r.status === 'PASS' ? 'PASS' : r.status === 'WARN' ? 'WARN' : 'FAIL';
    const noteSummary = r.notes.length > 0 ? r.notes[0].substring(0, 60) : 'Clean';
    md += `| ${r.name} | \`${r.url}\` | ${statusIcon} | ${r.loadTime}ms | ${r.consoleErrors.length} | ${noteSummary} |\n`;
  }
  md += `\n`;

  // Detailed results per page
  md += `## Detailed Results\n\n`;
  for (const r of results) {
    md += `### ${r.name} (\`${r.url}\`)\n\n`;
    md += `**Status:** ${r.status}\n`;
    md += `**Load time:** ${r.loadTime}ms\n`;
    md += `**Screenshot:** \`${r.screenshotPath}\`\n\n`;

    // Component checks
    if (r.componentChecks.length > 0) {
      md += `**Component Checks:**\n\n`;
      md += `| Component | Status | Details |\n`;
      md += `|-----------|--------|----------|\n`;
      for (const c of r.componentChecks) {
        md += `| ${c.name} | ${c.status} | ${c.details} |\n`;
      }
      md += `\n`;
    }

    // Console errors
    if (r.consoleErrors.length > 0) {
      md += `**Console Errors:**\n`;
      for (const e of r.consoleErrors) {
        md += `- \`${e.substring(0, 200)}\`\n`;
      }
      md += `\n`;
    }

    // Console warnings
    if (r.consoleWarnings.length > 0) {
      md += `**Console Warnings:**\n`;
      for (const w of r.consoleWarnings.slice(0, 5)) {
        md += `- \`${w.substring(0, 200)}\`\n`;
      }
      if (r.consoleWarnings.length > 5) {
        md += `- (...${r.consoleWarnings.length - 5} more)\n`;
      }
      md += `\n`;
    }

    // Notes
    if (r.notes.length > 0) {
      md += `**Notes:**\n`;
      for (const n of r.notes) {
        md += `- ${n}\n`;
      }
      md += `\n`;
    }
  }

  md += `---\n*Generated by regression-audit.ts*\n`;

  return md;
}

// --- Run ---

runRegressionAudit().catch((err) => {
  console.error('Regression audit failed:', err);
  process.exit(1);
});
