# VER-06: Hardcoded Values Scan Report

**Date:** 2026-02-05
**Scanner:** verification/scripts/hardcoded-values-scan.ts
**Scope:** Component code in src/components/

## Summary

| Metric | Count |
|--------|-------|
| Total findings | 275 |
| Allow-listed (intentional) | 48 |
| Flagged for review | 227 |
| Files scanned | 63 (with findings) |
| Directories scanned | 9 |

### Findings by Pattern

| Pattern | Total | Allow-listed | Flagged |
|---------|-------|-------------|--------|
| Hex color value | 33 | 24 | 9 |
| RGB/RGBA color value | 100 | 18 | 82 |
| Arbitrary Tailwind color value | 8 | 0 | 8 |
| Arbitrary Tailwind size value | 134 | 6 | 128 |

## Allow-Listed Values (Intentional)

These hardcoded values are intentional and documented with justification.

### src/components/ui/card.tsx

**Justification:** Glass effect rgba values for backdrop-filter specific boxShadow and background - inline styles for Safari compatibility (Phase 40 decision)

| Line | Value | Pattern |
|------|-------|---------|
| 61 | `rgba(255, 255, 255` | rgb-rgba |
| 113 | `rgba(255, 255, 255` | rgb-rgba |
| 122 | `rgba(255, 255, 255` | rgb-rgba |

### src/components/ui/kbd.tsx

**Justification:** Raycast-extracted 4-layer keyboard shadow uses complex rgba/rgb values in inline boxShadow - too complex for a single token (Phase 41 decision)

| Line | Value | Pattern |
|------|-------|---------|
| 13 | `rgba(0, 0, 0` | rgb-rgba |
| 14 | `rgb(0, 0, 0` | rgb-rgba |
| 15 | `rgba(0, 0, 0` | rgb-rgba |
| 16 | `rgba(255, 255, 255` | rgb-rgba |
| 39 | `w-[20px]` | arbitrary-tailwind-size |
| 39 | `text-[10px]` | arbitrary-tailwind-size |
| 40 | `w-[24px]` | arbitrary-tailwind-size |
| 41 | `w-[28px]` | arbitrary-tailwind-size |
| 91 | `rgb(18, 18, 18` | rgb-rgba |
| 91 | `rgb(13, 13, 13` | rgb-rgba |

### src/components/ui/skeleton.tsx

**Justification:** Shimmer gradient uses rgba white/opacity values for animation-specific effect - inline style pattern for animation gradients (Phase 42 decision)

| Line | Value | Pattern |
|------|-------|---------|
| 22 | `rgba(255, 255, 255` | rgb-rgba |
| 24 | `rgba(255, 255, 255` | rgb-rgba |

### src/components/ui/toast.tsx

**Justification:** CSS keyframe injection uses inline styles for self-contained slide animations (Phase 41 decision)

| Line | Value | Pattern |
|------|-------|---------|
| 376 | `w-[380px]` | arbitrary-tailwind-size |

### src/components/ui/toggle.tsx

**Justification:** oklch value in shadow utility class is the accent token value used in Tailwind shadow-[] syntax for coral glow effect

| Line | Value | Pattern |
|------|-------|---------|
| 40 | `w-[52px]` | arbitrary-tailwind-size |

### src/components/primitives/GlassPanel.tsx

**Justification:** Glass primitive uses inline rgba for backdrop-filter Safari compatibility and glass tint system (Phase 42 decision)

| Line | Value | Pattern |
|------|-------|---------|
| 44 | `rgba(255, 255, 255` | rgb-rgba |
| 45 | `rgba(255, 255, 255` | rgb-rgba |

### src/components/primitives/TrafficLights.tsx

