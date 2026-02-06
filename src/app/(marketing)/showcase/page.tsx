import { Heading, Text } from "@/components/ui";

import { CodeBlock } from "./_components/code-block";
import { ComponentGrid } from "./_components/component-grid";
import { ShowcaseSection } from "./_components/showcase-section";
import { TokenRow, TokenSwatch } from "./_components/token-swatch";

/* ============================================
 * TOKEN DATA — derived from globals.css
 * ============================================ */

const CORAL_SCALE = [
  { name: "coral-100", cssVar: "color-coral-100" },
  { name: "coral-200", cssVar: "color-coral-200" },
  { name: "coral-300", cssVar: "color-coral-300" },
  { name: "coral-400", cssVar: "color-coral-400" },
  { name: "coral-500", cssVar: "color-coral-500", semantic: "Base #FF7F50" },
  { name: "coral-600", cssVar: "color-coral-600" },
  { name: "coral-700", cssVar: "color-coral-700" },
  { name: "coral-800", cssVar: "color-coral-800" },
  { name: "coral-900", cssVar: "color-coral-900" },
];

const GRAY_SCALE = [
  { name: "gray-50", cssVar: "color-gray-50" },
  { name: "gray-100", cssVar: "color-gray-100" },
  { name: "gray-200", cssVar: "color-gray-200" },
  { name: "gray-300", cssVar: "color-gray-300" },
  { name: "gray-400", cssVar: "color-gray-400", semantic: "Secondary text" },
  { name: "gray-500", cssVar: "color-gray-500", semantic: "Muted text" },
  { name: "gray-600", cssVar: "color-gray-600", semantic: "Dimmed text" },
  { name: "gray-700", cssVar: "color-gray-700" },
  { name: "gray-800", cssVar: "color-gray-800" },
  { name: "gray-900", cssVar: "color-gray-900", semantic: "Elevated surface" },
  { name: "gray-950", cssVar: "color-gray-950", semantic: "Body background" },
];

const SEMANTIC_COLORS = [
  {
    name: "background",
    cssVar: "color-background",
    semantic: "-> gray-950",
  },
  {
    name: "background-elevated",
    cssVar: "color-background-elevated",
    semantic: "-> gray-900",
  },
  { name: "surface", cssVar: "color-surface", semantic: "#18191c" },
  {
    name: "surface-elevated",
    cssVar: "color-surface-elevated",
    semantic: "#222326",
  },
  { name: "foreground", cssVar: "color-foreground", semantic: "-> gray-50" },
  {
    name: "foreground-secondary",
    cssVar: "color-foreground-secondary",
    semantic: "-> gray-400",
  },
  {
    name: "foreground-muted",
    cssVar: "color-foreground-muted",
    semantic: "-> gray-500",
  },
  { name: "accent", cssVar: "color-accent", semantic: "-> coral-500" },
  {
    name: "accent-hover",
    cssVar: "color-accent-hover",
    semantic: "-> coral-400",
  },
  {
    name: "accent-active",
    cssVar: "color-accent-active",
    semantic: "-> coral-600",
  },
  {
    name: "accent-foreground",
    cssVar: "color-accent-foreground",
    semantic: "-> gray-50",
  },
  { name: "success", cssVar: "color-success", semantic: "-> success-raw" },
  { name: "warning", cssVar: "color-warning", semantic: "-> warning-raw" },
  { name: "error", cssVar: "color-error", semantic: "-> error-raw" },
  { name: "info", cssVar: "color-info", semantic: "-> info-raw" },
  { name: "border", cssVar: "color-border", semantic: "rgba(255,255,255,0.08)" },
  {
    name: "border-hover",
    cssVar: "color-border-hover",
    semantic: "rgba(255,255,255,0.15)",
  },
  {
    name: "border-glass",
    cssVar: "color-border-glass",
    semantic: "rgba(255,255,255,0.06)",
  },
  {
    name: "border-subtle",
    cssVar: "color-border-subtle",
    semantic: "rgba(255,255,255,0.04)",
  },
  { name: "hover", cssVar: "color-hover", semantic: "rgba(255,255,255,0.05)" },
  { name: "active", cssVar: "color-active", semantic: "rgba(255,255,255,0.1)" },
  {
    name: "disabled",
    cssVar: "color-disabled",
    semantic: "rgba(128,128,128,0.5)",
  },
];

