import type { Metadata } from "next";

import { Heading, Text } from "@/components/ui";
import { FadeIn } from "@/components/motion/fade-in";
import { FadeInUp } from "@/components/motion/fade-in-up";
import { SlideUp } from "@/components/motion/slide-up";
import {
  StaggerReveal,
  StaggerRevealItem,
} from "@/components/motion/stagger-reveal";
import { ShowcaseSection } from "../_components/showcase-section";
import { CodeBlock } from "../_components/code-block";
import { HoverScaleDemo } from "../_components/motion-demo";
import { TrafficLightsDemo } from "../_components/traffic-lights-demo";

export const metadata: Metadata = {
  title: "Utilities - Virtuna UI Showcase",
  description:
    "Motion animations and decorative utilities.",
};

export default function UtilitiesShowcasePage() {
  return (
    <>
      <Heading level={1} className="mb-2">
        Utilities
      </Heading>
      <Text size="lg" muted className="mb-12">
        Motion animations and decorative components.
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

      {/* ===== PRIMITIVES SECTION ===== */}

      <div className="mb-20">
        <Heading level={2} className="mb-8 text-accent">
          Primitives
        </Heading>

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
