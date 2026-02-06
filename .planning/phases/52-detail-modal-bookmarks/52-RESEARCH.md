# Phase 52: Detail Modal & Bookmarks - Research

**Researched:** 2026-02-06
**Domain:** Modal dialogs, TikTok embeds, Zustand persistence, keyboard navigation
**Confidence:** HIGH

## Summary

This phase builds a video detail modal with TikTok embed, action buttons (Analyze/Bookmark/Remix), and bookmark persistence. The implementation leverages the existing design system Dialog component (Radix-based), Zustand for bookmark state with localStorage persistence (matching the established `settings-store.ts` and `test-store.ts` patterns), and TikTok's oEmbed API for video embedding.

Key implementation areas:
1. **Detail Modal** - Use existing `Dialog` component with `size="xl"` or custom width for TikTok embed + metadata
2. **TikTok Embed** - Render oEmbed HTML via `dangerouslySetInnerHTML` with script reloading
3. **Bookmark Store** - Create `bookmark-store.ts` following existing Zustand patterns with localStorage persistence
4. **Keyboard Navigation** - Custom `useEffect` hook for arrow key handling within modal context

**Primary recommendation:** Use the existing Dialog component infrastructure, create a new Zustand bookmark store following established patterns, embed TikTok via blockquote + script injection, and implement arrow key navigation with a custom hook.

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@radix-ui/react-dialog` | ^1.1.15 | Modal infrastructure | Already used in codebase, handles focus trap, scroll lock, escape key |
| `zustand` | ^5.0.10 | State management | Already used for settings, tests, societies - persist pattern established |
| `@phosphor-icons/react` | ^2.1.10 | Icons (BookmarkSimple) | Design system standard for icons |
| `framer-motion` | ^12.29.3 | Animations | Already used for motion components |

### Supporting (Already Installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `class-variance-authority` | ^0.7.1 | Variant styles | Modal size variants if extending Dialog |
| `next/navigation` | (Next 16.1.5) | URL state sync | Optional `?video=id` shareability |

### No New Dependencies Needed

All required functionality is covered by existing dependencies. The TikTok embed uses vanilla HTML/script injection, not a library.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── stores/
│   └── bookmark-store.ts          # NEW: Zustand bookmark store
├── components/
│   └── trending/
│       ├── video-detail-modal.tsx  # NEW: Detail modal component
│       ├── video-card.tsx          # UPDATE: Add bookmark icon overlay
│       └── video-grid.tsx          # UPDATE: Wire onClick to modal
├── hooks/
│   └── use-modal-keyboard-nav.ts   # NEW: Arrow key navigation hook
└── app/(app)/trending/
    └── trending-client.tsx         # UPDATE: Add "Saved" tab + modal state
```

### Pattern 1: Zustand Store with localStorage Persistence

**What:** Create bookmark store following established codebase patterns
**When to use:** Persisting bookmarked video IDs across sessions
**Example:**

```typescript
// Source: Codebase pattern from settings-store.ts and test-store.ts
import { create } from "zustand";

const STORAGE_KEY = "virtuna-bookmarks";

interface BookmarkState {
  bookmarkedIds: Set<string>;  // Or string[] for JSON serialization
  _isHydrated: boolean;

  // Actions
  toggleBookmark: (videoId: string) => void;
  isBookmarked: (videoId: string) => boolean;
  _hydrate: () => void;
}

function loadFromStorage(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveToStorage(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage errors
  }
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarkedIds: new Set(),
  _isHydrated: false,

  _hydrate: () => {
    const stored = loadFromStorage();
    if (stored) {
      set({ bookmarkedIds: new Set(stored), _isHydrated: true });
    } else {
      set({ _isHydrated: true });
    }
  },

  toggleBookmark: (videoId) => {
    set((state) => {
      const newSet = new Set(state.bookmarkedIds);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      saveToStorage(Array.from(newSet));
      return { bookmarkedIds: newSet };
    });
  },

  isBookmarked: (videoId) => get().bookmarkedIds.has(videoId),
}));
```

### Pattern 2: TikTok Embed with Script Reloading

**What:** Embed TikTok video using oEmbed blockquote + script injection
**When to use:** Displaying TikTok video in modal
**Example:**

