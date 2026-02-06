# Phase 47: Results Panel, Top Bar & Loading States - Research

**Researched:** 2026-02-06
**Domain:** Dashboard component migration to design system (GlassCard, GlassProgress, GlassPill, GlassSkeleton, Badge, Typography, Button, Spinner, Toast)
**Confidence:** HIGH

## Summary

This phase migrates three areas of the dashboard to design system components: (1) the results panel with 5 section components (ImpactScore, AttentionBreakdown, VariantsSection, InsightsSection, ThemesSection) plus ShareButton, (2) the top bar with ContextBar, FilterPillGroup, and LegendPills, and (3) the loading state (LoadingPhases). All target design system components already exist and are proven from prior phases. No new libraries are needed.

The existing components use hardcoded `border-zinc-800`, `bg-zinc-900`, `text-zinc-400`, and `bg-emerald-500` classes throughout. The migration replaces these with design system primitives: `GlassCard` for section containers, `GlassProgress` for attention bars, `GlassPill` for filter/legend pills, `GlassSkeleton` for loading placeholders, `Badge` for confidence indicators, `Typography` (`Heading`/`Text`/`Caption`) for text, `Button` for actions, `Spinner` for loading, and the `ui/toast` system for share confirmation. The dashboard-client.tsx orchestrates all three areas and will need updates to wire the new components together.

Two notable integration gaps exist: (1) `ToastProvider` is not yet in the `(app)` layout -- it must be added for the share button's clipboard toast, and (2) the loading state in `test-creation-flow.tsx` uses a bare `Loader2` spinner (not the design system `LoadingPhases` component) and needs to be connected to the skeleton-based loading pattern specified in CONTEXT.md.

**Primary recommendation:** Replace all legacy styled components with design system equivalents, add `ToastProvider` to the app layout, rebuild loading states as skeleton shimmer with progressive reveal, and keep all existing business logic/data flow unchanged. Use design tokens exclusively -- zero hardcoded zinc/emerald/amber colors.

## Standard Stack

### Core (already installed -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Design system primitives (`GlassCard`, `GlassPanel`, `GlassPill`, `GlassProgress`, `GlassSkeleton`) | n/a | Container, pill, progress, skeleton components | Already built and proven in phases 44-46 |
| Design system UI (`Badge`, `Button`, `Typography`, `Spinner`, `Toast`) | n/a | Status badges, actions, text, loading, notifications | Already built, design token compliant |
| `@radix-ui/react-accordion` | ^1.2.7 | Expand/collapse for insights and themes | Already used by `ui/accordion.tsx` (wraps Radix) |
| `zustand` | ^5.0.10 | State management (test-store, society-store) | Already manages simulation flow state |
| `lucide-react` | ^0.563.0 | Icons (Share2, Check, Info, ChevronDown, etc.) | Already used in all app components, icon migration out of scope |
| `class-variance-authority` | ^0.7.1 | Component variant management | Already used across design system |
| `tw-animate-css` | ^1.4.0 | Animation classes (accordion, fade) | Already imported in globals.css |

### Supporting (already available)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `framer-motion` | ^12.29.3 | Smooth transitions for progressive reveal | Skeleton-to-content fade transition during loading |
| `@phosphor-icons/react` | ^2.1.10 | Design system icon library | Only if Phosphor equivalents exist for used Lucide icons |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `GlassProgress` for attention bars | Raw div progress bars | GlassProgress provides consistent glow, coral/blue/green colors, and accessibility attributes for free |
| `GlassSkeleton` for loading | Custom shimmer divs | GlassSkeleton already has shimmer animation, shape variants, and composable layout helpers (`SkeletonText`, `SkeletonCard`) |
| `ui/toast` for share confirmation | `useState` + inline "Copied!" text (current pattern) | Toast system provides proper notification UX, auto-dismiss, accessibility (aria-live); current pattern is inline-only |
| `framer-motion AnimatePresence` for progressive reveal | CSS `@keyframes` + `opacity` transition | framer-motion handles mount/unmount animations cleanly with `AnimatePresence`; CSS-only approach is simpler but less composable |

**Installation:** No new packages needed. Everything is already installed.

## Architecture Patterns

### Recommended Component Structure

