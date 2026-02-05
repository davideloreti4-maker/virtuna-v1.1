"use client";

import { GlassPanel } from "@/components/primitives";
import type { GlassBlur } from "@/components/primitives";
import { FadeInUp, StaggerReveal, HoverScale } from "@/components/motion";
import { NoiseTexture, ChromaticAberration } from "@/components/effects";
import { Skeleton } from "@/components/ui";
import { Heading, Text, Caption } from "@/components/ui";

// ============================================
// GlassPanel Blur Variants Demo
// ============================================

const BLUR_LEVELS: { value: GlassBlur; label: string; px: string }[] = [
  { value: "none", label: "none", px: "0px" },
  { value: "xs", label: "xs", px: "2px" },
  { value: "sm", label: "sm", px: "8px" },
  { value: "md", label: "md", px: "12px" },
  { value: "lg", label: "lg", px: "20px" },
  { value: "xl", label: "xl", px: "36px" },
  { value: "2xl", label: "2xl", px: "48px" },
];

function GlassPanelBlurDemo(): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {BLUR_LEVELS.map(({ value, label, px }) => (
        <div key={value} className="relative overflow-hidden rounded-xl">
          {/* Background elements to show blur */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-coral-500/40 via-purple-500/30 to-cyan-500/40"
            aria-hidden="true"
          />
          <div
            className="absolute top-2 left-2 w-8 h-8 rounded-full bg-coral-500/70"
            aria-hidden="true"
          />
          <div
            className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-cyan-500/70"
            aria-hidden="true"
          />

          <GlassPanel blur={value} className="relative p-4 min-h-[100px]">
            <Text size="sm" className="font-semibold">
              {label}
            </Text>
            <Caption>{px}</Caption>
            <Text size="sm" muted className="mt-2">
              Sample text content
            </Text>
          </GlassPanel>
        </div>
      ))}
    </div>
  );
}

// ============================================
// FadeInUp Demo
// ============================================

function FadeInUpDemo(): React.JSX.Element {
  return (
    <div className="space-y-4">
      {[0, 0.2, 0.4].map((delay, i) => (
        <FadeInUp key={i} delay={delay}>
          <div className="rounded-lg border border-border-glass bg-surface p-4">
            <Text size="sm" className="font-medium">
              FadeInUp block {i + 1}
            </Text>
            <Caption>delay: {delay}s</Caption>
            <Text size="sm" muted className="mt-1">
              This content fades in and slides up from below when it enters the
              viewport.
            </Text>
          </div>
        </FadeInUp>
      ))}
    </div>
  );
}

// ============================================
// StaggerReveal Demo
// ============================================

function StaggerRevealDemo(): React.JSX.Element {
  const items = [
    "Card Alpha",
    "Card Beta",
    "Card Gamma",
    "Card Delta",
    "Card Epsilon",
    "Card Zeta",
  ];

  return (
    <StaggerReveal className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((label) => (
        <StaggerReveal.Item key={label}>
          <div className="rounded-lg border border-border-glass bg-surface p-4">
            <Text size="sm" className="font-medium">
              {label}
            </Text>
            <Caption>~80ms stagger delay</Caption>
            <Text size="sm" muted className="mt-1">
              Each card animates sequentially as the grid enters the viewport.
            </Text>
          </div>
        </StaggerReveal.Item>
      ))}
    </StaggerReveal>
  );
}

// ============================================
// HoverScale Demo
// ============================================

function HoverScaleDemo(): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {["Hover me", "Scale 1.02x", "Tap to press"].map((label, i) => (
        <HoverScale key={i}>
          <div className="rounded-lg border border-border-glass bg-surface p-6 text-center cursor-pointer select-none">
            <Text size="sm" className="font-medium">
              {label}
            </Text>
            <Caption className="mt-1">
              Hover to scale up, click to press down
            </Caption>
          </div>
        </HoverScale>
      ))}
    </div>
  );
}

// ============================================
// NoiseTexture Demo
// ============================================

function NoiseTextureDemo(): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Without noise */}
      <div className="relative overflow-hidden rounded-xl">
        <div
          className="absolute inset-0 bg-gradient-to-br from-purple-500/30 via-coral-500/20 to-cyan-500/30"
          aria-hidden="true"
        />
        <GlassPanel blur="md" className="relative p-6 min-h-[140px]">
          <Text size="sm" className="font-semibold">
            Without NoiseTexture
          </Text>
          <Text size="sm" muted className="mt-2">
            A standard GlassPanel without any grain overlay. Clean, smooth
            surface.
          </Text>
        </GlassPanel>
      </div>

      {/* With noise */}
      <div className="relative overflow-hidden rounded-xl">
        <div
          className="absolute inset-0 bg-gradient-to-br from-purple-500/30 via-coral-500/20 to-cyan-500/30"
          aria-hidden="true"
        />
        <GlassPanel blur="md" className="relative p-6 min-h-[140px]">
          <NoiseTexture opacity={0.05} />
          <Text size="sm" className="font-semibold relative z-10">
            With NoiseTexture
          </Text>
          <Text size="sm" muted className="mt-2 relative z-10">
            The same GlassPanel with a subtle SVG feTurbulence grain overlay for
            a premium tactile feel.
          </Text>
        </GlassPanel>
      </div>
    </div>
  );
}

