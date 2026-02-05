import { Heading, Text } from "@/components/ui";
import {
  Avatar,
  AvatarGroup,
} from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  GlassCard,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { ExtensionCard } from "@/components/ui/extension-card";
import { TestimonialCard } from "@/components/ui/testimonial-card";
import { Badge } from "@/components/ui/badge";

import { ShowcaseSection } from "../_components/showcase-section";
import { CodeBlock } from "../_components/code-block";
import { ComponentGrid } from "../_components/component-grid";

export const metadata = {
  title: "Data Display - Virtuna UI Showcase",
  description:
    "Avatar, Skeleton, Card, GlassCard, ExtensionCard, and TestimonialCard components.",
};

export default function DataDisplayPage() {
  return (
    <>
      {/* Page Header */}
      <div className="mb-16">
        <Heading level={1} className="mb-4">
          Data Display
        </Heading>
        <Text size="lg" muted>
          Components for presenting content, user identities, loading states,
          and structured information cards.
        </Text>
      </div>

      {/* ================================================
       * AVATAR
       * ================================================ */}
      <ShowcaseSection
        id="avatar"
        title="Avatar"
        description="User identity display with image, initials fallback, and five size variants. Built on Radix UI Avatar primitives."
      >
        {/* All 5 sizes */}
        <div className="mb-8">
          <Text size="sm" className="mb-4 font-medium text-foreground">
            Sizes
          </Text>
          <div className="flex items-end gap-4">
            <div className="flex flex-col items-center gap-2">
              <Avatar fallback="XS" size="xs" />
              <Text size="sm" muted>xs (24px)</Text>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Avatar fallback="SM" size="sm" />
              <Text size="sm" muted>sm (32px)</Text>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Avatar fallback="MD" size="md" />
              <Text size="sm" muted>md (40px)</Text>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Avatar fallback="LG" size="lg" />
              <Text size="sm" muted>lg (48px)</Text>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Avatar fallback="XL" size="xl" />
              <Text size="sm" muted>xl (64px)</Text>
            </div>
          </div>
        </div>

        {/* Fallback text */}
        <div className="mb-8">
          <Text size="sm" className="mb-4 font-medium text-foreground">
            Fallback Initials
          </Text>
          <div className="flex items-center gap-3">
            <Avatar fallback="DL" size="lg" />
            <Avatar fallback="SC" size="lg" />
            <Avatar fallback="JD" size="lg" />
            <Avatar fallback="A" size="lg" />
          </div>
        </div>

        <CodeBlock
          title="Avatar"
          code={`// All 5 sizes with fallback initials
<Avatar fallback="XS" size="xs" />
<Avatar fallback="SM" size="sm" />
<Avatar fallback="MD" size="md" />
<Avatar fallback="LG" size="lg" />
<Avatar fallback="XL" size="xl" />

// With image (auto-fallback on error)
<Avatar
  src="/avatars/user.jpg"
  alt="Davide Loreti"
  fallback="DL"
  size="lg"
/>`}
        />
      </ShowcaseSection>

      {/* ================================================
       * AVATAR GROUP
       * ================================================ */}
      <ShowcaseSection
        id="avatar-group"
        title="Avatar Group"
        description="Overlapping avatar stack with automatic +N truncation when max is exceeded."
      >
        <div className="mb-8 space-y-6">
          {/* No truncation */}
          <div>
            <Text size="sm" className="mb-3 font-medium text-foreground">
              Default (no max)
            </Text>
            <AvatarGroup>
              <Avatar fallback="DL" size="md" />
              <Avatar fallback="SC" size="md" />
              <Avatar fallback="JD" size="md" />
            </AvatarGroup>
          </div>

          {/* With max truncation */}
          <div>
            <Text size="sm" className="mb-3 font-medium text-foreground">
              max=3 with 6 avatars
            </Text>
            <AvatarGroup max={3} size="md">
              <Avatar fallback="DL" size="md" />
              <Avatar fallback="SC" size="md" />
              <Avatar fallback="JD" size="md" />
              <Avatar fallback="AK" size="md" />
              <Avatar fallback="MR" size="md" />
              <Avatar fallback="LT" size="md" />
            </AvatarGroup>
          </div>

          {/* Small group */}
          <div>
            <Text size="sm" className="mb-3 font-medium text-foreground">
              Small (sm) with max=2
            </Text>
            <AvatarGroup max={2} size="sm">
              <Avatar fallback="A" size="sm" />
              <Avatar fallback="B" size="sm" />
              <Avatar fallback="C" size="sm" />
              <Avatar fallback="D" size="sm" />
              <Avatar fallback="E" size="sm" />
            </AvatarGroup>
          </div>
        </div>

        <CodeBlock
          title="AvatarGroup"
          code={`// Overlapping group with +N truncation
<AvatarGroup max={3} size="md">
  <Avatar fallback="DL" size="md" />
  <Avatar fallback="SC" size="md" />
  <Avatar fallback="JD" size="md" />
  <Avatar fallback="AK" size="md" />
  <Avatar fallback="MR" size="md" />
  <Avatar fallback="LT" size="md" />
</AvatarGroup>
// Renders: DL SC JD +3`}
        />
      </ShowcaseSection>

      {/* ================================================
       * SKELETON
       * ================================================ */}
      <ShowcaseSection
        id="skeleton"
        title="Skeleton"
        description="Shimmer-animated loading placeholders that indicate content is being loaded. Use various shapes to match your content layout."
      >
        <div className="mb-8 space-y-8">
          {/* Text lines */}
          <div>
            <Text size="sm" className="mb-4 font-medium text-foreground">
              Text Placeholder
            </Text>
            <div className="max-w-md space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          </div>

          {/* Card skeleton */}
          <div>
            <Text size="sm" className="mb-4 font-medium text-foreground">
              Card Skeleton
            </Text>
            <div className="max-w-sm rounded-xl border border-border-glass p-6">
              <div className="flex items-center gap-4 mb-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          </div>

          {/* Various shapes */}
          <div>
            <Text size="sm" className="mb-4 font-medium text-foreground">
              Various Shapes
            </Text>
            <div className="flex items-center gap-6">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-12 w-12 rounded-lg" />
              <Skeleton className="h-6 w-32 rounded-full" />
              <Skeleton className="h-40 w-40 rounded-xl" />
            </div>
          </div>
        </div>

        <CodeBlock
          title="Skeleton"
          code={`// Text lines
<Skeleton className="h-4 w-full" />
<Skeleton className="h-4 w-4/5" />
<Skeleton className="h-4 w-3/5" />

// Circle (avatar placeholder)
<Skeleton className="h-12 w-12 rounded-full" />

// Rectangle (image placeholder)
<Skeleton className="h-40 w-40 rounded-xl" />

// Badge placeholder
<Skeleton className="h-6 w-32 rounded-full" />`}
        />
      </ShowcaseSection>

      {/* ================================================
       * CARD
       * ================================================ */}
      <ShowcaseSection
        id="card"
        title="Card"
        description="Basic surface card with gradient background, border, and inner glow. Composed with CardHeader, CardContent, and CardFooter sub-components."
      >
        <ComponentGrid columns={2}>
          {/* Full card */}
          <Card>
            <CardHeader>
              <Heading level={3} className="text-lg">
                Card Title
              </Heading>
              <Text size="sm" muted>
                Card description text
              </Text>
            </CardHeader>
            <CardContent>
              <Text size="sm">
                This is the card content area. It uses p-6 padding with no
                top padding to flow smoothly from the header.
              </Text>
            </CardContent>
            <CardFooter>
              <Badge>Action</Badge>
            </CardFooter>
          </Card>

          {/* Minimal card */}
          <Card>
            <CardContent className="p-6">
              <Text size="sm">
                A minimal card with only content — no header or footer. Useful
                for simple information blocks.
              </Text>
            </CardContent>
          </Card>
        </ComponentGrid>

        <div className="mt-8">
          <CodeBlock
            title="Card"
            code={`<Card>
  <CardHeader>
    <Heading level={3}>Card Title</Heading>
    <Text size="sm" muted>Card description</Text>
  </CardHeader>
  <CardContent>
    <Text size="sm">Card content goes here.</Text>
  </CardContent>
  <CardFooter>
    <Badge>Action</Badge>
  </CardFooter>
</Card>`}
          />
        </div>
      </ShowcaseSection>

      {/* ================================================
       * GLASS CARD
       * ================================================ */}
      <ShowcaseSection
        id="glass-card"
        title="GlassCard"
        description="Glassmorphism card with configurable blur intensity and optional inner glow. Place over colorful backgrounds to see the frosted glass effect."
      >
        <div className="mb-8 space-y-8">
          {/* Blur variants with colorful background */}
          <Text size="sm" className="mb-4 font-medium text-foreground">
            Blur Variants
          </Text>
          <ComponentGrid columns={3}>
            {(["sm", "md", "lg"] as const).map((blur) => (
              <div key={blur} className="relative overflow-hidden rounded-xl">
                {/* Colorful background to demonstrate blur */}
                <div className="absolute inset-0" aria-hidden="true">
                  <div className="absolute -left-4 -top-4 h-24 w-24 rounded-full bg-accent/40 blur-xl" />
                  <div className="absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-purple-500/30 blur-xl" />
                  <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/25 blur-lg" />
                </div>
                <GlassCard blur={blur} className="relative">
                  <CardContent className="p-6">
                    <Text size="sm" className="font-medium text-foreground">
                      blur=&quot;{blur}&quot;
                    </Text>
                    <Text size="sm" muted className="mt-1">
                      {blur === "sm" && "8px — subtle"}
                      {blur === "md" && "12px — default"}
                      {blur === "lg" && "20px — heavy"}
                    </Text>
                  </CardContent>
                </GlassCard>
              </div>
            ))}
          </ComponentGrid>

          {/* With glow vs without */}
          <div>
            <Text size="sm" className="mb-4 font-medium text-foreground">
              Inner Glow
            </Text>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="relative overflow-hidden rounded-xl">
                <div className="absolute inset-0" aria-hidden="true">
                  <div className="absolute -left-8 top-0 h-32 w-32 rounded-full bg-green-500/30 blur-2xl" />
                  <div className="absolute -right-8 bottom-0 h-28 w-28 rounded-full bg-blue-500/25 blur-2xl" />
                </div>
                <GlassCard blur="md" glow className="relative">
                  <CardContent className="p-6">
                    <Text size="sm" className="font-medium text-foreground">
                      glow=true
                    </Text>
                    <Text size="sm" muted className="mt-1">
                      Subtle white inner glow on top edge
                    </Text>
                  </CardContent>
                </GlassCard>
              </div>
              <div className="relative overflow-hidden rounded-xl">
                <div className="absolute inset-0" aria-hidden="true">
                  <div className="absolute -left-8 top-0 h-32 w-32 rounded-full bg-rose-500/30 blur-2xl" />
                  <div className="absolute -right-8 bottom-0 h-28 w-28 rounded-full bg-amber-500/25 blur-2xl" />
                </div>
                <GlassCard blur="md" glow={false} className="relative">
                  <CardContent className="p-6">
                    <Text size="sm" className="font-medium text-foreground">
                      glow=false
                    </Text>
                    <Text size="sm" muted className="mt-1">
                      No inner glow — flat glass surface
                    </Text>
                  </CardContent>
                </GlassCard>
              </div>
            </div>
          </div>
        </div>

        <CodeBlock
          title="GlassCard"
          code={`// Over colorful background to see blur effect
<GlassCard blur="lg" glow>
  <CardContent className="p-6">
    <Text>Frosted glass content</Text>
  </CardContent>
</GlassCard>

// Blur variants: "sm" (8px), "md" (12px), "lg" (20px)
// glow: true (default) adds inner glow on top edge`}
        />
      </ShowcaseSection>

      {/* ================================================
       * EXTENSION CARD
       * ================================================ */}
      <ShowcaseSection
        id="extension-card"
        title="ExtensionCard"
        description="Raycast-style feature card with radial gradient glow, icon, title, description, and optional metadata. Supports 5 color themes."
      >
        <ComponentGrid columns={3}>
          <ExtensionCard
            icon={<span>🚀</span>}
            title="Quick Launch"
            description="Launch applications instantly with keyboard shortcuts."
            gradient="coral"
          />
          <ExtensionCard
            icon={<span>🎨</span>}
            title="Color Picker"
            description="Pick colors from anywhere on your screen with precision."
            gradient="purple"
            metadata={
              <span className="text-xs text-foreground-tertiary">v2.1.0</span>
            }
          />
          <ExtensionCard
            icon={<span>📦</span>}
            title="Package Manager"
            description="Manage npm, pnpm, and yarn packages from a single interface."
            gradient="blue"
          />
          <ExtensionCard
            icon={<span>🌿</span>}
            title="Git Branches"
            description="Switch, create, and manage branches without leaving your flow."
            gradient="green"
            metadata={
              <span className="text-xs text-foreground-tertiary">12k installs</span>
            }
          />
          <ExtensionCard
            icon={<span>🔍</span>}
            title="Search Engine"
            description="Search across all your tools, files, and bookmarks instantly."
            gradient="cyan"
          />
        </ComponentGrid>

        <div className="mt-8">
          <CodeBlock
            title="ExtensionCard"
            code={`// 5 gradient themes: coral, purple, blue, green, cyan
<ExtensionCard
  icon={<span>🚀</span>}
  title="Quick Launch"
  description="Launch apps with keyboard shortcuts."
  gradient="coral"
/>

// With metadata
<ExtensionCard
  icon={<span>🎨</span>}
  title="Color Picker"
  description="Pick colors from anywhere."
  gradient="purple"
  metadata={<span className="text-xs">v2.1.0</span>}
/>

// Clickable with link
<ExtensionCard
  icon={<span>📦</span>}
  title="Package Manager"
  description="Manage npm packages."
  gradient="blue"
  href="/extensions/pkg"
/>`}
          />
        </div>
      </ShowcaseSection>

      {/* ================================================
       * TESTIMONIAL CARD
       * ================================================ */}
      <ShowcaseSection
        id="testimonial-card"
        title="TestimonialCard"
        description="Quote card with author attribution including avatar, name, role, and company. Supports a featured variant with accent glow border."
      >
        <ComponentGrid columns={2}>
          <TestimonialCard
            quote="Virtuna transformed our workflow. The design system is incredibly polished and consistent."
            author={{
              name: "Sarah Chen",
              role: "Design Lead",
              company: "Acme Inc",
            }}
          />
          <TestimonialCard
            quote="The best design system I've used. Period. It saved us months of work."
            author={{
              name: "John Doe",
              role: "CTO",
              company: "Startup Co",
            }}
            featured
          />
          <TestimonialCard
            quote="Clean, fast, and beautiful. The dark theme is perfectly calibrated."
            author={{ name: "Alex Rivera" }}
          />
          <TestimonialCard
            quote="Every component just works. Accessibility, animations, theming — it's all there."
            author={{
              name: "Maria Gonzalez",
              role: "Frontend Engineer",
              company: "DevTools Inc",
            }}
            featured
          />
        </ComponentGrid>

        <div className="mt-8">
          <CodeBlock
            title="TestimonialCard"
            code={`// Basic testimonial
<TestimonialCard
  quote="Virtuna transformed our workflow."
  author={{
    name: "Sarah Chen",
    role: "Design Lead",
    company: "Acme Inc",
  }}
/>

// Featured variant with accent glow
<TestimonialCard
  quote="The best design system I've used."
  author={{
    name: "John Doe",
    role: "CTO",
    company: "Startup Co",
  }}
  featured
/>`}
          />
        </div>
      </ShowcaseSection>
    </>
  );
}