```
src/components/app/simulation/
  results-panel.tsx          # MIGRATE: zinc container -> GlassPanel/GlassCard wrapper with section cards
  impact-score.tsx           # MIGRATE: raw text -> GlassCard + Typography + coral accent color
  attention-breakdown.tsx    # MIGRATE: raw divs -> GlassCard + GlassProgress horizontal bars
  variants-section.tsx       # MIGRATE: zinc cards -> GlassCard + Typography + Badge
  insights-section.tsx       # MIGRATE: raw paragraphs -> GlassCard + expandable rows
  themes-section.tsx         # MIGRATE: raw buttons -> GlassCard + Accordion items
  share-button.tsx           # MIGRATE: raw button + useState -> Button ghost + useToast
  loading-phases.tsx         # REWRITE: phase checklist -> skeleton shimmer layout with progressive reveal

src/components/app/
  context-bar.tsx            # MIGRATE: raw pill -> GlassPill with colored dot
  filter-pills.tsx           # MIGRATE: raw buttons -> GlassPill with colored dot indicator
  legend-pills.tsx           # MIGRATE: raw buttons -> GlassPill with colored dot indicator

src/app/(app)/
  layout.tsx                 # ADD: ToastProvider wrapper
  dashboard/
    dashboard-client.tsx     # UPDATE: wire new loading skeleton, update top bar layout
```

### Pattern 1: Results Section Card Migration

**What:** Each results section (ImpactScore, AttentionBreakdown, etc.) becomes a `GlassCard` with `Typography` components for text.

**When to use:** Every section in the results panel.

**Before (current):**
```tsx
<div className="space-y-2">
  <div className="flex items-center gap-2">
    <h3 className="text-sm font-medium text-zinc-400">Impact Score</h3>
    <Info className="h-4 w-4 text-zinc-500" />
  </div>
  <span className="text-6xl font-bold text-emerald-400">{score}</span>
</div>
```

**After (design system):**
```tsx
<GlassCard padding="md" hover="lift">
  <div className="flex items-center gap-2 mb-2">
    <Text size="sm" muted>Impact Score</Text>
    <Info className="h-4 w-4 text-foreground-muted" />
  </div>
  <Caption>{label}</Caption>
  <div className="flex items-baseline gap-1">
    <span className="text-6xl font-bold text-accent">{score}</span>
    <Text as="span" muted>/100</Text>
  </div>
</GlassCard>
```

**Key token mappings:**
| Legacy Class | Design System Token/Component |
|-------------|-------------------------------|
| `text-zinc-400` | `text-foreground-secondary` or `<Text muted>` |
| `text-zinc-500` | `text-foreground-muted` or `<Caption>` |
| `text-white` | `text-foreground` or `<Text>` |
| `text-emerald-400` / score colors | `text-accent` (coral) for impact score per CONTEXT.md |
| `border-zinc-800` | `border-border` |
| `bg-zinc-900` | `bg-surface` |
| `bg-zinc-800/50` | `bg-surface-elevated` |
| `rounded-2xl border border-zinc-800 bg-zinc-900` | `<GlassCard>` (handles all three) |
| `text-sm font-medium` heading | `<Text size="sm">` with section header role |

### Pattern 2: Attention Breakdown with GlassProgress Bars

**What:** Replace the stacked color bar and manual legend with individual `GlassProgress` horizontal bars for each attention metric.

**CONTEXT.md decision:** "AttentionBreakdown uses GlassProgress horizontal bars for each attention metric (not a segmented bar)"

**Before (current):**
```tsx
{/* Single stacked bar with 3 colored segments */}
<div className="flex h-3 w-full overflow-hidden rounded-full">
  <div className="bg-red-500" style={{ width: `${attention.full}%` }} />
  <div className="bg-amber-400" style={{ width: `${attention.partial}%` }} />
  <div className="bg-zinc-600" style={{ width: `${attention.ignore}%` }} />
</div>
```

**After (design system):**
```tsx
<GlassCard padding="md" hover="lift">
  <Text size="sm" muted className="mb-4">Attention Breakdown</Text>
  <div className="space-y-4">
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <Text size="sm">Full Attention</Text>
        <Text size="sm" className="font-medium">{attention.full}%</Text>
      </div>
      <GlassProgress value={attention.full} color="coral" size="md" />
    </div>
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <Text size="sm">Partial</Text>
        <Text size="sm" className="font-medium">{attention.partial}%</Text>
      </div>
      <GlassProgress value={attention.partial} color="blue" size="md" />
    </div>
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <Text size="sm">Ignored</Text>
        <Text size="sm" className="font-medium">{attention.ignore}%</Text>
      </div>
      <GlassProgress value={attention.ignore} color="purple" size="md" />
    </div>
  </div>
</GlassCard>
```

**GlassProgress API (already built):**
- `value`: 0-100 percentage
- `color`: "coral" | "blue" | "green" | "purple" (uses CSS variables)
- `size`: "sm" (h-1) | "md" (h-2) | "lg" (h-3)
- `showLabel`: boolean (optional percentage text)
- Glow effect on fill bar (box-shadow with color-matched glow)
- Animated width transition via `var(--duration-normal) var(--ease-out)`

