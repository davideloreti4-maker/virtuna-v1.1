import type { Metadata } from "next";

import { Heading, Text } from "@/components/ui";
import { FadeIn } from "@/components/motion/fade-in";
import { FadeInUp } from "@/components/motion/fade-in-up";
import { SlideUp } from "@/components/motion/slide-up";
import {
  StaggerReveal,
  StaggerRevealItem,
} from "@/components/motion/stagger-reveal";
import { NoiseTexture } from "@/components/effects/noise-texture";
import { ChromaticAberration } from "@/components/effects/chromatic-aberration";
import { GradientGlow } from "@/components/primitives/GradientGlow";
import { GradientMesh } from "@/components/primitives/GradientMesh";

import { ShowcaseSection } from "../_components/showcase-section";
import { CodeBlock } from "../_components/code-block";
import { ComponentGrid } from "../_components/component-grid";
import { HoverScaleDemo } from "../_components/motion-demo";
import { TrafficLightsDemo } from "../_components/traffic-lights-demo";

export const metadata: Metadata = {
  title: "Utilities - Virtuna UI Showcase",
  description:
    "Motion animations, visual effects, gradient primitives, and decorative utilities.",
};

export default function UtilitiesShowcasePage() {
  return (
    <>
      <Heading level={1} className="mb-2">
        Utilities
      </Heading>
      <Text size="lg" muted className="mb-12">
        Motion animations, visual effects, gradient primitives, and decorative
        components.
      </Text>

      {/* ===== MOTION SECTION ===== */}

      <div className="mb-20">
        <Heading level={2} className="mb-8 text-accent">
          Motion
        </Heading>

        {/* FadeIn */}
        <ShowcaseSection
          id="fade-in"
          title="FadeIn"
          description="Fade + vertical translate on viewport entry. Configurable delay, duration, and distance."
        >
          <div className="mb-6 space-y-4">
            <FadeIn>
              <div className="rounded-lg border border-border-glass bg-surface/60 p-6">
                <Text size="sm" muted>
                  Default FadeIn — delay: 0, duration: 0.5s, distance: 20px
                </Text>
              </div>
            </FadeIn>
            <FadeIn delay={0.2} duration={0.8} distance={40}>
              <div className="rounded-lg border border-border-glass bg-surface/60 p-6">
                <Text size="sm" muted>
                  Custom FadeIn — delay: 0.2s, duration: 0.8s, distance: 40px
                </Text>
              </div>
            </FadeIn>
          </div>
          <CodeBlock
            title="FadeIn"
            code={`<FadeIn>
  <Card>Default fade-in</Card>
</FadeIn>

<FadeIn delay={0.2} duration={0.8} distance={40}>
  <Card>Custom timing</Card>
</FadeIn>`}
          />
        </ShowcaseSection>

        {/* FadeInUp */}
        <ShowcaseSection
          id="fade-in-up"
          title="FadeInUp"
          description="Raycast's signature scroll-reveal. Combines opacity fade with vertical translate and custom easing."
        >
          <div className="mb-6 space-y-4">
            <FadeInUp>
              <div className="rounded-lg border border-border-glass bg-surface/60 p-6">
                <Text size="sm" muted>
                  Default FadeInUp — delay: 0, duration: 0.6s, distance: 24px
                </Text>
              </div>
            </FadeInUp>
            <FadeInUp delay={0.15} distance={32} as="section">
              <div className="rounded-lg border border-accent/20 bg-accent/5 p-6">
                <Text size="sm" muted>
                  Custom FadeInUp — delay: 0.15s, distance: 32px, as:
                  &quot;section&quot;
                </Text>
              </div>
            </FadeInUp>
          </div>
          <CodeBlock
            title="FadeInUp"
            code={`<FadeInUp>
  <h2>Section Title</h2>
</FadeInUp>

<FadeInUp delay={0.15} distance={32} as="section">
  <SectionContent />
</FadeInUp>`}
          />
        </ShowcaseSection>

        {/* SlideUp */}
        <ShowcaseSection
          id="slide-up"
          title="SlideUp"
          description="Dramatic vertical slide with higher default distance (60px). Great for hero sections."
        >
          <div className="mb-6 space-y-4">
            <SlideUp>
              <div className="rounded-lg border border-border-glass bg-surface/60 p-6">
                <Text size="sm" muted>
                  Default SlideUp — delay: 0, duration: 0.6s, distance: 60px
                </Text>
              </div>
            </SlideUp>
            <SlideUp delay={0.3} distance={80}>
              <div className="rounded-lg border border-border-glass bg-surface/60 p-6">
                <Text size="sm" muted>
                  Custom SlideUp — delay: 0.3s, distance: 80px
                </Text>
              </div>
            </SlideUp>
          </div>
          <CodeBlock
            title="SlideUp"
            code={`<SlideUp>
  <HeroContent />
</SlideUp>

<SlideUp delay={0.3} distance={80}>
  <Card>Dramatic entrance</Card>
</SlideUp>`}
          />
        </ShowcaseSection>

        {/* StaggerReveal */}
        <ShowcaseSection
          id="stagger-reveal"
          title="StaggerReveal"
          description="Orchestrated stagger animation for grids and lists. Children animate sequentially with configurable delay."
        >
          <div className="mb-6">
            <StaggerReveal className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <StaggerRevealItem key={i}>
                  <div className="flex h-24 items-center justify-center rounded-lg border border-border-glass bg-surface/60 text-sm font-medium text-foreground-muted">
                    Item {i + 1}
                  </div>
                </StaggerRevealItem>
              ))}
            </StaggerReveal>
          </div>
          <CodeBlock
            title="StaggerReveal"
            code={`<StaggerReveal className="grid grid-cols-3 gap-4">
  <StaggerReveal.Item>Card 1</StaggerRevealItem>
  <StaggerReveal.Item>Card 2</StaggerRevealItem>
  <StaggerReveal.Item>Card 3</StaggerRevealItem>
</StaggerReveal>

{/* Custom stagger timing */}
<StaggerReveal staggerDelay={0.12} initialDelay={0.2}>
  ...
</StaggerReveal>`}
          />
        </ShowcaseSection>

        {/* HoverScale */}
        <ShowcaseSection
          id="hover-scale"
          title="HoverScale"
          description="Spring-based hover micro-interaction. Scales up on hover, down on tap. Configurable scale values."
        >
          <div className="mb-6">
            <HoverScaleDemo />
          </div>
          <CodeBlock
            title="HoverScale"
            code={`<HoverScale>
  <Card>Subtle hover (1.02)</Card>
</HoverScale>

<HoverScale scale={1.05} tapScale={0.95}>
  <Card>Dramatic hover</Card>
</HoverScale>`}
          />
        </ShowcaseSection>
      </div>

      {/* ===== EFFECTS SECTION ===== */}

      <div className="mb-20">
        <Heading level={2} className="mb-8 text-accent">
          Effects
        </Heading>

        {/* NoiseTexture */}
        <ShowcaseSection
          id="noise-texture"
          title="NoiseTexture"
          description="SVG feTurbulence grain overlay. Adds premium glass texture to any container. Parent needs position: relative."
        >
          <ComponentGrid columns={3}>
            {/* Default */}
            <div className="relative h-40 overflow-hidden rounded-lg border border-border-glass bg-gradient-to-br from-accent/20 to-accent/5">
              <NoiseTexture />
              <div className="relative z-10 flex h-full items-center justify-center">
                <div className="text-center">
                  <Text size="sm" className="font-medium">
                    Default
                  </Text>
                  <Text size="sm" muted>
                    opacity: 0.03
                  </Text>
                </div>
              </div>
            </div>

            {/* Higher opacity */}
            <div className="relative h-40 overflow-hidden rounded-lg border border-border-glass bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <NoiseTexture opacity={0.06} />
              <div className="relative z-10 flex h-full items-center justify-center">
                <div className="text-center">
                  <Text size="sm" className="font-medium">
                    Visible
                  </Text>
                  <Text size="sm" muted>
                    opacity: 0.06
                  </Text>
                </div>
              </div>
            </div>

            {/* Fine grain */}
            <div className="relative h-40 overflow-hidden rounded-lg border border-border-glass bg-gradient-to-br from-cyan-500/20 to-cyan-500/5">
              <NoiseTexture opacity={0.05} baseFrequency={0.9} numOctaves={4} />
              <div className="relative z-10 flex h-full items-center justify-center">
                <div className="text-center">
                  <Text size="sm" className="font-medium">
                    Fine grain
                  </Text>
                  <Text size="sm" muted>
                    freq: 0.9, octaves: 4
                  </Text>
                </div>
              </div>
            </div>
          </ComponentGrid>
          <div className="mt-6">
            <CodeBlock
              title="NoiseTexture"
              code={`<div className="relative">
  <NoiseTexture />
  <p>Content with subtle grain</p>
</div>

<NoiseTexture opacity={0.05} baseFrequency={0.9} numOctaves={4} />`}
            />
          </div>
        </ShowcaseSection>

        {/* ChromaticAberration */}
        <ShowcaseSection
          id="chromatic-aberration"
          title="ChromaticAberration"
          description="CSS text-shadow RGB split effect. Mimics camera lens chromatic aberration for decorative headings."
        >
          <div className="mb-6 space-y-6">
            <div className="rounded-lg border border-border-glass bg-surface/60 p-8">
              <ChromaticAberration>
                <p className="text-3xl font-bold text-foreground">
                  Default Effect
                </p>
              </ChromaticAberration>
              <Text size="sm" muted className="mt-2">
                offset: 1px, intensity: 0.15
              </Text>
            </div>

            <div className="rounded-lg border border-border-glass bg-surface/60 p-8">
              <ChromaticAberration offset={2} intensity={0.25}>
                <p className="text-3xl font-bold text-foreground">
                  Stronger Effect
                </p>
              </ChromaticAberration>
              <Text size="sm" muted className="mt-2">
                offset: 2px, intensity: 0.25
              </Text>
            </div>

            <div className="rounded-lg border border-border-glass bg-surface/60 p-8">
              <ChromaticAberration offset={3} intensity={0.35}>
                <p className="text-4xl font-bold text-foreground">
                  Dramatic
                </p>
              </ChromaticAberration>
              <Text size="sm" muted className="mt-2">
                offset: 3px, intensity: 0.35
              </Text>
            </div>
          </div>
          <CodeBlock
            title="ChromaticAberration"
            code={`<ChromaticAberration>
  <h2 className="text-2xl font-bold">Premium Feature</h2>
</ChromaticAberration>

<ChromaticAberration offset={2} intensity={0.25}>
  <h2>Stronger effect</h2>
</ChromaticAberration>

{/* Inline usage */}
<ChromaticAberration as="span" offset={2}>
  Glitch Text
</ChromaticAberration>`}
          />
        </ShowcaseSection>
      </div>

      {/* ===== PRIMITIVES SECTION ===== */}

      <div className="mb-20">
        <Heading level={2} className="mb-8 text-accent">
          Primitives
        </Heading>

        {/* GradientGlow */}
        <ShowcaseSection
          id="gradient-glow"
          title="GradientGlow"
          description="Ambient lighting effect. Blurred radial gradient for adding color identity and depth behind glass surfaces."
        >
          {/* All 6 colors */}
          <div className="mb-6">
            <Text size="sm" className="mb-4 font-medium text-foreground-secondary">
              All colors (medium intensity)
            </Text>
            <ComponentGrid columns={3}>
              {(
                ["purple", "blue", "pink", "cyan", "green", "orange"] as const
              ).map((color) => (
                <div
                  key={color}
                  className="relative flex h-32 items-center justify-center overflow-hidden rounded-lg border border-border-glass bg-background"
                >
                  <GradientGlow
                    color={color}
                    intensity="medium"
                    size={200}
                    blur={60}
                  />
                  <Text
                    size="sm"
                    className="relative z-10 font-medium capitalize"
                  >
                    {color}
                  </Text>
                </div>
              ))}
            </ComponentGrid>
          </div>

          {/* Intensity comparison */}
          <div className="mb-6">
            <Text size="sm" className="mb-4 font-medium text-foreground-secondary">
              Intensity levels (purple)
            </Text>
            <ComponentGrid columns={3}>
              {(["subtle", "medium", "strong"] as const).map((intensity) => (
                <div
                  key={intensity}
                  className="relative flex h-32 items-center justify-center overflow-hidden rounded-lg border border-border-glass bg-background"
                >
                  <GradientGlow
                    color="purple"
                    intensity={intensity}
                    size={200}
                    blur={60}
                  />
                  <Text
                    size="sm"
                    className="relative z-10 font-medium capitalize"
                  >
                    {intensity}
                  </Text>
                </div>
              ))}
            </ComponentGrid>
          </div>

          <CodeBlock
            title="GradientGlow"
            code={`<div className="relative">
  <GradientGlow color="purple" intensity="medium" position="top-right" />
  <GlassPanel>Content here</GlassPanel>
</div>

{/* With animation */}
<GradientGlow color="blue" animate animationType="float" />

{/* All colors: purple | blue | pink | cyan | green | orange */}
{/* Intensities: subtle (15%) | medium (30%) | strong (50%) */}`}
          />
        </ShowcaseSection>

        {/* GradientMesh */}
        <ShowcaseSection
          id="gradient-mesh"
          title="GradientMesh"
          description="Multi-color flowing gradient background. Ambient mesh of blended gradient glows for premium backgrounds."
        >
          <ComponentGrid columns={2}>
            {/* Two-color mesh */}
            <div className="relative h-48 overflow-hidden rounded-lg border border-border-glass bg-background">
              <GradientMesh colors={["purple", "blue"]} intensity="medium" />
              <div className="relative z-10 flex h-full items-center justify-center">
                <Text size="sm" className="font-medium">
                  Purple + Blue
                </Text>
              </div>
            </div>

            {/* Three-color mesh */}
            <div className="relative h-48 overflow-hidden rounded-lg border border-border-glass bg-background">
              <GradientMesh
                colors={["purple", "pink", "cyan"]}
                intensity="medium"
              />
              <div className="relative z-10 flex h-full items-center justify-center">
                <Text size="sm" className="font-medium">
                  Purple + Pink + Cyan
                </Text>
              </div>
            </div>

            {/* Four-color mesh */}
            <div className="relative h-48 overflow-hidden rounded-lg border border-border-glass bg-background">
              <GradientMesh
                colors={["purple", "blue", "pink", "cyan"]}
                intensity="strong"
              />
              <div className="relative z-10 flex h-full items-center justify-center">
                <Text size="sm" className="font-medium">
                  Four-color (strong)
                </Text>
              </div>
            </div>

            {/* Warm mesh */}
            <div className="relative h-48 overflow-hidden rounded-lg border border-border-glass bg-background">
              <GradientMesh
                colors={["orange", "pink"]}
                intensity="medium"
              />
              <div className="relative z-10 flex h-full items-center justify-center">
                <Text size="sm" className="font-medium">
                  Orange + Pink
                </Text>
              </div>
            </div>
          </ComponentGrid>
          <div className="mt-6">
            <CodeBlock
              title="GradientMesh"
              code={`<div className="relative min-h-screen">
  <GradientMesh colors={["purple", "blue"]} intensity="medium" />
  <div className="relative z-10">Content here</div>
</div>

{/* Animated three-color mesh */}
<GradientMesh colors={["purple", "pink", "cyan"]} animate />`}
            />
          </div>
        </ShowcaseSection>

        {/* TrafficLights */}
        <ShowcaseSection
          id="traffic-lights"
          title="TrafficLights"
          description="macOS window control buttons. Decorative or interactive red/yellow/green circles."
        >
          <div className="mb-6">
            <TrafficLightsDemo />
          </div>
          <CodeBlock
            title="TrafficLights"
            code={`{/* Static (decorative) */}
<TrafficLights size="md" />

{/* Interactive with callbacks */}
<TrafficLights
  interactive
  onClose={() => closeWindow()}
  onMinimize={() => minimizeWindow()}
  onMaximize={() => maximizeWindow()}
/>

{/* Disabled */}
<TrafficLights disabled />

{/* Sizes: sm (10px) | md (12px) | lg (14px) */}`}
          />
        </ShowcaseSection>
      </div>
    </>
  );
}
