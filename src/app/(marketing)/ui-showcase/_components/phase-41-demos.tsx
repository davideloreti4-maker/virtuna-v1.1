"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
  Toggle,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Avatar,
  AvatarGroup,
  Divider,
  Select,
  SearchableSelect,
  ToastProvider,
  useToast,
  Kbd,
  ShortcutBadge,
  ExtensionCard,
  TestimonialCard,
  CategoryTabs,
  Heading,
  Text,
  Caption,
} from "@/components/ui";
import {
  Rocket,
  PaintBrush,
  Package,
  Lightning,
  Code,
  Palette,
  Gear,
} from "@phosphor-icons/react";

// ============================================
// Dialog Demo
// ============================================

function DialogDemo(): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="secondary">Open Dialog (md)</Button>
        </DialogTrigger>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Confirm Action</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Are you sure you want to continue?
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 pt-4">
            <Text size="sm" muted>
              Your data will be permanently removed from our servers.
            </Text>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="destructive">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm">
            Small Dialog
          </Button>
        </DialogTrigger>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Small Dialog</DialogTitle>
            <DialogDescription>A compact dialog for simple confirmations.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" size="sm">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm">
            Large Dialog
          </Button>
        </DialogTrigger>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Configure your preferences. Changes are saved automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 pt-4 space-y-4">
            <Toggle label="Enable notifications" defaultChecked />
            <Toggle label="Dark mode" defaultChecked />
            <Toggle label="Auto-save" />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Done</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// Toggle Demo
// ============================================

function ToggleDemo(): React.JSX.Element {
  const [checked, setChecked] = useState(true);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6">
        <Toggle size="sm" aria-label="Small toggle" />
        <Toggle size="md" aria-label="Medium toggle" />
        <Toggle size="lg" aria-label="Large toggle" />
      </div>
      <div className="space-y-3">
        <Toggle label="Enable notifications" />
        <Toggle
          label="Coral accent (checked)"
          checked={checked}
          onCheckedChange={setChecked}
        />
        <Toggle label="Disabled toggle" disabled />
      </div>
    </div>
  );
}

// ============================================
// Tabs Demo
// ============================================

function TabsDemo(): React.JSX.Element {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="features">Features</TabsTrigger>
        <TabsTrigger value="pricing">Pricing</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <div className="rounded-lg border border-border-glass bg-surface p-4">
          <Text size="sm">
            Overview tab content. The active tab shows the Raycast glass pill styling.
          </Text>
        </div>
      </TabsContent>
      <TabsContent value="features">
        <div className="rounded-lg border border-border-glass bg-surface p-4">
          <Text size="sm">Features tab content with glass pill active indicator.</Text>
        </div>
      </TabsContent>
      <TabsContent value="pricing">
        <div className="rounded-lg border border-border-glass bg-surface p-4">
          <Text size="sm">Pricing tab content. Arrow keys navigate between tabs.</Text>
        </div>
      </TabsContent>
    </Tabs>
  );
}

// ============================================
// Avatar Demo
// ============================================

function AvatarDemo(): React.JSX.Element {
  return (
    <div className="space-y-6">
      {/* Sizes */}
      <div className="flex items-end gap-4">
        <div className="flex flex-col items-center gap-2">
          <Avatar fallback="XS" size="xs" />
          <Caption>xs</Caption>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Avatar fallback="SM" size="sm" />
          <Caption>sm</Caption>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Avatar fallback="MD" size="md" />
          <Caption>md</Caption>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Avatar fallback="LG" size="lg" />
          <Caption>lg</Caption>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Avatar fallback="XL" size="xl" />
          <Caption>xl</Caption>
        </div>
      </div>

      {/* Group */}
      <div>
        <Text size="sm" muted className="mb-2">
          AvatarGroup (max 3 of 5):
        </Text>
        <AvatarGroup max={3} size="md">
          <Avatar fallback="AB" />
          <Avatar fallback="CD" />
          <Avatar fallback="EF" />
          <Avatar fallback="GH" />
          <Avatar fallback="IJ" />
        </AvatarGroup>
      </div>
    </div>
  );
}

// ============================================
// Divider Demo
// ============================================