```typescript
// Source: TikTok oEmbed documentation (developers.tiktok.com/doc/embed-videos/)
import { useEffect, useRef } from "react";

interface TikTokEmbedProps {
  videoUrl: string;
  videoId: string;
}

export function TikTokEmbed({ videoUrl, videoId }: TikTokEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // TikTok embed script needs to be reloaded each time component mounts
    // Cache bust with timestamp to force re-initialization
    const script = document.createElement("script");
    script.src = `https://www.tiktok.com/embed.js?t=${Date.now()}`;
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Cleanup script on unmount
      document.body.removeChild(script);
    };
  }, [videoId]);

  return (
    <div ref={containerRef}>
      <blockquote
        className="tiktok-embed"
        cite={videoUrl}
        data-video-id={videoId}
        style={{ maxWidth: "325px" }}
      >
        <section />
      </blockquote>
    </div>
  );
}
```

### Pattern 3: Modal Keyboard Navigation Hook

**What:** Custom hook for arrow key navigation between videos
**When to use:** Navigating prev/next video while modal is open
**Example:**

```typescript
// Source: React keyboard navigation patterns
import { useEffect, useCallback } from "react";

interface UseModalKeyboardNavOptions {
  isOpen: boolean;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
}

export function useModalKeyboardNav({
  isOpen,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}: UseModalKeyboardNavOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === "ArrowLeft" && hasPrevious) {
        event.preventDefault();
        onPrevious();
      } else if (event.key === "ArrowRight" && hasNext) {
        event.preventDefault();
        onNext();
      }
    },
    [isOpen, onPrevious, onNext, hasPrevious, hasNext]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);
}
```

### Pattern 4: Dialog with Custom Size for Embed

**What:** Extend Dialog for larger modal accommodating TikTok embed
**When to use:** Modal needs wider than `xl` (576px) for side-by-side layout
**Example:**

```typescript
// Source: Existing Dialog component pattern
// The Dialog already supports size="full" (90vw) but a custom 2xl may be needed

// Option A: Use size="full" and constrain with max-w-4xl internally
<DialogContent size="full" className="max-w-4xl">
  {/* Side-by-side: TikTok embed (325px) + metadata */}
</DialogContent>

// Option B: Add custom size to dialogContentVariants (if needed)
// In dialog.tsx, add to size variants:
// '2xl': 'max-w-2xl',  // 672px
// '3xl': 'max-w-3xl',  // 768px
// '4xl': 'max-w-4xl',  // 896px
```

### Anti-Patterns to Avoid

- **Don't use `dangerouslySetInnerHTML` for TikTok oEmbed HTML:** The blockquote structure is static and known, so manually construct the elements. Only use innerHTML if fetching dynamic oEmbed response from API.
- **Don't persist Set directly to JSON:** JSON.stringify doesn't serialize Sets. Convert to array before storage, convert back on hydration.
- **Don't add keyboard listeners globally without cleanup:** Always remove event listeners in useEffect cleanup to prevent memory leaks.
- **Don't block Radix Dialog's built-in keyboard handling:** Escape key is already handled by Radix. Only add arrow keys, not Escape or Tab.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Focus trap in modal | Manual focus management | Radix Dialog (built-in) | Edge cases: nested focusable elements, dynamic content |
| Scroll lock | `overflow: hidden` on body | Radix Dialog (built-in) | iOS scroll issues, nested scroll containers |
| Escape key closing | `onKeyDown` handler | Radix Dialog (built-in) | Already handles focus restoration, animation timing |
| Overlay click closing | `onClick` on backdrop | Radix Dialog (built-in) | Bubble prevention, proper event delegation |
| localStorage hydration | Basic get/set | Established store pattern | SSR hydration mismatches, error handling |

**Key insight:** Radix Dialog handles the complex accessibility requirements. Focus on the domain-specific features: TikTok embed, bookmark state, keyboard navigation between videos.

## Common Pitfalls

### Pitfall 1: TikTok Embed Script Not Re-initializing

**What goes wrong:** TikTok blockquote renders but video doesn't load when modal reopens
**Why it happens:** TikTok's `embed.js` only processes blockquotes on initial load
**How to avoid:** Re-inject the script with cache-busting timestamp each time modal opens or video changes
**Warning signs:** Blockquote visible but no iframe/video player appears

### Pitfall 2: Hydration Mismatch with Bookmarks

**What goes wrong:** React hydration error on initial page load
**Why it happens:** Server renders without localStorage data, client has bookmarked state
**How to avoid:** Use `_isHydrated` flag pattern - render neutral state until hydrated
**Warning signs:** "Text content did not match" or "Hydration failed" console errors

### Pitfall 3: Set Serialization to JSON

**What goes wrong:** Bookmarks don't persist or become `{}` after reload
**Why it happens:** `JSON.stringify(new Set())` returns `"{}"`, not array
**How to avoid:** Convert to `Array.from(set)` before storage, `new Set(array)` on load
**Warning signs:** localStorage shows `{}` or empty object for bookmarks

### Pitfall 4: Arrow Keys Conflicting with TikTok Player

**What goes wrong:** Arrow keys seek video instead of navigating to prev/next
**Why it happens:** TikTok embed may capture keyboard events
**How to avoid:** Attach listener to window, check if event target is within iframe (skip if so)
**Warning signs:** Left/right arrows seek video 5s instead of changing video

### Pitfall 5: Modal Close Doesn't Stop TikTok Video

**What goes wrong:** Audio continues playing after modal closes
**Why it happens:** TikTok embed doesn't auto-pause on unmount
**How to avoid:** Set key prop on embed container to force remount, or conditionally render embed only when modal is open
**Warning signs:** Audio continues after closing modal

## Code Examples

Verified patterns from codebase and official sources:

### Bookmark Icon Toggle on VideoCard

```typescript
// Source: Codebase VideoCard + Phosphor icons
import { BookmarkSimple } from "@phosphor-icons/react";
import { useBookmarkStore } from "@/stores/bookmark-store";