// ============================================
// ChromaticAberration Demo
// ============================================

function ChromaticAberrationDemo(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-xl">
        <div
          className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-transparent to-cyan-500/20"
          aria-hidden="true"
        />
        <GlassPanel blur="lg" className="relative p-8 text-center">
          <ChromaticAberration offset={2} intensity={0.3}>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">
              VIRTUNA
            </h2>
          </ChromaticAberration>
          <Caption className="mt-3">
            ChromaticAberration: RGB split via CSS textShadow (offset: 2px,
            intensity: 0.3)
          </Caption>
        </GlassPanel>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div className="text-center">
          <ChromaticAberration offset={1} intensity={0.15}>
            <span className="text-xl font-bold">Subtle</span>
          </ChromaticAberration>
          <Caption className="mt-1">1px / 0.15</Caption>
        </div>
        <div className="text-center">
          <ChromaticAberration offset={2} intensity={0.25}>
            <span className="text-xl font-bold">Medium</span>
          </ChromaticAberration>
          <Caption className="mt-1">2px / 0.25</Caption>
        </div>
        <div className="text-center">
          <ChromaticAberration offset={3} intensity={0.4}>
            <span className="text-xl font-bold">Strong</span>
          </ChromaticAberration>
          <Caption className="mt-1">3px / 0.4</Caption>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Skeleton Shimmer Demo
// ============================================

function SkeletonShimmerDemo(): React.JSX.Element {
  return (
    <div className="space-y-4 max-w-md">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-32 w-full rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </div>
  );
}

// ============================================
// Main export — all Phase 42 demos
// ============================================

export function Phase42Demos(): React.JSX.Element {
  return (
    <>
      {/* GlassPanel Blur Variants */}
      <section className="mb-16">
        <Heading level={2} className="mb-2">
          GlassPanel Blur Variants
        </Heading>
        <Text size="sm" muted className="mb-6">
          7 blur levels from none (0px) to 2xl (48px). Blur reduces
          automatically on mobile for performance.
        </Text>
        <GlassPanelBlurDemo />
      </section>

      {/* FadeInUp */}
      <section className="mb-16">
        <Heading level={2} className="mb-2">
          FadeInUp
        </Heading>
        <Text size="sm" muted className="mb-6">
          Scroll-triggered fade + translateY reveal animation. Supports manual
          stagger via incremental delay props.
        </Text>
        <FadeInUpDemo />
      </section>

      {/* StaggerReveal */}
      <section className="mb-16">
        <Heading level={2} className="mb-2">
          StaggerReveal
        </Heading>
        <Text size="sm" muted className="mb-6">
          Orchestrated stagger animation for grid children. Each item animates
          sequentially with ~80ms delay.
        </Text>
        <StaggerRevealDemo />
      </section>

      {/* HoverScale */}
      <section className="mb-16">
        <Heading level={2} className="mb-2">
          HoverScale
        </Heading>
        <Text size="sm" muted className="mb-6">
          Micro-interaction wrapper: scale 1.02x on hover, 0.98x on tap. Spring
          physics (stiffness 400, damping 25).
        </Text>
        <HoverScaleDemo />
      </section>

      {/* NoiseTexture */}
      <section className="mb-16">
        <Heading level={2} className="mb-2">
          NoiseTexture
        </Heading>
        <Text size="sm" muted className="mb-6">
          SVG feTurbulence grain overlay. Adds tactile quality to glass surfaces.
          Each instance gets a unique filter ID via React.useId().
        </Text>
        <NoiseTextureDemo />
      </section>

      {/* ChromaticAberration */}
      <section className="mb-16">
        <Heading level={2} className="mb-2">
          ChromaticAberration
        </Heading>
        <Text size="sm" muted className="mb-6">
          Decorative RGB split effect using CSS textShadow. Best for large
          display text on glass surfaces.
        </Text>
        <ChromaticAberrationDemo />
      </section>

      {/* Skeleton Shimmer */}
      <section className="mb-16">
        <Heading level={2} className="mb-2">
          Skeleton Shimmer
        </Heading>
        <Text size="sm" muted className="mb-6">
          Loading placeholders with moving gradient shimmer. Respects
          prefers-reduced-motion.
        </Text>
        <SkeletonShimmerDemo />
      </section>
    </>
  );
}
