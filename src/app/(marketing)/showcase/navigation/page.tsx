import type { Metadata } from "next";

import {
  Heading,
  Text,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  CategoryTabs,
  Kbd,
  ShortcutBadge,
} from "@/components/ui";
import { ShowcaseSection } from "../_components/showcase-section";
import { CodeBlock } from "../_components/code-block";
import { ComponentGrid } from "../_components/component-grid";

export const metadata: Metadata = {
  title: "Navigation | Virtuna UI Showcase",
  description: "Tabs, CategoryTabs, Kbd, and ShortcutBadge components.",
};

// ============================================
// Category data for CategoryTabs demo
// ============================================

const CATEGORIES = [
  { value: "all", label: "All", count: 42 },
  { value: "productivity", label: "Productivity", count: 12 },
  { value: "developer", label: "Developer Tools", count: 18 },
  { value: "design", label: "Design", count: 8 },
  { value: "system", label: "System", count: 4 },
];

// ============================================
// Page component
// ============================================

export default function NavigationShowcasePage() {
  return (
    <>
      {/* Page header */}
      <div className="mb-12">
        <Heading level={1} className="mb-3">
          Navigation
        </Heading>
        <Text size="lg" muted>
          Tab navigation, keyboard keycaps, and shortcut badge components for
          navigational UI patterns.
        </Text>
      </div>

      {/* Tabs */}
      <ShowcaseSection
        id="tabs"
        title="Tabs"
        description="Radix-based tab system with glass pill styling. Supports sm, md, and lg sizes with arrow key navigation."
      >
        <div className="space-y-8">
          {/* Size variants */}
          <div className="space-y-6">
            <Text size="sm" className="font-medium">
              Sizes
            </Text>
            {(["sm", "md", "lg"] as const).map((size) => (
              <div key={size}>
                <Text size="sm" muted className="mb-2">
                  {size}
                </Text>
                <Tabs defaultValue="overview">
                  <TabsList>
                    <TabsTrigger value="overview" size={size}>
                      Overview
                    </TabsTrigger>
                    <TabsTrigger value="features" size={size}>
                      Features
                    </TabsTrigger>
                    <TabsTrigger value="changelog" size={size}>
                      Changelog
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="overview">
                    <div className="rounded-lg border border-border-glass bg-surface/30 p-4">
                      <Text size="sm" muted>
                        Overview tab content ({size} size trigger)
                      </Text>
                    </div>
                  </TabsContent>
                  <TabsContent value="features">
                    <div className="rounded-lg border border-border-glass bg-surface/30 p-4">
                      <Text size="sm" muted>
                        Features tab content ({size} size trigger)
                      </Text>
                    </div>
                  </TabsContent>
                  <TabsContent value="changelog">
                    <div className="rounded-lg border border-border-glass bg-surface/30 p-4">
                      <Text size="sm" muted>
                        Changelog tab content ({size} size trigger)
                      </Text>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            ))}
          </div>

          <CodeBlock
            title="Tabs usage"
            code={`import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui";

<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="features">Features</TabsTrigger>
    <TabsTrigger value="changelog">Changelog</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">Overview content</TabsContent>
  <TabsContent value="features">Features content</TabsContent>
  <TabsContent value="changelog">Changelog content</TabsContent>
</Tabs>

{/* Size variants: sm, md (default), lg */}
<TabsTrigger value="tab" size="lg">Large Tab</TabsTrigger>`}
          />
        </div>
      </ShowcaseSection>

      {/* CategoryTabs */}
      <ShowcaseSection
        id="category-tabs"
        title="CategoryTabs"
        description="Raycast-style horizontal scrollable category navigation with optional icons and count badges."
      >
        <div className="space-y-8">
          <CategoryTabs categories={CATEGORIES} defaultValue="all">
            <TabsContent value="all">
              <div className="rounded-lg border border-border-glass bg-surface/30 p-4">
                <Text size="sm" muted>
                  Showing all 42 extensions
                </Text>
              </div>
            </TabsContent>
            <TabsContent value="productivity">
              <div className="rounded-lg border border-border-glass bg-surface/30 p-4">
                <Text size="sm" muted>
                  12 productivity extensions
                </Text>
              </div>
            </TabsContent>
            <TabsContent value="developer">
              <div className="rounded-lg border border-border-glass bg-surface/30 p-4">
                <Text size="sm" muted>
                  18 developer tools
                </Text>
              </div>
            </TabsContent>
            <TabsContent value="design">
              <div className="rounded-lg border border-border-glass bg-surface/30 p-4">
                <Text size="sm" muted>
                  8 design extensions
                </Text>
              </div>
            </TabsContent>
            <TabsContent value="system">
              <div className="rounded-lg border border-border-glass bg-surface/30 p-4">
                <Text size="sm" muted>
                  4 system extensions
                </Text>
              </div>
            </TabsContent>
          </CategoryTabs>

          <CodeBlock
            title="CategoryTabs usage"
            code={`import { CategoryTabs } from "@/components/ui";
import { TabsContent } from "@/components/ui";

const categories = [
  { value: "all", label: "All", count: 42 },
  { value: "productivity", label: "Productivity", count: 12 },
  { value: "developer", label: "Developer Tools", count: 18 },
];

<CategoryTabs categories={categories} defaultValue="all">
  <TabsContent value="all">All extensions...</TabsContent>
  <TabsContent value="productivity">Productivity...</TabsContent>
  <TabsContent value="developer">Developer Tools...</TabsContent>
</CategoryTabs>`}
          />
        </div>
      </ShowcaseSection>

      {/* Kbd */}
      <ShowcaseSection
        id="kbd"
        title="Kbd"
        description="3D keyboard keycap visualization with Raycast's exact 4-layer box shadow. Supports sm, md, lg sizes and coral glow highlight."
      >
        <div className="space-y-8">
          {/* Size variants */}
          <div className="space-y-4">
            <Text size="sm" className="font-medium">
              Sizes
            </Text>
            <ComponentGrid columns={3}>
              {(["sm", "md", "lg"] as const).map((size) => (
                <div
                  key={size}
                  className="flex flex-col items-center gap-3 rounded-lg border border-border-glass bg-surface/30 p-6"
                >
                  <Kbd size={size}>K</Kbd>
                  <Text size="sm" muted>
                    {size}
                  </Text>
                </div>
              ))}
            </ComponentGrid>
          </div>

          {/* Highlighted variant */}
          <div className="space-y-4">
            <Text size="sm" className="font-medium">
              Highlighted (coral glow)
            </Text>
            <div className="flex items-center gap-4 rounded-lg border border-border-glass bg-surface/30 p-6">
              <Kbd highlighted>Enter</Kbd>
              <Kbd size="lg" highlighted>
                Space
              </Kbd>
              <Kbd size="sm" highlighted>
                Esc
              </Kbd>
            </div>
          </div>

          {/* Inline usage */}
          <div className="space-y-4">
            <Text size="sm" className="font-medium">
              Inline usage
            </Text>
            <div className="rounded-lg border border-border-glass bg-surface/30 p-6">
              <Text size="sm">
                Press <Kbd size="sm">K</Kbd> to open search, or{" "}
                <Kbd size="sm">Esc</Kbd> to close
              </Text>
            </div>
          </div>

          <CodeBlock
            title="Kbd usage"
            code={`import { Kbd } from "@/components/ui";

{/* Sizes: sm, md (default), lg */}
<Kbd size="sm">K</Kbd>
<Kbd>Enter</Kbd>
<Kbd size="lg">Space</Kbd>

{/* Highlighted with coral glow */}
<Kbd highlighted>Enter</Kbd>

{/* Inline in text */}
<p>Press <Kbd size="sm">K</Kbd> to search</p>`}
          />
        </div>
      </ShowcaseSection>

      {/* ShortcutBadge */}
      <ShowcaseSection
        id="shortcut-badge"
        title="ShortcutBadge"
        description="Displays modifier+key combinations using Kbd components with Unicode symbol mapping for modifier keys."
      >
        <div className="space-y-8">
          {/* Various combos */}
          <div className="space-y-4">
            <Text size="sm" className="font-medium">
              Key combinations
            </Text>
            <div className="flex flex-col gap-4 rounded-lg border border-border-glass bg-surface/30 p-6">
              <div className="flex items-center justify-between">
                <Text size="sm" muted>
                  Search
                </Text>
                <ShortcutBadge keys={["cmd", "K"]} />
              </div>
              <div className="flex items-center justify-between">
                <Text size="sm" muted>
                  Save
                </Text>
                <ShortcutBadge keys={["cmd", "S"]} />
              </div>
              <div className="flex items-center justify-between">
                <Text size="sm" muted>
                  Undo
                </Text>
                <ShortcutBadge keys={["cmd", "Z"]} />
              </div>
              <div className="flex items-center justify-between">
                <Text size="sm" muted>
                  Developer tools
                </Text>
                <ShortcutBadge keys={["cmd", "shift", "I"]} />
              </div>
              <div className="flex items-center justify-between">
                <Text size="sm" muted>
                  Force quit
                </Text>
                <ShortcutBadge keys={["cmd", "alt", "escape"]} />
              </div>
            </div>
          </div>

          {/* With separator */}
          <div className="space-y-4">
            <Text size="sm" className="font-medium">
              With plus separator
            </Text>
            <div className="flex items-center gap-6 rounded-lg border border-border-glass bg-surface/30 p-6">
              <ShortcutBadge keys={["shift", "alt", "P"]} separator="plus" />
              <ShortcutBadge keys={["ctrl", "C"]} separator="plus" />
            </div>
          </div>

          {/* Sizes and highlighted */}
          <div className="space-y-4">
            <Text size="sm" className="font-medium">
              Sizes and highlighted
            </Text>
            <div className="flex flex-col gap-4 rounded-lg border border-border-glass bg-surface/30 p-6">
              <div className="flex items-center gap-4">
                <Text size="sm" muted className="w-12">
                  sm
                </Text>
                <ShortcutBadge keys={["cmd", "enter"]} size="sm" />
              </div>
              <div className="flex items-center gap-4">
                <Text size="sm" muted className="w-12">
                  md
                </Text>
                <ShortcutBadge keys={["cmd", "enter"]} size="md" />
              </div>
              <div className="flex items-center gap-4">
                <Text size="sm" muted className="w-12">
                  lg
                </Text>
                <ShortcutBadge keys={["cmd", "enter"]} size="lg" />
              </div>
              <div className="flex items-center gap-4">
                <Text size="sm" muted className="w-12">
                  glow
                </Text>
                <ShortcutBadge keys={["cmd", "enter"]} highlighted />
              </div>
            </div>
          </div>

          <CodeBlock
            title="ShortcutBadge usage"
            code={`import { ShortcutBadge } from "@/components/ui";

{/* Basic combos — modifier keys auto-map to Unicode symbols */}
<ShortcutBadge keys={["cmd", "K"]} />        {/* ⌘ K */}
<ShortcutBadge keys={["cmd", "shift", "I"]} />  {/* ⌘ ⇧ I */}

{/* With plus separator */}
<ShortcutBadge keys={["shift", "alt", "P"]} separator="plus" />

{/* Sizes and highlighted */}
<ShortcutBadge keys={["cmd", "enter"]} size="lg" highlighted />`}
          />
        </div>
      </ShowcaseSection>
    </>
  );
}
