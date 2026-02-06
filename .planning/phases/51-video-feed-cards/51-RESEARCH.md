# Phase 51: Video Feed & Cards - Research

**Researched:** 2026-02-05
**Domain:** React component composition, responsive grid, infinite scroll, v0 MCP workflow
**Confidence:** HIGH

## Summary

Phase 51 requires building a VideoCard component and assembling it into a responsive infinite-scroll grid. The existing codebase provides all the building blocks: `GlassCard` (with hover="lift"), `GlassPill` (for category tags), `HoverScale` (motion wrapper), `Skeleton` (loading placeholders), `StaggerReveal` (grid animation), and `FadeIn`/`FadeInUp` (entrance animations). The mock data layer is complete with 42 videos, `getVideosByCategory()`, and the `TrendingVideo` type.

The v0 MCP (`mcp__v0__v0_generate_ui`) should be used to design the VideoCard visual layout and the empty state. Manual coding is better for the infinite scroll hook, data wiring, state management, and the responsive grid skeleton. After v0 generates the visual design, replace its approximations (shadcn Card, raw Tailwind colors) with actual design system imports (GlassCard, GlassPill, HoverScale, Typography, Skeleton).

**Primary recommendation:** Use `react-intersection-observer` for the infinite scroll sentinel, compose VideoCard from existing GlassCard + HoverScale + GlassPill primitives, and design the card layout in v0 before integrating.

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `motion` | 12.29.2 | HoverScale spring animation, StaggerReveal grid entrance | Already powering all motion components in the project |
| `@radix-ui/react-dialog` | 1.1.15 | Dialog primitive for the detail modal (Phase 52 wire-up) | Already installed, used by existing Dialog component |
| `lucide-react` | 0.563.0 | Icons (TrendingUp, Flame, RotateCcw, Eye, Heart, Share2, ArrowUp, ArrowDown) | Already used in trending-client.tsx |
| Next.js `Image` | 16.1.5 | Optimized thumbnail loading with lazy loading | Built into the framework, automatic optimization |

### New Dependency Required

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-intersection-observer` | ^3.x | `useInView` hook for infinite scroll sentinel | Scroll-triggered loading of next batch |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-intersection-observer` | Native `IntersectionObserver` API | Library adds ref management, SSR safety, cleanup, reduced-motion respect; native API requires manual boilerplate |
| `react-intersection-observer` | `react-infinite-scroll-hook` | More abstracted but less flexible; intersection-observer is more widely used (89.9 benchmark score on Context7) |
| `react-window` / virtualization | CSS grid with limited render | 42 videos max per category (14 each) -- too small to justify virtual scrolling complexity |

**Installation:**
```bash
pnpm add react-intersection-observer
```

### Next.js Image Configuration Required

The mock data uses `picsum.photos` for thumbnails. The `next.config.ts` needs `remotePatterns` for `picsum.photos`:

```typescript
const nextConfig: NextConfig = {
  transpilePackages: ['three'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'fastly.picsum.photos',
      },
    ],
  },
};
```

## Architecture Patterns

### Recommended File Structure

```
src/
├── components/
│   └── trending/
│       ├── video-card.tsx           # VideoCard component
│       ├── video-card-skeleton.tsx   # Skeleton loading placeholder
│       ├── video-grid.tsx           # Responsive grid + infinite scroll
│       ├── velocity-indicator.tsx   # Trending velocity badge (arrow + multiplier)
│       └── empty-state.tsx          # No results state (extract from trending-client)
├── hooks/
│   └── use-infinite-videos.ts       # Custom hook: pagination + intersection observer
└── app/(app)/trending/
    └── trending-client.tsx          # Updated to use VideoGrid instead of VideoPlaceholder
```

### Pattern 1: VideoCard Composition from Design System Primitives

**What:** Compose VideoCard from existing primitives rather than building from scratch.
**When to use:** Always -- the design system exists precisely for this purpose.

```tsx
// Composition hierarchy:
// HoverScale > GlassCard(hover="lift", color="orange") > content layout
//   - Next.js Image for thumbnail (portrait 400x500)
//   - Creator info row (avatar + handle + date)
//   - Title text
//   - GlassPill for category tag
//   - VelocityIndicator for trending speed
//   - View count + engagement metrics
```

### Pattern 2: Infinite Scroll with useInView Sentinel

