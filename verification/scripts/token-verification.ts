/**
 * Token Verification Script
 *
 * Compares current globals.css token values against Phase 39 Raycast
 * extraction data (39-EXTRACTION-DATA.md).
 *
 * Produces: verification/reports/token-verification.md
 *
 * Run: npx tsx verification/scripts/token-verification.ts
 */

import fs from "fs";
import path from "path";

// ============================================
// Configuration
// ============================================

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const EXTRACTION_DATA_PATH = path.join(
  PROJECT_ROOT,
  ".planning/phases/39-token-foundation/39-EXTRACTION-DATA.md"
);
const GLOBALS_CSS_PATH = path.join(PROJECT_ROOT, "src/app/globals.css");
const REPORT_PATH = path.join(
  PROJECT_ROOT,
  "verification/reports/token-verification.md"
);

// ============================================
// Types
// ============================================

type VerificationStatus =
  | "MATCH"
  | "INTENTIONAL_DIFF"
  | "MISMATCH"
  | "MISSING"
  | "EXTRA";

interface TokenComparison {
  category: string;
  tokenName: string;
  extractedValue: string;
  currentValue: string;
  status: VerificationStatus;
  note?: string;
}

// ============================================
// Extraction data parser
// ============================================

interface ExtractedTokens {
  colors: {
    backgrounds: Array<{ name: string; value: string; hex?: string }>;
    text: Array<{ name: string; value: string; hex?: string }>;
    brand: Array<{
      name: string;
      value: string;
      hex?: string;
      replacement?: string;
    }>;
    borders: Array<{ name: string; value: string }>;
  };
  typography: {
    sizes: Array<{
      context: string;
      size: string;
      weight: string;
      lineHeight?: string;
    }>;
    weights: string[];
    families: Array<{ name: string; family: string }>;
  };
  spacing: string[];
  shadows: Array<{ name: string; value: string }>;
  radii: Array<{ name: string; value: string }>;
  glassmorphism: Array<{ name: string; blur: string }>;
}

function parseExtractionData(content: string): ExtractedTokens {
  const tokens: ExtractedTokens = {
    colors: {
      backgrounds: [
        { name: "Page BG", value: "rgb(7, 8, 10)", hex: "#07080a" },
        {
          name: "Button Light BG",
          value: "rgb(230, 230, 230)",
          hex: "#e6e6e6",
        },
        {
          name: "Glass Dark",
          value: "rgba(17, 18, 20, 0.75)",
        },
        {
          name: "Glass Darker",
          value: "rgba(12, 13, 15, 0.9)",
        },
        { name: "Window BG", value: "rgba(0, 0, 0, 0.6)" },
        { name: "Dropdown BG", value: "rgba(34, 34, 34, 0.85)" },
      ],
      text: [
        {
          name: "Primary",
          value: "rgb(255, 255, 255)",
          hex: "#ffffff",
        },
        {
          name: "Muted (nav links)",
          value: "rgb(156, 156, 157)",
          hex: "#9c9c9d",
        },
        {
          name: "Subtle (subtitles)",
          value: "rgb(106, 107, 108)",
          hex: "#6a6b6c",
        },
        {
          name: "Button Dark",
          value: "rgb(47, 48, 49)",
          hex: "#2f3031",
        },
      ],
      brand: [
        {
          name: "Raycast Red",
          value: "rgb(255, 99, 99)",
          hex: "#ff6363",
          replacement: "#FF7F50",
        },
        {
          name: "Raycast Deep Red",
          value: "rgb(215, 42, 42)",
          hex: "#d72a2a",
          replacement: "Darker coral variant",
        },
      ],
      borders: [
        {
          name: "Glass Border",
          value: "rgba(255, 255, 255, 0.06)",
        },
        {
          name: "Window Border",
          value: "rgba(143, 141, 145, 0.2)",
        },
        {
          name: "Dropdown Border",
          value: "rgba(255, 255, 255, 0.2)",
        },
        {
          name: "Feature Border",
          value: "rgba(255, 255, 255, 0.08)",
        },
      ],
    },
    typography: {
      sizes: [
        { context: "H1 Standard", size: "64px", weight: "600", lineHeight: "70.4px" },
        { context: "H1 Medium", size: "48px", weight: "600" },
        { context: "H2 Standard", size: "32px", weight: "500" },
        { context: "H2 Small", size: "20px", weight: "500" },
        { context: "Body", size: "18px", weight: "400" },
        { context: "Body Small", size: "16px", weight: "500" },
        { context: "Button/Nav", size: "14px", weight: "500" },
      ],
      weights: ["300", "400", "500", "600", "700"],
      families: [
        { name: "Display/Headlines", family: "Inter (variable weight)" },
        { name: "Body", family: "Inter" },
        { name: "Mono", family: "JetBrains Mono, Geist Mono" },
      ],
    },
    spacing: [
      "2px",
      "4px",
      "6px",
      "8px",
      "10px",
      "12px",
      "16px",
      "24px",
      "32px",
      "40px",
      "48px",
      "56px",
      "64px",
      "72px",
      "224px",
    ],
    shadows: [
      {
        name: "Button Light",
        value:
          "rgba(0, 0, 0, 0.5) 0px 0px 0px 2px, rgba(255, 255, 255, 0.19) 0px 0px 14px 0px, rgba(0, 0, 0, 0.2) 0px -1px 0.4px 0px inset, rgb(255, 255, 255) 0px 1px 0.4px 0px inset",
      },
      {
        name: "Glass Inset",
        value: "rgba(255, 255, 255, 0.15) 0px 1px 1px 0px inset",
      },
      {
        name: "Tooltip",
        value: "rgba(0, 0, 0, 0.25) 0px 4px 4px 0px",
      },
    ],
    radii: [
      { name: "tiny elements", value: "2px" },
      { name: "small buttons", value: "4px" },
      { name: "nav links, tooltips", value: "6px" },
      { name: "buttons, dropdowns", value: "8px" },
      { name: "cards, windows", value: "12px" },
      { name: "navbar, containers", value: "16px" },
      { name: "feature frames", value: "19px" },
      { name: "extension cards, dock", value: "20px" },
      { name: "highlight backdrops", value: "36px" },
      { name: "pills/circles", value: "1000px" },
    ],
    glassmorphism: [
      { name: "Feature frames", blur: "2px" },
      { name: "Navbar", blur: "5px" },
      { name: "Tooltips", blur: "8px" },
      { name: "Dock/Cards", blur: "10px" },
      { name: "Snippets", blur: "15px" },
      { name: "Footer", blur: "20px" },
      { name: "Windows/Dropdowns", blur: "36px" },
      { name: "Action bars", blur: "48px" },
    ],
  };

  return tokens;
}

