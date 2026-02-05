/**
 * WCAG AA Color Contrast Audit
 *
 * Standalone Node script (NOT a Playwright test) that:
 * 1. Launches Chromium via Playwright
 * 2. Extracts all semantic color token values via getComputedStyle()
 * 3. Computes WCAG AA contrast ratios for meaningful foreground/background pairs
 * 4. Generates a markdown report at verification/reports/contrast-audit.md
 *
 * Usage: npx tsx verification/scripts/contrast-audit.ts
 * Requires: dev server running on localhost:3000
 */

import { chromium } from 'playwright';
import { hex, score } from 'wcag-contrast';
import fs from 'fs';
import path from 'path';

// --- Types ---

interface ExtractedToken {
  name: string;
  computed: string; // raw computed value from browser (rgb/rgba)
  hex: string; // converted hex value
}

interface ContrastResult {
  label: string;
  fgToken: string;
  bgToken: string;
  fgHex: string;
  bgHex: string;
  ratio: number;
  wcagScore: string;
  passesAA: boolean; // normal text: >= 4.5:1
  passesAALarge: boolean; // large text: >= 3:1
}

// --- Token definitions ---

const SEMANTIC_TOKENS = [
  // Backgrounds
  '--color-background',
  '--color-background-elevated',
  '--color-surface',
  '--color-surface-elevated',

  // Text
  '--color-foreground',
  '--color-foreground-secondary',
  '--color-foreground-muted',

  // Accent
  '--color-accent',
  '--color-accent-hover',
  '--color-accent-foreground',

  // Status
  '--color-success',
  '--color-warning',
  '--color-error',
  '--color-info',

  // Border (decorative, included for completeness)
  '--color-border',

  // States
  '--color-hover',
  '--color-active',
  '--color-disabled',
];

// --- Foreground / Background pair definitions ---

function definePairs(): Array<{ fg: string; bg: string; label: string }> {
  const backgrounds = [
    '--color-background',
    '--color-surface',
    '--color-surface-elevated',
    '--color-background-elevated',
  ];

  const bgLabels: Record<string, string> = {
    '--color-background': 'background',
    '--color-surface': 'surface',
    '--color-surface-elevated': 'surface-elevated',
    '--color-background-elevated': 'bg-elevated',
  };

  const pairs: Array<{ fg: string; bg: string; label: string }> = [];

  // Text colors on all backgrounds
  const textColors = [
    '--color-foreground',
    '--color-foreground-secondary',
    '--color-foreground-muted',
  ];
  const textLabels: Record<string, string> = {
    '--color-foreground': 'foreground',
    '--color-foreground-secondary': 'foreground-secondary',
    '--color-foreground-muted': 'foreground-muted',
  };

  for (const fg of textColors) {
    for (const bg of backgrounds) {
      pairs.push({
        fg,
        bg,
        label: `${textLabels[fg]} on ${bgLabels[bg]}`,
      });
    }
  }

  // Accent colors on all backgrounds
  for (const bg of backgrounds) {
    pairs.push({
      fg: '--color-accent',
      bg,
      label: `accent on ${bgLabels[bg]}`,
    });
    pairs.push({
      fg: '--color-accent-hover',
      bg,
      label: `accent-hover on ${bgLabels[bg]}`,
    });
  }

  // Accent-foreground on accent background
  pairs.push({
    fg: '--color-accent-foreground',
    bg: '--color-accent',
    label: 'accent-foreground on accent',
  });

  // Status colors on all backgrounds
  const statusColors = [
    '--color-success',
    '--color-warning',
    '--color-error',
    '--color-info',
  ];
  const statusLabels: Record<string, string> = {
    '--color-success': 'success',
    '--color-warning': 'warning',
    '--color-error': 'error',
    '--color-info': 'info',
  };

  for (const fg of statusColors) {
    for (const bg of backgrounds) {
      pairs.push({
        fg,
        bg,
        label: `${statusLabels[fg]} on ${bgLabels[bg]}`,
      });
    }
  }

  return pairs;
}

// --- Color conversion helpers ---

/**
 * Parse rgb(r, g, b) or rgba(r, g, b, a) string to hex.
 * For rgba, composites against black (#000) background (dark theme).
 */