### Pattern 3: Filter/Legend Pills with GlassPill + Colored Dot

**What:** Replace raw filter buttons with `GlassPill` components. Each pill has a small colored dot indicator and toggleable active/inactive states.

**CONTEXT.md decision:** "Filter/legend pills use neutral glass style (GlassPill) with a small colored dot or left border to indicate category -- not tinted backgrounds"

**Before (current FilterPill):**
```tsx
<button className={cn(
  "flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm",
  active ? "border-zinc-600 bg-zinc-800/50 text-white"
         : "border-zinc-800 bg-zinc-900/50 text-zinc-400"
)}>
  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
  {label}
</button>
```

**After (design system):**
```tsx
<GlassPill
  color="neutral"
  size="md"
  variant="outline"
  active={isActive}
  onClick={() => onToggle(id)}
>
  <span
    className={cn("h-2 w-2 rounded-full shrink-0", !isActive && "opacity-40")}
    style={{ backgroundColor: dotColor }}
    aria-hidden="true"
  />
  {label}
</GlassPill>
```

**GlassPill API (already built):**
- `color`: "neutral" (for these pills per CONTEXT.md -- no tinted backgrounds)
- `active`: boolean (brighter background, ring indicator)
- `onClick`: makes it a `<button>`, toggleable
- `variant`: "subtle" | "solid" | "outline" -- use "outline" for border visibility
- `size`: "sm" | "md" | "lg"

**ContextBar migration:** Simple -- replace the raw div/span with a single `GlassPill` containing the colored dot + location text. No interactive behavior needed (display-only).

### Pattern 4: Skeleton Loading with Progressive Reveal

**What:** Replace the current `LoadingPhases` (phase checklist + progress bar) with skeleton shimmer placeholders matching the final results layout. Each section fades in from skeleton to real content as data becomes ready.

**CONTEXT.md decisions:**
- "Skeleton shimmer placeholders in the shape of the final stacked-card layout"
- "No separate progress bar or percentage -- skeletons alone convey loading"
- "Progressive reveal: each section fades in from skeleton to real content as it becomes ready"
- "Visible cancel button below the skeleton area"

**Components to use:**
- `GlassSkeleton` (primitives): shape="text"|"rectangle", shimmer animation built-in
- `SkeletonText`: multiple line text placeholder (lines prop, lastLineWidth)
- `SkeletonCard`: card with avatar + text placeholder
- `GlassCard`: wrapping container for each skeleton section
- `Button` secondary: cancel button below skeleton area
- `framer-motion AnimatePresence`: fade transition from skeleton to real content

**Skeleton layout pattern (mirrors final stacked-card results):**
```tsx
function ResultsSkeleton() {
  return (
    <div className="space-y-4">
      {/* ImpactScore skeleton */}
      <GlassCard padding="md">
        <GlassSkeleton width="120px" height="14px" />
        <GlassSkeleton width="80px" height="12px" className="mt-2" />
        <GlassSkeleton width="160px" height="48px" className="mt-3" />
      </GlassCard>

      {/* AttentionBreakdown skeleton */}
      <GlassCard padding="md">
        <GlassSkeleton width="160px" height="14px" />
        <div className="mt-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <GlassSkeleton width="100px" />
                <GlassSkeleton width="40px" />
              </div>
              <GlassSkeleton shape="rectangle" height={8} />
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Variants skeleton */}
      <GlassCard padding="md">
        <GlassSkeleton width="80px" height="14px" />
        <div className="mt-3 space-y-2">
          {[1, 2].map((i) => (
            <GlassSkeleton key={i} shape="rectangle" height={64} />
          ))}
        </div>
      </GlassCard>

      {/* Insights skeleton */}
      <GlassCard padding="md">
        <GlassSkeleton width="80px" height="14px" />
        <SkeletonText lines={3} className="mt-3" />
      </GlassCard>

      {/* Themes skeleton */}
      <GlassCard padding="md">
        <GlassSkeleton width="120px" height="14px" />
        <div className="mt-3 space-y-2">
          {[1, 2].map((i) => (
            <GlassSkeleton key={i} shape="rectangle" height={48} />
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
```

