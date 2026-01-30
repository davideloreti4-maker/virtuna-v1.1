import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function captureVirtunaDashboard() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  });

  const page = await context.newPage();

  // Navigate to the Virtuna app dashboard
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' });

  // Wait for page to fully render
  await page.waitForTimeout(1000);

  // Ensure output directory exists
  const outputDir = path.join(process.cwd(), '.planning/phases/12-comparison/virtuna-screenshots/dashboard');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Capture screenshot
  const outputPath = path.join(outputDir, '01-dashboard-default.png');
  await page.screenshot({
    path: outputPath,
    fullPage: false, // Match viewport size exactly
  });

  console.log(`Screenshot saved to: ${outputPath}`);

  await browser.close();
}

captureVirtunaDashboard().catch(console.error);