**Justification:** macOS traffic light colors (#ed6a5f, #f6be50, #61c555) are system-defined constants with no design token equivalent

| Line | Value | Pattern |
|------|-------|---------|
| 25 | `#ed6a5f` | hex-color |
| 26 | `#e24b41` | hex-color |
| 29 | `#f6be50` | hex-color |
| 30 | `#e1a73e` | hex-color |
| 33 | `#61c555` | hex-color |
| 34 | `#2dac2f` | hex-color |
| 37 | `#3d3d3d` | hex-color |
| 38 | `#2a2a2a` | hex-color |

### src/components/app/filter-pills.tsx

**Justification:** Country flag colors (#F97316, #3B82F6, etc.) are data-driven per-country identifiers, not design tokens

| Line | Value | Pattern |
|------|-------|---------|
| 49 | `#F97316` | hex-color |
| 50 | `#3B82F6` | hex-color |
| 51 | `#10B981` | hex-color |
| 52 | `#8B5CF6` | hex-color |
| 53 | `#EF4444` | hex-color |

### src/components/app/network-visualization.tsx

**Justification:** Data visualization with dynamic per-node colors - WebGL/Canvas context, not CSS design tokens

| Line | Value | Pattern |
|------|-------|---------|
| 21 | `#F97316` | hex-color |
| 22 | `#3B82F6` | hex-color |
| 23 | `#10B981` | hex-color |
| 24 | `#8B5CF6` | hex-color |
| 25 | `#EF4444` | hex-color |
| 132 | `rgba(255, 255, 255` | rgb-rgba |

### src/components/visualization/GlassOrb.tsx

**Justification:** THREE.js shader colors operate in WebGL context, not CSS - design tokens are not applicable

| Line | Value | Pattern |
|------|-------|---------|
| 78 | `#FF5722` | hex-color |
| 78 | `#FF6B35` | hex-color |
| 79 | `#FF7043` | hex-color |
| 79 | `#FF8E72` | hex-color |
| 80 | `#E040FB` | hex-color |
| 80 | `#C850C0` | hex-color |

### src/components/visualization/SplineOrb.tsx

**Justification:** Spline 3D component - WebGL context, not CSS tokens

| Line | Value | Pattern |
|------|-------|---------|
| 70 | `rgba(255,107,53` | rgb-rgba |
| 70 | `rgba(230,74,25` | rgb-rgba |
| 84 | `rgba(255,107,53` | rgb-rgba |
| 84 | `rgba(230,74,25` | rgb-rgba |

## Flagged Values (Review Needed)

These values may need to be replaced with design tokens from globals.css.

### src/components/ui/avatar.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 44 | `text-[10px]` | arbitrary-tailwind-size | `xs: "text-[10px]",` |
| 45 | `text-[11px]` | arbitrary-tailwind-size | `sm: "text-[11px]",` |
| 46 | `text-[13px]` | arbitrary-tailwind-size | `md: "text-[13px]",` |
| 47 | `text-[15px]` | arbitrary-tailwind-size | `lg: "text-[15px]",` |
| 48 | `text-[18px]` | arbitrary-tailwind-size | `xl: "text-[18px]",` |

### src/components/ui/badge.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 64 | `text-[10px]` | arbitrary-tailwind-size | `sm: "h-5 px-2 text-[10px]",` |

### src/components/ui/button.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 70 | `h-[36px]` | arbitrary-tailwind-size | `sm: "h-9 min-h-[36px] min-w-[36px] px-3 text-sm rounded-md",` |
| 70 | `w-[36px]` | arbitrary-tailwind-size | `sm: "h-9 min-h-[36px] min-w-[36px] px-3 text-sm rounded-md",` |
| 71 | `h-[44px]` | arbitrary-tailwind-size | `md: "h-11 min-h-[44px] min-w-[44px] px-4 text-sm rounded-md",` |
| 71 | `w-[44px]` | arbitrary-tailwind-size | `md: "h-11 min-h-[44px] min-w-[44px] px-4 text-sm rounded-md",` |
| 72 | `h-[48px]` | arbitrary-tailwind-size | `lg: "h-12 min-h-[48px] min-w-[48px] px-6 text-base rounded-lg",` |
| 72 | `w-[48px]` | arbitrary-tailwind-size | `lg: "h-12 min-h-[48px] min-w-[48px] px-6 text-base rounded-lg",` |

### src/components/primitives/CommandPalette.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 285 | `w-[640px]` | arbitrary-tailwind-size | `"relative w-full max-w-[640px] mx-4",` |
| 320 | `text-[15px]` | arbitrary-tailwind-size | `"text-[15px] text-[var(--color-fg)]",` |
| 329 | `text-[11px]` | arbitrary-tailwind-size | `"text-[11px] font-medium text-[var(--color-grey-200)]",` |
| 341 | `h-[400px]` | arbitrary-tailwind-size | `className="max-h-[400px] overflow-y-auto py-2"` |
| 345 | `text-[14px]` | arbitrary-tailwind-size | `<div className="px-4 py-8 text-center text-[var(--color-fg-300)] text-[14px]">` |
| 352 | `text-[11px]` | arbitrary-tailwind-size | `<div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider ...` |
| 396 | `rgba(255, 255, 255` | rgb-rgba | `? "rgba(255, 255, 255, 0.05)"` |
| 408 | `text-[14px]` | arbitrary-tailwind-size | `"text-[14px] font-medium truncate",` |
| 417 | `text-[12px]` | arbitrary-tailwind-size | `<div className="text-[12px] text-[var(--color-fg-400)] truncate">` |
| 428 | `text-[11px]` | arbitrary-tailwind-size | `"text-[11px] font-medium text-[var(--color-grey-200)]",` |
| 456 | `rgba(0, 0, 0` | rgb-rgba | `style={{ backgroundColor: "rgba(0, 0, 0, 0.2)" }}` |
| 458 | `text-[11px]` | arbitrary-tailwind-size | `<div className="flex items-center gap-3 text-[11px] text-[var(--color-fg-400)]">` |
| 472 | `text-[11px]` | arbitrary-tailwind-size | `<div className="flex items-center gap-1 text-[11px] text-[var(--color-fg-400)]">` |

### src/components/primitives/Divider.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 67 | `rgba(255, 255, 255` | rgb-rgba | `background: "linear-gradient(180deg, transparent 0%, rgba(255, 255, 255, 0.1)...` |
| 85 | `rgba(255, 255, 255` | rgb-rgba | `background: "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) ...` |
| 112 | `text-[12px]` | arbitrary-tailwind-size | `<span className="text-[12px] text-[var(--color-fg-400)] font-medium uppercase...` |

### src/components/primitives/GlassAlert.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 37 | `rgba(255, 255, 255` | rgb-rgba | `bg: "rgba(255, 255, 255, 0.02)",` |
| 38 | `rgba(255, 255, 255` | rgb-rgba | `border: "rgba(255, 255, 255, 0.1)",` |
| 139 | `text-[14px]` | arbitrary-tailwind-size | `className="text-[14px] font-semibold mb-1"` |
| 145 | `text-[13px]` | arbitrary-tailwind-size | `<div className="text-[13px] text-[var(--color-fg-200)]">` |

### src/components/primitives/GlassAvatar.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 29 | `text-[10px]` | arbitrary-tailwind-size | `xs: { avatar: "w-6 h-6", text: "text-[10px]", icon: 12, status: "w-1.5 h-1.5" },` |
| 30 | `text-[11px]` | arbitrary-tailwind-size | `sm: { avatar: "w-8 h-8", text: "text-[11px]", icon: 14, status: "w-2 h-2" },` |
| 31 | `text-[13px]` | arbitrary-tailwind-size | `md: { avatar: "w-10 h-10", text: "text-[13px]", icon: 18, status: "w-2.5 h-2....` |
| 32 | `text-[15px]` | arbitrary-tailwind-size | `lg: { avatar: "w-12 h-12", text: "text-[15px]", icon: 22, status: "w-3 h-3" },` |
| 33 | `text-[18px]` | arbitrary-tailwind-size | `xl: { avatar: "w-16 h-16", text: "text-[18px]", icon: 28, status: "w-3.5 h-3....` |

### src/components/primitives/GlassBadge.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 29 | `rgba(255, 255, 255` | rgb-rgba | `bg: "rgba(255, 255, 255, 0.05)",` |
| 31 | `rgba(255, 255, 255` | rgb-rgba | `border: "rgba(255, 255, 255, 0.1)",` |
| 69 | `text-[10px]` | arbitrary-tailwind-size | `badge: "px-1.5 py-0.5 text-[10px]",` |
| 73 | `text-[11px]` | arbitrary-tailwind-size | `badge: "px-2 py-1 text-[11px]",` |
| 77 | `text-[12px]` | arbitrary-tailwind-size | `badge: "px-2.5 py-1 text-[12px]",` |

### src/components/primitives/GlassBreadcrumbs.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 164 | `text-[14px]` | arbitrary-tailwind-size | `"text-[var(--color-fg-400)] text-[14px]"` |
| 189 | `text-[14px]` | arbitrary-tailwind-size | `"text-[14px] font-medium",` |
| 210 | `text-[14px]` | arbitrary-tailwind-size | `"text-[14px] font-medium",` |

### src/components/primitives/GlassCheckbox.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 226 | `rgba(255, 255, 255` | rgb-rgba | `? "rgba(255, 255, 255, 0.05)"` |

### src/components/primitives/GlassInput.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 33 | `text-[13px]` | arbitrary-tailwind-size | `input: "h-8 px-2.5 text-[13px]",` |
| 42 | `h-[42px]` | arbitrary-tailwind-size | `input: "h-[42px] px-3 text-[14px]",` |
| 42 | `text-[14px]` | arbitrary-tailwind-size | `input: "h-[42px] px-3 text-[14px]",` |
| 50 | `text-[15px]` | arbitrary-tailwind-size | `input: "h-12 px-4 text-[15px]",` |
| 215 | `rgba(255, 255, 255` | rgb-rgba | `backgroundColor: "rgba(255, 255, 255, 0.05)",` |

### src/components/primitives/GlassModal.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 199 | `text-[18px]` | arbitrary-tailwind-size | `className="text-[18px] font-semibold text-[var(--color-fg)]"` |
| 207 | `text-[14px]` | arbitrary-tailwind-size | `className="mt-1 text-[14px] text-[var(--color-fg-300)]"` |

### src/components/primitives/GlassNavbar.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 28 | `h-[76px]` | arbitrary-tailwind-size | `md: "h-[76px] py-4 px-6", // Raycast exact` |
| 100 | `w-[1204px]` | arbitrary-tailwind-size | `"w-full max-w-[1204px] mx-auto",` |
| 122 | `rgba(16, 17, 17` | rgb-rgba | `? "rgba(16, 17, 17, 0.8)" // More opaque when scrolled` |
| 123 | `rgba(16, 17, 17` | rgb-rgba | `: "rgba(16, 17, 17, 0.6)", // Raycast bg-100 with opacity` |
| 179 | `text-[14px]` | arbitrary-tailwind-size | `"text-[14px] font-medium",` |

### src/components/primitives/GlassProgress.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 143 | `rgba(255, 255, 255` | rgb-rgba | `stroke="rgba(255, 255, 255, 0.1)"` |
| 172 | `text-[10px]` | arbitrary-tailwind-size | `size === "sm" && "text-[10px]",` |
| 173 | `text-[11px]` | arbitrary-tailwind-size | `size === "md" && "text-[11px]",` |
| 174 | `text-[14px]` | arbitrary-tailwind-size | `size === "lg" && "text-[14px]"` |
| 201 | `rgba(255, 255, 255` | rgb-rgba | `backgroundColor: "rgba(255, 255, 255, 0.1)",` |

### src/components/primitives/GlassRadio.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 265 | `rgba(255, 255, 255` | rgb-rgba | `: "rgba(255, 255, 255, 0.05)", // Raycast glass when unchecked` |

### src/components/primitives/GlassSearchBar.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 140 | `h-[43px]` | arbitrary-tailwind-size | `"h-[43px] px-3",` |
| 174 | `text-[15px]` | arbitrary-tailwind-size | `"text-[var(--color-fg)] text-[15px] font-medium",` |
| 204 | `text-[11px]` | arbitrary-tailwind-size | `"text-[11px] font-medium text-[var(--color-grey-200)]",` |

### src/components/primitives/GlassSkeleton.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 89 | `rgba(255, 255, 255` | rgb-rgba | `backgroundColor: "rgba(255, 255, 255, 0.05)",` |
| 91 | `rgba(255, 255, 255` | rgb-rgba | `? "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.08) 50%, tran...` |
| 135 | `rgba(255, 255, 255` | rgb-rgba | `style={{ backgroundColor: "rgba(255, 255, 255, 0.02)" }}` |

### src/components/primitives/GlassSlider.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 300 | `rgba(255, 255, 255` | rgb-rgba | `backgroundColor: "rgba(255, 255, 255, 0.05)", // Raycast glass` |
| 319 | `rgba(229, 120, 80` | rgb-rgba | `: "0 0 8px rgba(229, 120, 80, 0.3)",` |
| 339 | `rgba(0, 0, 0` | rgb-rgba | `? "0 0 16px var(--color-accent-transparent), 0 4px 12px rgba(0, 0, 0, 0.2)"` |
| 340 | `rgba(0, 0, 0` | rgb-rgba | `: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(229, 120, 80, 0.2)",` |
| 340 | `rgba(229, 120, 80` | rgb-rgba | `: "0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(229, 120, 80, 0.2)",` |

### src/components/primitives/GlassTabs.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 84 | `text-[13px]` | arbitrary-tailwind-size | `tab: "px-3 py-1.5 text-[13px]",` |
| 89 | `text-[15px]` | arbitrary-tailwind-size | `tab: "px-3 py-2 text-[15px]",` |
| 93 | `text-[16px]` | arbitrary-tailwind-size | `tab: "px-4 py-2.5 text-[16px]",` |
| 295 | `rgba(255, 255, 255` | rgb-rgba | `backgroundColor: isActive ? "rgba(255, 255, 255, 0.05)" : "transparent",` |

### src/components/primitives/GlassTextarea.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 26 | `h-[80px]` | arbitrary-tailwind-size | `sm: "px-3 py-2 text-sm min-h-[80px]",` |
| 27 | `h-[120px]` | arbitrary-tailwind-size | `md: "px-4 py-3 text-base min-h-[120px]",` |
| 28 | `h-[160px]` | arbitrary-tailwind-size | `lg: "px-5 py-4 text-lg min-h-[160px]",` |
| 202 | `rgba(255, 255, 255` | rgb-rgba | `backgroundColor: "rgba(255, 255, 255, 0.05)",` |

### src/components/primitives/GlassToast.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 139 | `w-[320px]` | arbitrary-tailwind-size | `"min-w-[320px] max-w-[400px]"` |
| 139 | `w-[400px]` | arbitrary-tailwind-size | `"min-w-[320px] max-w-[400px]"` |
| 156 | `text-[14px]` | arbitrary-tailwind-size | `<p className="text-[14px] font-medium text-[var(--color-fg)]">` |
| 160 | `text-[13px]` | arbitrary-tailwind-size | `<p className="mt-1 text-[13px] text-[var(--color-fg-300)]">` |
| 168 | `text-[13px]` | arbitrary-tailwind-size | `"mt-2 text-[13px] font-medium",` |
| 197 | `rgba(255, 255, 255` | rgb-rgba | `style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}` |

### src/components/primitives/GlassToggle.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 183 | `rgba(229, 120, 80` | rgb-rgba | `? "0 2px 8px var(--color-accent-transparent), 0 0 0 1px rgba(229, 120, 80, 0.1)"` |
| 184 | `rgba(0, 0, 0` | rgb-rgba | `: "0 2px 4px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05)",` |
| 184 | `rgba(0, 0, 0` | rgb-rgba | `: "0 2px 4px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05)",` |
| 207 | `text-[14px]` | arbitrary-tailwind-size | `"text-[14px] font-medium",` |
| 221 | `text-[14px]` | arbitrary-tailwind-size | `"text-[14px] font-medium",` |

### src/components/primitives/GlassTooltip.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 179 | `text-[13px]` | arbitrary-tailwind-size | `"text-[13px] text-[var(--color-fg)]",` |

### src/components/primitives/Kbd.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 25 | `text-[11px]` | arbitrary-tailwind-size | `wrapper: "px-1.5 py-0.5 text-[11px]",` |
| 29 | `text-[12px]` | arbitrary-tailwind-size | `wrapper: "px-2 py-1 text-[12px]",` |
| 33 | `text-[14px]` | arbitrary-tailwind-size | `wrapper: "px-3 py-1.5 text-[14px]",` |
| 101 | `rgb(18, 18, 18` | rgb-rgba | `background: "linear-gradient(180deg, rgb(18, 18, 18), rgb(13, 13, 13))",` |
| 101 | `rgb(13, 13, 13` | rgb-rgba | `background: "linear-gradient(180deg, rgb(18, 18, 18), rgb(13, 13, 13))",` |
| 104 | `rgba(0, 0, 0` | rgb-rgba | `? `rgba(0, 0, 0, 0.4) 0px 1.5px 0.5px 2.5px,` |
| 105 | `rgb(0, 0, 0` | rgb-rgba | `rgb(0, 0, 0) 0px 0px 0.5px 1px,` |
| 106 | `rgba(0, 0, 0` | rgb-rgba | `rgba(0, 0, 0, 0.25) 0px 2px 1px 1px inset,` |
| 107 | `rgba(255, 255, 255` | rgb-rgba | `rgba(255, 255, 255, 0.2) 0px 1px 1px 1px inset,` |
| 109 | `rgba(0, 0, 0` | rgb-rgba | `: `rgba(0, 0, 0, 0.4) 0px 1.5px 0.5px 2.5px,` |
| 110 | `rgb(0, 0, 0` | rgb-rgba | `rgb(0, 0, 0) 0px 0px 0.5px 1px,` |
| 111 | `rgba(0, 0, 0` | rgb-rgba | `rgba(0, 0, 0, 0.25) 0px 2px 1px 1px inset,` |
| 112 | `rgba(255, 255, 255` | rgb-rgba | `rgba(255, 255, 255, 0.2) 0px 1px 1px 1px inset`,` |

### src/components/effects/chromatic-aberration.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 78 | `rgba(255, 0, 0` | rgb-rgba | `textShadow: `-${offset}px 0 rgba(255, 0, 0, ${intensity}), ${offset}px 0 rgba...` |
| 78 | `rgba(0, 255, 255` | rgb-rgba | `textShadow: `-${offset}px 0 rgba(255, 0, 0, ${intensity}), ${offset}px 0 rgba...` |

### src/components/app/app-shell.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 28 | `#0A0A0A` | hex-color | `<div className="flex h-screen bg-[#0A0A0A]">` |
| 28 | `bg-[#0A0A0A]` | arbitrary-tailwind-color | `<div className="flex h-screen bg-[#0A0A0A]">` |

### src/components/app/auth-guard.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 42 | `#0A0A0A` | hex-color | `<div className="flex h-screen bg-[#0A0A0A]">` |
| 42 | `bg-[#0A0A0A]` | arbitrary-tailwind-color | `<div className="flex h-screen bg-[#0A0A0A]">` |
| 44 | `w-[248px]` | arbitrary-tailwind-size | `<div className="hidden w-[248px] shrink-0 flex-col border-r border-zinc-800 p...` |

### src/components/app/card-action-menu.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 44 | `w-[140px]` | arbitrary-tailwind-size | `className="z-50 min-w-[140px] rounded-lg border border-zinc-700 bg-zinc-800 p...` |

### src/components/app/content-form.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 99 | `h-[100px]` | arbitrary-tailwind-size | `"w-full min-h-[100px] resize-none overflow-hidden",` |
| 117 | `h-[44px]` | arbitrary-tailwind-size | `"flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-1.5",` |
| 130 | `h-[44px]` | arbitrary-tailwind-size | `"flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-1.5",` |

### src/components/app/create-society-modal.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 59 | `w-[700px]` | arbitrary-tailwind-size | `<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-[700px] -...` |
| 61 | `#18181B` | hex-color | `background: `linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92...` |
| 61 | `rgba(99, 102, 241` | rgb-rgba | `background: `linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92...` |
| 61 | `rgba(139, 92, 246` | rgb-rgba | `background: `linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92...` |
| 61 | `rgba(59, 130, 246` | rgb-rgba | `background: `linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92...` |
| 75 | `w-[500px]` | arbitrary-tailwind-size | `<div className="mx-auto max-w-[500px] pt-8 text-center">` |
| 82 | `text-[15px]` | arbitrary-tailwind-size | `<Dialog.Description className="mb-8 text-[15px] leading-relaxed text-zinc-400">` |
| 93 | `#18181B` | hex-color | `className="mb-4 min-h-[80px] w-full resize-none rounded-xl border border-zinc...` |
| 93 | `bg-[#18181B]` | arbitrary-tailwind-color | `className="mb-4 min-h-[80px] w-full resize-none rounded-xl border border-zinc...` |
| 93 | `h-[80px]` | arbitrary-tailwind-size | `className="mb-4 min-h-[80px] w-full resize-none rounded-xl border border-zinc...` |
| 93 | `text-[15px]` | arbitrary-tailwind-size | `className="mb-4 min-h-[80px] w-full resize-none rounded-xl border border-zinc...` |
| 100 | `text-[15px]` | arbitrary-tailwind-size | `"flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-8 ...` |

### src/components/app/leave-feedback-modal.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 59 | `w-[480px]` | arbitrary-tailwind-size | `"fixed left-1/2 top-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 -translate...` |
| 60 | `#18181B` | hex-color | `"rounded-2xl border border-zinc-800 bg-[#18181B] p-6 shadow-xl",` |
| 60 | `bg-[#18181B]` | arbitrary-tailwind-color | `"rounded-2xl border border-zinc-800 bg-[#18181B] p-6 shadow-xl",` |
| 92 | `text-[13px]` | arbitrary-tailwind-size | `<label className="mb-3 block text-[13px] text-zinc-400">` |
| 113 | `text-[13px]` | arbitrary-tailwind-size | `<label className="mb-3 block text-[13px] text-zinc-400">` |
| 127 | `text-[13px]` | arbitrary-tailwind-size | `<p className="text-[13px] text-zinc-500">` |

### src/components/app/mobile-nav.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 18 | `h-[44px]` | arbitrary-tailwind-size | `className="fixed left-4 top-4 z-50 flex min-h-[44px] min-w-[44px] items-cente...` |
| 18 | `w-[44px]` | arbitrary-tailwind-size | `className="fixed left-4 top-4 z-50 flex min-h-[44px] min-w-[44px] items-cente...` |

### src/components/app/settings/settings-page.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 58 | `h-[44px]` | arbitrary-tailwind-size | `"flex min-h-[44px] flex-shrink-0 items-center gap-3 whitespace-nowrap rounded...` |

### src/components/app/settings/team-section.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 107 | `w-[160px]` | arbitrary-tailwind-size | `className="min-w-[160px] rounded-lg border border-zinc-800 bg-zinc-900 p-1 sh...` |

### src/components/app/sidebar.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 86 | `rgb(40,40,40` | rgb-rgba | `"fixed left-0 top-0 z-50 h-screen w-[240px] flex-col border-r border-[rgb(40,...` |
| 86 | `rgba(21,21,21` | rgb-rgba | `"fixed left-0 top-0 z-50 h-screen w-[240px] flex-col border-r border-[rgb(40,...` |
| 86 | `w-[240px]` | arbitrary-tailwind-size | `"fixed left-0 top-0 z-50 h-screen w-[240px] flex-col border-r border-[rgb(40,...` |
| 94 | `h-[44px]` | arbitrary-tailwind-size | `className="absolute right-4 top-4 flex min-h-[44px] min-w-[44px] items-center...` |
| 94 | `w-[44px]` | arbitrary-tailwind-size | `className="absolute right-4 top-4 flex min-h-[44px] min-w-[44px] items-center...` |
| 131 | `rgb(153,163,169` | rgb-rgba | `<label className="mb-2 block text-xs font-normal text-[rgb(153,163,169)]">` |
| 139 | `rgb(153,163,169` | rgb-rgba | `<label className="mb-2 block text-xs font-normal text-[rgb(153,163,169)]">` |
| 146 | `rgb(40,40,40` | rgb-rgba | `<div className="mt-4 border-t border-[rgb(40,40,40)]" />` |
| 152 | `rgb(184,184,184` | rgb-rgba | `className="flex w-full items-center justify-between py-3 text-sm text-[rgb(18...` |
| 166 | `rgb(40,40,40` | rgb-rgba | `<div className="border-t border-[rgb(40,40,40)]" />` |
| 193 | `rgb(101,101,101` | rgb-rgba | `<p className="mt-2 text-center text-xs text-[rgb(101,101,101)]">Version 2.1</p>` |

### src/components/app/society-selector.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 105 | `#18181B` | hex-color | `<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-[800px] m...` |
| 105 | `bg-[#18181B]` | arbitrary-tailwind-color | `<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-[800px] m...` |
| 105 | `w-[800px]` | arbitrary-tailwind-size | `<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-[800px] m...` |
| 105 | `w-[600px]` | arbitrary-tailwind-size | `<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-[800px] m...` |
| 155 | `h-[180px]` | arbitrary-tailwind-size | `className="flex min-h-[180px] cursor-pointer flex-col items-center justify-ce...` |
| 206 | `h-[180px]` | arbitrary-tailwind-size | `"relative flex min-h-[180px] cursor-pointer flex-col rounded-xl border border...` |
| 257 | `h-[180px]` | arbitrary-tailwind-size | `"relative flex min-h-[180px] cursor-pointer flex-col rounded-xl border border...` |

### src/components/app/survey-form.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 132 | `h-[80px]` | arbitrary-tailwind-size | `"min-h-[80px] w-full resize-none overflow-hidden bg-transparent text-base tex...` |
| 210 | `h-[44px]` | arbitrary-tailwind-size | `<div className="flex min-h-[44px] items-center gap-2 rounded-lg border border...` |
| 218 | `h-[44px]` | arbitrary-tailwind-size | `className="flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc...` |
| 230 | `h-[44px]` | arbitrary-tailwind-size | `className="min-h-[44px] rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-med...` |
| 277 | `#18181B` | hex-color | `className="z-50 min-w-[200px] rounded-lg border border-zinc-800 bg-[#18181B] ...` |
| 277 | `bg-[#18181B]` | arbitrary-tailwind-color | `className="z-50 min-w-[200px] rounded-lg border border-zinc-800 bg-[#18181B] ...` |
| 277 | `w-[200px]` | arbitrary-tailwind-size | `className="z-50 min-w-[200px] rounded-lg border border-zinc-800 bg-[#18181B] ...` |

### src/components/app/test-history-item.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 43 | `rgba(40,40,40` | rgb-rgba | `? 'bg-[rgba(40,40,40,0.5)] text-white'` |
| 44 | `rgb(184,184,184` | rgb-rgba | `: 'text-[rgb(184,184,184)] hover:bg-[rgba(40,40,40,0.3)] hover:text-white'` |
| 44 | `rgba(40,40,40` | rgb-rgba | `: 'text-[rgb(184,184,184)] hover:bg-[rgba(40,40,40,0.3)] hover:text-white'` |
| 73 | `w-[120px]` | arbitrary-tailwind-size | `className="z-50 min-w-[120px] rounded-lg border border-zinc-700 bg-zinc-800 p...` |

### src/components/app/test-type-selector.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 52 | `w-[770px]` | arbitrary-tailwind-size | `"fixed left-1/2 top-1/2 z-50 w-[770px] -translate-x-1/2 -translate-y-1/2",` |
| 53 | `rgb(40,40,40` | rgb-rgba | `"rounded-lg border border-[rgb(40,40,40)] bg-[rgba(6,6,6,0.667)] p-3 shadow-[...` |
| 53 | `rgba(6,6,6` | rgb-rgba | `"rounded-lg border border-[rgb(40,40,40)] bg-[rgba(6,6,6,0.667)] p-3 shadow-[...` |
| 53 | `rgba(0,0,0` | rgb-rgba | `"rounded-lg border border-[rgb(40,40,40)] bg-[rgba(6,6,6,0.667)] p-3 shadow-[...` |
| 71 | `text-[18px]` | arbitrary-tailwind-size | `<Dialog.Title className="py-3 text-center text-[18px] font-semibold leading-[...` |
| 81 | `rgb(184,184,184` | rgb-rgba | `<p className="mb-1.5 text-xs font-normal uppercase leading-[18px] text-[rgb(1...` |
| 93 | `rgb(184,184,184` | rgb-rgba | `<p className="mb-1.5 text-xs font-normal uppercase leading-[18px] text-[rgb(1...` |
| 118 | `rgb(184,184,184` | rgb-rgba | `<p className="mb-1.5 text-xs font-normal uppercase leading-[18px] text-[rgb(1...` |
| 149 | `rgb(184,184,184` | rgb-rgba | `<p className="mb-1.5 text-xs font-normal uppercase leading-[18px] text-[rgb(1...` |
| 168 | `rgb(184,184,184` | rgb-rgba | `<p className="mb-1.5 text-xs font-normal uppercase leading-[18px] text-[rgb(1...` |
| 181 | `rgb(40,40,40` | rgb-rgba | `<div className="border-t border-[rgb(40,40,40)] pt-3">` |
| 185 | `rgb(221,221,221` | rgb-rgba | `className="flex items-center gap-2 px-3 py-2 text-sm text-[rgb(221,221,221)] ...` |
| 219 | `h-[52px]` | arbitrary-tailwind-size | `className="flex h-[52px] w-full items-center gap-3 rounded-lg p-1.5 text-left...` |

### src/components/app/view-selector.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 76 | `#18181B` | hex-color | `className="z-50 min-w-[200px] rounded-lg border border-zinc-800 bg-[#18181B] ...` |
| 76 | `bg-[#18181B]` | arbitrary-tailwind-color | `className="z-50 min-w-[200px] rounded-lg border border-zinc-800 bg-[#18181B] ...` |
| 76 | `w-[200px]` | arbitrary-tailwind-size | `className="z-50 min-w-[200px] rounded-lg border border-zinc-800 bg-[#18181B] ...` |
| 81 | `text-[11px]` | arbitrary-tailwind-size | `<DropdownMenu.Label className="px-4 py-2 text-[11px] font-semibold uppercase ...` |

### src/components/layout/footer.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 21 | `text-[32px]` | arbitrary-tailwind-size | `<h2 className="font-display text-[32px] font-[350] leading-[36px] text-white ...` |
| 21 | `text-[40px]` | arbitrary-tailwind-size | `<h2 className="font-display text-[32px] font-[350] leading-[36px] text-white ...` |
| 33 | `h-[44px]` | arbitrary-tailwind-size | `className="min-h-[44px] rounded bg-accent px-6 py-3 text-sm font-medium text-...` |
| 39 | `h-[44px]` | arbitrary-tailwind-size | `className="min-h-[44px] rounded border border-white/20 px-6 py-3 text-sm font...` |

### src/components/layout/header.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 102 | `h-[44px]` | arbitrary-tailwind-size | `className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center ...` |
| 102 | `w-[44px]` | arbitrary-tailwind-size | `className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center ...` |

### src/components/landing/faq-section.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 72 | `text-[32px]` | arbitrary-tailwind-size | `<h2 className="mt-4 font-display text-[32px] font-[350] leading-[36px] text-w...` |
| 72 | `text-[40px]` | arbitrary-tailwind-size | `<h2 className="mt-4 font-display text-[32px] font-[350] leading-[36px] text-w...` |

### src/components/landing/feature-card.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 33 | `px-[26px]` | arbitrary-tailwind-size | `"rounded-lg border border-white/10 px-[26px] py-12 transition-colors hover:bo...` |

### src/components/landing/features-section.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 63 | `text-[32px]` | arbitrary-tailwind-size | `<h2 className="mt-4 font-display text-[32px] font-[350] leading-[36px] text-w...` |
| 63 | `text-[40px]` | arbitrary-tailwind-size | `<h2 className="mt-4 font-display text-[32px] font-[350] leading-[36px] text-w...` |

### src/components/landing/hero-section.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 28 | `text-[36px]` | arbitrary-tailwind-size | `<h1 className="font-display text-[36px] sm:text-[44px] md:text-[52px] leading...` |
| 28 | `text-[44px]` | arbitrary-tailwind-size | `<h1 className="font-display text-[36px] sm:text-[44px] md:text-[52px] leading...` |
| 28 | `text-[52px]` | arbitrary-tailwind-size | `<h1 className="font-display text-[36px] sm:text-[44px] md:text-[52px] leading...` |
| 51 | `w-[280px]` | arbitrary-tailwind-size | `<div className="relative w-[280px] sm:w-[400px] lg:w-[480px] xl:w-[550px] asp...` |
| 51 | `w-[400px]` | arbitrary-tailwind-size | `<div className="relative w-[280px] sm:w-[400px] lg:w-[480px] xl:w-[550px] asp...` |
| 51 | `w-[480px]` | arbitrary-tailwind-size | `<div className="relative w-[280px] sm:w-[400px] lg:w-[480px] xl:w-[550px] asp...` |
| 51 | `w-[550px]` | arbitrary-tailwind-size | `<div className="relative w-[280px] sm:w-[400px] lg:w-[480px] xl:w-[550px] asp...` |

### src/components/landing/persona-card.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 40 | `#1a1a1a` | hex-color | `<div className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify...` |
| 40 | `bg-[#1a1a1a]` | arbitrary-tailwind-color | `<div className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify...` |

### src/components/landing/stats-section.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 28 | `text-[40px]` | arbitrary-tailwind-size | `<h2 className="mt-4 font-display text-[40px] font-[350] text-white sm:text-[5...` |
| 28 | `text-[52px]` | arbitrary-tailwind-size | `<h2 className="mt-4 font-display text-[40px] font-[350] text-white sm:text-[5...` |
| 40 | `h-[44px]` | arbitrary-tailwind-size | `className="mt-6 inline-flex min-h-[44px] items-center gap-2 text-white hover:...` |

### src/components/viral-results/FactorCard.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 55 | `rgba(52, 211, 153` | rgb-rgba | `if (percentage >= 80) return "rgba(52, 211, 153, 0.15)";` |
| 56 | `rgba(163, 230, 53` | rgb-rgba | `if (percentage >= 60) return "rgba(163, 230, 53, 0.15)";` |
| 57 | `rgba(250, 204, 21` | rgb-rgba | `if (percentage >= 40) return "rgba(250, 204, 21, 0.15)";` |
| 58 | `rgba(251, 146, 60` | rgb-rgba | `if (percentage >= 20) return "rgba(251, 146, 60, 0.15)";` |
| 59 | `rgba(248, 113, 113` | rgb-rgba | `return "rgba(248, 113, 113, 0.15)";` |
| 108 | `rgba(255,255,255` | rgb-rgba | `? `0 0 20px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.05)`` |
| 109 | `rgba(255,255,255` | rgb-rgba | `: "inset 0 1px 0 rgba(255,255,255,0.05)",` |

### src/components/viral-results/RemixCTA.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 88 | `rgba(249, 115, 22` | rgb-rgba | `: "0 8px 32px -8px rgba(249, 115, 22, 0.5), 0 4px 16px -4px rgba(236, 72, 153...` |
| 88 | `rgba(236, 72, 153` | rgb-rgba | `: "0 8px 32px -8px rgba(249, 115, 22, 0.5), 0 4px 16px -4px rgba(236, 72, 153...` |

### src/components/viral-results/ViralResultsCard.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 28 | `rgba(34, 197, 94` | rgb-rgba | `if (score >= 70) return "rgba(34, 197, 94, 0.08)";` |
| 29 | `rgba(234, 179, 8` | rgb-rgba | `if (score >= 40) return "rgba(234, 179, 8, 0.08)";` |
| 30 | `rgba(239, 68, 68` | rgb-rgba | `return "rgba(239, 68, 68, 0.08)";` |
| 108 | `rgba(0,0,0` | rgb-rgba | `"shadow-[0_20px_70px_-15px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]"` |
| 108 | `rgba(255,255,255` | rgb-rgba | `"shadow-[0_20px_70px_-15px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]"` |

### src/components/viral-results/ViralScoreRing.tsx

| Line | Value | Pattern | Context |
|------|-------|---------|---------|
| 46 | `rgba(34, 197, 94` | rgb-rgba | `if (score >= 70) return "rgba(34, 197, 94, 0.35)"; // green` |
| 47 | `rgba(234, 179, 8` | rgb-rgba | `if (score >= 40) return "rgba(234, 179, 8, 0.35)"; // yellow/orange` |
| 48 | `rgba(239, 68, 68` | rgb-rgba | `return "rgba(239, 68, 68, 0.35)"; // red` |

## Recommendations

The following files contain hardcoded values that should be reviewed for potential token replacement:

- **src/components/ui/avatar.tsx** (5 findings)
  - Values: `text-[10px]`, `text-[11px]`, `text-[13px]`, `text-[15px]`, `text-[18px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/ui/badge.tsx** (1 findings)
  - Values: `text-[10px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/ui/button.tsx** (6 findings)
  - Values: `h-[36px]`, `w-[36px]`, `h-[44px]`, `w-[44px]`, `h-[48px]`, `w-[48px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/primitives/CommandPalette.tsx** (13 findings)
  - Values: `w-[640px]`, `text-[15px]`, `text-[11px]`, `h-[400px]`, `text-[14px]`, `rgba(255, 255, 255`, `text-[12px]`, `rgba(0, 0, 0`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/primitives/Divider.tsx** (3 findings)
  - Values: `rgba(255, 255, 255`, `text-[12px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/primitives/GlassAlert.tsx** (4 findings)
  - Values: `rgba(255, 255, 255`, `text-[14px]`, `text-[13px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/primitives/GlassAvatar.tsx** (5 findings)
  - Values: `text-[10px]`, `text-[11px]`, `text-[13px]`, `text-[15px]`, `text-[18px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/primitives/GlassBadge.tsx** (5 findings)
  - Values: `rgba(255, 255, 255`, `text-[10px]`, `text-[11px]`, `text-[12px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/primitives/GlassBreadcrumbs.tsx** (3 findings)
  - Values: `text-[14px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/primitives/GlassCheckbox.tsx** (1 findings)
  - Values: `rgba(255, 255, 255`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/primitives/GlassInput.tsx** (5 findings)
  - Values: `text-[13px]`, `h-[42px]`, `text-[14px]`, `text-[15px]`, `rgba(255, 255, 255`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/primitives/GlassModal.tsx** (2 findings)
  - Values: `text-[18px]`, `text-[14px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/primitives/GlassNavbar.tsx** (5 findings)
  - Values: `h-[76px]`, `w-[1204px]`, `rgba(16, 17, 17`, `text-[14px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/primitives/GlassProgress.tsx** (5 findings)
  - Values: `rgba(255, 255, 255`, `text-[10px]`, `text-[11px]`, `text-[14px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/primitives/GlassRadio.tsx** (1 findings)
  - Values: `rgba(255, 255, 255`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/primitives/GlassSearchBar.tsx** (3 findings)
  - Values: `h-[43px]`, `text-[15px]`, `text-[11px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/primitives/GlassSkeleton.tsx** (3 findings)
  - Values: `rgba(255, 255, 255`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/primitives/GlassSlider.tsx** (5 findings)
  - Values: `rgba(255, 255, 255`, `rgba(229, 120, 80`, `rgba(0, 0, 0`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/primitives/GlassTabs.tsx** (4 findings)
  - Values: `text-[13px]`, `text-[15px]`, `text-[16px]`, `rgba(255, 255, 255`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/primitives/GlassTextarea.tsx** (4 findings)
  - Values: `h-[80px]`, `h-[120px]`, `h-[160px]`, `rgba(255, 255, 255`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/primitives/GlassToast.tsx** (6 findings)
  - Values: `w-[320px]`, `w-[400px]`, `text-[14px]`, `text-[13px]`, `rgba(255, 255, 255`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/primitives/GlassToggle.tsx** (5 findings)
  - Values: `rgba(229, 120, 80`, `rgba(0, 0, 0`, `text-[14px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/primitives/GlassTooltip.tsx** (1 findings)
  - Values: `text-[13px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/primitives/Kbd.tsx** (13 findings)
  - Values: `text-[11px]`, `text-[12px]`, `text-[14px]`, `rgb(18, 18, 18`, `rgb(13, 13, 13`, `rgba(0, 0, 0`, `rgb(0, 0, 0`, `rgba(255, 255, 255`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/effects/chromatic-aberration.tsx** (2 findings)
  - Values: `rgba(255, 0, 0`, `rgba(0, 255, 255`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/app/app-shell.tsx** (2 findings)
  - Values: `#0A0A0A`, `bg-[#0A0A0A]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/app/auth-guard.tsx** (3 findings)
  - Values: `#0A0A0A`, `bg-[#0A0A0A]`, `w-[248px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/app/card-action-menu.tsx** (1 findings)
  - Values: `w-[140px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/app/content-form.tsx** (3 findings)
  - Values: `h-[100px]`, `h-[44px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/app/create-society-modal.tsx** (12 findings)
  - Values: `w-[700px]`, `#18181B`, `rgba(99, 102, 241`, `rgba(139, 92, 246`, `rgba(59, 130, 246`, `w-[500px]`, `text-[15px]`, `bg-[#18181B]`, `h-[80px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/app/leave-feedback-modal.tsx** (6 findings)
  - Values: `w-[480px]`, `#18181B`, `bg-[#18181B]`, `text-[13px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/app/mobile-nav.tsx** (2 findings)
  - Values: `h-[44px]`, `w-[44px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/app/settings/settings-page.tsx** (1 findings)
  - Values: `h-[44px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/app/settings/team-section.tsx** (1 findings)
  - Values: `w-[160px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/app/sidebar.tsx** (11 findings)
  - Values: `rgb(40,40,40`, `rgba(21,21,21`, `w-[240px]`, `h-[44px]`, `w-[44px]`, `rgb(153,163,169`, `rgb(184,184,184`, `rgb(101,101,101`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/app/society-selector.tsx** (7 findings)
  - Values: `#18181B`, `bg-[#18181B]`, `w-[800px]`, `w-[600px]`, `h-[180px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/app/survey-form.tsx** (7 findings)
  - Values: `h-[80px]`, `h-[44px]`, `#18181B`, `bg-[#18181B]`, `w-[200px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/app/test-history-item.tsx** (4 findings)
  - Values: `rgba(40,40,40`, `rgb(184,184,184`, `w-[120px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/app/test-type-selector.tsx** (13 findings)
  - Values: `w-[770px]`, `rgb(40,40,40`, `rgba(6,6,6`, `rgba(0,0,0`, `text-[18px]`, `rgb(184,184,184`, `rgb(221,221,221`, `h-[52px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/app/view-selector.tsx** (4 findings)
  - Values: `#18181B`, `bg-[#18181B]`, `w-[200px]`, `text-[11px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/layout/footer.tsx** (4 findings)
  - Values: `text-[32px]`, `text-[40px]`, `h-[44px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/layout/header.tsx** (2 findings)
  - Values: `h-[44px]`, `w-[44px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/landing/faq-section.tsx** (2 findings)
  - Values: `text-[32px]`, `text-[40px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/landing/feature-card.tsx** (1 findings)
  - Values: `px-[26px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/landing/features-section.tsx** (2 findings)
  - Values: `text-[32px]`, `text-[40px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/landing/hero-section.tsx** (7 findings)
  - Values: `text-[36px]`, `text-[44px]`, `text-[52px]`, `w-[280px]`, `w-[400px]`, `w-[480px]`, `w-[550px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/landing/persona-card.tsx** (2 findings)
  - Values: `#1a1a1a`, `bg-[#1a1a1a]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/landing/stats-section.tsx** (3 findings)
  - Values: `text-[40px]`, `text-[52px]`, `h-[44px]`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/viral-results/FactorCard.tsx** (7 findings)
  - Values: `rgba(52, 211, 153`, `rgba(163, 230, 53`, `rgba(250, 204, 21`, `rgba(251, 146, 60`, `rgba(248, 113, 113`, `rgba(255,255,255`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/viral-results/RemixCTA.tsx** (2 findings)
  - Values: `rgba(249, 115, 22`, `rgba(236, 72, 153`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/viral-results/ViralResultsCard.tsx** (5 findings)
  - Values: `rgba(34, 197, 94`, `rgba(234, 179, 8`, `rgba(239, 68, 68`, `rgba(0,0,0`, `rgba(255,255,255`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification
- **src/components/viral-results/ViralScoreRing.tsx** (3 findings)
  - Values: `rgba(34, 197, 94`, `rgba(234, 179, 8`, `rgba(239, 68, 68`
  - Suggested action: Replace with semantic tokens from globals.css or add to allow-list with justification

## Methodology

### Patterns Detected

- **Hex color value:** `#[0-9a-fA-F]{3,8}\b`
- **RGB/RGBA color value:** `rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+`
- **Arbitrary Tailwind color value:** `\b(?:bg|text|border|shadow|ring)-\[#[0-9a-fA-F]+\]`
- **Arbitrary Tailwind size value:** `\b(?:bg|text|border|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|w|h|gap|space-x|space-y)-\[\d+px\]`

### Exclusions

- Comment lines (// and /* */ blocks)
- Import statements
- CSS variable references (var(--...))

### Allow-List Criteria

Values are allow-listed when they meet one of these criteria:
1. **Platform constants** (macOS traffic light colors, system UI values)
2. **WebGL/shader context** (THREE.js colors, GLSL values -- not CSS)
3. **Complex compound values** (multi-layer shadows too complex for single token)
4. **Animation-specific** (shimmer gradients, transition values)
5. **Data-driven** (per-item colors like country flags, chart series)
6. **Safari compatibility** (inline styles required for -webkit- prefix)

---
*Generated by hardcoded-values-scan.ts*
*Phase: 44-verification-documentation, Plan: 02*