**Progressive reveal pattern (framer-motion):**
```tsx
import { AnimatePresence, motion } from "framer-motion";

function RevealSection({
  isLoaded,
  skeleton,
  children,
}: {
  isLoaded: boolean;
  skeleton: ReactNode;
  children: ReactNode;
}) {
  return (
    <AnimatePresence mode="wait">
      {isLoaded ? (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      ) : (
        <motion.div
          key="skeleton"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {skeleton}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

**Store integration:** The current `test-store` has `simulationPhase` tracking (analyzing -> matching -> simulating -> generating). Map these phases to section readiness:
- `analyzing` complete: ImpactScore section ready
- `matching` complete: AttentionBreakdown ready
- `simulating` complete: Variants ready
- `generating` complete: Insights + Themes ready

### Pattern 5: Share Button with Toast Notification

**What:** Replace the current inline "Copied!" feedback with the design system `useToast` hook for a proper toast notification.

**CONTEXT.md decision:** "Share button copies link to clipboard with a brief toast confirmation"

**Before (current):**
```tsx
const [copied, setCopied] = useState(false);
const handleShare = async () => {
  await navigator.clipboard.writeText(shareUrl);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};
// Inline "Copied!" text in button
```

**After (design system):**
```tsx
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ShareButton({ resultId }: ShareButtonProps) {
  const { toast } = useToast();

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/results/${resultId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ variant: "success", title: "Link copied to clipboard" });
    } catch {
      toast({ variant: "error", title: "Failed to copy link" });
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleShare}>
      <Share2 className="h-4 w-4" />
      Share
    </Button>
  );
}
```

**Prerequisite:** `ToastProvider` must wrap the app layout. Currently NOT present in `src/app/(app)/layout.tsx`.

### Pattern 6: Expandable Insight/Theme Rows

**What:** Insights and Themes have expandable items. Each item is a row that expands to show detail on click.

**CONTEXT.md decision:** "Insights and Themes sections have expandable items: each insight/theme is a row that expands to show longer detail on click"

**Implementation options (Claude's Discretion):**

**Option A: Radix Accordion (recommended)**
The `ui/accordion.tsx` already wraps Radix Accordion with animation. ThemesSection already uses a manual expand/collapse pattern -- migrate to Accordion for consistency.

```tsx
import { AccordionRoot, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

<GlassCard padding="md" hover="lift">
  <Text size="sm" muted className="mb-3">Conversation Themes</Text>
  <AccordionRoot type="single" collapsible>
    {themes.map((theme) => (
      <AccordionItem key={theme.id} value={theme.id}>
        <AccordionTrigger>
          <div className="flex items-center gap-2">
            <Text size="sm" className="font-medium">{theme.title}</Text>
            <Caption>~{theme.percentage}%</Caption>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <Text size="sm" muted>{theme.description}</Text>
          {theme.quotes.map((quote, i) => (
            <blockquote key={i} className="mt-2 border-l-2 border-border pl-3">
              <Text size="sm" muted className="italic">&ldquo;{quote}&rdquo;</Text>
            </blockquote>
          ))}
        </AccordionContent>
      </AccordionItem>
    ))}
  </AccordionRoot>
</GlassCard>
```

The Accordion component already has:
- `animate-accordion-down` / `animate-accordion-up` keyframes (in globals.css)
- Caret rotation on open (via `[data-state=open]>svg` selector)
- Height animation on content reveal/hide
- Keyboard accessibility (Enter/Space to toggle, Up/Down to navigate)

### Anti-Patterns to Avoid

- **Hardcoded zinc/emerald/amber colors:** No `bg-zinc-900`, `text-zinc-400`, `bg-emerald-500`. Use design tokens: `bg-surface`, `text-foreground-secondary`, `text-accent`.
- **Double glass layers:** Don't nest `GlassCard` inside `GlassPanel` or another `GlassCard`. Each results section is ONE GlassCard -- the results panel wrapper should be a plain div or a single GlassPanel.
- **Using primitives/GlassToast instead of ui/toast:** Two toast systems exist. Use `ui/toast` (design system, consistent semantic tokens) not `primitives/GlassToast`.
- **Keeping the phase checklist loading UI:** CONTEXT.md explicitly says "skeleton shimmer placeholders" and "no separate progress bar." The LoadingPhases component with its checklist + progress bar must be fully replaced.
- **Manual shimmer animation:** Don't write custom `@keyframes shimmer`. Use `GlassSkeleton` which already has `animate-shimmer` with the correct timing (2s ease-in-out infinite).
- **Breaking simulation flow state:** The test-store manages `currentStatus` ('idle' | 'selecting-type' | 'filling-form' | 'simulating' | 'viewing-results') and `simulationPhase`. Don't change these enums or the flow -- only change what renders for each state.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Skeleton loading placeholders | Custom shimmer divs with `@keyframes` | `GlassSkeleton` + `SkeletonText` + `SkeletonCard` | Already has shimmer animation, shape variants, correct opacity |
| Progress bars for attention metrics | Raw div with percentage width | `GlassProgress` | Glow effect, color variants, accessibility roles, animated transitions |
| Pill/tag components for filters | Raw buttons with manual styling | `GlassPill` | Active/inactive states, size variants, interactive/static modes |
| Toast notification for share | `useState` + `setTimeout` for "Copied!" | `useToast` from `ui/toast` | Auto-dismiss, pause on hover, slide animation, accessibility |
| Expand/collapse for themes/insights | Manual `useState` + conditional render | Radix `Accordion` via `ui/accordion` | Height animation, keyboard navigation, ARIA attributes |
| Section container with glass effect | Manual `border border-zinc-800 bg-zinc-900 rounded-2xl` | `GlassCard` | Consistent glass styling, hover effects, design token compliant |

**Key insight:** Every visual pattern in this migration has a direct design system equivalent. The migration is a 1:1 replacement operation. The only new construction is the skeleton loading layout (composing existing `GlassSkeleton` primitives into a results-shaped placeholder) and wiring progressive reveal with `AnimatePresence`.

## Common Pitfalls

### Pitfall 1: ToastProvider Missing from App Layout

**What goes wrong:** `useToast()` throws "must be used within ToastProvider" when ShareButton tries to show clipboard toast.

**Why it happens:** `ToastProvider` is only used in the showcase demo, not in the `(app)` layout. The share button migration needs it.

**How to avoid:** Add `ToastProvider` to `src/app/(app)/layout.tsx` wrapping the `AppShell`. This is a one-line wrapper addition.

**Warning signs:** Runtime error from `useToast()` hook in share-button component.

### Pitfall 2: Double Glass Layers in Results Panel

**What goes wrong:** The results panel wrapper (`results-panel.tsx`) is currently a `rounded-2xl border border-zinc-800 bg-zinc-900` container. If migrated to `GlassPanel` AND each section inside also uses `GlassCard`, you get nested glass layers with doubled blur and visual muddiness.

**Why it happens:** CONTEXT.md says "each section is its own GlassCard." The outer container should NOT also be glass.

**How to avoid:** Make the results panel wrapper a plain `<div>` with `space-y-4` for vertical spacing. Only the individual section cards are `GlassCard`. The sticky header/footer in the current results-panel.tsx should use `bg-background/95` (opaque) not glass.

**Warning signs:** Blurry/muddy appearance when results panel renders. More than 2 glass elements stacked vertically (violates mobile backdrop-filter budget).

### Pitfall 3: Backdrop-Filter Budget on Mobile

**What goes wrong:** Each `GlassCard` creates a compositing layer with `backdrop-filter`. 5 result section cards + sidebar = 6 backdrop-filter elements. Mobile performance degrades.

**Why it happens:** MOBL-03 decision: "max 2 glass elements." The sidebar already uses one.

**How to avoid:** Use `GlassCard` WITHOUT blur on mobile for result sections. The `GlassPanel` inside `GlassCard` accepts `blur` prop -- set it to `"none"` on mobile via a responsive approach, or apply `backdrop-filter: none` on `@media (max-width: 768px)`. Alternatively, since result cards need Raycast hover (translate-y-0.5, border brightens) but don't strictly need blur, consider using `GlassCard` with the blur prop set to `"none"` or `"xs"` to reduce GPU cost.

**Warning signs:** Jank or low FPS when scrolling results panel on mobile Safari.

### Pitfall 4: Lightning CSS Strips backdrop-filter from Utility Classes

**What goes wrong:** `backdrop-blur-*` utility classes compile to empty rules via Lightning CSS (Tailwind v4).

**Why it happens:** Known project issue documented in MEMORY.md and STATE.md. GlassPanel already works around this with inline styles.

**How to avoid:** Use `GlassCard` / `GlassPanel` which apply backdrop-filter via inline `style={{ backdropFilter: 'blur(Xpx)', WebkitBackdropFilter: 'blur(Xpx)' }}`. Never use `backdrop-blur-*` Tailwind classes directly.

**Warning signs:** Glass cards appearing without any blur effect.

### Pitfall 5: Simulation Phase Mapping for Progressive Reveal

**What goes wrong:** The progressive reveal pattern needs to know which sections are "ready" as simulation progresses. The current store has 4 phases but only transitions between them at fixed intervals (1 second each). Mapping phases to sections incorrectly causes wrong sections to reveal.

**Why it happens:** The `test-store.ts` `submitTest` function sets phases sequentially: analyzing (0-25%) -> matching (25-50%) -> simulating (50-75%) -> generating (75-100%). But the data model populates ALL fields at once when simulation completes.

**How to avoid:** Two approaches:
1. **Simple (recommended):** Keep the store as-is. Map phases to section "readiness" purely for visual effect -- sections reveal in sequence but data still arrives all at once. This is a UI-only progressive reveal.
2. **Complex (not needed):** Refactor store to populate sections incrementally.

Use approach 1. The progressive reveal is purely visual animation. When `simulationPhase` changes, mark the corresponding section as "visually ready" and fade it from skeleton to placeholder content until real data arrives.

**Warning signs:** Trying to refactor the test-store's submitTest to return partial data.

### Pitfall 6: Test Creation Flow Has Inline SimulationResultsPanel

**What goes wrong:** `test-creation-flow.tsx` contains an inline `SimulationResultsPanel` component (lines 160-258) that duplicates results display logic. If only `simulation/results-panel.tsx` is migrated, the flow orchestrator still shows the legacy version.

**Why it happens:** Two places render results: (1) `dashboard-client.tsx` uses `<ResultsPanel>` from `simulation/results-panel.tsx`, and (2) `test-creation-flow.tsx` has its own inline `SimulationResultsPanel`.

**How to avoid:** Migrate BOTH locations. The `dashboard-client.tsx` already uses the separate `ResultsPanel` component. The `test-creation-flow.tsx` inline component should be replaced with the migrated `ResultsPanel` or removed if `dashboard-client.tsx` is the only active consumer. Check which code path is actually used in production (dashboard-client is the main page; test-creation-flow appears to be an older orchestrator).

**Warning signs:** One results view looks migrated, the other still shows zinc colors.

### Pitfall 7: GlassPill Active State vs Colored Dot

**What goes wrong:** `GlassPill` has an `active` prop that changes the background opacity. But the CONTEXT.md says "neutral glass style with a small colored dot." If you use `GlassPill` with `color="neutral"`, the active state brightens the neutral background, which is correct. But the colored dot must be added as a child element, not as the pill's color prop.

**Why it happens:** `GlassPill`'s `color` prop controls the background tint, not a dot indicator. The dot indicator is a separate visual element.

**How to avoid:** Always use `color="neutral"` for filter/legend pills. Add the colored dot as a child `<span>` inside the pill. Use the `active` prop to toggle visual state (brighter vs dimmer).

**Warning signs:** Tinted pill backgrounds instead of neutral glass + colored dots.

### Pitfall 8: Results Panel Sticky Header/Footer Conflicts with GlassCard

**What goes wrong:** The current results-panel.tsx has `sticky top-0` header and `sticky bottom-0` footer inside a scrollable container. If the container becomes a flex column of GlassCards, the sticky positioning may not work correctly within the new layout.

**How to avoid:** Keep the results panel as a scrollable container (`max-h-[70vh] overflow-y-auto`). The header (title + share button) and footer (run another test button) remain sticky with `bg-background/95 backdrop-blur` (NOT glass). Only the content sections between header and footer are individual GlassCards.

**Warning signs:** Sticky header/footer not sticking, or overlapping with GlassCard borders.

## Code Examples

### Example 1: ImpactScore Card Migration

```tsx
// AFTER migration
import { GlassCard } from "@/components/primitives";
import { Text, Caption } from "@/components/ui/typography";
import { Info } from "lucide-react";
import type { ImpactLabel } from "@/types/test";

interface ImpactScoreProps {
  score: number;
  label: ImpactLabel;
}

export function ImpactScore({ score, label }: ImpactScoreProps) {
  return (
    <GlassCard padding="md" hover="lift">
      <div className="flex items-center gap-2 mb-2">
        <Text size="sm" muted>Impact Score</Text>
        <Info className="h-4 w-4 text-foreground-muted" />
      </div>
      <Caption className="text-accent">{label}</Caption>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-6xl font-bold text-accent">{score}</span>
        <Text as="span" size="lg" muted>/100</Text>
      </div>
    </GlassCard>
  );
}
```

### Example 2: ShareButton with Toast

```tsx
// AFTER migration
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Share2 } from "lucide-react";