**What:** Place an invisible sentinel element at the bottom of the grid. When it enters the viewport, load the next batch.
**When to use:** For paginated content loading without explicit "Load More" buttons.

```tsx
import { useInView } from 'react-intersection-observer';

function useInfiniteVideos(category: TrendingCategory, pageSize = 6) {
  const [displayCount, setDisplayCount] = useState(pageSize);
  const allVideos = getVideosByCategory(category);
  const hasMore = displayCount < allVideos.length;

  const loadMore = useCallback(() => {
    if (hasMore) {
      setDisplayCount(prev => Math.min(prev + pageSize, allVideos.length));
    }
  }, [hasMore, pageSize, allVideos.length]);

  // Reset when category changes
  useEffect(() => {
    setDisplayCount(pageSize);
  }, [category, pageSize]);

  return {
    videos: allVideos.slice(0, displayCount),
    hasMore,
    loadMore,
    total: allVideos.length,
  };
}

// In the grid component:
function VideoGrid({ category }: { category: TrendingCategory }) {
  const { videos, hasMore, loadMore } = useInfiniteVideos(category);
  const { ref: sentinelRef, inView } = useInView({
    threshold: 0,
    rootMargin: '200px',
  });

  useEffect(() => {
    if (inView && hasMore) {
      // Brief delay for skeleton flash
      const timer = setTimeout(loadMore, 300);
      return () => clearTimeout(timer);
    }
  }, [inView, hasMore, loadMore]);

  return (
    <>
      <StaggerReveal className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map(video => (
          <StaggerReveal.Item key={video.id}>
            <VideoCard video={video} />
          </StaggerReveal.Item>
        ))}
      </StaggerReveal>

      {hasMore && (
        <div ref={sentinelRef} className="mt-5">
          <SkeletonGrid count={3} />
        </div>
      )}
    </>
  );
}
```

### Pattern 3: Velocity Indicator Mapping

**What:** Map velocity multiplier ranges to visual indicators (rising/peaking/declining).
**When to use:** VideoCard trending speed badge.

```tsx
// Velocity thresholds (from mock data analysis):
// Breaking Out: velocity 12-50x → "rising" (green arrow up)
// Trending Now: velocity 3-10x → "peaking" (orange steady/slight up)
// Rising Again: velocity 2-6x → "declining" or "resurfacing" (blue rotate arrow)

function getVelocityLabel(velocity: number): {
  label: string;
  icon: 'rising' | 'peaking' | 'declining';
  color: string;
} {
  if (velocity >= 10) return { label: `${velocity.toFixed(0)}x`, icon: 'rising', color: 'text-green-400' };
  if (velocity >= 5)  return { label: `${velocity.toFixed(0)}x`, icon: 'peaking', color: 'text-accent' };
  return { label: `${velocity.toFixed(1)}x`, icon: 'declining', color: 'text-blue-400' };
}
```

### Pattern 4: StaggerReveal for Grid Entrance Animation

**What:** Wrap the grid with StaggerReveal for sequential card entrance animation.
**When to use:** Initial render and tab changes.

The project already has `StaggerReveal` and `StaggerReveal.Item` from `@/components/motion`. This is the exact pattern for grid card reveal -- wrap the grid container and each card item.

### Anti-Patterns to Avoid

