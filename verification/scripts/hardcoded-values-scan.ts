/**
 * Hardcoded Values Scanner
 *
 * Scans component directories for hardcoded color/spacing values
 * that should be using design tokens from globals.css.
 *
 * Produces: verification/reports/hardcoded-values.md
 *
 * Run: npx tsx verification/scripts/hardcoded-values-scan.ts
 */

import fs from "fs";
import path from "path";

// ============================================
// Configuration
// ============================================

const PROJECT_ROOT = path.resolve(__dirname, "../..");

const SCAN_DIRECTORIES = [
  "src/components/ui",
  "src/components/primitives",
  "src/components/motion",
  "src/components/effects",
  "src/components/app",
  "src/components/layout",
  "src/components/landing",
  "src/components/visualization",
  "src/components/viral-results",
];

const FILE_EXTENSIONS = [".tsx", ".ts"];

// ============================================
// Pattern definitions
// ============================================

interface PatternDef {
  name: string;
  regex: RegExp;
  description: string;
}

const PATTERNS: PatternDef[] = [
  {
    name: "hex-color",
    regex: /#[0-9a-fA-F]{3,8}\b/g,
    description: "Hex color value",
  },
  {
    name: "rgb-rgba",
    regex: /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g,
    description: "RGB/RGBA color value",
  },
  {
    name: "arbitrary-tailwind-color",
    regex: /\b(?:bg|text|border|shadow|ring)-\[#[0-9a-fA-F]+\]/g,
    description: "Arbitrary Tailwind color value",
  },
  {
    name: "arbitrary-tailwind-size",
    regex: /\b(?:bg|text|border|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|w|h|gap|space-x|space-y)-\[\d+px\]/g,
    description: "Arbitrary Tailwind size value",
  },
];

// ============================================
// Allow-list: intentional hardcoded values
// ============================================

interface AllowListEntry {
  file: string;
  justification: string;
  /** Optional: specific patterns to allow. If empty, all patterns allowed for this file. */
  patterns?: string[];
}

const ALLOW_LIST: AllowListEntry[] = [
  {
    file: "TrafficLights.tsx",
    justification:
      "macOS traffic light colors (#ed6a5f, #f6be50, #61c555) are system-defined constants with no design token equivalent",
  },
  {
    file: "GlassOrb.tsx",
    justification:
      "THREE.js shader colors operate in WebGL context, not CSS - design tokens are not applicable",
  },
  {
    file: "kbd.tsx",
    justification:
      "Raycast-extracted 4-layer keyboard shadow uses complex rgba/rgb values in inline boxShadow - too complex for a single token (Phase 41 decision)",
  },
  {
    file: "skeleton.tsx",
    justification:
      "Shimmer gradient uses rgba white/opacity values for animation-specific effect - inline style pattern for animation gradients (Phase 42 decision)",
  },
  {
    file: "extension-card.tsx",
    justification:
      "GRADIENT_THEMES uses per-theme oklch radial gradients - each is unique and not tokenizable (Phase 41 decision)",
  },
  {
    file: "card.tsx",
    justification:
      "Glass effect rgba values for backdrop-filter specific boxShadow and background - inline styles for Safari compatibility (Phase 40 decision)",
  },
  {
    file: "filter-pills.tsx",
    justification:
      "Country flag colors (#F97316, #3B82F6, etc.) are data-driven per-country identifiers, not design tokens",
  },
  {
    file: "spinner.tsx",
    justification:
      "SVG stroke uses currentColor inheritance - no hardcoded color values (inline styles are for transform only)",
  },
  {
    file: "dialog.tsx",
    justification:
      "Backdrop blur values (4px overlay, 20px content) are component-specific glassmorphism tuning - inline for Safari -webkit- prefix compatibility",
  },
  {
    file: "toggle.tsx",
    justification:
      "oklch value in shadow utility class is the accent token value used in Tailwind shadow-[] syntax for coral glow effect",
  },
  {
    file: "select.tsx",
    justification:
      "Inline styles for dropdown positioning (maxHeight, overflow) are layout-specific, not design token candidates",
  },
  {
    file: "toast.tsx",
    justification:
      "CSS keyframe injection uses inline styles for self-contained slide animations (Phase 41 decision)",
  },
  // Shader files
  {
    file: "coreFragment.glsl.ts",
    justification: "GLSL shader source - WebGL context, not CSS",
  },
  {
    file: "orbFragment.glsl.ts",
    justification: "GLSL shader source - WebGL context, not CSS",
  },
  {
    file: "orbVertex.glsl.ts",
    justification: "GLSL shader source - WebGL context, not CSS",
  },
  {
    file: "shellFragment.glsl.ts",
    justification: "GLSL shader source - WebGL context, not CSS",
  },
  // Visualization components
  {
    file: "VisualizationCanvas.tsx",
    justification:
      "THREE.js/R3F scene setup - colors are WebGL context, not CSS tokens",
  },
  {
    file: "SplineOrb.tsx",
    justification:
      "Spline 3D component - WebGL context, not CSS tokens",
  },
  {
    file: "VisualizationContext.tsx",
    justification:
      "Visualization state management - no CSS color usage",
  },
  {
    file: "network-visualization.tsx",
    justification:
      "Data visualization with dynamic per-node colors - WebGL/Canvas context, not CSS design tokens",
  },
  // Primitives with intentional glass effects
  {
    file: "GlassPanel.tsx",
    justification:
      "Glass primitive uses inline rgba for backdrop-filter Safari compatibility and glass tint system (Phase 42 decision)",
  },
  {
    file: "GradientGlow.tsx",
    justification:
      "Gradient glow uses dynamic oklch values passed via props for customizable glow effects",
  },
  {
    file: "GradientMesh.tsx",
    justification:
      "Gradient mesh uses dynamic color values for generative visual effects",
  },
  {
    file: "LiquidGlassFilters.tsx",
    justification:
      "SVG filter definitions use specific color matrix values for liquid glass effect",
  },
];

// ============================================
// Scanner logic
// ============================================

interface Finding {
  file: string;
  relPath: string;
  line: number;
  match: string;
  pattern: string;
  lineContent: string;
  allowListed: boolean;
  allowListJustification?: string;
}

function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("/**")
  );
}

function isImportLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("import ") || trimmed.startsWith("from ");
}

function getFiles(dir: string): string[] {
  const fullDir = path.join(PROJECT_ROOT, dir);
  if (!fs.existsSync(fullDir)) return [];

  const results: string[] = [];
  const entries = fs.readdirSync(fullDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(fullDir, entry.name);
    if (entry.isDirectory()) {
      // Recurse into subdirectories
      const subDir = path.join(dir, entry.name);
      results.push(...getFiles(subDir));
    } else if (FILE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }

  return results;
}

function scanFile(filePath: string): Finding[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const fileName = path.basename(filePath);
  const relPath = path.relative(PROJECT_ROOT, filePath);
  const findings: Finding[] = [];

  // Check if file is in allow-list
  const allowEntry = ALLOW_LIST.find((e) => e.file === fileName);

  lines.forEach((line, idx) => {
    // Skip comment lines and import lines
    if (isCommentLine(line) || isImportLine(line)) return;

    for (const pattern of PATTERNS) {
      // Reset regex lastIndex
      pattern.regex.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.regex.exec(line)) !== null) {
        const matchedValue = match[0];

        // Skip common non-color hex patterns
        if (pattern.name === "hex-color") {
          // Skip very short matches that might be part of class names
          const hexPart = matchedValue.slice(1);
          if (hexPart.length < 3) continue;

          // Skip CSS variable references like var(--color-...)
          const beforeMatch = line.slice(0, match.index);
          if (beforeMatch.endsWith("--") || beforeMatch.endsWith("var(--")) continue;
        }

        findings.push({
          file: filePath,
          relPath,
          line: idx + 1,
          match: matchedValue,
          pattern: pattern.name,
          lineContent: line.trim(),
          allowListed: !!allowEntry,
          allowListJustification: allowEntry?.justification,
        });
      }
    }
  });

  return findings;
}

