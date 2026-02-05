# Usage Guidelines

> When to use each component, variant selection guidance, and common patterns.
> API reference: [components.md](./components.md) | Visual examples: [/showcase](/showcase)

## General Principles

- **Dark-mode first:** All components are designed for dark backgrounds. Never assume light theme.
- **Token-based:** Never hardcode colors, spacing, or shadows. Use semantic design tokens from `globals.css`.
- **Server-first:** Use server components by default. Add `"use client"` only for interactivity (state, event handlers, browser APIs).
- **Semantic HTML:** Use correct elements -- `<button>` for actions, `<a>` for navigation, `<input>` for data entry.
- **Composition over configuration:** Prefer composing simple components (Card + CardHeader + CardContent) over monolithic components with many props.

---

## Interactive Components

### Button

**Use when:** User needs to trigger an action (submit, save, delete, toggle).

**Don't use when:** Navigating to a new page -- use `<Link>` or Button with `asChild` + `<a>`.

**Variant guidance:**

| Situation | Variant | Why |
|-----------|---------|-----|
| Most buttons (submit, cancel, toggle) | `secondary` (default) | Sparse accent usage matches Raycast |
| Main CTA per section | `primary` | Coral accent draws attention -- limit to one per section |
| Toolbar actions, icon-only buttons | `ghost` | Transparent background keeps toolbar clean |
| Delete, remove, destructive operations | `destructive` | Red signals danger |

**Common patterns:**

- **Button group:** `<div className="flex gap-2">` with all buttons at the same size
- **Loading state:** Set `loading={true}` during async operations; button auto-disables
- **Icon button:** Use `ghost` variant with `size="sm"` and an icon child
- **Link button:** Use `asChild` to wrap an `<a>` or Next.js `<Link>`

```tsx
// Button group pattern
<div className="flex gap-2">
  <Button variant="secondary">Cancel</Button>
  <Button variant="primary">Save Changes</Button>
</div>

// Icon button
<Button variant="ghost" size="sm" aria-label="Close">
  <XIcon className="h-4 w-4" />
</Button>
```

### Input / InputField

**Use Input when:** You need a bare input element within a custom layout.

**Use InputField when:** You need a labeled input with helper text and error messages (most form scenarios).

**Don't use when:** Selecting from a fixed set of options -- use Select or Toggle instead.

**Common patterns:**

- **Form layout:** Stack InputFields with `space-y-4` gap
- **Inline error:** Pass string `error` prop to show error message with `role="alert"`
- **Helper text:** Use `helperText` for input guidance (hidden when error is present)

```tsx
// Standard form pattern
<div className="space-y-4">
  <InputField label="Email" type="email" placeholder="you@example.com" />
  <InputField
    label="Password"
    type="password"
    helperText="Must be at least 8 characters"
    error={errors.password}
  />
</div>
```

### Select / SearchableSelect

**Use Select when:** User must choose from a predefined list of 3-15 options.

**Use SearchableSelect when:** Option list has more than ~8 items and benefits from filtering.

**Don't use when:**
- Fewer than 3 options -- use radio buttons or Toggle
- Free-form text input needed -- use Input with autocomplete
- Multiple selection needed -- use checkboxes

**Variant guidance:**

| Options Count | Component | Why |
|---------------|-----------|-----|
| 2 options | Toggle or radio buttons | Simpler interaction |
| 3-8 options | Select | Manageable list, no search needed |
| 9+ options | SearchableSelect | Type-to-filter improves UX |
| Grouped options | Select or SearchableSelect with groups | Logical categorization |

```tsx
// Grouped select
<Select
  options={[
    { label: "Frontend", options: [
      { value: "react", label: "React" },
      { value: "vue", label: "Vue" },
    ]},
    { label: "Backend", options: [
      { value: "node", label: "Node.js" },
      { value: "python", label: "Python" },
    ]},
  ]}
  placeholder="Select framework..."
/>
```

### Toggle

**Use when:** Binary on/off setting (notifications, dark mode, feature flags).

**Don't use when:**
- Triggering an immediate action (use Button)
- Choosing between more than 2 options (use Select or Tabs)

**Common patterns:**

- **Settings list:** Stack Toggles with labels in a Card
- **Always provide a label:** Either via `label` prop or `aria-label`

```tsx
// Settings pattern
<Card>
  <CardContent className="space-y-4">
    <Toggle label="Enable notifications" />
    <Toggle label="Dark mode" defaultChecked />
    <Toggle label="Auto-save" size="sm" />
  </CardContent>
</Card>
```

### Dialog

**Use when:** User confirmation is required before a destructive action, or for focused forms/settings that overlay the current context.

