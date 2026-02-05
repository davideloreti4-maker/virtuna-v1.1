# Component API Reference

> Complete API documentation for all Virtuna design system components.
> Visual examples: [/showcase](/showcase)

## Table of Contents

**Full Documentation**
- [Button](#button)
- [Input](#input)
- [InputField](#inputfield)
- [Select](#select)
- [SearchableSelect](#searchableselect)
- [Dialog](#dialog)
- [Toast](#toast)
- [Card](#card)
- [GlassCard](#glasscard)

**Standard Documentation**
- [Badge](#badge)
- [Toggle](#toggle)
- [Tabs](#tabs)
- [CategoryTabs](#categorytabs)
- [Avatar](#avatar)
- [AvatarGroup](#avatargroup)
- [Kbd](#kbd)
- [ShortcutBadge](#shortcutbadge)
- [ExtensionCard](#extensioncard)
- [TestimonialCard](#testimonialcard)

**Brief Documentation**
- [Spinner](#spinner)
- [Icon](#icon)
- [Skeleton](#skeleton)
- [Divider](#divider)
- [Heading](#heading)
- [Text](#text)
- [Caption](#caption)
- [Code](#code)

---

## Button

Interactive button component with Raycast-style design system integration. Supports four visual variants, three sizes, a loading state with spinner, and composition via the Radix Slot pattern.

> **Note:** The default variant is `secondary` (not `primary`), following Raycast's pattern of sparse accent usage. Use `primary` sparingly for main CTAs.

### Import

```tsx
import { Button } from "@/components/ui";
// or
import { Button, buttonVariants } from "@/components/ui/button";
import type { ButtonProps } from "@/components/ui/button";
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"primary" \| "secondary" \| "ghost" \| "destructive"` | `"secondary"` | Visual style variant |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Size variant (36px / 44px / 48px height) |
| `asChild` | `boolean` | `false` | Renders as Radix Slot for composition with other elements |
| `loading` | `boolean` | `false` | Shows spinner icon and disables interaction |
| `disabled` | `boolean` | `false` | Disables the button |
| `className` | `string` | - | Additional CSS classes |

Extends `React.ButtonHTMLAttributes<HTMLButtonElement>`.

### Variants

| Variant | Background | Use Case |
|---------|-----------|----------|
| `primary` | Coral accent (`bg-accent`) | Main CTA -- one per section maximum |
| `secondary` | Surface with border (`bg-surface`) | Default for most buttons -- form submits, toggles |
| `ghost` | Transparent (`bg-transparent`) | Toolbar actions, icon-only buttons, inline actions |
| `destructive` | Error red (`bg-error`) | Delete, remove, cancel -- destructive operations only |

### Sizes

| Size | Height | Min Touch Target | Use Case |
|------|--------|------------------|----------|
| `sm` | 36px | 36x36px | Icon buttons, compact UIs |
| `md` | 44px | 44x44px | Default, meets touch target |
| `lg` | 48px | 48x48px | Prominent CTAs |

### Usage Example

```tsx
// Secondary (default) -- most common
<Button>Learn More</Button>

// Primary CTA (use sparingly)
<Button variant="primary" size="lg">Get Started</Button>

// Loading state
<Button loading>Saving...</Button>

// Ghost icon button
<Button variant="ghost" size="sm">
  <XIcon className="h-4 w-4" />
</Button>

// As a link (composition via asChild)
<Button asChild>
  <a href="/dashboard">Go to Dashboard</a>
</Button>

// Destructive action
<Button variant="destructive">Delete Account</Button>
```

### Accessibility

- `aria-busy="true"` set automatically during loading state
- `aria-disabled` set when disabled or loading
- Focus ring: 2px accent ring with offset on `focus-visible`
- Disabled state removes pointer events and reduces opacity

### Do's and Don'ts

**Do:**
- Use `secondary` as the default variant for most actions
- Set `loading={true}` during async operations
- Use `asChild` to render as a link for navigation

**Don't:**
- Use `primary` for every button -- reserve for single main CTA per section
- Use Button for navigation without `asChild` + `<a>` -- use Link instead
- Disable without visual feedback (always show why something is disabled)

---

## Input

Base input component with full state support (default, hover, focus, error, disabled). Height is 44px for touch target compliance.

### Import

```tsx
import { Input } from "@/components/ui";
// or
import { Input } from "@/components/ui/input";
import type { InputProps } from "@/components/ui/input";
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `error` | `boolean` | `false` | Applies error border styling and sets `aria-invalid` |
| `type` | `string` | `"text"` | HTML input type (text, password, email, search, etc.) |
| `placeholder` | `string` | - | Placeholder text |
| `disabled` | `boolean` | `false` | Disables the input |
| `className` | `string` | - | Additional CSS classes |

Extends `React.InputHTMLAttributes<HTMLInputElement>`.

### Usage Example

```tsx
// Basic text input
<Input type="text" placeholder="Enter your name" />

// Password input
<Input type="password" placeholder="Enter password" />

// Error state
<Input type="email" error placeholder="Enter email" />

// Disabled
<Input type="text" disabled placeholder="Cannot edit" />
```

### Accessibility

- `aria-invalid` automatically set when `error={true}`
- Focus ring: 2px accent ring (or error ring in error state)
- Placeholder uses `foreground-muted` color token

### Do's and Don'ts

**Do:**
- Use `InputField` when you need labels and error messages (wraps `Input`)
- Set the correct `type` attribute for the input content
- Provide a visible label or `aria-label` for screen readers

**Don't:**
- Use `Input` without a label -- use `InputField` or add `aria-label`
- Rely on placeholder text as the only label

---

## InputField

Wrapper around `Input` that provides label, helper text, and error message support with proper accessibility linking.

### Import

```tsx
import { InputField } from "@/components/ui";
// or
import { InputField } from "@/components/ui/input";
import type { InputFieldProps } from "@/components/ui/input";
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | - | Label text displayed above the input |
| `helperText` | `string` | - | Helper text below input (hidden when error is present) |
| `error` | `string \| boolean` | - | Error message string or boolean for styling-only error |
| `id` | `string` | auto-generated | ID for label-input association |
| `className` | `string` | - | Additional CSS classes (applied to wrapper div) |

Inherits all `InputProps` except `error` (overridden to accept string).

### Usage Example

```tsx
// With label
<InputField label="Email" type="email" placeholder="you@example.com" />

// With label and helper text
<InputField
  label="Password"
  type="password"
  helperText="Must be at least 8 characters"
/>

// With error message
<InputField
  label="Username"
  error="Username is already taken"
/>

// Boolean error (styling only, no message)
<InputField label="Name" error={hasError} />
```

### Subcomponents

InputField internally composes:
- `<label>` linked via `htmlFor` to the input
- `<Input>` with `aria-describedby` pointing to helper/error text
- Helper text paragraph with unique ID
- Error message paragraph with `role="alert"` for screen reader announcements

### Accessibility

- Label automatically linked to input via `htmlFor`/`id`
- `aria-describedby` connects input to helper text or error message
- Error messages use `role="alert"` for immediate screen reader announcement
- Auto-generates unique ID if none provided

### Do's and Don'ts

**Do:**
- Always provide a `label` for form inputs
- Use string `error` to show error messages to users
- Use `helperText` for input guidance

**Don't:**
- Show both `helperText` and `error` simultaneously (error takes precedence automatically)
- Use boolean `error` when you have an error message to display

---

## Select

Custom select dropdown with full keyboard navigation and glassmorphism styling. Supports flat and grouped option lists.

### Import

```tsx
import { Select } from "@/components/ui";
// or
import { Select } from "@/components/ui/select";
import type { SelectProps, SelectOption, SelectGroup } from "@/components/ui/select";
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | `(SelectOption \| SelectGroup)[]` | required | Flat or grouped options |
| `value` | `string` | - | Controlled selected value |
| `defaultValue` | `string` | - | Default value (uncontrolled) |
| `onChange` | `(value: string) => void` | - | Callback when selection changes |
| `placeholder` | `string` | `"Select..."` | Placeholder when no selection |
| `disabled` | `boolean` | `false` | Disables the select |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Trigger size variant |
| `error` | `boolean` | `false` | Error state styling |
| `className` | `string` | - | Additional CSS classes |

### Types

```tsx
interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectGroup {
  label: string;
  options: SelectOption[];
}
```

### Sizes

| Size | Height | Font |
|------|--------|------|
| `sm` | 32px | 14px |
| `md` | 40px | 16px |
| `lg` | 48px | 18px |

### Usage Example

```tsx
// Basic usage
<Select
  options={[
    { value: "react", label: "React" },
    { value: "vue", label: "Vue" },
    { value: "svelte", label: "Svelte" },
  ]}
  placeholder="Select framework..."
/>

// Controlled
const [value, setValue] = useState("");
<Select value={value} onChange={setValue} options={options} />

// Grouped options
<Select
  options={[
    { label: "Fruits", options: [
      { value: "apple", label: "Apple" },
      { value: "banana", label: "Banana" },
    ]},
    { label: "Vegetables", options: [
      { value: "carrot", label: "Carrot" },
    ]},
  ]}
/>
```

### Accessibility

- `role="combobox"` on trigger with `aria-expanded`, `aria-haspopup="listbox"`
- `role="listbox"` on dropdown panel
- `role="option"` with `aria-selected` on each option
- `aria-activedescendant` tracks highlighted option
- Full keyboard navigation: Arrow Up/Down, Enter/Space, Escape, Home/End, Tab
- Disabled options skipped during keyboard navigation with wrap-around

### Do's and Don'ts

**Do:**
- Use grouped options for long option lists with logical categories
- Provide a meaningful `placeholder` that describes the expected selection
- Use controlled mode (`value` + `onChange`) for form integration

**Don't:**
- Use Select for fewer than 3 options -- use radio buttons or a toggle instead
- Mix flat options and groups in the same options array without clear reason

---

## SearchableSelect

Extends Select with a type-to-filter search input at the top of the dropdown. Options are filtered case-insensitively as the user types.

### Import

```tsx
import { SearchableSelect } from "@/components/ui";
// or
import { SearchableSelect } from "@/components/ui/select";
import type { SearchableSelectProps } from "@/components/ui/select";
```

### Props

Inherits all `SelectProps` plus:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `searchPlaceholder` | `string` | `"Search..."` | Placeholder for the search input |
| `noResultsText` | `string` | `"No results found"` | Text shown when no options match |

### Usage Example

```tsx
// Basic searchable
<SearchableSelect
  options={countries}
  placeholder="Select country..."
  searchPlaceholder="Search countries..."
/>

// Controlled with custom no-results text
const [country, setCountry] = useState("");
<SearchableSelect
  value={country}
  onChange={setCountry}
  options={countries}
  noResultsText="No countries match your search"
/>
```

### Accessibility

- Search input auto-focused when dropdown opens
- Clear search button with `aria-label="Clear search"`
- Same keyboard navigation as Select (Arrow keys, Enter, Escape)
- Space key types in search input instead of selecting

### Do's and Don'ts

**Do:**
- Use when option list has more than ~8 items
- Provide helpful `searchPlaceholder` and `noResultsText`

**Don't:**
- Use for short option lists where filtering adds unnecessary complexity
- Forget to handle the controlled state if integrating with forms

---

## Dialog

Modal dialog built on `@radix-ui/react-dialog` with glassmorphism styling, five size variants, and animated open/close transitions.

### Import

```tsx
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui";
```

### DialogContent Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `"sm" \| "md" \| "lg" \| "xl" \| "full"` | `"md"` | Maximum width of the dialog |
| `className` | `string` | - | Additional CSS classes |

### Sizes

| Size | Max Width | Use Case |
|------|-----------|----------|
| `sm` | 384px | Confirmations, simple alerts |
| `md` | 448px | Default, standard forms |
| `lg` | 512px | Complex forms, settings |
| `xl` | 576px | Wide content, tables |
| `full` | 90vw / 90vh | Full-screen content with scroll |

### Subcomponents

| Component | Description |
|-----------|-------------|
| `Dialog` | Root -- controls open/close state (Radix Root) |
| `DialogTrigger` | Opens dialog on click. Use `asChild` to compose with Button |
| `DialogContent` | Glass-styled content panel with size variants |
| `DialogHeader` | Flex column container for title + description (p-6 pb-0) |
| `DialogFooter` | Right-aligned button container (p-6 pt-4) |
| `DialogTitle` | Styled heading (text-lg font-semibold) |
| `DialogDescription` | Secondary text (text-sm foreground-secondary) |
| `DialogClose` | Closes dialog on click. Use `asChild` to compose with Button |
| `DialogPortal` | Renders into portal at DOM end |
| `DialogOverlay` | Blurred dark backdrop (bg-black/60, 4px blur) |

### Usage Example

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent size="md">
    <DialogHeader>
      <DialogTitle>Confirm Action</DialogTitle>
      <DialogDescription>This cannot be undone.</DialogDescription>
    </DialogHeader>
    <div className="p-6">
      <p>Are you sure you want to proceed?</p>
    </div>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="secondary">Cancel</Button>
      </DialogClose>
      <Button variant="primary">Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Accessibility

- Radix-managed focus trap: focus stays within dialog while open
- Radix-managed scroll lock: page scroll disabled while open
- `Escape` key closes dialog
- Focus returns to trigger on close
- Uses `role="dialog"` with `aria-labelledby` (DialogTitle) and `aria-describedby` (DialogDescription)
- Overlay click closes dialog

### Do's and Don'ts

**Do:**
- Always include `DialogTitle` for accessibility (even if visually hidden)
- Use `asChild` on `DialogTrigger` and `DialogClose` to compose with your buttons
- Keep dialog content focused on a single task

**Don't:**
- Nest dialogs within dialogs
- Use `full` size for simple confirmations
- Put long scrollable content in small-sized dialogs (use `full` or `xl`)

---

## Toast

Notification toast system with slide-in/out animations, progress bar, pause-on-hover, and five semantic variants.

### Import

```tsx
import { ToastProvider, useToast } from "@/components/ui";
// or
import { ToastProvider, useToast, Toast } from "@/components/ui/toast";
import type { ToastData, ToastVariant, UseToast, ToastProviderProps } from "@/components/ui/toast";
```

### ToastProvider Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `React.ReactNode` | required | Application children |
| `maxToasts` | `number` | `5` | Maximum visible toasts (oldest removed when exceeded) |

### useToast Return

| Method | Signature | Description |
|--------|-----------|-------------|
| `toast` | `(options: Omit<ToastData, "id">) => string` | Create a toast, returns its ID |
| `dismiss` | `(id: string) => void` | Dismiss a specific toast |
| `dismissAll` | `() => void` | Dismiss all toasts |

### ToastData

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"default" \| "success" \| "error" \| "warning" \| "info"` | `"default"` | Visual variant |
| `title` | `string` | required | Toast title text |
| `description` | `string` | - | Optional description below the title |
| `duration` | `number` | `5000` | Auto-dismiss duration in ms. Set `0` for persistent |
| `action` | `{ label: string; onClick: () => void }` | - | Optional action button |

### Variants

| Variant | Icon | Color | Use Case |
|---------|------|-------|----------|
| `default` | none | neutral | General notifications |
| `success` | CheckCircle | green | Operation completed successfully |
| `error` | XCircle | red | Operation failed |
| `warning` | Warning | yellow | Caution or potential issue |
| `info` | Info | blue | Informational message |

### Usage Example

```tsx
// 1. Wrap your app with ToastProvider (once in layout.tsx)
<ToastProvider maxToasts={5}>
  {children}
</ToastProvider>

// 2. Use the hook in any component
function SaveButton() {
  const { toast } = useToast();

  const handleSave = async () => {
    try {
      await saveData();
      toast({ variant: "success", title: "Saved!", description: "Your changes have been saved." });
    } catch {
      toast({ variant: "error", title: "Save failed", description: "Please try again." });
    }
  };

  return <Button onClick={handleSave}>Save</Button>;
}

// Persistent toast with action
toast({
  variant: "warning",
  title: "Session expiring",
  description: "Your session will expire in 5 minutes.",
  duration: 0,
  action: { label: "Extend", onClick: () => extendSession() },
});
```

### Accessibility

- Each toast has `role="alert"` and `aria-live="polite"`
- Toast container has `aria-label="Notifications"`
- Dismiss button has `aria-label="Dismiss toast"`
- Progress bar shows remaining time visually
- Auto-dismiss pauses on mouse hover

### Do's and Don'ts

**Do:**
- Place `ToastProvider` once at the root layout level
- Use semantic variants to communicate meaning (success/error/warning/info)
- Set `duration: 0` for critical messages that require user acknowledgment

**Don't:**
- Create multiple `ToastProvider` instances (except for isolated showcase demos)
- Use toasts for inline form validation (use InputField errors instead)
- Show toasts for every minor action (reserve for meaningful feedback)

---

## Card

Basic card component with dark surface styling, gradient background, and subtle inner glow.

### Import

```tsx
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui";
// or
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import type { CardProps } from "@/components/ui/card";
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Additional CSS classes |
| `style` | `React.CSSProperties` | - | Additional inline styles |

Extends `React.HTMLAttributes<HTMLDivElement>`.

### Subcomponents

| Component | Description | Padding |
|-----------|-------------|---------|
| `CardHeader` | Top section for titles and header actions | `p-6` |
| `CardContent` | Main body content | `p-6 pt-0` |
| `CardFooter` | Bottom section with flex layout for actions | `p-6 pt-0`, `flex items-center` |

### Usage Example

```tsx
<Card>
  <CardHeader>
    <h3 className="text-lg font-semibold">Card Title</h3>
    <p className="text-sm text-foreground-secondary">Subtitle</p>
  </CardHeader>
  <CardContent>
    <p>Card content goes here.</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Accessibility

- Renders semantic `<div>` -- add appropriate ARIA roles if the card is interactive
- Card background uses gradient token (`--gradient-card-bg`) with subtle inner glow shadow

### Do's and Don'ts

**Do:**
- Use Card for content grouping on solid dark backgrounds
- Use subcomponents (CardHeader, CardContent, CardFooter) for consistent padding
- Add headings inside CardHeader for document structure

**Don't:**
- Use Card over gradient or image backgrounds (use GlassCard instead)
- Add interactive roles without keyboard support

---

## GlassCard

Glassmorphism card with backdrop blur, frosted glass background, and optional inner glow. Designed for use over gradient or image backgrounds.

### Import

```tsx
import { GlassCard } from "@/components/ui";
// or
import { GlassCard } from "@/components/ui/card";
import type { GlassCardProps } from "@/components/ui/card";
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `blur` | `"sm" \| "md" \| "lg"` | `"md"` | Backdrop blur intensity |
| `glow` | `boolean` | `true` | Show inner glow effect on top edge |
| `className` | `string` | - | Additional CSS classes |
| `style` | `React.CSSProperties` | - | Additional inline styles |

Extends `React.HTMLAttributes<HTMLDivElement>`.

### Blur Values

| Size | Blur | Use Case |
|------|------|----------|
| `sm` | 8px | Subtle glass effect |
| `md` | 12px | Default, balanced glass |
| `lg` | 20px | Strong frosted glass |

### Usage Example

```tsx
// Default glass card
<GlassCard>
  <CardContent>
    <p>Glassmorphism content</p>
  </CardContent>
</GlassCard>

// Strong blur with glow
<GlassCard blur="lg" glow>
  <CardHeader>Premium Feature</CardHeader>
  <CardContent>Enhanced glass effect</CardContent>
</GlassCard>

// Subtle blur without glow
<GlassCard blur="sm" glow={false}>
  <CardContent>Minimal glass styling</CardContent>
</GlassCard>
```

### Accessibility

- Same as Card -- no interactive role by default
- Glassmorphism effects are purely decorative; content remains readable

### Do's and Don'ts

**Do:**
- Use GlassCard over gradient or image backgrounds where blur is visible
- Use CardHeader/CardContent/CardFooter subcomponents for consistent spacing
- Ensure text contrast is sufficient against blurred background content

**Don't:**
- Use GlassCard on solid dark backgrounds (use Card instead -- blur has no visual effect)
- Stack multiple GlassCards where blur effects compound

---

## Badge

Display-only status indicator with semantic color variants and two sizes.

### Import

```tsx
import { Badge } from "@/components/ui";
import type { BadgeProps } from "@/components/ui/badge";
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"default" \| "success" \| "warning" \| "error" \| "info"` | `"default"` | Visual variant |
| `size` | `"sm" \| "md"` | `"md"` | Size (20px / 24px height) |
| `className` | `string` | - | Additional CSS classes |

Extends `React.HTMLAttributes<HTMLSpanElement>`.

### Variants

| Variant | Background | Text Color | Use Case |
|---------|-----------|------------|----------|
| `default` | `bg-surface` | `foreground-secondary` | General labels |
| `success` | `bg-success/10` | `text-success` | Active, completed |
| `warning` | `bg-warning/10` | `text-warning` | Pending, caution |
| `error` | `bg-error/10` | `text-error` | Failed, danger |
| `info` | `bg-info/10` | `text-info` | New, informational |

### Usage Example

```tsx
// Status indicators
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="error">Expired</Badge>

// Count badges
<Badge size="sm">3</Badge>
<Badge variant="info" size="sm">New</Badge>
```

---

## Toggle

Switch/toggle component built on `@radix-ui/react-switch` with coral accent when checked and optional label wrapping.

### Import

```tsx
import { Toggle } from "@/components/ui";
import type { ToggleProps } from "@/components/ui/toggle";
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Track size (20px / 24px / 28px height) |
| `label` | `string` | - | Label text (wraps toggle in `<label>`) |
| `checked` | `boolean` | - | Controlled checked state |
| `defaultChecked` | `boolean` | - | Default checked state (uncontrolled) |
| `onCheckedChange` | `(checked: boolean) => void` | - | Callback when toggled |
| `disabled` | `boolean` | `false` | Disables the toggle |

Extends Radix Switch Root props.

### Key Behaviors

- Checked: coral accent track (`bg-accent/20`) with coral thumb and glow shadow
- Unchecked: neutral glass track (`bg-surface`) with secondary-colored thumb
- Keyboard: Space to toggle
- Label wrapping: when `label` is provided, renders inside `<label>` for click-to-toggle

### Usage Example

```tsx
// With label (recommended)
<Toggle label="Enable notifications" />

// Controlled
const [enabled, setEnabled] = useState(false);
<Toggle checked={enabled} onCheckedChange={setEnabled} label="Dark mode" />

// Sizes
<Toggle size="sm" label="Small" />
<Toggle size="lg" label="Large" />

// Without label (provide aria-label)
<Toggle aria-label="Toggle feature" />
```

---

## Tabs

Tab system built on `@radix-ui/react-tabs` with Raycast glass pill styling. Full accessibility via Radix.

### Import

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui";
```

### Subcomponents

| Component | Props | Description |
|-----------|-------|-------------|
| `Tabs` | Radix Tabs Root props | Root container, manages active tab state |
| `TabsList` | Radix Tabs List props | Glass pill track container |
| `TabsTrigger` | `size?: "sm" \| "md" \| "lg"` + Radix props | Individual tab button |
| `TabsContent` | Radix Tabs Content props | Content panel per tab |

### Key Behaviors

- Active tab: glass pill styling (`bg-white/5`, `border-white/10`, shadow)
- Inactive tab: muted text with transparent border
- Arrow key navigation between triggers (Radix roving tabindex)
- Home/End key support

### Usage Example

```tsx
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
    <TabsTrigger value="billing">Billing</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">Overview content...</TabsContent>
  <TabsContent value="settings">Settings content...</TabsContent>
  <TabsContent value="billing">Billing content...</TabsContent>
</Tabs>
```

---

## CategoryTabs

Higher-level tabs component for category navigation with icons, counts, and horizontal scrolling.

### Import

```tsx
import { CategoryTabs } from "@/components/ui";
import { TabsContent } from "@/components/ui/tabs";
import type { CategoryTabsProps, CategoryTab } from "@/components/ui/category-tabs";
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `categories` | `CategoryTab[]` | required | Array of category definitions |
| `defaultValue` | `string` | first category | Default active category (uncontrolled) |
| `value` | `string` | - | Controlled active category |
| `onValueChange` | `(value: string) => void` | - | Callback on category change |
| `children` | `React.ReactNode` | required | TabsContent children |
| `className` | `string` | - | Additional CSS classes |

### CategoryTab Type

```tsx
interface CategoryTab {
  value: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}
```

### Usage Example

```tsx
const categories = [
  { value: "all", label: "All", count: 42 },
  { value: "dev", label: "Developer", icon: <CodeIcon />, count: 18 },
  { value: "design", label: "Design", icon: <PaletteIcon />, count: 8 },
];

<CategoryTabs categories={categories} defaultValue="all">
  <TabsContent value="all">All items...</TabsContent>
  <TabsContent value="dev">Developer items...</TabsContent>
  <TabsContent value="design">Design items...</TabsContent>
</CategoryTabs>
```

---

## Avatar

Convenience avatar component composing Radix Avatar primitives. Shows an image with automatic fallback to initials when the image fails to load.

### Import

```tsx
import { Avatar, AvatarGroup } from "@/components/ui";
import type { AvatarProps, AvatarGroupProps } from "@/components/ui/avatar";
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | - | Image source URL |
| `alt` | `string` | `""` | Alt text for the image |
| `fallback` | `string` | - | Fallback initials (e.g., "DL") |
| `size` | `"xs" \| "sm" \| "md" \| "lg" \| "xl"` | `"md"` | Avatar size |
| `className` | `string` | - | Additional CSS classes |

### Sizes

| Size | Dimensions | Use Case |
|------|-----------|----------|
| `xs` | 24px | Inline indicators |
| `sm` | 32px | Compact lists |
| `md` | 40px | Cards, comments (default) |
| `lg` | 48px | Profile headers |
| `xl` | 64px | Hero/profile pages |

### Usage Example

```tsx
// With image and fallback
<Avatar src="/photo.jpg" alt="Davide Loreti" fallback="DL" />

// Initials only
<Avatar fallback="DL" size="lg" />

// Different sizes
<Avatar src="/photo.jpg" size="xs" />
<Avatar src="/photo.jpg" size="xl" />
```

### Low-Level Primitives

For advanced composition, use `AvatarRoot`, `AvatarImage`, `AvatarFallback` directly (Radix primitives with Virtuna styling).

---

## AvatarGroup

Overlapping avatar stack with +N overflow count.

### Import

```tsx
import { AvatarGroup } from "@/components/ui";
import type { AvatarGroupProps } from "@/components/ui/avatar";
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `React.ReactNode` | required | Avatar elements |
| `max` | `number` | - | Maximum visible avatars (remaining shows +N) |
| `size` | Avatar size | `"md"` | Size for the overflow count avatar |
| `className` | `string` | - | Additional CSS classes |

### Usage Example

```tsx
<AvatarGroup max={3} size="sm">
  <Avatar src="/user1.jpg" fallback="A" />
  <Avatar src="/user2.jpg" fallback="B" />
  <Avatar src="/user3.jpg" fallback="C" />
  <Avatar src="/user4.jpg" fallback="D" />
  <Avatar src="/user5.jpg" fallback="E" />
</AvatarGroup>
// Renders 3 avatars + "+2" circle
```

---

## Kbd

Raycast-style 3D keyboard keycap visualization with realistic 4-layer box shadow.

### Import

```tsx
import { Kbd } from "@/components/ui";
import type { KbdProps } from "@/components/ui/kbd";
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Keycap size (20px / 24px / 28px) |
| `highlighted` | `boolean` | `false` | Adds coral glow highlight |
| `className` | `string` | - | Additional CSS classes |

Extends `React.HTMLAttributes<HTMLElement>`.

### Usage Example

```tsx
// Inline key
Press <Kbd>K</Kbd> to search

// Large highlighted key
<Kbd size="lg" highlighted>Enter</Kbd>

// Small modifier
<Kbd size="sm">Esc</Kbd>
```

---

## ShortcutBadge

Displays modifier+key combinations using composed Kbd components with Unicode modifier symbols.

### Import

```tsx
import { ShortcutBadge } from "@/components/ui";
import type { ShortcutBadgeProps } from "@/components/ui/shortcut-badge";
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `keys` | `string[]` | required | Key names (e.g., `["cmd", "K"]`) |
| `separator` | `"plus" \| "none"` | `"none"` | Separator between keys |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Size passed to each Kbd |
| `highlighted` | `boolean` | `false` | Highlight all keys with coral glow |
| `className` | `string` | - | Additional CSS classes |

### Supported Modifier Keys

`cmd`/`command`, `shift`, `alt`/`option`, `ctrl`/`control`, `enter`/`return`, `backspace`, `delete`, `tab`, `escape`, `space`, `up`, `down`, `left`, `right`

### Usage Example

```tsx
// Command + K
<ShortcutBadge keys={["cmd", "K"]} />

// Shift + Alt + P with plus separator
<ShortcutBadge keys={["shift", "alt", "P"]} separator="plus" />

// Small highlighted
<ShortcutBadge keys={["cmd", "enter"]} size="sm" highlighted />
```

---

## ExtensionCard

Raycast-style feature/extension card with radial gradient glow, icon, title, description, and optional metadata.

### Import

```tsx
import { ExtensionCard, GRADIENT_THEMES } from "@/components/ui";
import type { ExtensionCardProps } from "@/components/ui/extension-card";
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `React.ReactNode` | required | Icon (emoji, SVG, or React node) |
| `title` | `string` | required | Card title |
| `description` | `string` | required | Card description (2-line clamp) |
| `gradient` | `"coral" \| "purple" \| "blue" \| "green" \| "cyan"` | `"coral"` | Gradient glow theme |
| `metadata` | `React.ReactNode` | - | Optional metadata below description |
| `href` | `string` | - | Makes card a clickable link |
| `className` | `string` | - | Additional CSS classes |

### Usage Example

```tsx
<ExtensionCard
  icon={<span>🚀</span>}
  title="Quick Launch"
  description="Launch applications instantly with keyboard shortcuts."
  gradient="purple"
  href="/extensions/quick-launch"
  metadata={<span className="text-xs text-foreground-muted">v2.1.0</span>}
/>
```

---

## TestimonialCard

Testimonial card with blockquote, author attribution (avatar/initials, name, role, company), and optional featured variant.

### Import

```tsx
import { TestimonialCard } from "@/components/ui";
import type { TestimonialCardProps } from "@/components/ui/testimonial-card";
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `quote` | `string` | required | Testimonial quote text |
| `author` | `{ name, role?, company?, avatar? }` | required | Author information |
| `featured` | `boolean` | `false` | Accent glow border for highlighted testimonials |
| `className` | `string` | - | Additional CSS classes |

### Usage Example

```tsx
<TestimonialCard
  quote="Virtuna transformed our workflow."
  author={{
    name: "Sarah Chen",
    role: "Design Lead",
    company: "Acme Inc",
    avatar: "/avatars/sarah.jpg",
  }}
  featured
/>
```

---

## Spinner

SVG loading spinner with indeterminate (spinning) and determinate (progress) modes. Inherits color from parent via `currentColor`.

**Import:** `import { Spinner } from "@/components/ui"`

**Key props:** `size?: "sm" | "md" | "lg"` (16px / 24px / 32px), `value?: number` (0-100 for determinate), `label?: string` (default `"Loading"`)

```tsx
<Spinner />                    // Indeterminate
<Spinner size="lg" />          // Large spinner
<Spinner value={75} />         // 75% progress
<div className="text-accent"><Spinner /></div>  // Coral colored
```

---

## Icon

Wrapper for Phosphor icons with consistent sizing and accessibility.

**Import:** `import { Icon } from "@/components/ui"`

**Key props:** `icon: PhosphorIcon` (required), `size?: 16 | 20 | 24 | 32` (default 20), `weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"` (default `"regular"`), `label?: string` (omit for decorative)

```tsx
<Icon icon={MagnifyingGlass} />                        // Decorative
<Icon icon={Warning} label="Warning" className="text-warning" />  // Meaningful
```

---

## Skeleton

Loading placeholder with shimmer animation (moving gradient highlight).

**Import:** `import { Skeleton } from "@/components/ui"`

**Key props:** `className: string` (set dimensions via Tailwind classes)

```tsx
<Skeleton className="h-4 w-48" />        // Text line
<Skeleton className="h-10 w-10 rounded-full" />  // Avatar placeholder
<Skeleton className="h-32 w-full" />      // Card placeholder
```

---

## Divider

Layout separator with horizontal, vertical, and labeled variants.

**Import:** `import { Divider } from "@/components/ui"`

**Key props:** `orientation?: "horizontal" | "vertical"` (default `"horizontal"`), `label?: string` (center text for horizontal dividers)

```tsx
<Divider />                          // Horizontal line
<Divider label="or" />               // Labeled divider
<Divider orientation="vertical" />   // Vertical line (use in flex containers)
```

---

## Heading

Semantic heading component (h1-h6) with independent visual size override.

**Import:** `import { Heading } from "@/components/ui"`

**Key props:** `level: 1-6` (required, determines HTML tag), `size?: 1-6` (visual override, defaults to level)

Typography scale: h1=64px, h2=48px, h3=24px, h4=20px, h5=18px, h6=16px

```tsx
<Heading level={1}>Page Title</Heading>       // <h1> at 64px
<Heading level={2}>Section</Heading>           // <h2> at 48px
<Heading level={1} size={3}>Compact</Heading>  // <h1> tag, 24px visual
```

---

## Text

Body text component with size variants and muted color option.

**Import:** `import { Text } from "@/components/ui"`

**Key props:** `size?: "sm" | "base" | "lg"` (14px / 16px / 18px), `muted?: boolean`, `as?: "p" | "span" | "div"` (default `"p"`)

```tsx
<Text>Default paragraph text.</Text>
<Text size="lg">Large intro text.</Text>
<Text muted>Secondary information.</Text>
<Text as="span" size="sm">Inline text</Text>
```

---

## Caption

Small muted text for captions, labels, and timestamps. Renders as `<span>` with 12px size.

**Import:** `import { Caption } from "@/components/ui"`

```tsx
<Caption>Updated 3 hours ago</Caption>
<Caption>Photo by John Doe</Caption>
```

---

## Code

Inline code snippet component with monospace font and subtle background.

**Import:** `import { Code } from "@/components/ui"`

```tsx
<Text>Use the <Code>useState</Code> hook to manage state.</Text>
<Text>Run <Code>pnpm install</Code> to install dependencies.</Text>
```