function rgbStringToHex(rgbStr: string): string {
  const trimmed = rgbStr.trim();

  // Handle rgba
  const rgbaMatch = trimmed.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/
  );

  if (!rgbaMatch) {
    console.warn(`Could not parse color: "${rgbStr}"`);
    return '#000000';
  }

  let r = parseInt(rgbaMatch[1], 10);
  let g = parseInt(rgbaMatch[2], 10);
  let b = parseInt(rgbaMatch[3], 10);
  const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;

  // For rgba with alpha < 1, composite against dark background (typical usage)
  // Using #07080a as base (the actual background color)
  if (a < 1) {
    const baseR = 7,
      baseG = 8,
      baseB = 10;
    r = Math.round(r * a + baseR * (1 - a));
    g = Math.round(g * a + baseG * (1 - a));
    b = Math.round(b * a + baseB * (1 - a));
  }

  const toHex = (n: number): string => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// --- Main audit function ---

async function runContrastAudit(): Promise<void> {
  console.log('Launching browser for contrast audit...');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Navigate and wait for page to fully load
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('Extracting computed color token values...');

  // Extract all semantic token values from the browser.
  // Strategy: Use a 2D canvas to force color resolution to sRGB.
  // Modern Chromium may return lab() from getComputedStyle for oklch values,
  // but drawing to a canvas and reading pixel data always gives us RGB.
  const rawTokens = await page.evaluate((tokenNames: string[]) => {
    const results: Array<{ name: string; computed: string; rgb: string }> = [];
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d')!;

    // Also create a temp element for computed style reporting
    const el = document.createElement('div');
    el.style.display = 'none';
    document.body.appendChild(el);

    for (const name of tokenNames) {
      // Get the computed style string for reporting
      el.style.backgroundColor = `var(${name})`;
      const computedStr = getComputedStyle(el).backgroundColor;
      el.style.backgroundColor = '';

      // Use canvas to force sRGB resolution
      // Clear canvas first
      ctx.clearRect(0, 0, 1, 1);

      // Draw a pixel with the resolved color
      // We need to resolve the CSS variable first
      const root = document.documentElement;
      const rawValue = getComputedStyle(root).getPropertyValue(name).trim();

      ctx.fillStyle = rawValue;
      ctx.fillRect(0, 0, 1, 1);

      const pixel = ctx.getImageData(0, 0, 1, 1).data;
      const r = pixel[0];
      const g = pixel[1];
      const b = pixel[2];
      const a = pixel[3];

      let rgbStr: string;
      if (a < 255) {
        rgbStr = `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(4)})`;
      } else {
        rgbStr = `rgb(${r}, ${g}, ${b})`;
      }

      results.push({ name, computed: computedStr.trim(), rgb: rgbStr });
    }

    document.body.removeChild(el);
    return results;
  }, SEMANTIC_TOKENS);

  await browser.close();

  // Convert to hex using the canvas-resolved RGB values
  const tokens: ExtractedToken[] = rawTokens.map((t) => ({
    name: t.name,
    computed: t.computed,
    hex: rgbStringToHex(t.rgb),
  }));

  // Build lookup
  const tokenMap = new Map<string, ExtractedToken>();
  for (const t of tokens) {
    tokenMap.set(t.name, t);
  }

  console.log(`Extracted ${tokens.length} tokens. Computing contrast ratios...`);

  // Define pairs and compute contrasts
  const pairs = definePairs();
  const results: ContrastResult[] = [];

  for (const pair of pairs) {
    const fgToken = tokenMap.get(pair.fg);
    const bgToken = tokenMap.get(pair.bg);

    if (!fgToken || !bgToken) {
      console.warn(`Missing token for pair: ${pair.label}`);
      continue;
    }

    const ratio = hex(fgToken.hex, bgToken.hex);
    const roundedRatio = Math.round(ratio * 100) / 100;

    results.push({
      label: pair.label,
      fgToken: pair.fg,
      bgToken: pair.bg,
      fgHex: fgToken.hex,
      bgHex: bgToken.hex,
      ratio: roundedRatio,
      wcagScore: score(ratio),
      passesAA: ratio >= 4.5,
      passesAALarge: ratio >= 3.0,
    });
  }

  // Generate report
  const report = generateReport(results, tokens);

  // Write report
  const reportPath = path.join(__dirname, '..', 'reports', 'contrast-audit.md');
  fs.writeFileSync(reportPath, report, 'utf-8');

  // Summary
  const passes = results.filter((r) => r.passesAA);
  const fails = results.filter((r) => !r.passesAA);
  const largeTextOnlyPasses = fails.filter((r) => r.passesAALarge);

  console.log('\n=== WCAG AA Contrast Audit Results ===');
  console.log(`Total combinations: ${results.length}`);
  console.log(`Normal text AA pass (>=4.5:1): ${passes.length}`);
  console.log(`Normal text AA fail (<4.5:1): ${fails.length}`);
  console.log(`  Of which pass large text AA (>=3:1): ${largeTextOnlyPasses.length}`);
  console.log(`\nReport written to: ${reportPath}`);
}