**Don't use when:**
- Displaying simple information -- use a Card or inline content
- Navigation between views -- use routing
- Non-blocking notifications -- use Toast

**Size guidance:**

| Content Type | Size | Why |
|-------------|------|-----|
| Confirmation prompt | `sm` | Minimal content, quick decision |
| Standard form | `md` (default) | Balanced space for form fields |
| Complex form, settings | `lg` | Room for multiple sections |
| Wide content, tables | `xl` | Extra width for data |
| Full document view | `full` | Maximum space with scroll |

```tsx
// Confirmation dialog pattern
<Dialog>
  <DialogTrigger asChild>
    <Button variant="destructive">Delete Account</Button>
  </DialogTrigger>
  <DialogContent size="sm">
    <DialogHeader>
      <DialogTitle>Are you sure?</DialogTitle>
      <DialogDescription>
        This action cannot be undone.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="secondary">Cancel</Button>
      </DialogClose>
      <Button variant="destructive" onClick={handleDelete}>
        Delete
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Tabs / CategoryTabs

**Use Tabs when:** Switching between content panels within the same page context.

**Use CategoryTabs when:** Filtering content by category with optional icons and counts.

**Don't use when:**
- Navigation between separate pages -- use routing with links
- Fewer than 2 panels -- no tabs needed

```tsx
// Standard tabs
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="analytics">Analytics</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">...</TabsContent>
  <TabsContent value="analytics">...</TabsContent>
</Tabs>

// Category tabs with icons and counts
<CategoryTabs
  categories={[
    { value: "all", label: "All", count: 42 },
    { value: "dev", label: "Developer", icon: <CodeIcon />, count: 18 },
  ]}
  defaultValue="all"
>
  <TabsContent value="all">All items</TabsContent>
  <TabsContent value="dev">Developer items</TabsContent>
</CategoryTabs>
```

---

## Display Components

### Card / GlassCard

**Use Card when:** Content grouping on solid dark backgrounds (page sections, form containers, data panels).

**Use GlassCard when:** Content needs glassmorphism effect over gradient or image backgrounds.

**Don't use either when:**
- Single piece of text or a button -- no container needed
- Full-width page sections -- use semantic HTML sections

**Common patterns:**

- **Compound layout:** Card + CardHeader + CardContent + CardFooter
- **Grid of cards:** `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`
- **Feature showcase:** GlassCard with gradient background blobs behind

```tsx
// Standard card grid
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <Card>
    <CardHeader><Heading level={3}>Feature</Heading></CardHeader>
    <CardContent><Text muted>Description</Text></CardContent>
  </Card>
  {/* More cards... */}
</div>
```

### Badge

**Use when:** Displaying status indicators, labels, counts, or tags.

**Don't use when:**
- Interactive status changes -- use Toggle or Button
- Long text -- badges are for short labels (1-3 words)

**Variant guidance:**

| Status | Variant |
|--------|---------|
| Active, completed, online | `success` |
| Pending, review needed | `warning` |
| Failed, expired, offline | `error` |
| New, informational | `info` |
| General label, tag | `default` |

### Avatar / AvatarGroup

**Use Avatar when:** Displaying a user's profile image or initials.

**Use AvatarGroup when:** Showing multiple users in a compact overlapping stack.

**Don't use when:**
- Generic images (use `<img>`)
- Icons or logos (use Icon or inline SVG)

```tsx
// User profile
<div className="flex items-center gap-3">
  <Avatar src="/photo.jpg" alt="Davide" fallback="DL" size="lg" />
  <div>
    <Text>Davide Loreti</Text>
    <Text muted size="sm">Developer</Text>
  </div>
</div>

// Collaborators list
<AvatarGroup max={4} size="sm">
  {users.map(u => (
    <Avatar key={u.id} src={u.avatar} fallback={u.initials} />
  ))}
</AvatarGroup>
```

### ExtensionCard

**Use when:** Feature cards with gradient glow, icon, and description (marketing pages, extension stores).

**Don't use when:** Generic content cards -- use Card instead.

### TestimonialCard

**Use when:** Customer quotes with attribution (marketing pages, landing pages).

**Don't use when:** General text content -- use Card with custom layout.

---

## Feedback Components

### Toast

**Use when:** Non-blocking feedback after user actions (save success, delete confirmation, error notification).

**Don't use when:**
- Inline form validation -- use InputField `error` prop
- Critical blocking actions -- use Dialog
- Persistent status indicators -- use Badge

**Variant guidance:**

| Situation | Variant |
|-----------|---------|
| General notification | `default` |
| Action succeeded | `success` |
| Action failed | `error` |
| Potential issue, degraded | `warning` |
| Informational update | `info` |

### Spinner

**Use when:** Content is loading or an async operation is in progress.

**Don't use when:**
- Content layout is known (use Skeleton instead for placeholder shapes)
- Brief operations under 300ms (no spinner needed)

```tsx
// In a button
<Button loading>Saving...</Button>