- **Don't use CSS `aspect-ratio` on the card itself** -- Use it only on the thumbnail container. The card height should be determined by content.
- **Don't virtualize 14 items** -- With max 14 videos per category tab, react-window/virtualization adds complexity with zero benefit.
- **Don't use `<img>` tags** -- Use Next.js `Image` for lazy loading, format optimization, and responsive srcset.
- **Don't hardcode breakpoints in JS** -- Use Tailwind's responsive grid classes (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`).
- **Don't create a new animation system** -- Use existing `HoverScale`, `StaggerReveal`, `FadeIn` motion components.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Intersection Observer | Manual `IntersectionObserver` setup with ref management | `react-intersection-observer` `useInView` hook | SSR safety, cleanup, ref forwarding, threshold options handled |
| Hover scale effect | CSS `:hover` transform with `transition` | Existing `HoverScale` component | Spring physics (stiffness: 400, damping: 25), reduced-motion support |
| Grid entrance animation | Manual `IntersectionObserver` + CSS keyframes | Existing `StaggerReveal` + `StaggerReveal.Item` | Viewport-triggered, configurable stagger delay, reduced-motion |
| Image lazy loading | Manual lazy loading with IntersectionObserver | Next.js `Image` with `loading="lazy"` (default) | Built-in srcset, WebP/AVIF conversion, blur placeholder |
| Glass card styling | Raw CSS glassmorphism | Existing `GlassCard` with `hover="lift"` | Safari-compatible backdrop-filter, GPU performance caps, tint system |
| Category tag pill | Raw `<span>` with rounded styles | Existing `GlassPill` with `color="orange"` | Consistent oklch colors, active state, interactive variant |
| Number formatting | `Intl.NumberFormat` or manual formatting | Existing `formatCompactNumber()` in trending-client.tsx | Already handles B/M/K formatting correctly |
| Modal dialog | Custom overlay + portal | Existing `Dialog` / `DialogContent` (Radix-based) | Focus trap, scroll lock, accessibility, animation built in |

**Key insight:** This phase is almost entirely composition. Every visual primitive exists. The new code is layout, data wiring, and the infinite scroll hook.

## Common Pitfalls

### Pitfall 1: Backdrop-filter Stripped by Lightning CSS

**What goes wrong:** Tailwind v4's Lightning CSS bundler strips `backdrop-filter` and `-webkit-backdrop-filter` from CSS classes during compilation.
**Why it happens:** Lightning CSS build step removes these properties.
**How to avoid:** Apply backdrop-filter via React inline styles: `style={{ backdropFilter: 'blur(Xpx)', WebkitBackdropFilter: 'blur(Xpx)' }}`. The existing GlassPanel already handles this via `glass-blur-*` CSS classes in globals.css, but any new glass effects must follow this pattern.
**Warning signs:** Elements appear without blur/frosted effect despite having backdrop-filter in className.

### Pitfall 2: picsum.photos Requires next.config Image Configuration

**What goes wrong:** Next.js `Image` component throws "hostname not configured" error for `picsum.photos` thumbnails.
**Why it happens:** Next.js requires explicit allowlisting of external image domains in `next.config.ts`.
**How to avoid:** Add `remotePatterns` for both `picsum.photos` and `fastly.picsum.photos` (redirect target) to `next.config.ts` before using `Image` with mock data thumbnails.
**Warning signs:** Runtime error: "Invalid src prop on next/image, hostname picsum.photos is not configured."

### Pitfall 3: oklch Color Inaccuracy at Build Time

**What goes wrong:** Tailwind v4's `@theme` block compiles oklch values to hex at build time. For very dark colors (L < 0.15), oklch-to-hex conversion is inaccurate.
**Why it happens:** Build-time color space conversion loses precision in dark ranges.
**How to avoid:** Use exact hex/rgba values for dark tokens in @theme blocks. oklch works fine in inline CSS styles (browser interprets directly). The existing globals.css already uses hex for dark grays.
**Warning signs:** Dark background colors appear different than expected.

### Pitfall 4: Infinite Scroll Fires Multiple Times

**What goes wrong:** IntersectionObserver fires multiple times when sentinel enters viewport, causing duplicate batch loads.
**Why it happens:** The sentinel element may enter/leave the viewport multiple times during reflow.
**How to avoid:** Guard `loadMore` with a `loading` state flag. Only trigger load when `inView && !loading && hasMore`. The `react-intersection-observer` library helps with `triggerOnce` option, but for infinite scroll you want repeating triggers with a loading guard.
**Warning signs:** Duplicate items appearing in the grid, or all items loading at once.

### Pitfall 5: Tab Change Without Reset Causes Stale Data

**What goes wrong:** Switching category tabs shows old category's videos briefly before updating.
**Why it happens:** State from previous tab persists if `displayCount` is not reset on category change.
**How to avoid:** Reset `displayCount` to `pageSize` in a `useEffect` that depends on `category`. The existing `trending-client.tsx` already has a loading skeleton flash pattern (250ms timeout) that masks this.
**Warning signs:** Briefly seeing wrong category videos after tab switch.

### Pitfall 6: HoverScale + GlassCard Double Hover Effect

**What goes wrong:** Wrapping `GlassCard` with `hover="lift"` inside `HoverScale` creates two competing scale/translate animations on hover.
**Why it happens:** Both components apply hover transforms independently.
**How to avoid:** Choose ONE hover strategy. Either use `GlassCard` with `hover="lift"` (CSS translate + shadow) OR wrap in `HoverScale` (spring physics scale). Recommendation: Use `HoverScale` for the spring feel and set `GlassCard` `hover="none"`.
**Warning signs:** Jittery or doubled hover animation on cards.

## v0 MCP Workflow Research

### How to Use v0 MCP Effectively

**Tool API:**
- `mcp__v0__v0_generate_ui` -- Initial component generation from text prompt
- `mcp__v0__v0_chat_complete` -- Iterative refinement via conversation
- Models: `v0-1.5-lg` (highest quality), `v0-1.5-md` (default, faster), `v0-1.0-md` (legacy)
- Both tools accept a `context` param for existing code/design system reference

**Prompt Engineering for v0 with a Design System:**

1. **Include BRAND-BIBLE.md as context.** Pass the full file content or relevant sections in the `context` parameter. v0 will reference these tokens and component names.

2. **Be explicit about component names.** v0 does not know your custom components. Name them explicitly:
   ```
   "Use a GlassCard component (glassmorphic card with blur, border glow, hover='lift' prop).
    Use GlassPill for category tags (rounded pill with color tint).
    Use HoverScale wrapper for spring-physics hover animation."
   ```

3. **Specify color tokens by name AND value.** v0 generates Tailwind classes -- it will approximate colors unless told exact values:
   ```
   "Background: bg-background (#0A0A0B near-black).
    Accent: coral #E57850 for CTAs and highlights.
    Text: text-foreground (#FAFAFA) for primary, text-foreground-secondary (#9c9c9d) for secondary."
   ```

4. **Describe the visual standard explicitly.**
   ```
   "Raycast-quality premium dark UI. iOS 26 liquid glass aesthetic.
    Funnel Display for headings, Satoshi for body text."
   ```

5. **Provide the data shape.** Include the TypeScript interface so v0 generates correct prop structures:
   ```
   "VideoCard receives a TrendingVideo object with: id, title, thumbnailUrl (400x500 portrait),
    creator {handle, displayName, avatarUrl}, views, likes, shares, date (ISO), category,
    hashtags, velocity (multiplier like 42.3x)."
   ```

**Iterative Refinement with v0_chat_complete:**

Use conversation history to refine the design:
```
Message 1 (user): [initial prompt with BRAND-BIBLE context]
Message 2 (assistant): [v0's generated code]
Message 3 (user): "The thumbnail should be portrait (5:4 aspect ratio, not 16:9).
  Add a gradient overlay at the bottom of the thumbnail for text readability.
  The velocity indicator should use green for >10x, coral/orange for 5-10x, blue for <5x."
```

Keep iterating until the visual output matches Raycast quality. Then integrate.

### v0 Output Integration Strategy

v0 generates standalone React + Tailwind CSS code. Integration requires these replacements:

| v0 Approximation | Replace With | Import From |
|-------------------|-------------|-------------|
| `<div className="rounded-xl bg-gray-900 border border-gray-800 ...">` | `<GlassCard color="orange" hover="none" padding="none">` | `@/components/primitives` |
| `<span className="rounded-full bg-orange-500/20 text-orange-400 px-2 py-1 text-xs">` | `<GlassPill color="orange" size="sm">` | `@/components/primitives` |
| `<img src={...} />` | `<Image src={...} width={400} height={500} alt={...} />` | `next/image` |
| Raw hover transforms | `<HoverScale>` wrapper | `@/components/motion` |
| Manual fade-in CSS | `<StaggerReveal>` / `<FadeIn>` | `@/components/motion` |
| `<h3 className="text-lg font-semibold text-white">` | `<Heading level={3} size={4}>` or raw Tailwind (per card context) | `@/components/ui/typography` |
| Hardcoded color values | Design token classes (`text-foreground-secondary`, `bg-surface-elevated`) | `globals.css @theme` |

### What v0 is Good At vs Manual Coding

| v0 Excels At | Code Manually |
|-------------|---------------|
| Visual card layout composition (thumbnail + metadata + tags) | Infinite scroll hook (`useInfiniteVideos`) |
| Responsive grid proportions and spacing | Data wiring (connecting mock data to components) |
| Thumbnail overlay gradients and text placement | State management (displayCount, loading, category reset) |
| Category pill and velocity indicator visual design | `useInView` sentinel integration |
| Empty state illustration layout | TypeScript interfaces and prop types |
| Hover state visual polish | Tab change + URL sync (already exists) |
| Color and spacing experimentation | Animation wiring (StaggerReveal, HoverScale) |
| Portrait card aspect ratio and image cropping | Next.js Image configuration |

**Workflow:**
1. Design VideoCard layout in v0 (visual only)
2. Design empty state in v0 (visual only)
3. Iterate with `v0_chat_complete` until Raycast-quality
4. Manually build `useInfiniteVideos` hook
5. Manually build `VideoGrid` with StaggerReveal + sentinel
6. Integrate v0 output: replace approximations with real imports
7. Wire data, state, and interactions manually

### v0 Prompt Template for VideoCard

```
context: [BRAND-BIBLE.md content]

prompt: "Design a VideoCard component for a trending videos dashboard.

DESIGN SYSTEM:
- Background: near-black (#0A0A0B), surfaces: #18191c, elevated: #222326
- Accent: coral #E57850
- Text: #FAFAFA primary, #9c9c9d secondary, #848586 muted
- Glass cards with frosted blur, subtle border glow (rgba(255,255,255,0.08))
- Fonts: Funnel Display for headings, Satoshi for body
- Rounded corners: 12px for cards
- Dark premium Raycast aesthetic

CARD REQUIREMENTS:
- Portrait thumbnail (400x500, 5:4 aspect ratio) with gradient overlay at bottom
- Creator row: small avatar (28px circle), display name, handle in muted text
- Video title: medium weight, max 2 lines with line-clamp
- Category tag: small pill with category label and category-appropriate color
- Velocity indicator: multiplier like '42.3x' with colored arrow (green for >10x, coral for 5-10x, blue for <5x)
- Metadata row: view count (compact format like '12.4M'), date ('2d ago')
- On hover: subtle scale up (1.02) with elevated shadow

DATA SHAPE:
interface TrendingVideo {
  id: string; title: string; thumbnailUrl: string;
  creator: { handle: string; displayName: string; avatarUrl: string };
  views: number; likes: number; shares: number; date: string;
  category: 'breaking-out' | 'trending-now' | 'rising-again';
  velocity: number;
}

Make it Raycast-quality premium dark UI. Single card, no grid."
```

## Code Examples

### VideoCard Skeleton Placeholder

```tsx
// Matches the VideoCard layout dimensions for zero-shift loading
function VideoCardSkeleton() {
  return (
    <div className="space-y-3">
      {/* Thumbnail skeleton (5:4 aspect ratio) */}
      <Skeleton className="aspect-[4/5] w-full rounded-xl" />
      {/* Creator row */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-3 w-24 rounded-md" />
      </div>
      {/* Title */}
      <Skeleton className="h-4 w-full rounded-md" />
      <Skeleton className="h-4 w-3/4 rounded-md" />
      {/* Metadata row */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-3 w-12 rounded-md" />
      </div>
    </div>
  );
}
```

### Relative Date Formatting

```tsx
// Compact relative date: "2h ago", "3d ago", "1w ago"
function formatRelativeDate(isoDate: string): string {
  const now = new Date();
  const date = new Date(isoDate);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return 'just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}w ago`;
}
```

### Responsive Grid with Tailwind

```tsx
// 3 cols desktop, 2 tablet, 1 mobile -- consistent with existing SkeletonGrid
<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
  {videos.map(video => (
    <VideoCard key={video.id} video={video} onClick={() => openDetail(video)} />
  ))}
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `scroll` event listener + debounce | IntersectionObserver API | Widely adopted by 2022 | No main thread scroll monitoring, better perf |
| `framer-motion` package | `motion` package (same creator) | 2024+ | Lighter bundle, same API, already installed |
| `<img>` with manual lazy loading | Next.js `Image` component | Next.js 13+ | Automatic WebP/AVIF, srcset, lazy by default |
| Manual CSS glassmorphism | GlassPanel/GlassCard primitives | This project (v1.1) | Safari-compatible, performance-aware, consistent |

**Deprecated/outdated:**
- `framer-motion` direct import: Use `motion/react` instead (already done in this project)
- Scroll event listener for infinite scroll: Use IntersectionObserver via `react-intersection-observer`

## Open Questions

1. **Thumbnail aspect ratio: 4:5 or 16:9?**
   - What we know: Mock data uses `400/500` (4:5 portrait) from picsum.photos, matching TikTok's native aspect ratio
   - What's unclear: Whether the grid looks better with 4:5 portrait or 16:9 landscape thumbnails
   - Recommendation: Start with 4:5 (matches TikTok content), validate visually in v0 iteration. Can adjust with a single `aspect-[ratio]` change.

2. **VideoCard click behavior**
   - What we know: CARD-05 says "Click on VideoCard opens detail modal"
   - What's unclear: Whether to implement the click handler in Phase 51 or defer to Phase 52
   - Recommendation: Add the `onClick` prop to VideoCard in Phase 51 but leave the modal implementation to Phase 52. Wire a no-op or console.log for now.

3. **Batch size for infinite scroll**
   - What we know: 14 videos per category, so infinite scroll is more about progressive reveal than true pagination
   - What's unclear: Optimal batch size (6? 9? All 14?)
   - Recommendation: Page size of 6 (fills 2 rows on desktop). Second load gets remaining 8. This gives a meaningful "load more" moment without excessive fragmentation.

## Sources

### Primary (HIGH confidence)
- `/thebuilder/react-intersection-observer` via Context7 -- `useInView` hook API, InfiniteScroll component pattern, `useOnInView` for performance-critical callbacks (benchmark score: 89.9)
- `/websites/motion_dev` via Context7 -- Motion library for React animation (benchmark score: 89.1)
- Existing codebase files (direct read):
  - `src/components/primitives/GlassCard.tsx` -- hover="lift", color, tinted, padding props
  - `src/components/primitives/GlassPill.tsx` -- color, size, variant, active props
  - `src/components/motion/hover-scale.tsx` -- spring physics scale=1.02, tapScale=0.98
  - `src/components/motion/stagger-reveal.tsx` -- StaggerReveal + StaggerReveal.Item
  - `src/components/ui/skeleton.tsx` -- shimmer animation skeleton
  - `src/components/ui/dialog.tsx` -- Radix Dialog with glass styling
  - `src/types/trending.ts` -- TrendingVideo, TrendingCategory, ValidTab
  - `src/lib/trending-mock-data.ts` -- 42 videos, getVideosByCategory()
  - `src/app/(app)/trending/trending-client.tsx` -- TrendingClient shell with tabs, SkeletonGrid, EmptyState
  - `src/app/globals.css` -- @theme tokens, glass-blur-* classes
  - `.planning/BRAND-BIBLE.md` -- Full design system spec

### Secondary (MEDIUM confidence)
- [Vercel blog: Maximizing outputs with v0](https://vercel.com/blog/maximizing-outputs-with-v0-from-ui-generation-to-code-creation) -- Prompt engineering best practices for v0
- [ClaudeCode101: v0 Components workflow](https://www.claudecode101.com/en/tutorial/workflows/v0-components) -- Design phase, import & adapt, enhancement workflow
- [v0-mcp GitHub](https://github.com/hellolucky/v0-mcp) -- v0 MCP server tool API (generate_ui, chat_complete, generate_from_image)
- [freeCodeCamp: Infinite Scrolling in React](https://www.freecodecamp.org/news/infinite-scrolling-in-react/) -- IntersectionObserver pattern
- [Next.js docs: Image Component](https://nextjs.org/docs/app/api-reference/components/image) -- remotePatterns config, responsive images

### Tertiary (LOW confidence)
- [Strapi blog: Building Faster with V0 and Claude Code](https://strapi.io/blog/building-faster-with-v0-and-claude-code-lessons-learned-from-vibe-coding) -- v0+Claude workflow (could not fetch, 403)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All core libraries already installed except react-intersection-observer (well-documented, 89.9 benchmark)
- Architecture: HIGH -- Direct codebase analysis of every component to be composed
- v0 workflow: MEDIUM -- Practical workflow patterns assembled from multiple sources; actual v0 output quality TBD at execution time
- Pitfalls: HIGH -- All pitfalls verified against actual codebase patterns and documented project memory (MEMORY.md)

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (stable domain, no fast-moving dependencies)