interface ShareButtonProps {
  resultId: string;
}

export function ShareButton({ resultId }: ShareButtonProps) {
  const { toast } = useToast();

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/results/${resultId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ variant: "success", title: "Link copied to clipboard" });
    } catch {
      toast({ variant: "error", title: "Failed to copy link" });
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleShare}>
      <Share2 className="h-4 w-4" />
      Share
    </Button>
  );
}
```

### Example 3: FilterPill Migration

```tsx
// AFTER migration
import { GlassPill } from "@/components/primitives";
import { cn } from "@/lib/utils";

interface FilterPillProps {
  label: string;
  dotColor: string;
  active: boolean;
  onClick: () => void;
}

export function FilterPill({ label, dotColor, active, onClick }: FilterPillProps) {
  return (
    <GlassPill
      color="neutral"
      size="md"
      variant="outline"
      active={active}
      onClick={onClick}
    >
      <span
        className={cn("h-2 w-2 rounded-full shrink-0", !active && "opacity-40")}
        style={{ backgroundColor: dotColor }}
        aria-hidden="true"
      />
      {label}
    </GlassPill>
  );
}
```

### Example 4: Skeleton Loading Layout

```tsx
// New loading-skeleton component
import { GlassCard } from "@/components/primitives";
import { GlassSkeleton, SkeletonText } from "@/components/primitives/GlassSkeleton";
import { Button } from "@/components/ui/button";