// ============================================
// Report generation
// ============================================

function generateReport(findings: Finding[]): string {
  const allowListed = findings.filter((f) => f.allowListed);
  const flagged = findings.filter((f) => !f.allowListed);

  // Group flagged by file
  const flaggedByFile = new Map<string, Finding[]>();
  for (const f of flagged) {
    const existing = flaggedByFile.get(f.relPath) || [];
    existing.push(f);
    flaggedByFile.set(f.relPath, existing);
  }

  // Group allow-listed by file
  const allowedByFile = new Map<string, Finding[]>();
  for (const f of allowListed) {
    const existing = allowedByFile.get(f.relPath) || [];
    existing.push(f);
    allowedByFile.set(f.relPath, existing);
  }

  const date = new Date().toISOString().split("T")[0];

  let md = `# VER-06: Hardcoded Values Scan Report\n\n`;
  md += `**Date:** ${date}\n`;
  md += `**Scanner:** verification/scripts/hardcoded-values-scan.ts\n`;
  md += `**Scope:** Component code in src/components/\n\n`;

  md += `## Summary\n\n`;
  md += `| Metric | Count |\n`;
  md += `|--------|-------|\n`;
  md += `| Total findings | ${findings.length} |\n`;
  md += `| Allow-listed (intentional) | ${allowListed.length} |\n`;
  md += `| Flagged for review | ${flagged.length} |\n`;
  md += `| Files scanned | ${new Set(findings.map((f) => f.relPath)).size + " (with findings)"} |\n`;
  md += `| Directories scanned | ${SCAN_DIRECTORIES.length} |\n\n`;

  // Pattern breakdown
  md += `### Findings by Pattern\n\n`;
  md += `| Pattern | Total | Allow-listed | Flagged |\n`;
  md += `|---------|-------|-------------|--------|\n`;
  for (const pattern of PATTERNS) {
    const total = findings.filter((f) => f.pattern === pattern.name).length;
    const allowed = allowListed.filter(
      (f) => f.pattern === pattern.name
    ).length;
    const flag = flagged.filter((f) => f.pattern === pattern.name).length;
    if (total > 0) {
      md += `| ${pattern.description} | ${total} | ${allowed} | ${flag} |\n`;
    }
  }
  md += `\n`;

  // ----------------------------------------
  // Allow-listed section
  // ----------------------------------------
  md += `## Allow-Listed Values (Intentional)\n\n`;
  md += `These hardcoded values are intentional and documented with justification.\n\n`;

  if (allowedByFile.size === 0) {
    md += `No allow-listed findings.\n\n`;
  } else {
    for (const [filePath, fileFindings] of allowedByFile) {
      const justification = fileFindings[0].allowListJustification || "N/A";
      md += `### ${filePath}\n\n`;
      md += `**Justification:** ${justification}\n\n`;
      md += `| Line | Value | Pattern |\n`;
      md += `|------|-------|---------|\n`;
      for (const f of fileFindings) {
        md += `| ${f.line} | \`${f.match}\` | ${f.pattern} |\n`;
      }
      md += `\n`;
    }
  }

  // ----------------------------------------
  // Flagged section
  // ----------------------------------------
  md += `## Flagged Values (Review Needed)\n\n`;
  md += `These values may need to be replaced with design tokens from globals.css.\n\n`;

  if (flaggedByFile.size === 0) {
    md += `No flagged findings -- all hardcoded values are allow-listed.\n\n`;
  } else {
    for (const [filePath, fileFindings] of flaggedByFile) {
      md += `### ${filePath}\n\n`;
      md += `| Line | Value | Pattern | Context |\n`;
      md += `|------|-------|---------|---------|\n`;
      for (const f of fileFindings) {
        // Truncate long context lines
        const ctx =
          f.lineContent.length > 80
            ? f.lineContent.slice(0, 77) + "..."
            : f.lineContent;
        md += `| ${f.line} | \`${f.match}\` | ${f.pattern} | \`${ctx}\` |\n`;
      }
      md += `\n`;
    }
  }

  // ----------------------------------------
  // Recommendations
  // ----------------------------------------
  md += `## Recommendations\n\n`;

  if (flaggedByFile.size === 0) {
    md += `All hardcoded values have been reviewed and allow-listed with justification. No immediate action required.\n\n`;
  } else {
    md += `The following files contain hardcoded values that should be reviewed for potential token replacement:\n\n`;

    for (const [filePath, fileFindings] of flaggedByFile) {
      const uniqueValues = [...new Set(fileFindings.map((f) => f.match))];
      md += `- **${filePath}** (${fileFindings.length} findings)\n`;
      md += `  - Values: ${uniqueValues.map((v) => `\`${v}\``).join(", ")}\n`;
      md += `  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification\n`;
    }
    md += `\n`;
  }

  // ----------------------------------------
  // Methodology
  // ----------------------------------------
  md += `## Methodology\n\n`;
  md += `### Patterns Detected\n\n`;
  for (const pattern of PATTERNS) {
    md += `- **${pattern.description}:** \`${pattern.regex.source}\`\n`;
  }
  md += `\n`;

  md += `### Exclusions\n\n`;
  md += `- Comment lines (// and /* */ blocks)\n`;
  md += `- Import statements\n`;
  md += `- CSS variable references (var(--...))\n\n`;

  md += `### Allow-List Criteria\n\n`;
  md += `Values are allow-listed when they meet one of these criteria:\n`;
  md += `1. **Platform constants** (macOS traffic light colors, system UI values)\n`;
  md += `2. **WebGL/shader context** (THREE.js colors, GLSL values -- not CSS)\n`;
  md += `3. **Complex compound values** (multi-layer shadows too complex for single token)\n`;
  md += `4. **Animation-specific** (shimmer gradients, transition values)\n`;
  md += `5. **Data-driven** (per-item colors like country flags, chart series)\n`;
  md += `6. **Safari compatibility** (inline styles required for -webkit- prefix)\n\n`;

  md += `---\n`;
  md += `*Generated by hardcoded-values-scan.ts*\n`;
  md += `*Phase: 44-verification-documentation, Plan: 02*\n`;

  return md;
}