function DividerDemo(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <Text size="sm" muted className="mb-2">
          Horizontal:
        </Text>
        <Divider />
      </div>

      <div>
        <Text size="sm" muted className="mb-2">
          With label:
        </Text>
        <Divider label="OR" />
      </div>

      <div>
        <Text size="sm" muted className="mb-2">
          Vertical (between elements):
        </Text>
        <div className="flex h-8 items-center gap-4">
          <span className="text-sm text-foreground">Left</span>
          <Divider orientation="vertical" />
          <span className="text-sm text-foreground">Right</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Select Demo
// ============================================

const BASIC_OPTIONS = [
  { value: "react", label: "React" },
  { value: "vue", label: "Vue" },
  { value: "svelte", label: "Svelte" },
  { value: "angular", label: "Angular" },
  { value: "solid", label: "SolidJS" },
];

const GROUPED_OPTIONS = [
  {
    label: "Frontend",
    options: [
      { value: "react", label: "React" },
      { value: "vue", label: "Vue" },
      { value: "svelte", label: "Svelte" },
    ],
  },
  {
    label: "Backend",
    options: [
      { value: "node", label: "Node.js" },
      { value: "deno", label: "Deno" },
      { value: "bun", label: "Bun" },
    ],
  },
];

const SEARCHABLE_OPTIONS = [
  { value: "us", label: "United States" },
  { value: "uk", label: "United Kingdom" },
  { value: "de", label: "Germany" },
  { value: "fr", label: "France" },
  { value: "it", label: "Italy" },
  { value: "es", label: "Spain" },
  { value: "pt", label: "Portugal" },
  { value: "jp", label: "Japan" },
  { value: "kr", label: "South Korea" },
  { value: "au", label: "Australia" },
  { value: "ca", label: "Canada" },
  { value: "br", label: "Brazil" },
];

function SelectDemo(): React.JSX.Element {
  return (
    <div className="max-w-sm space-y-6">
      <div>
        <Text size="sm" muted className="mb-2">
          Basic:
        </Text>
        <Select options={BASIC_OPTIONS} placeholder="Choose a framework..." />
      </div>

      <div>
        <Text size="sm" muted className="mb-2">
          With groups:
        </Text>
        <Select options={GROUPED_OPTIONS} placeholder="Choose a runtime..." />
      </div>

      <div>
        <Text size="sm" muted className="mb-2">
          Searchable:
        </Text>
        <SearchableSelect
          options={SEARCHABLE_OPTIONS}
          placeholder="Choose a country..."
          searchPlaceholder="Type to search..."
        />
      </div>
    </div>
  );
}

// ============================================
// Toast Demo (needs inner component for useToast)
// ============================================

function ToastDemoInner(): React.JSX.Element {
  const { toast } = useToast();

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          toast({ variant: "success", title: "Success!", description: "Your changes have been saved." })
        }
      >
        Success Toast
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          toast({ variant: "error", title: "Error", description: "Something went wrong." })
        }
      >
        Error Toast
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          toast({ variant: "warning", title: "Warning", description: "Please check your input." })
        }
      >
        Warning Toast
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          toast({ variant: "info", title: "Info", description: "New version available." })
        }
      >
        Info Toast
      </Button>
    </div>
  );
}

function ToastDemo(): React.JSX.Element {
  return (
    <ToastProvider>
      <ToastDemoInner />
    </ToastProvider>
  );
}

// ============================================
// Kbd Demo
// ============================================

function KbdDemo(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Kbd>Esc</Kbd>
        <Kbd>K</Kbd>
        <Kbd>Enter</Kbd>
        <Kbd>Tab</Kbd>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col items-center gap-2">
          <Kbd size="sm">A</Kbd>
          <Caption>sm</Caption>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Kbd size="md">B</Kbd>
          <Caption>md</Caption>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Kbd size="lg">C</Kbd>
          <Caption>lg</Caption>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Kbd highlighted>K</Kbd>
        <Caption>Highlighted (coral glow)</Caption>
      </div>
    </div>
  );
}

// ============================================
// ShortcutBadge Demo
// ============================================

function ShortcutBadgeDemo(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <ShortcutBadge keys={["cmd", "K"]} />
          <Caption>Cmd+K</Caption>
        </div>
        <div className="flex items-center gap-3">
          <ShortcutBadge keys={["cmd", "shift", "P"]} />
          <Caption>Cmd+Shift+P</Caption>
        </div>
        <div className="flex items-center gap-3">
          <ShortcutBadge keys={["ctrl", "C"]} />
          <Caption>Ctrl+C</Caption>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <ShortcutBadge keys={["cmd", "shift", "P"]} separator="plus" />
        <Caption>With &quot;plus&quot; separator</Caption>
      </div>
    </div>
  );
}

// ============================================
// ExtensionCard Demo
// ============================================

function ExtensionCardDemo(): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <ExtensionCard
        icon={<Rocket size={24} weight="duotone" />}
        title="Quick Launch"
        description="Launch applications instantly with keyboard shortcuts."
        gradient="coral"
        metadata={
          <span className="text-xs text-foreground-muted">v2.1.0</span>
        }
      />
      <ExtensionCard
        icon={<PaintBrush size={24} weight="duotone" />}
        title="Color Picker"
        description="Pick colors from anywhere on your screen and copy to clipboard."
        gradient="purple"
        metadata={
          <span className="text-xs text-foreground-muted">v1.4.2</span>
        }
      />
      <ExtensionCard
        icon={<Package size={24} weight="duotone" />}
        title="Package Manager"
        description="Manage npm, pnpm, and yarn packages with ease."
        gradient="blue"
        metadata={
          <span className="text-xs text-foreground-muted">v3.0.0</span>
        }
      />
    </div>
  );
}