interface LoadingSkeletonProps {
  onCancel: () => void;
}

export function LoadingSkeleton({ onCancel }: LoadingSkeletonProps) {
  return (
    <div className="space-y-4">
      {/* ImpactScore skeleton */}
      <GlassCard padding="md">
        <GlassSkeleton width="120px" />
        <GlassSkeleton width="80px" className="mt-2" />
        <GlassSkeleton width="160px" height="48px" className="mt-3" />
      </GlassCard>

      {/* AttentionBreakdown skeleton */}
      <GlassCard padding="md">
        <GlassSkeleton width="160px" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <GlassSkeleton key={i} shape="rectangle" height={8} />
          ))}
        </div>
      </GlassCard>

      {/* Variants skeleton */}
      <GlassCard padding="md">
        <GlassSkeleton width="80px" />
        <div className="mt-3 space-y-2">
          <GlassSkeleton shape="rectangle" height={56} />
          <GlassSkeleton shape="rectangle" height={56} />
        </div>
      </GlassCard>

      {/* Insights + Themes skeleton */}
      <GlassCard padding="md">
        <GlassSkeleton width="80px" />
        <SkeletonText lines={3} className="mt-3" />
      </GlassCard>

      {/* Cancel button */}
      <Button variant="secondary" onClick={onCancel} className="w-full">
        Cancel
      </Button>
    </div>
  );
}
```

### Example 5: Progressive Reveal Wrapper

```tsx
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