// --- Report generation ---

function generateReport(results: ContrastResult[], tokens: ExtractedToken[]): string {
  const date = new Date().toISOString().split('T')[0];
  const passes = results.filter((r) => r.passesAA);
  const fails = results.filter((r) => !r.passesAA);
  const largeTextPasses = fails.filter((r) => r.passesAALarge);

  let md = '';

  // Header
  md += `# WCAG AA Color Contrast Audit\n\n`;
  md += `**Date:** ${date}\n`;
  md += `**Standard:** WCAG 2.1 Level AA\n`;
  md += `**Method:** Browser-computed RGB values extracted via Playwright getComputedStyle() on localhost:3000\n`;
  md += `**Tool:** wcag-contrast v3.0.0 (hex-based contrast ratio calculation)\n`;
  md += `**Note:** All color values are browser-rendered (not manual oklch conversion)\n\n`;

  // Summary
  md += `## Summary\n\n`;
  md += `| Metric | Count |\n`;
  md += `|--------|-------|\n`;
  md += `| Total combinations tested | ${results.length} |\n`;
  md += `| Normal text AA pass (>=4.5:1) | ${passes.length} |\n`;
  md += `| Normal text AA fail (<4.5:1) | ${fails.length} |\n`;
  md += `| Large text AA pass (>=3:1) among failures | ${largeTextPasses.length} |\n`;
  md += `| Large text AA fail (<3:1) | ${fails.length - largeTextPasses.length} |\n\n`;

  md += `**WCAG AA thresholds:**\n`;
  md += `- Normal text (< 24px / < 18.66px bold): requires **4.5:1**\n`;
  md += `- Large text (>= 24px / >= 18.66px bold): requires **3:1**\n\n`;

  // Failures
  md += `## Failures (Normal Text AA)\n\n`;
  if (fails.length === 0) {
    md += `No failures. All combinations pass WCAG AA for normal text.\n\n`;
  } else {
    md += `The following combinations do not meet the 4.5:1 ratio for normal text:\n\n`;
    md += `| Combination | FG Hex | BG Hex | Ratio | Score | Large Text (3:1) |\n`;
    md += `|-------------|--------|--------|-------|-------|-------------------|\n`;
    for (const f of fails) {
      const largePass = f.passesAALarge ? 'PASS' : 'FAIL';
      md += `| ${f.label} | \`${f.fgHex}\` | \`${f.bgHex}\` | ${f.ratio}:1 | ${f.wcagScore} | ${largePass} |\n`;
    }
    md += `\n`;
  }

  // Passes
  md += `## Passes (Normal Text AA)\n\n`;
  if (passes.length === 0) {
    md += `No passes.\n\n`;
  } else {
    md += `| Combination | FG Hex | BG Hex | Ratio | Score |\n`;
    md += `|-------------|--------|--------|-------|-------|\n`;
    for (const p of passes) {
      md += `| ${p.label} | \`${p.fgHex}\` | \`${p.bgHex}\` | ${p.ratio}:1 | ${p.wcagScore} |\n`;
    }
    md += `\n`;
  }

  // Extracted token values
  md += `## Extracted Token Values\n\n`;
  md += `All values below are browser-computed RGB (via getComputedStyle) converted to hex.\n\n`;
  md += `| Token | Computed Value | Hex |\n`;
  md += `|-------|---------------|-----|\n`;
  for (const t of tokens) {
    md += `| \`${t.name}\` | \`${t.computed}\` | \`${t.hex}\` |\n`;
  }
  md += `\n`;

  // Methodology
  md += `## Methodology\n\n`;
  md += `1. Launched headless Chromium via Playwright\n`;
  md += `2. Navigated to http://localhost:3000 (dev server)\n`;
  md += `3. Extracted CSS custom property raw values via \`getComputedStyle(document.documentElement).getPropertyValue()\`\n`;
  md += `4. Resolved each value to sRGB via Canvas 2D API (\`fillRect\` + \`getImageData\`) to handle oklch/lab formats\n`;
  md += `5. Converted pixel RGBA data to hex values\n`;
  md += `6. For RGBA tokens (borders, states), composited against \`--color-background\` (#07080a) as base\n`;
  md += `7. Computed contrast ratios using \`wcag-contrast\` hex() function\n`;
  md += `8. Evaluated against WCAG 2.1 Level AA thresholds\n\n`;

  md += `**Note:** This audit documents findings only. It does not modify component code. Any failures are noted for a future fix phase.\n`;

  return md;
}

// --- Run ---

runContrastAudit().catch((err) => {
  console.error('Contrast audit failed:', err);
  process.exit(1);
});