const FONT_FAMILIES = [
  {
    name: "--font-sans",
    value: "Inter, ui-sans-serif, system-ui",
    sample: "The quick brown fox",
    className: "font-sans",
  },
  {
    name: "--font-mono",
    value: "ui-monospace, SFMono-Regular, JetBrains Mono",
    sample: "const x = 42;",
    className: "font-mono",
  },
];

const FONT_SIZES = [
  { name: "--text-xs", value: "12px", css: "text-xs" },
  { name: "--text-sm", value: "14px", css: "text-sm" },
  { name: "--text-base", value: "16px", css: "text-base" },
  { name: "--text-lg", value: "18px", css: "text-lg" },
  { name: "--text-xl", value: "20px", css: "text-xl" },
  { name: "--text-2xl", value: "24px", css: "text-2xl" },
  { name: "--text-3xl", value: "30px", css: "text-3xl" },
  { name: "--text-4xl", value: "36px", css: "text-4xl" },
  { name: "--text-5xl", value: "48px", css: "text-5xl" },
  { name: "--text-hero", value: "52px", css: "text-hero" },
  { name: "--text-display", value: "64px", css: "text-display" },
];

const FONT_WEIGHTS = [
  { name: "--font-regular", value: "400", css: "font-regular" },
  { name: "--font-medium", value: "500", css: "font-medium" },
  { name: "--font-semibold", value: "600", css: "font-semibold" },
  { name: "--font-bold", value: "700", css: "font-bold" },
];

const SPACING_SCALE = [
  { name: "--spacing-0", value: "0", size: 0 },
  { name: "--spacing-1", value: "4px", size: 4 },
  { name: "--spacing-2", value: "8px", size: 8 },
  { name: "--spacing-3", value: "12px", size: 12 },
  { name: "--spacing-4", value: "16px", size: 16 },
  { name: "--spacing-5", value: "20px", size: 20 },
  { name: "--spacing-6", value: "24px", size: 24 },
  { name: "--spacing-8", value: "32px", size: 32 },
  { name: "--spacing-10", value: "40px", size: 40 },
  { name: "--spacing-12", value: "48px", size: 48 },
  { name: "--spacing-16", value: "64px", size: 64 },
  { name: "--spacing-20", value: "80px", size: 80 },
  { name: "--spacing-24", value: "96px", size: 96 },
];

const SHADOWS = [
  { name: "--shadow-sm", css: "shadow-sm", label: "Small" },
  { name: "--shadow-md", css: "shadow-md", label: "Medium" },
  { name: "--shadow-lg", css: "shadow-lg", label: "Large" },
  { name: "--shadow-xl", css: "shadow-xl", label: "Extra Large" },
  { name: "--shadow-glass", css: "shadow-glass", label: "Glass" },
  {
    name: "--shadow-glow-accent",
    css: "shadow-glow-accent",
    label: "Glow Accent",
  },
  { name: "--shadow-button", css: "shadow-button", label: "Button" },
];

const RADII = [
  { name: "--radius-none", value: "0", css: "rounded-none" },
  { name: "--radius-sm", value: "4px", css: "rounded-sm" },
  { name: "--radius-xs", value: "6px", css: "rounded-xs" },
  { name: "--radius-md", value: "8px", css: "rounded-md" },
  { name: "--radius-lg", value: "12px", css: "rounded-lg" },
  { name: "--radius-xl", value: "16px", css: "rounded-xl" },
  { name: "--radius-2xl", value: "20px", css: "rounded-2xl" },
  { name: "--radius-3xl", value: "24px", css: "rounded-3xl" },
  { name: "--radius-full", value: "9999px", css: "rounded-full" },
];

const DURATIONS = [
  { name: "--duration-fast", value: "150ms" },
  { name: "--duration-normal", value: "200ms" },
  { name: "--duration-slow", value: "300ms" },
];