// ============================================
// TestimonialCard Demo
// ============================================

function TestimonialCardDemo(): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <TestimonialCard
        quote="Virtuna transformed our workflow. The design system is incredibly polished and every component feels like it was crafted with care."
        author={{
          name: "Sarah Chen",
          role: "Design Lead",
          company: "Acme Inc",
        }}
      />
      <TestimonialCard
        quote="The best design system I've used. The attention to detail in the glassmorphism and animations is unmatched."
        author={{
          name: "John Doe",
          role: "CTO",
          company: "Startup Co",
        }}
        featured
      />
    </div>
  );
}

// ============================================
// CategoryTabs Demo
// ============================================

function CategoryTabsDemo(): React.JSX.Element {
  const categories = [
    { value: "all", label: "All", count: 42 },
    {
      value: "productivity",
      label: "Productivity",
      icon: <Lightning size={14} weight="fill" />,
      count: 12,
    },
    {
      value: "developer",
      label: "Developer Tools",
      icon: <Code size={14} weight="fill" />,
      count: 18,
    },
    {
      value: "design",
      label: "Design",
      icon: <Palette size={14} weight="fill" />,
      count: 8,
    },
    {
      value: "system",
      label: "System",
      icon: <Gear size={14} weight="fill" />,
      count: 4,
    },
  ];

  return (
    <CategoryTabs categories={categories} defaultValue="all">
      <TabsContent value="all">
        <div className="rounded-lg border border-border-glass bg-surface p-4">
          <Text size="sm">Showing all 42 extensions</Text>
        </div>
      </TabsContent>
      <TabsContent value="productivity">
        <div className="rounded-lg border border-border-glass bg-surface p-4">
          <Text size="sm">12 productivity extensions</Text>
        </div>
      </TabsContent>
      <TabsContent value="developer">
        <div className="rounded-lg border border-border-glass bg-surface p-4">
          <Text size="sm">18 developer tools</Text>
        </div>
      </TabsContent>
      <TabsContent value="design">
        <div className="rounded-lg border border-border-glass bg-surface p-4">
          <Text size="sm">8 design extensions</Text>
        </div>
      </TabsContent>
      <TabsContent value="system">
        <div className="rounded-lg border border-border-glass bg-surface p-4">
          <Text size="sm">4 system extensions</Text>
        </div>
      </TabsContent>
    </CategoryTabs>
  );
}

// ============================================
// Main export — all Phase 41 demos
// ============================================

export function Phase41Demos(): React.JSX.Element {
  return (
    <>
      {/* Dialog */}
      <section className="mb-16">
        <Heading level={2} className="mb-6">
          Dialog
        </Heading>
        <DialogDemo />
      </section>

      {/* Toggle */}
      <section className="mb-16">
        <Heading level={2} className="mb-6">
          Toggle
        </Heading>
        <ToggleDemo />
      </section>

      {/* Tabs */}
      <section className="mb-16">
        <Heading level={2} className="mb-6">
          Tabs
        </Heading>
        <TabsDemo />
      </section>

      {/* Avatar */}
      <section className="mb-16">
        <Heading level={2} className="mb-6">
          Avatar
        </Heading>
        <AvatarDemo />
      </section>

      {/* Divider */}
      <section className="mb-16">
        <Heading level={2} className="mb-6">
          Divider
        </Heading>
        <DividerDemo />
      </section>

      {/* Select */}
      <section className="mb-16">
        <Heading level={2} className="mb-6">
          Select
        </Heading>
        <SelectDemo />
      </section>

      {/* Toast */}
      <section className="mb-16">
        <Heading level={2} className="mb-6">
          Toast
        </Heading>
        <ToastDemo />
      </section>

      {/* Kbd */}
      <section className="mb-16">
        <Heading level={2} className="mb-6">
          Kbd
        </Heading>
        <KbdDemo />
      </section>

      {/* ShortcutBadge */}
      <section className="mb-16">
        <Heading level={2} className="mb-6">
          ShortcutBadge
        </Heading>
        <ShortcutBadgeDemo />
      </section>

      {/* ExtensionCard */}
      <section className="mb-16">
        <Heading level={2} className="mb-6">
          ExtensionCard
        </Heading>
        <ExtensionCardDemo />
      </section>

      {/* TestimonialCard */}
      <section className="mb-16">
        <Heading level={2} className="mb-6">
          TestimonialCard
        </Heading>
        <TestimonialCardDemo />
      </section>

      {/* CategoryTabs */}
      <section className="mb-16">
        <Heading level={2} className="mb-6">
          CategoryTabs
        </Heading>
        <CategoryTabsDemo />
      </section>
    </>
  );
}