// ============================================
// Main execution
// ============================================

function main(): void {
  console.log("Hardcoded Values Scanner");
  console.log("========================\n");

  // Collect all files
  const allFiles: string[] = [];
  for (const dir of SCAN_DIRECTORIES) {
    const files = getFiles(dir);
    console.log(`  ${dir}: ${files.length} files`);
    allFiles.push(...files);
  }
  console.log(`\nTotal files to scan: ${allFiles.length}\n`);

  // Scan all files
  const allFindings: Finding[] = [];
  for (const file of allFiles) {
    const findings = scanFile(file);
    if (findings.length > 0) {
      allFindings.push(...findings);
    }
  }

  // Generate report
  const report = generateReport(allFindings);

  // Write report
  const reportPath = path.join(
    PROJECT_ROOT,
    "verification/reports/hardcoded-values.md"
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report, "utf-8");

  // Summary output
  const allowListed = allFindings.filter((f) => f.allowListed).length;
  const flagged = allFindings.filter((f) => !f.allowListed).length;

  console.log("Results:");
  console.log(`  Total findings: ${allFindings.length}`);
  console.log(`  Allow-listed: ${allowListed}`);
  console.log(`  Flagged: ${flagged}`);
  console.log(`\nReport written to: ${reportPath}`);
}

main();