// Standalone
<div className="flex items-center gap-2 text-accent">
  <Spinner size="sm" />
  <Text size="sm">Loading data...</Text>
</div>

// Progress indicator
<Spinner value={uploadProgress} />
```

### Skeleton

**Use when:** Content layout is known but data is loading (text lines, avatars, cards).

**Don't use when:**
- Layout is unknown (use Spinner)
- Content loads instantly (no placeholder needed)

```tsx
// Text skeleton
<div className="space-y-2">
  <Skeleton className="h-4 w-3/4" />
  <Skeleton className="h-4 w-1/2" />
</div>

// Card skeleton
<Skeleton className="h-48 w-full rounded-xl" />
```

---

## Typography Components

### Heading

**Use when:** Section headings that need semantic HTML (h1-h6).

**Don't use when:** Styled text that isn't a heading -- use `Text` with custom classes.

**Level guidance:**

| Level | Size | Use Case |
|-------|------|----------|
| 1 | 64px | Page title (once per page) |
| 2 | 48px | Major sections |
| 3 | 24px | Subsections, card titles |
| 4 | 20px | Minor sections |
| 5 | 18px | Sidebar headings |
| 6 | 16px | Label headings |

### Text / Caption / Code

**Use Text when:** Body paragraphs and general text content.

**Use Caption when:** Small, muted secondary information (timestamps, attribution, hints).

**Use Code when:** Inline code references within text.

```tsx
<Heading level={2}>Getting Started</Heading>
<Text>Install the package using your preferred package manager.</Text>
<Text as="div">
  Run <Code>pnpm add virtuna</Code> in your terminal.
</Text>
<Caption>Last updated 3 hours ago</Caption>
```

---

## Layout Components

### Divider

**Use when:** Visually separating content sections.

**Don't use when:**
- Spacing alone is sufficient (use margin/padding)
- Between every element (use sparingly for clarity)

**Orientation guidance:**

| Layout | Orientation | Example |
|--------|-------------|---------|
| Vertical stack | `horizontal` (default) | Between form sections |
| Horizontal row | `vertical` | Between toolbar items |
| With label | `horizontal` + `label` | "or" separator in auth forms |

---

## Keyboard / Navigation Components

### Kbd / ShortcutBadge

**Use Kbd when:** Displaying a single keyboard key reference.

**Use ShortcutBadge when:** Displaying modifier+key combinations (Cmd+K, Shift+Alt+P).

```tsx
// Inline reference
<Text>Press <Kbd>K</Kbd> to open search.</Text>

// Keyboard shortcut
<div className="flex items-center justify-between">
  <Text size="sm">Search</Text>
  <ShortcutBadge keys={["cmd", "K"]} />
</div>
```

---

## Composition Patterns

### Form Pattern

```tsx
<Card>
  <CardHeader>
    <Heading level={3}>Account Settings</Heading>
    <Text muted size="sm">Update your profile information.</Text>
  </CardHeader>
  <CardContent className="space-y-4">
    <InputField label="Name" placeholder="Your name" />
    <InputField label="Email" type="email" placeholder="you@example.com" />
    <Select
      options={timezones}
      placeholder="Select timezone..."
    />
    <Toggle label="Email notifications" />
  </CardContent>
  <CardFooter className="justify-end gap-2">
    <Button variant="secondary">Cancel</Button>
    <Button variant="primary">Save Changes</Button>
  </CardFooter>
</Card>
```

### Page Header Pattern

```tsx
<div className="space-y-2">
  <Heading level={1}>Dashboard</Heading>
  <Text muted size="lg">Welcome back, Davide.</Text>
</div>
<Divider className="my-8" />
```

### Data Card Pattern

```tsx
<Card>
  <CardContent className="flex items-center gap-4">
    <Avatar src={user.avatar} fallback={user.initials} size="lg" />
    <div className="flex-1">
      <Text className="font-medium">{user.name}</Text>
      <Caption>{user.role} at {user.company}</Caption>
    </div>
    <Badge variant="success">Active</Badge>
  </CardContent>
</Card>
```

### Empty State Pattern

```tsx
<Card>
  <CardContent className="py-12 text-center">
    <Icon icon={InboxIcon} size={48} className="mx-auto text-foreground-muted mb-4" />
    <Heading level={3}>No items yet</Heading>
    <Text muted size="sm" className="mt-2">
      Create your first item to get started.
    </Text>
    <Button variant="primary" className="mt-6">
      Create Item
    </Button>
  </CardContent>
</Card>
```