// Inside VideoCard thumbnail overlay
const isBookmarked = useBookmarkStore((s) => s.bookmarkedIds.has(video.id));

{isBookmarked && (
  <div className="absolute top-2 right-2 z-10">
    <BookmarkSimple weight="fill" className="h-5 w-5 text-accent" />
  </div>
)}
```

### Modal State Management Pattern

```typescript
// Source: Codebase trending-client.tsx pattern
const [selectedVideo, setSelectedVideo] = useState<TrendingVideo | null>(null);
const isModalOpen = selectedVideo !== null;

// Pass to VideoGrid
<VideoGrid
  category={activeTab}
  onVideoClick={(video) => setSelectedVideo(video)}
/>

// Modal
<VideoDetailModal
  video={selectedVideo}
  open={isModalOpen}
  onOpenChange={(open) => {
    if (!open) setSelectedVideo(null);
  }}
  onNavigate={(direction) => {
    // Find prev/next video in current filtered list
  }}
/>
```

### Saved Tab Integration

```typescript
// Source: Codebase category-tabs pattern
// Extend VALID_TABS and categories array

// Add "saved" as special filter (not a TrendingCategory)
type FilterTab = TrendingCategory | "saved";

// In categories array:
{
  value: "saved",
  label: "Saved",
  icon: <BookmarkSimple weight="fill" className="h-3.5 w-3.5" />,
  // No count badge per CONTEXT.md decision
}

// Filter logic in VideoGrid or hook:
const videos = activeTab === "saved"
  ? allVideos.filter((v) => bookmarkedIds.has(v.id))
  : getVideosByCategory(activeTab as TrendingCategory);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zustand v4 `persist()` middleware | Manual localStorage + `_hydrate()` pattern | Codebase convention | Cleaner SSR hydration control |
| TikTok SDK | oEmbed blockquote + script | Current | Simpler, no SDK dependency |
| Custom modal focus trap | Radix Dialog | Established | Better a11y, less code |

**Deprecated/outdated:**
- `zustand/middleware` persist in v5: Can still be used, but codebase uses manual pattern for explicit hydration control in Next.js

## Open Questions

None critical. All technical decisions are clear based on CONTEXT.md and codebase patterns.

## Sources

### Primary (HIGH confidence)
- Context7 `/websites/zustand_pmnd_rs` - Zustand persist middleware with SSR/Next.js patterns
- Context7 `/websites/radix-ui-primitives` - Dialog keyboard interactions and accessibility
- Codebase: `/src/stores/settings-store.ts`, `/src/stores/test-store.ts` - Established Zustand patterns
- Codebase: `/src/components/ui/dialog.tsx` - Existing Dialog component with size variants

### Secondary (MEDIUM confidence)
- [TikTok oEmbed Documentation](https://developers.tiktok.com/doc/embed-videos/) - Official embed structure
- [EmbedSocial Guide](https://embedsocial.com/blog/embed-tiktok-video/) - TikTok embedding best practices 2026
- [FreeCodeCamp Keyboard Accessibility](https://www.freecodecamp.org/news/designing-keyboard-accessibility-for-complex-react-experiences/) - Arrow key navigation patterns

### Tertiary (LOW confidence)
- [react-social-media-embed](https://www.npmjs.com/package/react-social-media-embed) - Alternative approach (not recommended, adds dependency)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use
- Architecture: HIGH - Patterns directly match existing codebase conventions
- Pitfalls: HIGH - Verified through Context7 docs and codebase analysis

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days - stable patterns, no fast-moving dependencies)