interface ProgressiveRevealProps {
  isReady: boolean;
  skeleton: ReactNode;
  children: ReactNode;
}

export function ProgressiveReveal({ isReady, skeleton, children }: ProgressiveRevealProps) {
  return (
    <AnimatePresence mode="wait">
      {isReady ? (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.215, 0.61, 0.355, 1] }}
        >
          {children}
        </motion.div>
      ) : (
        <motion.div
          key="skeleton"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {skeleton}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

## State of the Art

| Old Approach (current codebase) | Current Approach (target) | Impact |
|--------------------------------|---------------------------|--------|
| `border-zinc-800 bg-zinc-900 rounded-2xl` containers | `<GlassCard>` design system component | Consistent glass styling, hover effects, design token compliant |
| Raw `<div>` progress bars with inline width | `<GlassProgress>` with color, size, glow | Accessibility attributes, animated transitions, glow effect |
| Raw buttons with manual active/inactive styling | `<GlassPill>` with active prop | Consistent toggle behavior, glass styling, keyboard accessible |
| Phase checklist + progress bar for loading | `<GlassSkeleton>` shimmer + progressive reveal | Modern loading UX, matches final layout shape |
| `useState` + `setTimeout` for "Copied!" | `useToast()` notification | Auto-dismiss, accessibility, consistent UX |
| Hardcoded color classes (`text-zinc-400`, `bg-emerald-500`) | Semantic tokens (`text-foreground-secondary`, `text-accent`) | Theme-able, maintainable, design system compliant |
| Manual expand/collapse with `useState` + conditional render | Radix `Accordion` via `ui/accordion` | Height animation, keyboard nav, ARIA support |

**Deprecated/outdated patterns being removed:**
- `bg-zinc-900`, `border-zinc-800`, `text-zinc-400`: Replaced by design tokens
- `bg-emerald-500`, `bg-amber-400`, `bg-red-500` for attention: Replaced by `GlassProgress` colors
- `LoadingPhases` checklist UI: Replaced by skeleton shimmer pattern
- Inline "Copied!" state management in ShareButton: Replaced by toast system
- `SimulationResultsPanel` inline component in `test-creation-flow.tsx`: Replaced by migrated `ResultsPanel`

## Open Questions

1. **GlassCard blur on mobile -- how aggressive to optimize?**
   - What we know: MOBL-03 says max 2 glass elements. Sidebar uses 1. Five result cards would exceed budget.
   - What's unclear: Should result cards use `blur="none"` on mobile, or should the entire results panel be a single GlassPanel with non-glass children?
   - **Recommendation:** Set GlassCard blur to `"none"` for result sections on mobile (>768px keeps blur). The visual difference is minimal on dark backgrounds, and performance is preserved. Alternatively, use a single GlassPanel wrapper on mobile and plain divs for sections.

2. **ContextBar location display -- keep as pill or change to text?**
   - What we know: Currently a small pill with green dot + "Switzerland" text. CONTEXT.md says "Claude's Discretion" for ContextBar display format.
   - What's unclear: Whether it should remain a pill or become inline text with Typography.
   - **Recommendation:** Keep as a `GlassPill` with colored dot -- matches the filter pill visual language and is already compact. Use `GlassPill color="neutral"` with green dot child.

3. **Variants section layout -- side-by-side or stacked?**
   - What we know: CONTEXT.md says "Claude's Discretion: choose between side-by-side columns or stacked rows based on existing data structure."
   - What's unclear: Existing data has `type: 'original' | 'ai-generated'` with variable count of variants.
   - **Recommendation:** Keep stacked rows (current layout). The data is a variable-length array, and side-by-side comparison would require exactly 2 items. Stacked rows work for any number of variants and are already proven. Each variant becomes a row inside a single GlassCard.

4. **test-creation-flow.tsx inline SimulationResultsPanel -- remove or keep?**
   - What we know: `dashboard-client.tsx` is the active page component and uses `<ResultsPanel>` from `simulation/results-panel.tsx`. The `test-creation-flow.tsx` has its own inline version.
   - What's unclear: Is `test-creation-flow.tsx` still used as an alternative entry point?
   - **Recommendation:** Check if `test-creation-flow.tsx` is imported anywhere besides the barrel export. If not actively used in any page, the inline `SimulationResultsPanel` can be replaced with a reference to the shared `ResultsPanel`. If it IS used, migrate both.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/components/primitives/GlassCard.tsx` -- GlassCard API (color, tinted, glow, hover, padding)
- Codebase analysis: `src/components/primitives/GlassProgress.tsx` -- GlassProgress API (value, color, size, showLabel, circular/linear)
- Codebase analysis: `src/components/primitives/GlassPill.tsx` -- GlassPill API (color, active, onClick, variant, size)
- Codebase analysis: `src/components/primitives/GlassSkeleton.tsx` -- GlassSkeleton + SkeletonText + SkeletonCard
- Codebase analysis: `src/components/ui/toast.tsx` -- ToastProvider + useToast API
- Codebase analysis: `src/components/ui/typography.tsx` -- Heading, Text, Caption, Code
- Codebase analysis: `src/components/ui/badge.tsx` -- Badge variants (default, success, warning, error, info, accent)
- Codebase analysis: `src/components/ui/button.tsx` -- Button variants (primary, secondary, ghost, destructive) + loading prop
- Codebase analysis: `src/components/ui/accordion.tsx` -- AccordionRoot, AccordionItem, AccordionTrigger, AccordionContent
- Codebase analysis: `src/components/app/simulation/` -- All 7 legacy components to migrate
- Codebase analysis: `src/components/app/context-bar.tsx`, `filter-pills.tsx`, `legend-pills.tsx` -- Legacy top bar components
- Codebase analysis: `src/app/(app)/dashboard/dashboard-client.tsx` -- Main dashboard page composition
- Codebase analysis: `src/stores/test-store.ts` -- Simulation phase flow and state management
- Codebase analysis: `src/app/globals.css` -- Shimmer animation, design tokens, keyframes

### Secondary (MEDIUM confidence)
- Prior phase research: `46-RESEARCH.md` -- Established migration patterns (Dialog, Button, GlassInput migration approach)
- framer-motion `AnimatePresence` -- Used in existing codebase (ViralResultsCard) for mount/unmount animations

### Tertiary (LOW confidence)
- Mobile backdrop-filter budget enforcement strategy -- no automated check exists; relies on manual counting

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All components already built and proven in phases 44-46, zero new dependencies
- Architecture: HIGH -- Clear 1:1 replacement mapping for every component, patterns established in phase 46
- Pitfalls: HIGH -- All pitfalls identified from direct codebase analysis (ToastProvider missing, double glass, mobile blur budget, Lightning CSS, inline SimulationResultsPanel duplicate)
- Loading state: MEDIUM -- Skeleton shimmer + progressive reveal is a new composition pattern (not a replacement), but all building blocks exist

**Research date:** 2026-02-06
**Valid until:** 2026-03-08 (stable -- no moving dependencies, all components built)
