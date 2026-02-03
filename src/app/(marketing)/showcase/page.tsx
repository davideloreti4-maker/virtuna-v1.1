"use client";

import { Container, Header, Footer } from "@/components/layout";
import { FadeIn, SlideUp } from "@/components/motion";
import {
  GlassPanel,
  GradientGlow,
  GradientMesh,
  GlassCard,
  GlassPill,
  TrafficLights,
  colorMap,
  type GradientColor,
} from "@/components/primitives";
import { Button } from "@/components/ui";
import {
  Lightning,
  Brain,
  ChartLineUp,
  Users,
  Sparkle,
  Fire,
} from "@phosphor-icons/react";

const gradientColors: GradientColor[] = ["purple", "blue", "pink", "cyan", "green", "orange"];

const colorLabels: Record<GradientColor, { label: string; usage: string }> = {
  purple: { label: "Purple", usage: "AI / Intelligence" },
  blue: { label: "Blue", usage: "Analytics / Data" },
  pink: { label: "Pink", usage: "Social / Engagement" },
  cyan: { label: "Cyan", usage: "Speed / Performance" },
  green: { label: "Green", usage: "Growth / Success" },
  orange: { label: "Orange", usage: "Creativity / Content" },
};

export default function ShowcasePage() {
  return (
    <div className="min-h-screen bg-bg-base">
      <Header />

      <main className="py-16">
        <Container>
          {/* Page Title */}
          <FadeIn>
            <div className="mb-16 text-center">
              <h1 className="font-display text-4xl font-bold text-text-primary md:text-5xl lg:text-6xl">
                Design System Showcase
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-text-secondary">
                Comprehensive reference for Virtuna&apos;s iOS 26 / Raycast-inspired design
                system. Use this page as context when generating UI with v0 or Claude.
              </p>
            </div>
          </FadeIn>

          {/* ============================================ */}
          {/* SECTION 1: DESIGN TOKENS */}
          {/* ============================================ */}
          <section className="mb-24">
            <SectionHeader
              title="1. Design Tokens"
              description="Foundation colors, gradients, and shadows"
            />

            {/* Background Hierarchy */}
            <div className="mb-12">
              <h3 className="mb-4 text-lg font-semibold text-text-primary">
                Background Hierarchy
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="overflow-hidden rounded-xl">
                  <div className="h-24 bg-bg-base" />
                  <div className="bg-surface p-3">
                    <p className="text-sm font-medium text-text-primary">bg-base</p>
                    <p className="text-xs text-text-secondary">oklch(0.13 0.02 264)</p>
                    <p className="text-xs text-text-tertiary">Hero backgrounds</p>
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl">
                  <div className="h-24 bg-surface" />
                  <div className="bg-surface-elevated p-3">
                    <p className="text-sm font-medium text-text-primary">surface</p>
                    <p className="text-xs text-text-secondary">oklch(0.18 0.02 264)</p>
                    <p className="text-xs text-text-tertiary">Elevated panels</p>
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl">
                  <div className="h-24 bg-surface-elevated" />
                  <div className="bg-white/5 p-3">
                    <p className="text-sm font-medium text-text-primary">surface-elevated</p>
                    <p className="text-xs text-text-secondary">oklch(0.23 0.02 264)</p>
                    <p className="text-xs text-text-tertiary">Cards, modals</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Text Hierarchy */}
            <div className="mb-12">
              <h3 className="mb-4 text-lg font-semibold text-text-primary">
                Text Hierarchy
              </h3>
              <GlassPanel className="p-6">
                <div className="space-y-3">
                  <p className="text-text-primary">
                    text-primary — Primary text, near white (oklch 0.98)
                  </p>
                  <p className="text-text-secondary">
                    text-secondary — Secondary text, muted (oklch 0.70)
                  </p>
                  <p className="text-text-tertiary">
                    text-tertiary — Disabled/placeholder (oklch 0.50)
                  </p>
                </div>
              </GlassPanel>
            </div>

            {/* Gradient Palette */}
            <div className="mb-12">
              <h3 className="mb-4 text-lg font-semibold text-text-primary">
                Gradient Palette
              </h3>
              <p className="mb-4 text-sm text-text-secondary">
                Each color has a semantic meaning. Use consistently for feature identity.
              </p>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                {gradientColors.map((color) => (
                  <div key={color} className="text-center">
                    <div
                      className="mb-2 h-20 rounded-xl"
                      style={{ background: colorMap[color] }}
                    />
                    <p className="text-sm font-medium text-text-primary">
                      {colorLabels[color].label}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {colorLabels[color].usage}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Shadow Scale */}
            <div>
              <h3 className="mb-4 text-lg font-semibold text-text-primary">
                Shadow Scale
              </h3>
              <div className="grid gap-6 md:grid-cols-5">
                {["sm", "md", "lg", "elevated", "float"].map((shadow) => (
                  <div key={shadow} className="text-center">
                    <div
                      className="mx-auto mb-3 h-16 w-16 rounded-xl bg-surface-elevated"
                      style={{ boxShadow: `var(--shadow-${shadow})` }}
                    />
                    <p className="text-sm font-medium text-text-primary">shadow-{shadow}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ============================================ */}
          {/* SECTION 2: GLASS PRIMITIVES */}
          {/* ============================================ */}
          <section className="mb-24">
            <SectionHeader
              title="2. Glass Primitives"
              description="GlassPanel, GradientGlow, TrafficLights — the building blocks"
            />

            {/* GlassPanel */}
            <div className="mb-12">
              <h3 className="mb-4 text-lg font-semibold text-text-primary">
                GlassPanel
              </h3>
              <p className="mb-4 text-sm text-text-secondary">
                Blur levels: sm (8px), md (12px), lg (20px). Supports color tints and inner glow.
              </p>

              {/* Blur levels */}
              <div className="mb-8 grid gap-4 md:grid-cols-3">
                {(["sm", "md", "lg"] as const).map((blur) => (
                  <div key={blur} className="relative h-32">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/30 to-blue-500/30 rounded-xl" />
                    <GlassPanel blur={blur} className="relative h-full p-4">
                      <p className="text-sm font-medium text-text-primary">blur=&quot;{blur}&quot;</p>
                      <p className="text-xs text-text-secondary">
                        {blur === "sm" ? "8px" : blur === "md" ? "12px" : "20px"} blur
                      </p>
                    </GlassPanel>
                  </div>
                ))}
              </div>

              {/* Tinted glass */}
              <p className="mb-4 text-sm text-text-secondary">
                Tinted glass with inner glow (iOS 26 liquid glass style):
              </p>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                {gradientColors.map((color) => (
                  <GlassPanel
                    key={color}
                    tint={color}
                    innerGlow={0.5}
                    borderGlow
                    className="p-4"
                  >
                    <p className="text-sm font-medium text-text-primary">
                      tint=&quot;{color}&quot;
                    </p>
                    <p className="text-xs text-text-secondary">innerGlow=0.5</p>
                  </GlassPanel>
                ))}
              </div>
            </div>

            {/* GradientGlow */}
            <div className="mb-12">
              <h3 className="mb-4 text-lg font-semibold text-text-primary">
                GradientGlow
              </h3>
              <p className="mb-4 text-sm text-text-secondary">
                Ambient lighting effect. Place behind GlassPanel for depth.
              </p>

              {/* Intensity levels */}
              <div className="mb-8 grid gap-6 md:grid-cols-3">
                {(["subtle", "medium", "strong"] as const).map((intensity) => (
                  <div key={intensity} className="relative h-40 rounded-xl bg-bg-base overflow-hidden">
                    <GradientGlow
                      color="purple"
                      intensity={intensity}
                      size={200}
                      position="center"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-sm font-medium text-text-primary">
                        intensity=&quot;{intensity}&quot;
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* All colors */}
              <p className="mb-4 text-sm text-text-secondary">All gradient colors:</p>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                {gradientColors.map((color) => (
                  <div
                    key={color}
                    className="relative h-28 rounded-xl bg-bg-base overflow-hidden"
                  >
                    <GradientGlow
                      color={color}
                      intensity="medium"
                      size={150}
                      position="center"
                    />
                    <div className="absolute inset-0 flex items-end justify-center pb-2">
                      <p className="text-xs font-medium text-text-primary">{color}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TrafficLights */}
            <div>
              <h3 className="mb-4 text-lg font-semibold text-text-primary">
                TrafficLights
              </h3>
              <p className="mb-4 text-sm text-text-secondary">
                macOS window controls. Use in window mockups.
              </p>
              <GlassPanel className="p-6">
                <div className="flex flex-wrap items-center gap-8">
                  <div className="text-center">
                    <TrafficLights size="sm" className="mb-2" />
                    <p className="text-xs text-text-secondary">size=&quot;sm&quot;</p>
                  </div>
                  <div className="text-center">
                    <TrafficLights size="md" className="mb-2" />
                    <p className="text-xs text-text-secondary">size=&quot;md&quot;</p>
                  </div>
                  <div className="text-center">
                    <TrafficLights size="lg" className="mb-2" />
                    <p className="text-xs text-text-secondary">size=&quot;lg&quot;</p>
                  </div>
                  <div className="text-center">
                    <TrafficLights size="md" disabled className="mb-2" />
                    <p className="text-xs text-text-secondary">disabled</p>
                  </div>
                </div>
              </GlassPanel>
            </div>
          </section>

          {/* ============================================ */}
          {/* SECTION 3: GRADIENT MESH */}
          {/* ============================================ */}
          <section className="mb-24">
            <SectionHeader
              title="3. Gradient Mesh"
              description="Multi-color flowing backgrounds for premium feel"
            />

            <div className="grid gap-6 md:grid-cols-2">
              {/* Static mesh */}
              <div className="relative h-64 overflow-hidden rounded-2xl bg-bg-base">
                <GradientMesh colors={["purple", "blue"]} intensity="medium" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <GlassPanel className="p-4">
                    <p className="text-sm text-text-primary">
                      colors=[&quot;purple&quot;, &quot;blue&quot;]
                    </p>
                  </GlassPanel>
                </div>
              </div>

              {/* Three-color mesh */}
              <div className="relative h-64 overflow-hidden rounded-2xl bg-bg-base">
                <GradientMesh colors={["purple", "pink", "cyan"]} intensity="medium" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <GlassPanel className="p-4">
                    <p className="text-sm text-text-primary">
                      colors=[&quot;purple&quot;, &quot;pink&quot;, &quot;cyan&quot;]
                    </p>
                  </GlassPanel>
                </div>
              </div>

              {/* Animated mesh */}
              <div className="relative h-64 overflow-hidden rounded-2xl bg-bg-base md:col-span-2">
                <GradientMesh
                  colors={["purple", "blue", "pink", "cyan"]}
                  intensity="medium"
                  animate
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <GlassPanel className="p-4">
                    <p className="text-sm text-text-primary">
                      4 colors + animate=true (slow drift)
                    </p>
                  </GlassPanel>
                </div>
              </div>
            </div>
          </section>

          {/* ============================================ */}
          {/* SECTION 4: GLASS CARD */}
          {/* ============================================ */}
          <section className="mb-24">
            <SectionHeader
              title="4. GlassCard"
              description="Ready-to-use card with glow, tint, and hover states"
            />

            {/* Basic cards with colors */}
            <div className="mb-8 grid gap-6 md:grid-cols-3">
              <GlassCard color="purple" glow hover="lift">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-gradient-purple/20 p-2">
                    <Brain className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-text-primary">AI Analysis</h4>
                    <p className="text-sm text-text-secondary">
                      hover=&quot;lift&quot; + glow
                    </p>
                  </div>
                </div>
              </GlassCard>

              <GlassCard color="blue" glow tinted hover="glow-boost">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-gradient-blue/20 p-2">
                    <ChartLineUp className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-text-primary">Analytics</h4>
                    <p className="text-sm text-text-secondary">
                      tinted + glow-boost
                    </p>
                  </div>
                </div>
              </GlassCard>

              <GlassCard color="pink" glow tinted hover="lift">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-gradient-pink/20 p-2">
                    <Users className="h-5 w-5 text-pink-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-text-primary">Social</h4>
                    <p className="text-sm text-text-secondary">
                      tinted + lift
                    </p>
                  </div>
                </div>
              </GlassCard>
            </div>

            {/* Full feature card example */}
            <div className="relative overflow-hidden rounded-2xl bg-bg-base p-8">
              <GradientMesh colors={["purple", "blue"]} intensity="subtle" />
              <div className="relative z-10 grid gap-6 md:grid-cols-3">
                {[
                  { color: "cyan" as const, icon: Lightning, title: "Performance", desc: "60fps animations" },
                  { color: "green" as const, icon: Sparkle, title: "Growth", desc: "Track metrics" },
                  { color: "orange" as const, icon: Fire, title: "Trending", desc: "Viral content" },
                ].map(({ color, icon: Icon, title, desc }) => (
                  <GlassCard key={color} color={color} glow tinted hover="lift">
                    <div className="text-center">
                      <div className="mx-auto mb-3 w-fit rounded-xl bg-white/5 p-3">
                        <Icon className="h-8 w-8" style={{ color: colorMap[color] }} />
                      </div>
                      <h4 className="font-semibold text-text-primary">{title}</h4>
                      <p className="text-sm text-text-secondary">{desc}</p>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          </section>

          {/* ============================================ */}
          {/* SECTION 5: GLASS PILL */}
          {/* ============================================ */}
          <section className="mb-24">
            <SectionHeader
              title="5. GlassPill"
              description="Chips, tags, and small filter buttons"
            />

            <GlassPanel className="p-6">
              {/* Sizes */}
              <div className="mb-6">
                <p className="mb-3 text-sm text-text-secondary">Sizes:</p>
                <div className="flex flex-wrap gap-3">
                  <GlassPill size="sm">size=&quot;sm&quot;</GlassPill>
                  <GlassPill size="md">size=&quot;md&quot;</GlassPill>
                  <GlassPill size="lg">size=&quot;lg&quot;</GlassPill>
                </div>
              </div>

              {/* Colors */}
              <div className="mb-6">
                <p className="mb-3 text-sm text-text-secondary">Colors:</p>
                <div className="flex flex-wrap gap-3">
                  <GlassPill color="neutral">Neutral</GlassPill>
                  {gradientColors.map((color) => (
                    <GlassPill key={color} color={color}>
                      {color}
                    </GlassPill>
                  ))}
                </div>
              </div>

              {/* Interactive */}
              <div className="mb-6">
                <p className="mb-3 text-sm text-text-secondary">Interactive (click me):</p>
                <div className="flex flex-wrap gap-3">
                  <GlassPill color="purple" onClick={() => {}}>
                    Clickable
                  </GlassPill>
                  <GlassPill color="blue" active onClick={() => {}}>
                    Active
                  </GlassPill>
                  <GlassPill color="pink" disabled onClick={() => {}}>
                    Disabled
                  </GlassPill>
                </div>
              </div>

              {/* Filter group example */}
              <div>
                <p className="mb-3 text-sm text-text-secondary">Filter group pattern:</p>
                <div className="flex flex-wrap gap-2">
                  <GlassPill color="purple" active onClick={() => {}}>
                    All
                  </GlassPill>
                  <GlassPill color="neutral" onClick={() => {}}>
                    Challenges
                  </GlassPill>
                  <GlassPill color="neutral" onClick={() => {}}>
                    Sounds
                  </GlassPill>
                  <GlassPill color="neutral" onClick={() => {}}>
                    Formats
                  </GlassPill>
                  <GlassPill color="neutral" onClick={() => {}}>
                    Trends
                  </GlassPill>
                </div>
              </div>
            </GlassPanel>
          </section>

          {/* ============================================ */}
          {/* SECTION 6: COMPOSITION PATTERNS */}
          {/* ============================================ */}
          <section className="mb-24">
            <SectionHeader
              title="6. Composition Patterns"
              description="How to combine primitives for common UI patterns"
            />

            {/* Window Mockup */}
            <div className="mb-12">
              <h3 className="mb-4 text-lg font-semibold text-text-primary">
                Window Mockup
              </h3>
              <p className="mb-4 text-sm text-text-secondary">
                TrafficLights + GlassPanel + content = macOS window style
              </p>

              <div className="relative overflow-hidden rounded-2xl bg-bg-base p-8">
                <GradientMesh colors={["purple", "blue"]} intensity="subtle" />
                <div className="relative z-10 mx-auto max-w-2xl">
                  <GlassPanel blur="lg" borderGlow className="overflow-hidden">
                    {/* Title bar */}
                    <div className="flex items-center gap-4 border-b border-white/5 px-4 py-3">
                      <TrafficLights size="sm" />
                      <span className="text-sm text-text-secondary">Virtuna Dashboard</span>
                    </div>
                    {/* Content */}
                    <div className="p-6">
                      <div className="mb-4 flex gap-2">
                        <GlassPill color="purple" size="sm">AI</GlassPill>
                        <GlassPill color="blue" size="sm">Analytics</GlassPill>
                      </div>
                      <h4 className="mb-2 text-lg font-semibold text-text-primary">
                        Viral Score: 87/100
                      </h4>
                      <p className="text-sm text-text-secondary">
                        Your content has high viral potential based on hook strength
                        and trend alignment.
                      </p>
                    </div>
                  </GlassPanel>
                </div>
              </div>
            </div>

            {/* Stats Dashboard */}
            <div className="mb-12">
              <h3 className="mb-4 text-lg font-semibold text-text-primary">
                Stats Dashboard
              </h3>
              <p className="mb-4 text-sm text-text-secondary">
                GlassCard grid with colored accents for data display
              </p>

              <div className="relative overflow-hidden rounded-2xl bg-bg-base p-6">
                <GradientMesh colors={["cyan", "blue", "purple"]} intensity="subtle" />
                <div className="relative z-10 grid gap-4 md:grid-cols-4">
                  {[
                    { label: "Views", value: "2.4M", change: "+12%", color: "cyan" as const },
                    { label: "Engagement", value: "8.7%", change: "+3.2%", color: "purple" as const },
                    { label: "Followers", value: "142K", change: "+2.1K", color: "pink" as const },
                    { label: "Earnings", value: "$3,240", change: "+$180", color: "green" as const },
                  ].map(({ label, value, change, color }) => (
                    <GlassCard key={label} color={color} tinted padding="sm">
                      <p className="text-xs text-text-secondary">{label}</p>
                      <p className="text-2xl font-bold text-text-primary">{value}</p>
                      <p className="text-xs" style={{ color: colorMap[color] }}>
                        {change}
                      </p>
                    </GlassCard>
                  ))}
                </div>
              </div>
            </div>

            {/* Hero Pattern */}
            <div>
              <h3 className="mb-4 text-lg font-semibold text-text-primary">
                Hero Section Pattern
              </h3>
              <p className="mb-4 text-sm text-text-secondary">
                Gradient mesh + centered content + floating window mockup
              </p>

              <div className="relative overflow-hidden rounded-2xl bg-bg-base">
                <GradientMesh
                  colors={["purple", "pink", "blue"]}
                  intensity="medium"
                  animate
                />
                <div className="relative z-10 px-8 py-16 text-center">
                  <h2 className="font-display text-4xl font-bold text-text-primary md:text-5xl">
                    Create Viral Content
                  </h2>
                  <p className="mx-auto mt-4 max-w-xl text-lg text-text-secondary">
                    AI-powered insights to help your content break through the noise.
                  </p>
                  <div className="mt-8 flex justify-center gap-4">
                    <Button variant="primary" size="lg">
                      Get Started
                    </Button>
                    <Button variant="ghost" size="lg">
                      Learn More
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ============================================ */}
          {/* SECTION 7: USAGE REFERENCE */}
          {/* ============================================ */}
          <section>
            <SectionHeader
              title="7. Quick Reference"
              description="Copy-paste patterns for common use cases"
            />

            <GlassPanel className="p-6">
              <div className="space-y-6 font-mono text-sm">
                <CodeBlock
                  title="Feature Card with Glow"
                  code={`<GlassCard color="purple" glow tinted hover="lift">
  <Icon className="h-6 w-6" />
  <h4>Feature Title</h4>
  <p>Description</p>
</GlassCard>`}
                />

                <CodeBlock
                  title="Window Mockup"
                  code={`<GlassPanel blur="lg" borderGlow>
  <div className="flex items-center gap-4 px-4 py-3 border-b border-white/5">
    <TrafficLights size="sm" />
    <span>Window Title</span>
  </div>
  <div className="p-6">
    {/* Content */}
  </div>
</GlassPanel>`}
                />

                <CodeBlock
                  title="Page with Gradient Background"
                  code={`<div className="relative min-h-screen bg-bg-base">
  <GradientMesh colors={["purple", "blue", "pink"]} intensity="medium" animate />
  <div className="relative z-10">
    {/* Content */}
  </div>
</div>`}
                />

                <CodeBlock
                  title="Filter Pills Group"
                  code={`<div className="flex gap-2">
  <GlassPill color="purple" active onClick={...}>All</GlassPill>
  <GlassPill color="neutral" onClick={...}>Filter 1</GlassPill>
  <GlassPill color="neutral" onClick={...}>Filter 2</GlassPill>
</div>`}
                />
              </div>
            </GlassPanel>
          </section>
        </Container>
      </main>

      <Footer />
    </div>
  );
}

// Helper components
function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <SlideUp>
      <div className="mb-8">
        <h2 className="font-display text-2xl font-bold text-text-primary">{title}</h2>
        <p className="mt-1 text-text-secondary">{description}</p>
      </div>
    </SlideUp>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div>
      <p className="mb-2 text-xs text-text-secondary font-sans">{title}</p>
      <pre className="overflow-x-auto rounded-lg bg-bg-base p-4 text-text-primary">
        <code>{code}</code>
      </pre>
    </div>
  );
}
