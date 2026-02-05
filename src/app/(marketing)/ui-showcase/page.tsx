"use client";

import { useState } from "react";
import {
  Button,
  Card,
  GlassCard,
  CardHeader,
  CardContent,
  CardFooter,
  Input,
  InputField,
  Badge,
  Heading,
  Text,
  Caption,
  Code,
  Spinner,
  Icon,
} from "@/components/ui";
import { MagnifyingGlass, Warning, Check, Heart, Star } from "@phosphor-icons/react";
import { Phase41Demos } from "./_components/phase-41-demos";
import { Phase42Demos } from "./_components/phase-42-demos";

export default function UIShowcasePage() {
  const [inputValue, setInputValue] = useState("");
  const [progress, setProgress] = useState(65);

  return (
    <div className="min-h-screen bg-background p-8 md:p-16">
      <Heading level={1} className="mb-4">
        UI Components Showcase
      </Heading>
      <Text muted className="mb-12">
        Phase 40, 41, & 42 Components — Visual verification page
      </Text>

      {/* Section 1: Buttons */}
      <section className="mb-16">
        <Heading level={2} className="mb-6">
          Button
        </Heading>

        <div className="space-y-6">
          {/* Variants */}
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary (Default)</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
          </div>

          {/* Sizes */}
          <div className="flex flex-wrap items-center gap-4">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="sm" aria-label="Search" className="p-0 w-9 h-9">
              <Icon icon={MagnifyingGlass} size={20} />
            </Button>
          </div>

          {/* States */}
          <div className="flex flex-wrap items-center gap-4">
            <Button disabled>Disabled</Button>
            <Button loading>Loading</Button>
            <Button variant="primary" loading>
              Primary Loading
            </Button>
          </div>
        </div>
      </section>

      {/* Section 2: Cards */}
      <section className="mb-16">
        <Heading level={2} className="mb-6">
          Card & GlassCard
        </Heading>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <Heading level={3}>Standard Card</Heading>
            </CardHeader>
            <CardContent>
              <Text>This is a standard card with dark surface background.</Text>
            </CardContent>
            <CardFooter>
              <Button variant="secondary" size="sm">Action</Button>
            </CardFooter>
          </Card>

          {/* GlassCard with gradient background to show blur */}
          <div className="relative overflow-hidden rounded-xl">
            {/* Background elements that GlassCard will blur */}
            <div className="absolute inset-0 bg-gradient-to-br from-coral-500/40 via-purple-500/30 to-cyan-500/40" aria-hidden="true" />
            <div className="absolute top-4 left-4 w-20 h-20 rounded-full bg-coral-500/60" aria-hidden="true" />
            <div className="absolute bottom-4 right-4 w-16 h-16 rounded-full bg-cyan-500/60" aria-hidden="true" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-purple-500/50" aria-hidden="true" />

            <GlassCard blur="md" glow className="relative">
              <CardHeader>
                <Heading level={3}>Glass Card</Heading>
              </CardHeader>
              <CardContent>
                <Text>This card has a frosted glass blur effect. The colorful shapes behind are blurred through the glass.</Text>
              </CardContent>
              <CardFooter>
                <Button variant="secondary" size="sm">Action</Button>
              </CardFooter>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Section 3: Input */}
      <section className="mb-16">
        <Heading level={2} className="mb-6">
          Input & InputField
        </Heading>

        <div className="max-w-md space-y-6">
          <Input
            placeholder="Standard input — focus for coral ring"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />

          <InputField
            label="Email Address"
            placeholder="you@example.com"
            helperText="We will never share your email."
          />

          <InputField
            label="Username"
            placeholder="johndoe"
            error="Username is already taken"
          />

          <InputField
            label="Disabled Input"
            placeholder="Cannot edit"
            disabled
          />
        </div>
      </section>

      {/* Section 4: Badge */}
      <section className="mb-16">
        <Heading level={2} className="mb-6">
          Badge
        </Heading>

        <div className="flex flex-wrap items-center gap-4">
          <Badge variant="default">Default</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="error">Error</Badge>
          <Badge variant="info">Info</Badge>
        </div>
      </section>

      {/* Section 5: Typography */}
      <section className="mb-16">
        <Heading level={2} className="mb-6">
          Typography
        </Heading>

        <div className="space-y-4">
          <Heading level={1}>Heading 1</Heading>
          <Heading level={2}>Heading 2</Heading>
          <Heading level={3}>Heading 3</Heading>
          <Heading level={4}>Heading 4</Heading>
          <Heading level={5}>Heading 5</Heading>
          <Heading level={6}>Heading 6</Heading>

          <div className="h-4" />

          <Text size="lg">Text Large</Text>
          <Text size="base">Text Base (default)</Text>
          <Text size="sm">Text Small</Text>
          <Text muted>Text Muted</Text>

          <div className="h-4" />

          <Caption>Caption text — smaller, secondary color</Caption>

          <div className="h-4" />

          <Text>
            Inline <Code>code</Code> within text
          </Text>
          <div className="bg-surface p-4 rounded-lg">
            <Code className="whitespace-pre">
{`// Code block example
function greet(name: string) {
  return \`Hello, \${name}!\`;
}`}
            </Code>
          </div>
        </div>
      </section>

      {/* Section 6: Spinner */}
      <section className="mb-16">
        <Heading level={2} className="mb-6">
          Spinner
        </Heading>

        <div className="flex flex-wrap items-end gap-8">
          <div className="flex flex-col items-center gap-2">
            <Spinner size="sm" />
            <Caption>Small</Caption>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Spinner size="md" />
            <Caption>Medium</Caption>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Spinner size="lg" />
            <Caption>Large</Caption>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Spinner size="md" value={progress} />
            <Caption>Determinate ({progress}%)</Caption>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setProgress((p) => Math.max(0, p - 10))}
          >
            - 10%
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setProgress((p) => Math.min(100, p + 10))}
          >
            + 10%
          </Button>
        </div>
      </section>

      {/* Section 7: Icon */}
      <section className="mb-16">
        <Heading level={2} className="mb-6">
          Icon
        </Heading>

        <div className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <Icon icon={MagnifyingGlass} size={16} />
              <Caption>16px</Caption>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Icon icon={MagnifyingGlass} size={20} />
              <Caption>20px</Caption>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Icon icon={MagnifyingGlass} size={24} />
              <Caption>24px</Caption>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Icon icon={MagnifyingGlass} size={32} />
              <Caption>32px</Caption>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Icon icon={Star} weight="thin" size={24} />
            <Icon icon={Star} weight="light" size={24} />
            <Icon icon={Star} weight="regular" size={24} />
            <Icon icon={Star} weight="bold" size={24} />
            <Icon icon={Star} weight="fill" size={24} />
            <Icon icon={Star} weight="duotone" size={24} />
          </div>

          <div className="flex items-center gap-4">
            <Icon icon={Warning} label="Warning" className="text-warning" size={24} />
            <Icon icon={Check} label="Success" className="text-success" size={24} />
            <Icon icon={Heart} label="Favorite" className="text-coral-500" size={24} />
          </div>
        </div>
      </section>

      {/* Touch Target Test */}
      <section className="mb-16">
        <Heading level={2} className="mb-6">
          Touch Targets (44x44px minimum)
        </Heading>
        <Text className="mb-4">
          Interactive elements should have at least 44x44px touch target.
        </Text>

        <div className="flex items-center gap-4 p-4 bg-surface rounded-lg">
          <div className="relative">
            <Button size="md">Medium Button</Button>
            <div className="absolute inset-0 border-2 border-dashed border-coral-500/50 pointer-events-none" />
          </div>
          <div className="relative">
            <Button size="lg">Large Button</Button>
            <div className="absolute inset-0 border-2 border-dashed border-coral-500/50 pointer-events-none" />
          </div>
          <div className="relative">
            <Button size="sm" aria-label="Icon button" className="p-0 w-11 h-11">
              <Icon icon={Heart} size={20} />
            </Button>
            <div className="absolute inset-0 border-2 border-dashed border-coral-500/50 pointer-events-none" />
          </div>
        </div>
      </section>

      {/* Phase 41 Divider */}
      <div className="my-16 flex items-center gap-4 w-full">
        <span className="flex-1 h-px bg-border" />
        <span className="text-sm font-medium text-foreground-secondary">Phase 41 — Extended Components</span>
        <span className="flex-1 h-px bg-border" />
      </div>

      {/* Phase 41 Interactive Demos */}
      <Phase41Demos />

      {/* Phase 42 Divider */}
      <div className="my-16 flex items-center gap-4 w-full">
        <span className="flex-1 h-px bg-border" />
        <span className="text-sm font-medium text-foreground-secondary">Phase 42 — Effects & Animation</span>
        <span className="flex-1 h-px bg-border" />
      </div>

      {/* Phase 42 Effects & Animation Demos */}
      <Phase42Demos />
    </div>
  );
}
