import { Heading, Text } from "@/components/ui";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { Divider } from "@/components/ui/divider";

import { ShowcaseSection } from "../_components/showcase-section";
import { CodeBlock } from "../_components/code-block";

export const metadata = {
  title: "Layout Components - Virtuna UI Showcase",
  description:
    "GlassPanel with Raycast-style frosted glass and Divider with horizontal, vertical, and labeled variants.",
};

export default function LayoutComponentsPage() {
  return (
    <>
      {/* Page Header */}
      <div className="mb-16">
        <Heading level={1} className="mb-4">
          Layout Components
        </Heading>
        <Text size="lg" muted>
          Structural and container components for building glass-effect panels,
          content separators, and spatial organization.
        </Text>
      </div>

      {/* ================================================
       * GLASS PANEL -- Zero-config Raycast Glass
       * ================================================ */}
      <ShowcaseSection
        id="glass-panel"
        title="GlassPanel"
        description="Zero-config Raycast-style frosted glass container. Fixed 5px blur, 12px radius, neutral gradient. Safari-compatible via inline backdrop-filter."
      >
        <div className="mb-8">
          <Text size="sm" className="mb-6 font-medium text-foreground">
            Usage Examples
          </Text>
          <div className="space-y-6">
            {/* Default */}
            <div className="relative overflow-hidden rounded-xl">
              <div className="absolute inset-0" aria-hidden="true">
                <div className="absolute -left-6 top-1/4 h-20 w-20 rounded-full bg-accent/50 blur-xl" />
                <div className="absolute left-1/3 -top-4 h-16 w-16 rounded-full bg-purple-500/40 blur-xl" />
                <div className="absolute right-1/4 bottom-0 h-18 w-18 rounded-full bg-cyan-500/35 blur-xl" />
              </div>
              <GlassPanel className="relative px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Text size="sm" className="font-medium text-foreground">
                      Default
                    </Text>
                    <Text size="sm" muted>
                      5px blur, 12px radius, Raycast neutral gradient
                    </Text>
                  </div>
                </div>
              </GlassPanel>
            </div>

            {/* As section */}
            <div className="relative overflow-hidden rounded-xl">
              <div className="absolute inset-0" aria-hidden="true">
                <div className="absolute -right-4 top-1/3 h-14 w-14 rounded-full bg-green-500/30 blur-lg" />
                <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-500/25 blur-lg" />
              </div>
              <GlassPanel as="section" className="relative px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Text size="sm" className="font-medium text-foreground">
                      as=&quot;section&quot;
                    </Text>
                    <Text size="sm" muted>
                      Renders as a semantic &lt;section&gt; element
                    </Text>
                  </div>
                </div>
              </GlassPanel>
            </div>

            {/* With custom className */}
            <div className="relative overflow-hidden rounded-xl">
              <div className="absolute inset-0" aria-hidden="true">
                <div className="absolute left-1/4 top-0 h-16 w-16 rounded-full bg-blue-500/40 blur-xl" />
                <div className="absolute right-1/3 bottom-0 h-20 w-20 rounded-full bg-orange-500/30 blur-xl" />
              </div>
              <GlassPanel className="relative px-8 py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Text size="sm" className="font-medium text-foreground">
                      Custom padding via className
                    </Text>
                    <Text size="sm" muted>
                      Layout overrides via className prop
                    </Text>
                  </div>
                </div>
              </GlassPanel>
            </div>
          </div>
        </div>

        <CodeBlock
          title="GlassPanel -- Zero-config Raycast Glass"
          code={`// Default -- no props needed
<GlassPanel className="p-6">
  <h2>Content</h2>
</GlassPanel>

// Semantic element
<GlassPanel as="aside" className="p-6">
  <nav>Sidebar content</nav>
</GlassPanel>

// With custom style override
<GlassPanel style={{ maxWidth: 600 }}>
  <p>Constrained width panel</p>
</GlassPanel>`}
        />
      </ShowcaseSection>

      {/* ================================================
       * DIVIDER
       * ================================================ */}
      <ShowcaseSection
        id="divider"
        title="Divider"
        description="Layout separator with horizontal, vertical, and labeled variants. Uses semantic border color tokens and includes ARIA separator role."
      >
        <div className="mb-8 space-y-10">
          {/* Horizontal */}
          <div>
            <Text size="sm" className="mb-4 font-medium text-foreground">
              Horizontal (default)
            </Text>
            <div className="rounded-xl border border-border-glass p-6">
              <Text size="sm">Content above the divider</Text>
              <div className="my-4">
                <Divider />
              </div>
              <Text size="sm">Content below the divider</Text>
            </div>
          </div>

          {/* With label */}
          <div>
            <Text size="sm" className="mb-4 font-medium text-foreground">
              With Label
            </Text>
            <div className="space-y-6 rounded-xl border border-border-glass p-6">
              <Divider label="or" />
              <Divider label="Section Break" />
              <Divider label="continue reading" />
            </div>
          </div>

          {/* Vertical */}
          <div>
            <Text size="sm" className="mb-4 font-medium text-foreground">
              Vertical
            </Text>
            <div className="flex h-12 items-center gap-4 rounded-xl border border-border-glass px-6">
              <Text size="sm">Left</Text>
              <Divider orientation="vertical" />
              <Text size="sm">Center</Text>
              <Divider orientation="vertical" />
              <Text size="sm">Right</Text>
            </div>
          </div>
        </div>

        <CodeBlock
          title="Divider"
          code={`// Horizontal (default)
<Divider />

// With label
<Divider label="or" />
<Divider label="Section Break" />

// Vertical -- inside a flex container with height
<div className="flex h-12 items-center gap-4">
  <span>Left</span>
  <Divider orientation="vertical" />
  <span>Center</span>
  <Divider orientation="vertical" />
  <span>Right</span>
</div>`}
        />
      </ShowcaseSection>
    </>
  );
}