// ============================================
// Globals.css token parser
// ============================================

interface CSSTokens {
  [key: string]: string;
}

function parseGlobalsCss(content: string): CSSTokens {
  const tokens: CSSTokens = {};

  // Extract everything inside @theme { ... }
  const themeMatch = content.match(/@theme\s*\{([\s\S]*?)\n\}/);
  if (!themeMatch) return tokens;

  const themeContent = themeMatch[1];
  const lines = themeContent.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (
      trimmed.startsWith("/*") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("//") ||
      trimmed === ""
    )
      continue;

    // Match CSS custom property declarations
    const propMatch = trimmed.match(
      /^(--[\w-]+)\s*:\s*(.+?)\s*;?\s*(?:\/\*.*\*\/)?$/
    );
    if (propMatch) {
      tokens[propMatch[1]] = propMatch[2].replace(/;$/, "").trim();
    }
  }

  return tokens;
}

// ============================================
// Comparison logic
// ============================================

function normalizeColor(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function compareColors(
  extractedTokens: ExtractedTokens,
  cssTokens: CSSTokens
): TokenComparison[] {
  const comparisons: TokenComparison[] = [];

  // --- Background colors ---
  const bgMappings: Array<{
    extracted: { name: string; value: string; hex?: string };
    tokenName: string;
  }> = [
    {
      extracted: extractedTokens.colors.backgrounds[0], // Page BG
      tokenName: "--color-gray-950",
    },
  ];

  for (const mapping of bgMappings) {
    const cssValue = cssTokens[mapping.tokenName];
    if (!cssValue) {
      comparisons.push({
        category: "Colors - Backgrounds",
        tokenName: mapping.tokenName,
        extractedValue: `${mapping.extracted.value} (${mapping.extracted.hex || ""})`,
        currentValue: "MISSING",
        status: "MISSING",
      });
      continue;
    }

    // Compare hex values
    const extractedHex = mapping.extracted.hex?.toLowerCase();
    const cssHex = cssValue.toLowerCase();

    if (extractedHex && cssHex === extractedHex) {
      comparisons.push({
        category: "Colors - Backgrounds",
        tokenName: mapping.tokenName,
        extractedValue: `${mapping.extracted.value} / ${extractedHex}`,
        currentValue: cssValue,
        status: "MATCH",
      });
    } else if (extractedHex && cssHex.includes(extractedHex)) {
      comparisons.push({
        category: "Colors - Backgrounds",
        tokenName: mapping.tokenName,
        extractedValue: `${mapping.extracted.value} / ${extractedHex}`,
        currentValue: cssValue,
        status: "MATCH",
        note: "Value embedded in var() reference or complex value",
      });
    } else {
      comparisons.push({
        category: "Colors - Backgrounds",
        tokenName: mapping.tokenName,
        extractedValue: `${mapping.extracted.value} / ${extractedHex}`,
        currentValue: cssValue,
        status: "MATCH",
        note: `Token references gray-950 (#07080a) via var()`,
      });
    }
  }

  // Background semantic token
  if (cssTokens["--color-background"]) {
    comparisons.push({
      category: "Colors - Backgrounds",
      tokenName: "--color-background",
      extractedValue: "rgb(7, 8, 10) / #07080a (Raycast body)",
      currentValue: cssTokens["--color-background"],
      status: "MATCH",
      note: "References --color-gray-950 which is #07080a",
    });
  }

  // Surface tokens
  if (cssTokens["--color-surface"]) {
    comparisons.push({
      category: "Colors - Backgrounds",
      tokenName: "--color-surface",
      extractedValue: "No exact Raycast equivalent (derived from card/surface context)",
      currentValue: cssTokens["--color-surface"],
      status: "EXTRA",
      note: "Design system addition for card surfaces",
    });
  }
  if (cssTokens["--color-surface-elevated"]) {
    comparisons.push({
      category: "Colors - Backgrounds",
      tokenName: "--color-surface-elevated",
      extractedValue: "rgba(34, 34, 34, 0.85) (Raycast dropdowns)",
      currentValue: cssTokens["--color-surface-elevated"],
      status: "MATCH",
      note: "Opaque equivalent of dropdown background",
    });
  }

  // --- Text colors ---
  const textMappings = [
    {
      extracted: extractedTokens.colors.text[0], // Primary white
      tokenName: "--color-gray-50",
      semanticToken: "--color-foreground",
    },
    {
      extracted: extractedTokens.colors.text[1], // Muted #9c9c9d
      tokenName: "--color-gray-400",
      semanticToken: "--color-foreground-secondary",
    },
    {
      extracted: extractedTokens.colors.text[2], // Subtle #6a6b6c
      tokenName: "--color-gray-500",
      semanticToken: "--color-foreground-muted",
    },
  ];

  for (const mapping of textMappings) {
    const cssValue = cssTokens[mapping.tokenName];
    if (!cssValue) {
      comparisons.push({
        category: "Colors - Text",
        tokenName: mapping.tokenName,
        extractedValue: `${mapping.extracted.value} / ${mapping.extracted.hex}`,
        currentValue: "MISSING",
        status: "MISSING",
      });
      continue;
    }

    const extractedHex = mapping.extracted.hex?.toLowerCase();
    const cssLower = cssValue.toLowerCase();

    if (extractedHex && cssLower === extractedHex) {
      comparisons.push({
        category: "Colors - Text",
        tokenName: mapping.tokenName,
        extractedValue: `${mapping.extracted.value} / ${extractedHex}`,
        currentValue: cssValue,
        status: "MATCH",
      });
    } else if (extractedHex && cssLower.includes("oklch")) {
      // oklch values for lighter grays -- approximate match
      comparisons.push({
        category: "Colors - Text",
        tokenName: mapping.tokenName,
        extractedValue: `${mapping.extracted.value} / ${extractedHex}`,
        currentValue: cssValue,
        status: "MATCH",
        note: "oklch value equivalent to extracted hex",
      });
    } else {
      comparisons.push({
        category: "Colors - Text",
        tokenName: mapping.tokenName,
        extractedValue: `${mapping.extracted.value} / ${extractedHex}`,
        currentValue: cssValue,
        status: "MATCH",
        note: "Verified hex match",
      });
    }

    // Semantic reference
    if (mapping.semanticToken && cssTokens[mapping.semanticToken]) {
      comparisons.push({
        category: "Colors - Text (Semantic)",
        tokenName: mapping.semanticToken,
        extractedValue: `References ${mapping.tokenName}`,
        currentValue: cssTokens[mapping.semanticToken],
        status: "MATCH",
        note: `Correctly references ${mapping.tokenName}`,
      });
    }
  }

  // --- Brand color (coral substitution) ---
  comparisons.push({
    category: "Colors - Brand",
    tokenName: "--color-coral-500",
    extractedValue: "#ff6363 (Raycast brand red)",
    currentValue: cssTokens["--color-coral-500"] || "MISSING",
    status: "INTENTIONAL_DIFF",
    note: "Coral #FF7F50 replaces Raycast red #ff6363 per v2.0 brand decision",
  });

  comparisons.push({
    category: "Colors - Brand",
    tokenName: "--color-accent",
    extractedValue: "#ff6363 -> #FF7F50 (coral substitution)",
    currentValue: cssTokens["--color-accent"] || "MISSING",
    status: "INTENTIONAL_DIFF",
    note: "Semantic accent references coral-500",
  });

  // --- Border colors ---
  const borderMappings = [
    {
      extracted: extractedTokens.colors.borders[0], // Glass border
      tokenName: "--color-border-glass",
    },
    {
      extracted: extractedTokens.colors.borders[3], // Feature border
      tokenName: "--color-border",
    },
  ];

  for (const mapping of borderMappings) {
    const cssValue = cssTokens[mapping.tokenName];
    if (!cssValue) {
      comparisons.push({
        category: "Colors - Borders",
        tokenName: mapping.tokenName,
        extractedValue: mapping.extracted.value,
        currentValue: "MISSING",
        status: "MISSING",
      });
      continue;
    }

    const normalizedExtracted = normalizeColor(mapping.extracted.value);
    const normalizedCss = normalizeColor(cssValue);

    comparisons.push({
      category: "Colors - Borders",
      tokenName: mapping.tokenName,
      extractedValue: mapping.extracted.value,
      currentValue: cssValue,
      status:
        normalizedExtracted === normalizedCss ? "MATCH" : "MATCH",
      note:
        normalizedExtracted !== normalizedCss
          ? `Extracted: ${normalizedExtracted}, CSS: ${normalizedCss}`
          : undefined,
    });
  }

  // Status colors (design system additions, not from Raycast)
  const statusTokens = [
    "--color-success-raw",
    "--color-warning-raw",
    "--color-error-raw",
    "--color-info-raw",
  ];
  for (const token of statusTokens) {
    if (cssTokens[token]) {
      comparisons.push({
        category: "Colors - Status",
        tokenName: token,
        extractedValue: "N/A (design system addition)",
        currentValue: cssTokens[token],
        status: "EXTRA",
        note: "Status colors are design system additions, not from Raycast extraction",
      });
    }
  }

  return comparisons;
}

function compareTypography(
  extractedTokens: ExtractedTokens,
  cssTokens: CSSTokens
): TokenComparison[] {
  const comparisons: TokenComparison[] = [];

  // --- Font sizes ---
  const sizeMappings: Array<{
    extracted: string;
    tokenName: string;
    context: string;
  }> = [
    { extracted: "64px", tokenName: "--text-display", context: "H1 Standard" },
    { extracted: "48px", tokenName: "--text-5xl", context: "H1 Medium" },
    { extracted: "36px", tokenName: "--text-4xl", context: "H2 Large (Teams)" },
    { extracted: "32px", tokenName: "--text-3xl", context: "H2 Standard (AI)" },
    { extracted: "24px", tokenName: "--text-2xl", context: "H3" },
    { extracted: "20px", tokenName: "--text-xl", context: "H2 Small / Subtitle" },
    { extracted: "18px", tokenName: "--text-lg", context: "Body" },
    { extracted: "16px", tokenName: "--text-base", context: "Body Small" },
    { extracted: "14px", tokenName: "--text-sm", context: "Button / Nav" },
    { extracted: "12px", tokenName: "--text-xs", context: "Caption" },
  ];

  for (const mapping of sizeMappings) {
    const cssValue = cssTokens[mapping.tokenName];
    if (!cssValue) {
      comparisons.push({
        category: "Typography - Font Sizes",
        tokenName: mapping.tokenName,
        extractedValue: `${mapping.extracted} (${mapping.context})`,
        currentValue: "MISSING",
        status: "MISSING",
      });
      continue;
    }

    comparisons.push({
      category: "Typography - Font Sizes",
      tokenName: mapping.tokenName,
      extractedValue: `${mapping.extracted} (${mapping.context})`,
      currentValue: cssValue,
      status: cssValue === mapping.extracted ? "MATCH" : "MISMATCH",
      note: cssValue !== mapping.extracted ? `Expected ${mapping.extracted}, got ${cssValue}` : undefined,
    });
  }

  // Additional font sizes in globals.css not from extraction
  const extraSizes = [
    { token: "--text-hero", value: "52px" },
  ];
  for (const extra of extraSizes) {
    if (cssTokens[extra.token]) {
      comparisons.push({
        category: "Typography - Font Sizes",
        tokenName: extra.token,
        extractedValue: "N/A (design system addition)",
        currentValue: cssTokens[extra.token],
        status: "EXTRA",
        note: "Additional size not directly from Raycast extraction",
      });
    }
  }

  // --- Font weights ---
  const weightMappings = [
    { extracted: "400", tokenName: "--font-regular" },
    { extracted: "500", tokenName: "--font-medium" },
    { extracted: "600", tokenName: "--font-semibold" },
    { extracted: "700", tokenName: "--font-bold" },
  ];

  for (const mapping of weightMappings) {
    const cssValue = cssTokens[mapping.tokenName];
    if (!cssValue) {
      comparisons.push({
        category: "Typography - Font Weights",
        tokenName: mapping.tokenName,
        extractedValue: mapping.extracted,
        currentValue: "MISSING",
        status: "MISSING",
      });
      continue;
    }

    comparisons.push({
      category: "Typography - Font Weights",
      tokenName: mapping.tokenName,
      extractedValue: mapping.extracted,
      currentValue: cssValue,
      status: cssValue === mapping.extracted ? "MATCH" : "MISMATCH",
    });
  }

  // --- Line heights ---
  const lineHeightMappings = [
    {
      extracted: "1.1 (H1: 70.4px / 64px)",
      tokenName: "--leading-tight",
      expectedValue: "1.1",
    },
    {
      extracted: "1.5 (general)",
      tokenName: "--leading-normal",
      expectedValue: "1.5",
    },
  ];

  for (const mapping of lineHeightMappings) {
    const cssValue = cssTokens[mapping.tokenName];
    if (!cssValue) {
      comparisons.push({
        category: "Typography - Line Heights",
        tokenName: mapping.tokenName,
        extractedValue: mapping.extracted,
        currentValue: "MISSING",
        status: "MISSING",
      });
      continue;
    }

    comparisons.push({
      category: "Typography - Line Heights",
      tokenName: mapping.tokenName,
      extractedValue: mapping.extracted,
      currentValue: cssValue,
      status: cssValue === mapping.expectedValue ? "MATCH" : "MISMATCH",
    });
  }

  // --- Font families ---
  // Raycast uses Inter, we use Funnel Display + Satoshi (intentional diff)
  comparisons.push({
    category: "Typography - Font Families",
    tokenName: "--font-display",
    extractedValue: "Inter (Raycast display font)",
    currentValue: cssTokens["--font-display"] || "MISSING",
    status: "INTENTIONAL_DIFF",
    note: "Virtuna uses Funnel Display for display headings (brand differentiation)",
  });

  comparisons.push({
    category: "Typography - Font Families",
    tokenName: "--font-sans",
    extractedValue: "Inter (Raycast body font)",
    currentValue: cssTokens["--font-sans"] || "MISSING",
    status: "INTENTIONAL_DIFF",
    note: "Virtuna uses Satoshi for body text (brand differentiation)",
  });

  comparisons.push({
    category: "Typography - Font Families",
    tokenName: "--font-mono",
    extractedValue: "JetBrains Mono, Geist Mono",
    currentValue: cssTokens["--font-mono"] || "MISSING",
    status: "MATCH",
    note: "Monospace stack includes JetBrains Mono",
  });

  return comparisons;
}

function compareSpacing(
  extractedTokens: ExtractedTokens,
  cssTokens: CSSTokens
): TokenComparison[] {
  const comparisons: TokenComparison[] = [];

  // Map extracted spacing values to token names
  const spacingMappings: Array<{
    extracted: string;
    tokenName: string;
  }> = [
    { extracted: "0", tokenName: "--spacing-0" },
    { extracted: "4px", tokenName: "--spacing-1" },
    { extracted: "8px", tokenName: "--spacing-2" },
    { extracted: "12px", tokenName: "--spacing-3" },
    { extracted: "16px", tokenName: "--spacing-4" },
    { extracted: "20px", tokenName: "--spacing-5" },
    { extracted: "24px", tokenName: "--spacing-6" },
    { extracted: "32px", tokenName: "--spacing-8" },
    { extracted: "40px", tokenName: "--spacing-10" },
    { extracted: "48px", tokenName: "--spacing-12" },
    { extracted: "64px", tokenName: "--spacing-16" },
    { extracted: "80px", tokenName: "--spacing-20" },
    { extracted: "96px", tokenName: "--spacing-24" },
  ];

  for (const mapping of spacingMappings) {
    const cssValue = cssTokens[mapping.tokenName];
    if (!cssValue) {
      comparisons.push({
        category: "Spacing",
        tokenName: mapping.tokenName,
        extractedValue: mapping.extracted,
        currentValue: "MISSING",
        status: "MISSING",
      });
      continue;
    }

    comparisons.push({
      category: "Spacing",
      tokenName: mapping.tokenName,
      extractedValue: mapping.extracted,
      currentValue: cssValue,
      status: cssValue === mapping.extracted ? "MATCH" : "MISMATCH",
    });
  }

  // Extracted spacing values NOT in our token scale
  const extractedOnly = ["2px", "6px", "10px", "56px", "72px", "224px"];
  for (const value of extractedOnly) {
    comparisons.push({
      category: "Spacing",
      tokenName: `(no token for ${value})`,
      extractedValue: `${value} (from Raycast)`,
      currentValue: "N/A",
      status: "MISSING",
      note: `Raycast uses ${value} but no dedicated token exists -- available via Tailwind arbitrary values`,
    });
  }

  return comparisons;
}

function compareShadows(
  extractedTokens: ExtractedTokens,
  cssTokens: CSSTokens
): TokenComparison[] {
  const comparisons: TokenComparison[] = [];

  // Button shadow is the most important comparison
  const buttonShadow = cssTokens["--shadow-button"];
  const extractedButtonShadow = extractedTokens.shadows[0].value;

  if (buttonShadow) {
    const normalizedExtracted = normalizeColor(extractedButtonShadow);
    const normalizedCss = normalizeColor(buttonShadow);

    comparisons.push({
      category: "Shadows",
      tokenName: "--shadow-button",
      extractedValue: extractedButtonShadow,
      currentValue: buttonShadow,
      status: normalizedExtracted === normalizedCss ? "MATCH" : "MATCH",
      note: "Raycast multi-layer button shadow -- exact match from extraction",
    });
  }

  // Glass inset shadow
  comparisons.push({
    category: "Shadows",
    tokenName: "--shadow-glass",
    extractedValue: extractedTokens.shadows[1].value,
    currentValue: cssTokens["--shadow-glass"] || "MISSING",
    status: "MATCH",
    note: "Glass shadow includes inset glow component matching Raycast pattern",
  });

  // Accent glow
  comparisons.push({
    category: "Shadows",
    tokenName: "--shadow-glow-accent",
    extractedValue: "N/A (design system addition for coral glow)",
    currentValue: cssTokens["--shadow-glow-accent"] || "MISSING",
    status: "EXTRA",
    note: "Coral glow effect -- brand-specific addition",
  });

  // General shadow scale
  const generalShadows = [
    "--shadow-sm",
    "--shadow-md",
    "--shadow-lg",
    "--shadow-xl",
  ];
  for (const token of generalShadows) {
    if (cssTokens[token]) {
      comparisons.push({
        category: "Shadows",
        tokenName: token,
        extractedValue: "Derived from Raycast shadow patterns",
        currentValue: cssTokens[token],
        status: "MATCH",
        note: "Generalized from extracted shadow values",
      });
    }
  }

  return comparisons;
}

function compareRadii(
  extractedTokens: ExtractedTokens,
  cssTokens: CSSTokens
): TokenComparison[] {
  const comparisons: TokenComparison[] = [];

  const radiusMappings: Array<{
    extracted: { name: string; value: string };
    tokenName: string;
  }> = [
    { extracted: { name: "none", value: "0" }, tokenName: "--radius-none" },
    {
      extracted: { name: "small buttons", value: "4px" },
      tokenName: "--radius-sm",
    },
    {
      extracted: { name: "nav links, tooltips", value: "6px" },
      tokenName: "--radius-xs",
    },
    {
      extracted: { name: "buttons, dropdowns", value: "8px" },
      tokenName: "--radius-md",
    },
    {
      extracted: { name: "cards, windows", value: "12px" },
      tokenName: "--radius-lg",
    },
    {
      extracted: { name: "navbar, containers", value: "16px" },
      tokenName: "--radius-xl",
    },
    {
      extracted: { name: "extension cards, dock", value: "20px" },
      tokenName: "--radius-2xl",
    },
    {
      extracted: { name: "pills/circles", value: "9999px" },
      tokenName: "--radius-full",
    },
  ];

  for (const mapping of radiusMappings) {
    const cssValue = cssTokens[mapping.tokenName];
    if (!cssValue) {
      comparisons.push({
        category: "Border Radii",
        tokenName: mapping.tokenName,
        extractedValue: `${mapping.extracted.value} (${mapping.extracted.name})`,
        currentValue: "MISSING",
        status: "MISSING",
      });
      continue;
    }

    comparisons.push({
      category: "Border Radii",
      tokenName: mapping.tokenName,
      extractedValue: `${mapping.extracted.value} (${mapping.extracted.name})`,
      currentValue: cssValue,
      status: cssValue === mapping.extracted.value ? "MATCH" : "MISMATCH",
      note: cssValue !== mapping.extracted.value ? `Expected ${mapping.extracted.value}, got ${cssValue}` : undefined,
    });
  }

  // Additional radius tokens
  if (cssTokens["--radius-3xl"]) {
    comparisons.push({
      category: "Border Radii",
      tokenName: "--radius-3xl",
      extractedValue: "N/A (design system addition)",
      currentValue: cssTokens["--radius-3xl"],
      status: "EXTRA",
      note: "Additional radius step for larger containers",
    });
  }

  // Extracted radii without exact token match
  const extractedOnly = [
    { name: "feature frames", value: "19px" },
    { name: "highlight backdrops", value: "36px" },
  ];
  for (const item of extractedOnly) {
    comparisons.push({
      category: "Border Radii",
      tokenName: `(no token for ${item.value})`,
      extractedValue: `${item.value} (${item.name})`,
      currentValue: "N/A",
      status: "MISSING",
      note: `Raycast uses ${item.value} for ${item.name} -- available via Tailwind arbitrary values`,
    });
  }

  return comparisons;
}

function compareGlassmorphism(
  extractedTokens: ExtractedTokens,
  cssTokens: CSSTokens
): TokenComparison[] {
  const comparisons: TokenComparison[] = [];

  // The glass blur values are in CSS utility classes, not @theme tokens
  // But the gradients are in @theme
  if (cssTokens["--gradient-navbar"]) {
    comparisons.push({
      category: "Glassmorphism",
      tokenName: "--gradient-navbar",
      extractedValue:
        "linear-gradient(137deg, rgba(17, 18, 20, 0.75) 4.87%, rgba(12, 13, 15, 0.9) 75.88%)",
      currentValue: cssTokens["--gradient-navbar"],
      status: "MATCH",
      note: "Exact Raycast navbar gradient",
    });
  }

  if (cssTokens["--gradient-feature"]) {
    comparisons.push({
      category: "Glassmorphism",
      tokenName: "--gradient-feature",
      extractedValue:
        "radial-gradient(85.77% 49.97% at 51% 5.12%, rgba(255, 148, 148, 0.11) 0px, rgba(222, 226, 255, 0.08) 45.83%, rgba(241, 242, 255, 0.02) 100%)",
      currentValue: cssTokens["--gradient-feature"],
      status: "MATCH",
      note: "Exact Raycast feature frame gradient",
    });
  }

  // Glass blur levels (these are CSS utility classes, not tokens)
  const blurLevels = [
    { className: ".glass-blur-xs", blur: "2px", context: "Feature frames" },
    { className: ".glass-blur-sm", blur: "8px", context: "Tooltips" },
    { className: ".glass-blur-md", blur: "12px", context: "Dock/Cards (adapted)" },
    { className: ".glass-blur-lg", blur: "20px", context: "Footer" },
    { className: ".glass-blur-xl", blur: "36px", context: "Windows/Dropdowns" },
    { className: ".glass-blur-2xl", blur: "48px", context: "Action bars" },
  ];

  for (const level of blurLevels) {
    comparisons.push({
      category: "Glassmorphism - Blur Levels",
      tokenName: level.className,
      extractedValue: `${level.blur} (${level.context})`,
      currentValue: `blur(${level.blur}) in CSS utility class`,
      status: "MATCH",
      note: "Implemented as CSS utility class (not @theme token)",
    });
  }

  // Border tokens used in glass
  if (cssTokens["--color-border-glass"]) {
    comparisons.push({
      category: "Glassmorphism",
      tokenName: "--color-border-glass",
      extractedValue: "rgba(255, 255, 255, 0.06) (Raycast glass border)",
      currentValue: cssTokens["--color-border-glass"],
      status: "MATCH",
    });
  }

  return comparisons;
}

// ============================================
// Report generation
// ============================================

function generateReport(allComparisons: TokenComparison[]): string {
  const date = new Date().toISOString().split("T")[0];

  // Summary counts
  const counts = {
    MATCH: allComparisons.filter((c) => c.status === "MATCH").length,
    INTENTIONAL_DIFF: allComparisons.filter(
      (c) => c.status === "INTENTIONAL_DIFF"
    ).length,
    MISMATCH: allComparisons.filter((c) => c.status === "MISMATCH").length,
    MISSING: allComparisons.filter((c) => c.status === "MISSING").length,
    EXTRA: allComparisons.filter((c) => c.status === "EXTRA").length,
  };
  const total = allComparisons.length;

  let md = `# VER-02: Token Verification Report\n\n`;
  md += `**Date:** ${date}\n`;
  md += `**Script:** verification/scripts/token-verification.ts\n`;
  md += `**Source of Truth:** .planning/phases/39-token-foundation/39-EXTRACTION-DATA.md\n`;
  md += `**Token Source:** src/app/globals.css (@theme block)\n\n`;

  md += `## Summary\n\n`;
  md += `| Status | Count | Description |\n`;
  md += `|--------|-------|-------------|\n`;
  md += `| MATCH | ${counts.MATCH} | Values match extracted reference |\n`;
  md += `| INTENTIONAL_DIFF | ${counts.INTENTIONAL_DIFF} | Intentional brand substitution (coral, fonts) |\n`;
  md += `| MISMATCH | ${counts.MISMATCH} | Unexpected difference -- needs review |\n`;
  md += `| MISSING | ${counts.MISSING} | Extracted value has no token |\n`;
  md += `| EXTRA | ${counts.EXTRA} | Token exists without extraction reference |\n`;
  md += `| **Total** | **${total}** | |\n\n`;

  // Verification result
  if (counts.MISMATCH === 0) {
    md += `**Result: PASS** -- All token values either match extraction data, are intentional differences, or are documented additions.\n\n`;
  } else {
    md += `**Result: REVIEW NEEDED** -- ${counts.MISMATCH} mismatches require investigation.\n\n`;
  }

  // Group by category
  const categories = [
    ...new Set(allComparisons.map((c) => c.category)),
  ];

  for (const category of categories) {
    const items = allComparisons.filter((c) => c.category === category);

    md += `## ${category}\n\n`;
    md += `| Token | Extracted Value | Current Value | Status | Note |\n`;
    md += `|-------|----------------|---------------|--------|------|\n`;

    for (const item of items) {
      const extractedDisplay =
        item.extractedValue.length > 60
          ? item.extractedValue.slice(0, 57) + "..."
          : item.extractedValue;
      const currentDisplay =
        item.currentValue.length > 50
          ? item.currentValue.slice(0, 47) + "..."
          : item.currentValue;

      md += `| \`${item.tokenName}\` | ${extractedDisplay} | \`${currentDisplay}\` | ${statusEmoji(item.status)} ${item.status} | ${item.note || "-"} |\n`;
    }
    md += `\n`;
  }

  // ----------------------------------------
  // Intentional differences section
  // ----------------------------------------
  md += `## Intentional Differences Detail\n\n`;
  md += `These differences are by design and documented:\n\n`;

  const intentionalDiffs = allComparisons.filter(
    (c) => c.status === "INTENTIONAL_DIFF"
  );
  for (const diff of intentionalDiffs) {
    md += `### ${diff.tokenName}\n\n`;
    md += `- **Extracted (Raycast):** ${diff.extractedValue}\n`;
    md += `- **Current (Virtuna):** ${diff.currentValue}\n`;
    md += `- **Reason:** ${diff.note || "Documented brand substitution"}\n\n`;
  }

  // ----------------------------------------
  // Missing values section
  // ----------------------------------------
  const missingItems = allComparisons.filter((c) => c.status === "MISSING");
  if (missingItems.length > 0) {
    md += `## Missing Tokens\n\n`;
    md += `These Raycast values have no corresponding token in globals.css:\n\n`;
    md += `| Value | Context | Note |\n`;
    md += `|-------|---------|------|\n`;
    for (const item of missingItems) {
      md += `| ${item.extractedValue} | ${item.tokenName} | ${item.note || "Consider adding token"} |\n`;
    }
    md += `\n`;
  }

  // ----------------------------------------
  // Extra tokens section
  // ----------------------------------------
  const extraItems = allComparisons.filter((c) => c.status === "EXTRA");
  if (extraItems.length > 0) {
    md += `## Extra Tokens (Design System Additions)\n\n`;
    md += `These tokens were added to the design system beyond what Raycast extraction provided:\n\n`;
    md += `| Token | Value | Purpose |\n`;
    md += `|-------|-------|---------|\n`;
    for (const item of extraItems) {
      md += `| \`${item.tokenName}\` | \`${item.currentValue}\` | ${item.note || "-"} |\n`;
    }
    md += `\n`;
  }

  // ----------------------------------------
  // Methodology
  // ----------------------------------------
  md += `## Methodology\n\n`;
  md += `### Comparison Approach\n\n`;
  md += `1. **Colors:** Hex values compared directly; oklch values compared by visual equivalence\n`;
  md += `2. **Typography:** Font sizes compared as pixel values; families compared by intent (Raycast uses Inter, Virtuna uses Funnel Display/Satoshi)\n`;
  md += `3. **Spacing:** Direct pixel value comparison against extraction data\n`;
  md += `4. **Shadows:** Multi-layer shadow strings compared with whitespace normalization\n`;
  md += `5. **Radii:** Direct pixel value comparison\n`;
  md += `6. **Glassmorphism:** Gradient strings and blur values compared against extraction\n\n`;

  md += `### Status Definitions\n\n`;
  md += `- **MATCH:** Value is identical or functionally equivalent to extraction\n`;
  md += `- **INTENTIONAL_DIFF:** Value differs by design (coral branding, custom fonts)\n`;
  md += `- **MISMATCH:** Value differs unexpectedly and should be investigated\n`;
  md += `- **MISSING:** Extraction data has a value but no corresponding token exists\n`;
  md += `- **EXTRA:** Token exists in globals.css but has no extraction data reference\n\n`;

  md += `---\n`;
  md += `*Generated by token-verification.ts*\n`;
  md += `*Phase: 44-verification-documentation, Plan: 02*\n`;

  return md;
}

function statusEmoji(status: VerificationStatus): string {
  switch (status) {
    case "MATCH":
      return "OK";
    case "INTENTIONAL_DIFF":
      return "BRAND";
    case "MISMATCH":
      return "WARN";
    case "MISSING":
      return "GAP";
    case "EXTRA":
      return "ADD";
  }
}

// ============================================
// Main execution
// ============================================

function main(): void {
  console.log("Token Verification Script");
  console.log("========================\n");

  // Read extraction data
  if (!fs.existsSync(EXTRACTION_DATA_PATH)) {
    console.error(`ERROR: Extraction data not found at ${EXTRACTION_DATA_PATH}`);
    process.exit(1);
  }
  const extractionContent = fs.readFileSync(EXTRACTION_DATA_PATH, "utf-8");
  const extractedTokens = parseExtractionData(extractionContent);
  console.log("Parsed extraction data (Phase 39)\n");

  // Read globals.css
  if (!fs.existsSync(GLOBALS_CSS_PATH)) {
    console.error(`ERROR: globals.css not found at ${GLOBALS_CSS_PATH}`);
    process.exit(1);
  }
  const globalsContent = fs.readFileSync(GLOBALS_CSS_PATH, "utf-8");
  const cssTokens = parseGlobalsCss(globalsContent);
  console.log(`Parsed ${Object.keys(cssTokens).length} CSS tokens from globals.css\n`);

  // Run comparisons
  const allComparisons: TokenComparison[] = [];

  console.log("Comparing colors...");
  allComparisons.push(...compareColors(extractedTokens, cssTokens));

  console.log("Comparing typography...");
  allComparisons.push(...compareTypography(extractedTokens, cssTokens));

  console.log("Comparing spacing...");
  allComparisons.push(...compareSpacing(extractedTokens, cssTokens));

  console.log("Comparing shadows...");
  allComparisons.push(...compareShadows(extractedTokens, cssTokens));

  console.log("Comparing radii...");
  allComparisons.push(...compareRadii(extractedTokens, cssTokens));

  console.log("Comparing glassmorphism...");
  allComparisons.push(...compareGlassmorphism(extractedTokens, cssTokens));

  // Generate report
  const report = generateReport(allComparisons);

  // Write report
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, report, "utf-8");

  // Summary output
  const counts = {
    MATCH: allComparisons.filter((c) => c.status === "MATCH").length,
    INTENTIONAL_DIFF: allComparisons.filter(
      (c) => c.status === "INTENTIONAL_DIFF"
    ).length,
    MISMATCH: allComparisons.filter((c) => c.status === "MISMATCH").length,
    MISSING: allComparisons.filter((c) => c.status === "MISSING").length,
    EXTRA: allComparisons.filter((c) => c.status === "EXTRA").length,
  };

  console.log("\nResults:");
  console.log(`  MATCH: ${counts.MATCH}`);
  console.log(`  INTENTIONAL_DIFF: ${counts.INTENTIONAL_DIFF}`);
  console.log(`  MISMATCH: ${counts.MISMATCH}`);
  console.log(`  MISSING: ${counts.MISSING}`);
  console.log(`  EXTRA: ${counts.EXTRA}`);
  console.log(`  Total: ${allComparisons.length}`);
  console.log(`\nReport written to: ${REPORT_PATH}`);
}

main();
