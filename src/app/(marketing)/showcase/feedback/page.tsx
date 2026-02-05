import type { Metadata } from "next";

import { Heading, Text, Badge, Spinner } from "@/components/ui";
import { ShowcaseSection } from "../_components/showcase-section";
import { CodeBlock } from "../_components/code-block";
import { ComponentGrid } from "../_components/component-grid";
import { ToastDemo } from "../_components/toast-demo";
import { DialogDemo } from "../_components/dialog-demo";
import { SpinnerDemo } from "../_components/spinner-demo";

export const metadata: Metadata = {
  title: "Feedback | Virtuna UI Showcase",
  description: "Badge, Toast, Dialog, and Spinner feedback components.",
};

// ============================================
// Page component
// ============================================

export default function FeedbackShowcasePage() {
  return (
    <>
      {/* Page header */}
      <div className="mb-12">
        <Heading level={1} className="mb-3">
          Feedback
        </Heading>
        <Text size="lg" muted>
          Status indicators, notifications, modal dialogs, and loading spinners
          for user feedback patterns.
        </Text>
      </div>

      {/* Badge */}
      <ShowcaseSection
        id="badge"
        title="Badge"
        description="Display-only status indicators with 5 semantic variants and 2 sizes. Non-interactive, using design system color tokens."
      >
        <div className="space-y-8">
          {/* All variants at md size */}
          <div className="space-y-4">
            <Text size="sm" className="font-medium">
              Variants (md)
            </Text>
            <div className="flex flex-wrap gap-3">
              <Badge variant="default">Default</Badge>
              <Badge variant="success">Active</Badge>
              <Badge variant="warning">Pending</Badge>
              <Badge variant="error">Failed</Badge>
              <Badge variant="info">New</Badge>
            </div>
          </div>

          {/* All variants at sm size */}
          <div className="space-y-4">
            <Text size="sm" className="font-medium">
              Variants (sm)
            </Text>
            <div className="flex flex-wrap gap-3">
              <Badge variant="default" size="sm">
                Draft
              </Badge>
              <Badge variant="success" size="sm">
                Live
              </Badge>
              <Badge variant="warning" size="sm">
                Review
              </Badge>
              <Badge variant="error" size="sm">
                Expired
              </Badge>
              <Badge variant="info" size="sm">
                Beta
              </Badge>
            </div>
          </div>

          {/* Size comparison */}
          <div className="space-y-4">
            <Text size="sm" className="font-medium">
              Size comparison
            </Text>
            <ComponentGrid columns={2}>
              <div className="flex flex-col items-center gap-3 rounded-lg border border-border-glass bg-surface/30 p-6">
                <Badge variant="info" size="sm">
                  sm (20px)
                </Badge>
                <Text size="sm" muted>
                  Compact for counts/icons
                </Text>
              </div>
              <div className="flex flex-col items-center gap-3 rounded-lg border border-border-glass bg-surface/30 p-6">
                <Badge variant="info" size="md">
                  md (24px)
                </Badge>
                <Text size="sm" muted>
                  Default for text labels
                </Text>
              </div>
            </ComponentGrid>
          </div>

          <CodeBlock
            title="Badge usage"
            code={`import { Badge } from "@/components/ui";

{/* Variants: default, success, warning, error, info */}
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="error">Failed</Badge>
<Badge variant="info">New</Badge>

{/* Sizes: sm (20px), md (24px, default) */}
<Badge size="sm">3</Badge>
<Badge variant="info" size="sm">Beta</Badge>`}
          />
        </div>
      </ShowcaseSection>

      {/* Toast */}
      <ShowcaseSection
        id="toast"
        title="Toast"
        description="Slide-in notification system with 5 variants, auto-dismiss progress, pause on hover, and action buttons. Requires ToastProvider in tree."
      >
        <div className="space-y-8">
          <div className="rounded-lg border border-border-glass bg-surface/30 p-6">
            <Text size="sm" muted className="mb-4">
              Click each button to trigger a toast notification in the top-right
              corner.
            </Text>
            <ToastDemo />
          </div>

          <CodeBlock
            title="Toast usage"
            code={`import { ToastProvider, useToast } from "@/components/ui";

// 1. Wrap your app with ToastProvider
<ToastProvider>
  <App />
</ToastProvider>

// 2. Use the hook to trigger toasts
function MyComponent() {
  const { toast, dismiss, dismissAll } = useToast();

  const handleSave = () => {
    toast({
      variant: "success",
      title: "Saved!",
      description: "Your changes have been saved.",
    });
  };

  const handleError = () => {
    toast({
      variant: "error",
      title: "Upload Failed",
      description: "File exceeds 10MB limit.",
      duration: 8000, // 8s (default 5s, 0 = persistent)
      action: { label: "Retry", onClick: handleRetry },
    });
  };
}

// Variants: default, success, warning, error, info`}
          />
        </div>
      </ShowcaseSection>

      {/* Dialog */}
      <ShowcaseSection
        id="dialog"
        title="Dialog"
        description="Radix-based modal dialog with glassmorphism styling. 5 size variants (sm, md, lg, xl, full) with focus trap, scroll lock, and scale + fade animation."
      >
        <div className="space-y-8">
          <div className="rounded-lg border border-border-glass bg-surface/30 p-6">
            <Text size="sm" muted className="mb-4">
              Open dialogs at different sizes. Each includes header,
              description, body, and footer sections.
            </Text>
            <DialogDemo />
          </div>

          <CodeBlock
            title="Dialog usage"
            code={`import {
  Dialog, DialogTrigger, DialogContent,
  DialogHeader, DialogFooter,
  DialogTitle, DialogDescription, DialogClose,
  Button,
} from "@/components/ui";

<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent size="md"> {/* sm | md | lg | xl | full */}
    <DialogHeader>
      <DialogTitle>Confirm Action</DialogTitle>
      <DialogDescription>This cannot be undone.</DialogDescription>
    </DialogHeader>
    <div className="px-6 py-4">
      <p>Dialog body content here.</p>
    </div>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="secondary">Cancel</Button>
      </DialogClose>
      <Button variant="primary">Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>`}
          />
        </div>
      </ShowcaseSection>

      {/* Spinner */}
      <ShowcaseSection
        id="spinner"
        title="Spinner"
        description="SVG loading indicator with indeterminate animation and determinate progress mode. 3 sizes, inherits color from parent via currentColor."
      >
        <div className="space-y-8">
          <div className="rounded-lg border border-border-glass bg-surface/30 p-6">
            <SpinnerDemo />
          </div>

          {/* Color inheritance */}
          <div className="space-y-4">
            <Text size="sm" className="font-medium">
              Color inheritance
            </Text>
            <div className="flex items-center gap-6 rounded-lg border border-border-glass bg-surface/30 p-6">
              <div className="flex flex-col items-center gap-2">
                <Spinner size="md" />
                <Text size="sm" muted>
                  Default
                </Text>
              </div>
              <div className="flex flex-col items-center gap-2 text-accent">
                <Spinner size="md" />
                <Text size="sm" muted>
                  Accent
                </Text>
              </div>
              <div className="flex flex-col items-center gap-2 text-success">
                <Spinner size="md" />
                <Text size="sm" muted>
                  Success
                </Text>
              </div>
              <div className="flex flex-col items-center gap-2 text-error">
                <Spinner size="md" />
                <Text size="sm" muted>
                  Error
                </Text>
              </div>
            </div>
          </div>

          <CodeBlock
            title="Spinner usage"
            code={`import { Spinner } from "@/components/ui";

{/* Indeterminate (default) */}
<Spinner />
<Spinner size="sm" />  {/* 16px */}
<Spinner size="md" />  {/* 24px (default) */}
<Spinner size="lg" />  {/* 32px */}

{/* Determinate progress */}
<Spinner value={75} />
<Spinner value={100} size="lg" />

{/* Color inheritance */}
<div className="text-accent">
  <Spinner />  {/* coral spinner */}
</div>

{/* In a button */}
<Button disabled>
  <Spinner size="sm" /> Loading...
</Button>`}
          />
        </div>
      </ShowcaseSection>
    </>
  );
}
