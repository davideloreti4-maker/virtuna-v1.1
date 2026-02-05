# Component Index

> Quick reference for all Virtuna design system components.

## Exports Quick Reference

```ts
// UI components (primary library)
import { Button, Card, Input, Badge, ... } from "@/components/ui";

// Motion components (scroll reveal, hover effects)
import { FadeIn, SlideUp, HoverScale, ... } from "@/components/motion";

// Effects components (visual overlays)
import { NoiseTexture, ChromaticAberration } from "@/components/effects";

// Primitives (low-level building blocks)
import { GlassPanel, GradientGlow, GradientMesh, ... } from "@/components/primitives";
```

---

## UI Components

| Component | Source | Showcase | Category | Exports |
|-----------|--------|----------|----------|---------|
| Accordion | [source](../src/components/ui/accordion.tsx) | -- | Interactive | `AccordionRoot`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` |
| Avatar | [source](../src/components/ui/avatar.tsx) | [/showcase/data-display](/showcase/data-display) | Display | `Avatar`, `AvatarGroup`, `AvatarRoot`, `AvatarImage`, `AvatarFallback` / `AvatarProps`, `AvatarGroupProps` |
| Badge | [source](../src/components/ui/badge.tsx) | [/showcase/feedback](/showcase/feedback) | Display | `Badge`, `badgeVariants` / `BadgeProps` |
| Button | [source](../src/components/ui/button.tsx) | [/showcase/inputs](/showcase/inputs) | Interactive | `Button`, `buttonVariants` / `ButtonProps` |
| Card | [source](../src/components/ui/card.tsx) | [/showcase/data-display](/showcase/data-display) | Display | `Card`, `GlassCard`, `CardHeader`, `CardContent`, `CardFooter` / `CardProps`, `GlassCardProps` |
| CategoryTabs | [source](../src/components/ui/category-tabs.tsx) | [/showcase/navigation](/showcase/navigation) | Interactive | `CategoryTabs` / `CategoryTabsProps`, `CategoryTab` |
| Dialog | [source](../src/components/ui/dialog.tsx) | [/showcase/feedback](/showcase/feedback) | Interactive | `Dialog`, `DialogTrigger`, `DialogPortal`, `DialogClose`, `DialogOverlay`, `DialogContent`, `dialogContentVariants`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription` / `DialogContentProps` |
| Divider | [source](../src/components/ui/divider.tsx) | [/showcase/layout-components](/showcase/layout-components) | Layout | `Divider` / `DividerProps` |
| ExtensionCard | [source](../src/components/ui/extension-card.tsx) | [/showcase/data-display](/showcase/data-display) | Display | `ExtensionCard`, `GRADIENT_THEMES` / `ExtensionCardProps` |
| Icon | [source](../src/components/ui/icon.tsx) | [/showcase/inputs](/showcase/inputs) | Display | `Icon` / `IconProps` |
| Input | [source](../src/components/ui/input.tsx) | [/showcase/inputs](/showcase/inputs) | Interactive | `Input`, `InputField` / `InputProps`, `InputFieldProps` |
| Kbd | [source](../src/components/ui/kbd.tsx) | [/showcase/navigation](/showcase/navigation) | Display | `Kbd`, `kbdVariants` / `KbdProps` |
| Select | [source](../src/components/ui/select.tsx) | [/showcase/inputs](/showcase/inputs) | Interactive | `Select`, `SearchableSelect`, `selectTriggerVariants` / `SelectProps`, `SearchableSelectProps`, `SelectOption`, `SelectGroup` |
| ShortcutBadge | [source](../src/components/ui/shortcut-badge.tsx) | [/showcase/navigation](/showcase/navigation) | Display | `ShortcutBadge` / `ShortcutBadgeProps` |
| Skeleton | [source](../src/components/ui/skeleton.tsx) | [/showcase/data-display](/showcase/data-display) | Feedback | `Skeleton` |
| Spinner | [source](../src/components/ui/spinner.tsx) | [/showcase/feedback](/showcase/feedback) | Feedback | `Spinner` / `SpinnerProps` |
| Tabs | [source](../src/components/ui/tabs.tsx) | [/showcase/navigation](/showcase/navigation) | Interactive | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` |
| TestimonialCard | [source](../src/components/ui/testimonial-card.tsx) | [/showcase/data-display](/showcase/data-display) | Display | `TestimonialCard` / `TestimonialCardProps` |
| Toast | [source](../src/components/ui/toast.tsx) | [/showcase/feedback](/showcase/feedback) | Feedback | `ToastProvider`, `useToast`, `Toast` / `ToastData`, `ToastVariant`, `UseToast`, `ToastProviderProps` |
| Toggle | [source](../src/components/ui/toggle.tsx) | [/showcase/inputs](/showcase/inputs) | Interactive | `Toggle` / `ToggleProps` |
| Typography | [source](../src/components/ui/typography.tsx) | [/showcase](/showcase) | Display | `Heading`, `Text`, `Caption`, `Code` / `HeadingProps`, `TextProps`, `CaptionProps`, `CodeProps` |

---

## Motion Components

Scroll-reveal and interaction animation wrappers. All are client components.

| Component | Source | Showcase | Description | Exports |
|-----------|--------|----------|-------------|---------|
| FadeIn | [source](../src/components/motion/fade-in.tsx) | [/showcase/utilities](/showcase/utilities) | Opacity fade on scroll into viewport | `FadeIn` / `FadeInProps` |
| FadeInUp | [source](../src/components/motion/fade-in-up.tsx) | [/showcase/utilities](/showcase/utilities) | Combined fade + vertical slide on scroll | `FadeInUp` / `FadeInUpProps` |
| SlideUp | [source](../src/components/motion/slide-up.tsx) | [/showcase/utilities](/showcase/utilities) | Vertical slide-up on scroll into viewport | `SlideUp` / `SlideUpProps` |
| StaggerReveal | [source](../src/components/motion/stagger-reveal.tsx) | [/showcase/utilities](/showcase/utilities) | Orchestrated stagger animation for child groups | `StaggerReveal`, `StaggerRevealItem` / `StaggerRevealProps`, `StaggerRevealItemProps` |
| HoverScale | [source](../src/components/motion/hover-scale.tsx) | [/showcase/utilities](/showcase/utilities) | Spring-based scale micro-interaction on hover | `HoverScale` / `HoverScaleProps` |
| PageTransition | [source](../src/components/motion/page-transition.tsx) | -- | Route transition wrapper (AnimatePresence) | `PageTransition` |
| FrozenRouter | [source](../src/components/motion/frozen-router.tsx) | -- | Prevents re-render during exit animations | `FrozenRouter` |

---

## Effects Components

Visual overlay effects for decorative use.

| Component | Source | Showcase | Description | Exports |
|-----------|--------|----------|-------------|---------|
| NoiseTexture | [source](../src/components/effects/noise-texture.tsx) | [/showcase/utilities](/showcase/utilities) | SVG feTurbulence grain overlay | `NoiseTexture` / `NoiseTextureProps` |
| ChromaticAberration | [source](../src/components/effects/chromatic-aberration.tsx) | [/showcase/utilities](/showcase/utilities) | CSS text-shadow RGB split effect | `ChromaticAberration` / `ChromaticAberrationProps` |

---

## Primitives

Low-level building blocks used by higher-level components and layouts.

| Component | Source | Showcase | Description | Exports |
|-----------|--------|----------|-------------|---------|
| GlassPanel | [source](../src/components/primitives/GlassPanel.tsx) | [/showcase/layout-components](/showcase/layout-components) | Configurable glass blur with 7 levels and tint options | `GlassPanel` / `GlassPanelProps`, `GlassTint`, `GlassBlur` |
| GradientGlow | [source](../src/components/primitives/GradientGlow.tsx) | [/showcase/utilities](/showcase/utilities) | Animated radial gradient glow orb | `GradientGlow`, `colorMap` / `GradientGlowProps`, `GradientColor` |
| GradientMesh | [source](../src/components/primitives/GradientMesh.tsx) | [/showcase/utilities](/showcase/utilities) | Multi-orb animated gradient mesh background | `GradientMesh` / `GradientMeshProps` |
| GlassCard | [source](../src/components/primitives/GlassCard.tsx) | [/showcase/data-display](/showcase/data-display) | Legacy glass card primitive | `GlassCard` / `GlassCardProps` |
| GlassPill | [source](../src/components/primitives/GlassPill.tsx) | -- | Small glass-effect pill tag | `GlassPill` / `GlassPillProps` |
| TrafficLights | [source](../src/components/primitives/TrafficLights.tsx) | [/showcase/utilities](/showcase/utilities) | macOS-style red/yellow/green dots | `TrafficLights` / `TrafficLightsProps` |

---

## By Category

### Interactive
Components with user interaction (click, type, select, toggle).

- **Button** -- Primary action trigger with variants (default, secondary, ghost, link, accent), sizes (sm, md, lg, icon), loading state
- **Input / InputField** -- Text input with label, helper text, error state, icons
- **Select / SearchableSelect** -- Dropdown selection with groups, keyboard nav, search filtering
- **Toggle** -- On/off switch with sizes and coral glow
- **Dialog** -- Modal dialog with 5 sizes (sm, md, lg, xl, full), glass backdrop
- **Tabs / TabsList / TabsTrigger / TabsContent** -- Radix-based tab navigation
- **CategoryTabs** -- Horizontal scrollable tabs with category count badges
- **Accordion** -- Expandable content panels

### Display
Components that present data and content.

- **Badge** -- Status/label pill with variants (default, secondary, success, warning, error, info, accent, outline)
- **Card / GlassCard** -- Content container with header/content/footer composition
- **ExtensionCard** -- Raycast-style extension card with gradient themes
- **TestimonialCard** -- Quote card with avatar and attribution
- **Avatar / AvatarGroup** -- User avatar with image, fallback, size variants, group stacking
- **Icon** -- Lucide icon wrapper with consistent sizing
- **Typography (Heading, Text, Caption, Code)** -- Semantic text components with size/weight presets
- **Kbd** -- Keyboard key visual (modifier keys, shortcuts)
- **ShortcutBadge** -- Keyboard shortcut display with platform-native symbols

### Feedback
Components that communicate status to the user.

- **Spinner** -- Loading indicator with sizes and progress mode
- **Toast / ToastProvider** -- Notification system with variants (default, success, warning, error, info)
- **Skeleton** -- Content placeholder with shimmer animation

### Layout
Structural and spacing components.

- **Divider** -- Horizontal/vertical separator line
- **GlassPanel** -- Glass-effect container with 7 blur levels (none, xs, sm, md, lg, xl, 2xl) and tint options

### Motion
Scroll-reveal and interaction animation wrappers.

- **FadeIn** -- Opacity-only entrance animation on scroll
- **FadeInUp** -- Combined fade + vertical translation entrance
- **SlideUp** -- Vertical slide entrance animation
- **StaggerReveal / StaggerRevealItem** -- Coordinated stagger animation for groups
- **HoverScale** -- Spring-based scale effect on hover
- **PageTransition / FrozenRouter** -- Route transition animation system

### Effects
Visual decorative overlays.

- **NoiseTexture** -- SVG grain overlay for texture
- **ChromaticAberration** -- RGB split text-shadow effect

---

## Showcase Pages

| Page | URL | Components Covered |
|------|-----|-------------------|
| Tokens | [/showcase](/showcase) | Color swatches, typography, spacing, shadows, radii, animations, gradients |
| Inputs | [/showcase/inputs](/showcase/inputs) | Button, Input, InputField, Select, SearchableSelect, Toggle, Icon |
| Navigation | [/showcase/navigation](/showcase/navigation) | Tabs, CategoryTabs, Kbd, ShortcutBadge |
| Feedback | [/showcase/feedback](/showcase/feedback) | Badge, Toast, Dialog, Spinner |
| Data Display | [/showcase/data-display](/showcase/data-display) | Avatar, AvatarGroup, Skeleton, Card, GlassCard, ExtensionCard, TestimonialCard |
| Layout | [/showcase/layout-components](/showcase/layout-components) | GlassPanel (blur levels, tints), Divider |
| Utilities | [/showcase/utilities](/showcase/utilities) | FadeIn, FadeInUp, SlideUp, StaggerReveal, HoverScale, NoiseTexture, ChromaticAberration, GradientGlow, GradientMesh, TrafficLights |