const EASINGS = [
  { name: "--ease-out-cubic", value: "cubic-bezier(0.215, 0.61, 0.355, 1)" },
  { name: "--ease-out-quart", value: "cubic-bezier(0.165, 0.84, 0.44, 1)" },
  { name: "--ease-in-out", value: "cubic-bezier(0.42, 0, 0.58, 1)" },
  { name: "--ease-spring", value: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
];

const Z_INDEX = [
  { name: "--z-base", value: "0" },
  { name: "--z-dropdown", value: "100" },
  { name: "--z-sticky", value: "200" },
  { name: "--z-modal-backdrop", value: "300" },
  { name: "--z-modal", value: "400" },
  { name: "--z-toast", value: "500" },
  { name: "--z-tooltip", value: "600" },
];

const GRADIENTS = [
  { name: "--gradient-coral", cssVar: "gradient-coral", label: "Coral" },
  {
    name: "--gradient-card-bg",
    cssVar: "gradient-card-bg",
    label: "Card Background",
  },
  {
    name: "--gradient-overlay",
    cssVar: "gradient-overlay",
    label: "Overlay",
  },
  {
    name: "--gradient-glow-coral",
    cssVar: "gradient-glow-coral",
    label: "Glow Coral",
  },
  {
    name: "--gradient-navbar",
    cssVar: "gradient-navbar",
    label: "Navbar",
  },
  {
    name: "--gradient-feature",
    cssVar: "gradient-feature",
    label: "Feature",
  },
];

/* ============================================
 * PAGE COMPONENT
 * ============================================ */

export default function ShowcasePage() {
  return (
    <div>
      {/* --- Page Header --- */}
      <div className="mb-16">
        <Heading level={1} className="mb-4">
          Design Tokens
        </Heading>
        <Text size="lg" muted className="max-w-2xl">
          Virtuna uses a two-tier token architecture. Primitive tokens (Layer 1)
          define raw color scales and values. Semantic tokens (Layer 2)
          reference primitives via{" "}
          <code className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-sm text-accent">
            var()
          </code>{" "}
          to provide contextual meaning — background, foreground, accent, etc.
        </Text>
      </div>

      {/* --- Coral Scale --- */}
      <ShowcaseSection
        id="coral"
        title="Coral Scale"
        description="Brand color palette replacing Raycast red. 9 steps from light to dark, with coral-500 as the base (#FF7F50)."
      >
        <ComponentGrid columns={3}>
          {CORAL_SCALE.map((token) => (
            <TokenSwatch
              key={token.name}
              name={token.name}
              cssVar={token.cssVar}
              semantic={token.semantic}
            />
          ))}
        </ComponentGrid>
        <div className="mt-6">
          <CodeBlock
            title="Usage"
            code={`<div className="bg-coral-500 text-white">
  Coral accent
</div>
<div className="text-coral-400">
  Lighter coral for hover states
</div>`}
          />
        </div>
      </ShowcaseSection>

      {/* --- Gray Scale --- */}
      <ShowcaseSection
        id="gray"
        title="Gray Scale"
        description="Neutral palette extracted from Raycast. Includes exact hex values for dark tones where oklch compilation is inaccurate."
      >
        <ComponentGrid columns={3}>
          {GRAY_SCALE.map((token) => (
            <TokenSwatch
              key={token.name}
              name={token.name}
              cssVar={token.cssVar}
              semantic={token.semantic}
            />
          ))}
        </ComponentGrid>
        <div className="mt-6">
          <CodeBlock
            title="Usage"
            code={`<div className="bg-gray-950 text-gray-50">
  Dark background with light text
</div>
<p className="text-gray-500">Muted text</p>`}
          />
        </div>
      </ShowcaseSection>

      {/* --- Semantic Colors --- */}
      <ShowcaseSection
        id="semantic"
        title="Semantic Colors"
        description="Contextual tokens that reference primitives. These are what components consume — background, surface, foreground, accent, status, borders, and states."
      >
        <div className="space-y-8">
          {/* Backgrounds & Surfaces */}
          <div>
            <Text size="sm" className="mb-3 font-medium">
              Backgrounds &amp; Surfaces
            </Text>
            <ComponentGrid columns={3}>
              {SEMANTIC_COLORS.filter((t) =>
                ["background", "background-elevated", "surface", "surface-elevated"].includes(t.name)
              ).map((token) => (
                <TokenSwatch
                  key={token.name}
                  name={token.name}
                  cssVar={token.cssVar}
                  semantic={token.semantic}
                />
              ))}
            </ComponentGrid>
          </div>

          {/* Text */}
          <div>
            <Text size="sm" className="mb-3 font-medium">
              Text
            </Text>
            <ComponentGrid columns={3}>
              {SEMANTIC_COLORS.filter((t) =>
                t.name.startsWith("foreground")
              ).map((token) => (
                <TokenSwatch
                  key={token.name}
                  name={token.name}
                  cssVar={token.cssVar}
                  semantic={token.semantic}
                />
              ))}
            </ComponentGrid>
          </div>

          {/* Accent */}
          <div>
            <Text size="sm" className="mb-3 font-medium">
              Accent
            </Text>
            <ComponentGrid columns={3}>
              {SEMANTIC_COLORS.filter((t) =>
                t.name.startsWith("accent")
              ).map((token) => (
                <TokenSwatch
                  key={token.name}
                  name={token.name}
                  cssVar={token.cssVar}
                  semantic={token.semantic}
                />
              ))}
            </ComponentGrid>
          </div>

          {/* Status */}
          <div>
            <Text size="sm" className="mb-3 font-medium">
              Status
            </Text>
            <ComponentGrid columns={4}>
              {SEMANTIC_COLORS.filter((t) =>
                ["success", "warning", "error", "info"].includes(t.name)
              ).map((token) => (
                <TokenSwatch
                  key={token.name}
                  name={token.name}
                  cssVar={token.cssVar}
                  semantic={token.semantic}
                />
              ))}
            </ComponentGrid>
          </div>

          {/* Borders */}
          <div>
            <Text size="sm" className="mb-3 font-medium">
              Borders
            </Text>
            <ComponentGrid columns={4}>
              {SEMANTIC_COLORS.filter((t) =>
                t.name.startsWith("border")
              ).map((token) => (
                <TokenSwatch
                  key={token.name}
                  name={token.name}
                  cssVar={token.cssVar}
                  semantic={token.semantic}
                />
              ))}
            </ComponentGrid>
          </div>

          {/* States */}
          <div>
            <Text size="sm" className="mb-3 font-medium">
              States
            </Text>
            <ComponentGrid columns={3}>
              {SEMANTIC_COLORS.filter((t) =>
                ["hover", "active", "disabled"].includes(t.name)
              ).map((token) => (
                <TokenSwatch
                  key={token.name}
                  name={token.name}
                  cssVar={token.cssVar}
                  semantic={token.semantic}
                />
              ))}
            </ComponentGrid>
          </div>
        </div>

        <div className="mt-6">
          <CodeBlock
            title="Two-tier mapping"
            code={`/* globals.css — Primitive (Layer 1) */
--color-coral-500: oklch(0.72 0.16 40);

/* globals.css — Semantic (Layer 2) */
--color-accent: var(--color-coral-500);

/* Component usage */
<Button className="bg-accent text-accent-foreground">
  Uses semantic token
</Button>`}
          />
        </div>
      </ShowcaseSection>

      {/* --- Typography --- */}
      <ShowcaseSection
        id="typography"
        title="Typography Tokens"
        description="Font families, sizes, weights, line heights, and letter spacing. Inter for all text (headings and body), mono for code."
      >
        <div className="space-y-8">
          {/* Font Families */}
          <div>
            <Text size="sm" className="mb-3 font-medium">
              Font Families
            </Text>
            <div className="space-y-4">
              {FONT_FAMILIES.map((font) => (
                <div
                  key={font.name}
                  className="rounded-lg border border-border-glass bg-surface/50 p-4"
                >
                  <p className="mb-1 font-mono text-xs text-foreground-muted">
                    {font.name}
                  </p>
                  <p className={`text-2xl ${font.className}`}>{font.sample}</p>
                  <p className="mt-1 font-mono text-xs text-foreground-muted">
                    {font.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Font Sizes */}
          <div>
            <Text size="sm" className="mb-3 font-medium">
              Font Sizes
            </Text>
            <div className="space-y-3">
              {FONT_SIZES.map((size) => (
                <div key={size.name} className="flex items-baseline gap-4">
                  <span className="w-32 shrink-0 font-mono text-xs text-foreground-muted">
                    {size.name}
                  </span>
                  <span className="w-12 shrink-0 font-mono text-xs text-foreground-muted">
                    {size.value}
                  </span>
                  <span
                    className="truncate leading-none"
                    style={{ fontSize: `var(--text-${size.css.replace("text-", "")})` }}
                  >
                    Virtuna
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Font Weights */}
          <div>
            <Text size="sm" className="mb-3 font-medium">
              Font Weights
            </Text>
            <div className="space-y-2">
              {FONT_WEIGHTS.map((w) => (
                <div key={w.name} className="flex items-baseline gap-4">
                  <span className="w-32 shrink-0 font-mono text-xs text-foreground-muted">
                    {w.name}
                  </span>
                  <span className="w-12 shrink-0 font-mono text-xs text-foreground-muted">
                    {w.value}
                  </span>
                  <span
                    className="text-lg"
                    style={{ fontWeight: w.value }}
                  >
                    Design Tokens
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <CodeBlock
            title="Usage"
            code={`<h1 className="text-display font-semibold">
  Hero Heading
</h1>
<p className="text-base font-normal">
  Body text in Inter
</p>
<code className="font-mono text-sm">
  code snippet
</code>`}
          />
        </div>
      </ShowcaseSection>

      {/* --- Spacing --- */}
      <ShowcaseSection
        id="spacing"
        title="Spacing Tokens"
        description="8px base grid system with 13 steps from 0 to 96px. Used for padding, margins, and gaps."
      >
        <div className="space-y-2">
          {SPACING_SCALE.map((space) => (
            <div key={space.name} className="flex items-center gap-4">
              <span className="w-28 shrink-0 font-mono text-xs text-foreground-muted">
                {space.name}
              </span>
              <span className="w-12 shrink-0 text-right font-mono text-xs text-foreground-muted">
                {space.value}
              </span>
              <div
                className="h-3 rounded-sm bg-accent"
                style={{ width: `${Math.max(space.size, 1)}px` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-6">
          <CodeBlock
            title="Usage"
            code={`<div className="p-4 gap-6">
  /* p-4 = 16px, gap-6 = 24px */
</div>
<div className="mt-8 px-12">
  /* mt-8 = 32px, px-12 = 48px */
</div>`}
          />
        </div>
      </ShowcaseSection>

      {/* --- Shadows --- */}
      <ShowcaseSection
        id="shadows"
        title="Shadow Tokens"
        description="7 shadow variants from subtle elevations to glow effects. Includes the multi-layer Raycast button shadow."
      >
        <ComponentGrid columns={3}>
          {SHADOWS.map((shadow) => (
            <div
              key={shadow.name}
              className="flex flex-col items-center gap-3 rounded-lg border border-border-glass bg-surface/50 p-6"
            >
              <div
                className="h-16 w-16 rounded-lg bg-surface-elevated"
                style={{ boxShadow: `var(--${shadow.css})` }}
              />
              <div className="text-center">
                <p className="font-mono text-xs text-foreground">
                  {shadow.label}
                </p>
                <p className="font-mono text-xs text-foreground-muted">
                  {shadow.name}
                </p>
              </div>
            </div>
          ))}
        </ComponentGrid>
        <div className="mt-6">
          <CodeBlock
            title="Usage"
            code={`<div className="shadow-md">
  Medium elevation
</div>
<div className="shadow-glass">
  Glassmorphism shadow
</div>
<button className="shadow-button">
  Raycast button shadow
</button>`}
          />
        </div>
      </ShowcaseSection>

      {/* --- Border Radius --- */}
      <ShowcaseSection
        id="radius"
        title="Border Radius Tokens"
        description="9 radius values from 0 to full circle. 6px for nav links, 8px for cards, 12px for panels, 16px for modals."
      >
        <ComponentGrid columns={3}>
          {RADII.map((r) => (
            <div
              key={r.name}
              className="flex items-center gap-3"
            >
              <div
                className="h-12 w-12 shrink-0 border-2 border-accent bg-accent/10"
                style={{ borderRadius: `var(--radius-${r.css.replace("rounded-", "")})` }}
              />
              <div>
                <p className="font-mono text-xs text-foreground">{r.name}</p>
                <p className="font-mono text-xs text-foreground-muted">
                  {r.value}
                </p>
              </div>
            </div>
          ))}
        </ComponentGrid>
        <div className="mt-6">
          <CodeBlock
            title="Usage"
            code={`<div className="rounded-md">  /* 8px */
<div className="rounded-lg">  /* 12px */
<div className="rounded-xl">  /* 16px */
<div className="rounded-full"> /* pill */`}
          />
        </div>
      </ShowcaseSection>

      {/* --- Animation --- */}
      <ShowcaseSection
        id="animation"
        title="Animation Tokens"
        description="Durations, easing curves, and z-index scale for consistent motion and layering."
      >
        <div className="space-y-8">
          {/* Durations */}
          <div>
            <Text size="sm" className="mb-3 font-medium">
              Durations
            </Text>
            <div className="space-y-2">
              {DURATIONS.map((d) => (
                <TokenRow
                  key={d.name}
                  name={d.name}
                  value={d.value}
                  preview={
                    <div
                      className="h-3 rounded-full bg-accent"
                      style={{
                        width: `${parseInt(d.value)}px`,
                      }}
                    />
                  }
                />
              ))}
            </div>
          </div>

          {/* Easings */}
          <div>
            <Text size="sm" className="mb-3 font-medium">
              Easing Curves
            </Text>
            <div className="space-y-2">
              {EASINGS.map((e) => (
                <TokenRow key={e.name} name={e.name} value={e.value} />
              ))}
            </div>
          </div>

          {/* Z-Index */}
          <div>
            <Text size="sm" className="mb-3 font-medium">
              Z-Index Scale
            </Text>
            <div className="space-y-2">
              {Z_INDEX.map((z) => (
                <TokenRow
                  key={z.name}
                  name={z.name}
                  value={z.value}
                  preview={
                    <div
                      className="h-3 rounded-full bg-accent/60"
                      style={{
                        width: `${Math.max(parseInt(z.value) / 5, 4)}px`,
                      }}
                    />
                  }
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <CodeBlock
            title="Usage"
            code={`/* Transition with tokens */
transition: all var(--duration-normal) var(--ease-out-cubic);

/* Tailwind usage */
<div className="duration-normal ease-out-cubic">
  Smooth transition
</div>

/* Z-index layering */
<div className="z-modal">Modal content</div>
<div className="z-toast">Toast notification</div>`}
          />
        </div>
      </ShowcaseSection>

      {/* --- Gradients --- */}
      <ShowcaseSection
        id="gradients"
        title="Gradient Tokens"
        description="6 gradient presets for brand accents, cards, overlays, glows, navbar, and feature backgrounds."
      >
        <ComponentGrid columns={2}>
          {GRADIENTS.map((g) => (
            <div
              key={g.name}
              className="overflow-hidden rounded-lg border border-border-glass"
            >
              <div
                className="h-24"
                style={{ background: `var(--${g.cssVar})` }}
              />
              <div className="bg-surface/50 p-3">
                <p className="font-mono text-xs text-foreground">
                  {g.label}
                </p>
                <p className="font-mono text-xs text-foreground-muted">
                  {g.name}
                </p>
              </div>
            </div>
          ))}
        </ComponentGrid>
        <div className="mt-6">
          <CodeBlock
            title="Usage"
            code={`/* Apply via inline style */
<div style={{ background: "var(--gradient-coral)" }}>
  Coral gradient
</div>

/* Navbar glass gradient */
<nav style={{ background: "var(--gradient-navbar)" }}>
  Navigation
</nav>`}
          />
        </div>
      </ShowcaseSection>
    </div>
  );
}
