# Phase 20: Visualization Foundation - Research

**Researched:** 2026-01-31
**Domain:** Canvas-based visualization with pan/zoom interactions, glass-effect orb, and animation state management
**Confidence:** HIGH

## Summary

Phase 20 establishes the visual core for Virtuna's progressive disclosure visualization: a central glass-like orb with breathing animations, pan/zoom canvas infrastructure, and animation state management. The research reveals a clear technical path using proven patterns.

**Key findings:**
- **Motion library** (already in project) provides production-grade spring physics and state-based animations ideal for orb breathing and state transitions
- **react-zoom-pan-pinch** is the industry standard for pan/zoom with touch support, providing all required features (min/max zoom, reset, no momentum)
- **Canvas 2D + DOM hybrid** is optimal: Canvas 2D for orb rendering (simpler, sufficient for glass effects) + DOM for future segment nodes (better tap handling)
- **Glass effects** via Canvas 2D radial gradients with glow (shadowBlur) are performant on mobile when properly optimized
- **ResizeObserver** pattern is standard for responsive canvas, with existing NetworkVisualization component as reference

The existing codebase already demonstrates canvas best practices (NetworkVisualization.tsx uses ResizeObserver, devicePixelRatio handling, requestAnimationFrame), providing a proven foundation to build on.

**Primary recommendation:** Build a new `ProgressiveVisualization` component using Canvas 2D for orb rendering, Motion library for animation states, and react-zoom-pan-pinch for pan/zoom. Reuse patterns from existing NetworkVisualization for canvas setup and responsiveness.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| motion | 12.29.2 | Animation & state transitions | Already in project; production-grade library by Framer Motion creators; 89.1 benchmark score; spring physics built-in |
| react-zoom-pan-pinch | Latest | Pan/zoom/pinch interactions | Industry standard with 66 code examples in Context7; supports all required features (bounds, reset, touch gestures) |
| Canvas 2D API | Native | Orb rendering & effects | Native browser API; sufficient for glass/glow effects; better mobile performance than WebGL for this use case |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ResizeObserver | Native | Responsive canvas sizing | Already used in NetworkVisualization; standard pattern for canvas responsiveness |
| requestAnimationFrame | Native | 60fps animation loop | Already used in NetworkVisualization; essential for smooth animations |
| zustand | 5.0.10 | State management | Already in project for animation state if needed (idle, gathering, analyzing, complete) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canvas 2D | WebGL/Three.js | WebGL better for complex 3D/particles but overkill for single orb; 40ms initial load vs 15ms for Canvas 2D; unnecessary complexity |
| react-zoom-pan-pinch | Custom pan/zoom | Custom solution requires handling touch events, momentum, bounds, performance optimization - all solved problems |
| Motion | Framer Motion | Motion is by same creators, lighter weight, already in project; Framer Motion adds React overhead |

**Installation:**
```bash
npm install react-zoom-pan-pinch
# motion already installed (12.29.2)
```

## Architecture Patterns

### Recommended Project Structure
```
src/components/app/
├── progressive-visualization.tsx    # New main component
├── orb-renderer.ts                 # Canvas rendering logic
├── use-orb-animation.ts            # Animation state hook
└── network-visualization.tsx       # Existing reference
```

### Pattern 1: Canvas Component with useRef + useEffect
**What:** React pattern for canvas integration using refs and effects
**When to use:** All canvas-based React components
**Example:**
```typescript
// Source: Existing NetworkVisualization.tsx (verified pattern)
export function ProgressiveVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Setup ResizeObserver for responsive canvas
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
    };

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(container);
    resizeCanvas();

    // Animation loop
    const animate = () => {
      // Render logic
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
```

### Pattern 2: Animation State Machine with Motion
**What:** State-based animations with smooth transitions
**When to use:** Complex animation states (idle → gathering → analyzing → complete)
**Example:**
```typescript
// Source: Context7 Motion docs + TSH.io state machines article
import { animate } from "motion/dom";
import { spring } from "motion";

type OrbState = 'idle' | 'gathering' | 'analyzing' | 'complete';

function useOrbAnimation(state: OrbState) {
  const orb = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!orb.current) return;

    // State-specific animations with spring physics
    switch (state) {
      case 'idle':
        animate(
          orb.current,
          { scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] },
          {
            type: spring,
            duration: 2.5,
            repeat: Infinity
          }
        );
        break;
      case 'gathering':
        animate(
          orb.current,
          { scale: 1.1, filter: 'brightness(1.3)' },
          {
            type: spring,
            duration: 3.5,
            bounce: 0.25
          }
        );
        break;
      // ... other states
    }
  }, [state]);
}
```

### Pattern 3: Pan/Zoom with TransformWrapper
**What:** Declarative pan/zoom with touch support
**When to use:** Canvas or DOM elements requiring pan/zoom interactions
**Example:**
```typescript
// Source: Context7 react-zoom-pan-pinch docs
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

export function ProgressiveVisualization() {
  return (
    <TransformWrapper
      initialScale={1}
      minScale={0.5}
      maxScale={3}
      panning={{ disabled: false }}
      wheel={{ smoothStep: 0.01 }}
      pinch={{ disabled: false }}
      doubleClick={{ disabled: true }}
      limitToBounds={true}
      centerOnInit={true}
    >
      {({ resetTransform }) => (
        <>
          <ResetButton onClick={resetTransform} />
          <TransformComponent>
            <canvas ref={canvasRef} />
          </TransformComponent>
        </>
      )}
    </TransformWrapper>
  );
}
```

### Pattern 4: Glass Orb with Radial Gradients
**What:** Glass-like translucent effect using Canvas 2D radial gradients
**When to use:** Creating glass/glow effects on canvas
**Example:**
```typescript
// Source: MDN Canvas API + W3Schools radial gradients
function drawGlassOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  glowIntensity: number
) {
  // Inner glass gradient (white/silver with orange accent)
  const innerGradient = ctx.createRadialGradient(
    x - radius * 0.3, y - radius * 0.3, 0,
    x, y, radius
  );
  innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
  innerGradient.addColorStop(0.4, 'rgba(240, 240, 240, 0.6)');
  innerGradient.addColorStop(0.7, 'rgba(229, 120, 80, 0.3)'); // Orange accent
  innerGradient.addColorStop(1, 'rgba(200, 200, 200, 0.2)');

  // Draw orb
  ctx.fillStyle = innerGradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Outer glow (use shadowBlur sparingly for performance)
  ctx.shadowColor = 'rgba(229, 120, 80, 0.5)';
  ctx.shadowBlur = 20 * glowIntensity;
  ctx.fill();
  ctx.shadowBlur = 0; // Reset immediately
}
```

### Pattern 5: Offscreen Canvas for Performance
**What:** Pre-render expensive operations to offscreen canvas
**When to use:** Repeated drawing operations (orb texture layers)
**Example:**
```typescript
// Source: MDN Canvas optimization guide
const offscreenCanvas = document.createElement('canvas');
offscreenCanvas.width = radius * 2;
offscreenCanvas.height = radius * 2;
const offscreenCtx = offscreenCanvas.getContext('2d');

// Draw complex texture once
drawComplexOrbTexture(offscreenCtx, radius);

// In animation loop, just draw the cached image
ctx.drawImage(offscreenCanvas, x - radius, y - radius);
```

### Anti-Patterns to Avoid
- **Animating backdrop-filter:** Never animate CSS backdrop-filter on mobile - severe performance penalty. Use canvas gradients instead.
- **Excessive shadowBlur:** shadowBlur is expensive; apply once per frame, reset immediately. Avoid animating blur intensity.
- **Forgetting devicePixelRatio:** Always scale canvas by DPR for crisp rendering on retina displays
- **Nested glass effects:** Don't stack multiple backdrop-filter elements - compounds performance cost
- **Sub-pixel coordinates:** Always use Math.floor() on coordinates to avoid anti-aliasing overhead

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pan/zoom with touch | Custom touch event handlers | react-zoom-pan-pinch | Handles pinch detection, momentum, bounds, coordinate transforms, cross-browser touch quirks |
| Spring animations | Custom easing functions | Motion library (spring) | Pre-calculates physics-based keyframes, handles interruptions, optimized performance |
| Canvas responsiveness | window.resize listener | ResizeObserver | Fires only when element resizes, batches updates, provides devicePixelContentBoxSize for pixel-perfect sizing |
| Animation state transitions | Boolean flags | State machine pattern | Prevents impossible states (e.g., isOpen=false + isAnimating=true), enforces valid transitions |
| Touch gesture detection | Manual touch coordinate math | Pointer Events API | Unified API for mouse/touch/pen, handles multi-touch, browser handles gesture recognition |

**Key insight:** Pan/zoom looks simple ("just track two fingers") but involves dozens of edge cases: pinch center calculation, momentum physics, boundary constraints, rotation prevention, coordinate space transforms, event propagation, accessibility. react-zoom-pan-pinch solves all of this in a battle-tested library.

## Common Pitfalls

### Pitfall 1: Canvas Blur on Retina Displays
**What goes wrong:** Canvas looks blurry on high-DPI screens (iPhone, MacBook)
**Why it happens:** Canvas resolution (width/height) doesn't match device pixel ratio
**How to avoid:** Always multiply canvas dimensions by devicePixelRatio and scale context
**Warning signs:** Canvas looks fuzzy while DOM elements look crisp
```typescript
// WRONG
canvas.width = container.offsetWidth;

// CORRECT
const dpr = window.devicePixelRatio || 1;
canvas.width = container.offsetWidth * dpr;
ctx.scale(dpr, dpr);
```

### Pitfall 2: backdrop-filter Performance on Mobile
**What goes wrong:** Glassmorphism works on desktop but stutters/crashes on mobile
**Why it happens:** backdrop-filter triggers expensive GPU compositing; mobile GPUs struggle with multiple blur layers
**How to avoid:** Limit to 2-3 glass elements per viewport, reduce blur to 6-8px on mobile, never animate backdrop-filter
**Warning signs:** Smooth on Chrome desktop, janky on Safari iOS; battery drain
```css
/* Mobile optimization - from research */
@media (max-width: 768px) {
  .glass-blur-lg {
    backdrop-filter: blur(8px); /* Reduced from 20px */
  }
}
```

### Pitfall 3: Sub-Pixel Rendering Anti-Aliasing
**What goes wrong:** Unexpected performance drop despite few canvas operations
**Why it happens:** Non-integer coordinates force browser to anti-alias every frame
**How to avoid:** Use Math.floor() on all coordinates in drawImage() and arc() calls
**Warning signs:** Performance degrades with more objects despite simple shapes
```typescript
// WRONG
ctx.drawImage(sprite, position.x, position.y);

// CORRECT
ctx.drawImage(sprite, Math.floor(position.x), Math.floor(position.y));
```

### Pitfall 4: Forgetting to Reset Canvas State
**What goes wrong:** Glow effects bleed across frames, rendering becomes unpredictable
**Why it happens:** Canvas 2D context is stateful; shadowBlur, filters, transforms persist
**How to avoid:** Reset state immediately after use, or use save()/restore() pairs
**Warning signs:** Effects accumulate over time, first frame looks different than later frames
```typescript
// WRONG
ctx.shadowBlur = 20;
ctx.fill();
// ... other drawing

// CORRECT
ctx.shadowBlur = 20;
ctx.fill();
ctx.shadowBlur = 0; // Reset immediately
```

### Pitfall 5: Animation State Impossible States
**What goes wrong:** Orb gets stuck in weird states, transitions fail
**Why it happens:** Using separate boolean flags (isIdle, isGathering) allows invalid combinations
**How to avoid:** Use single state variable with union type: 'idle' | 'gathering' | 'analyzing' | 'complete'
**Warning signs:** Need to check multiple booleans, unclear what current state is
```typescript
// WRONG
const [isIdle, setIsIdle] = useState(true);
const [isAnimating, setIsAnimating] = useState(false);
// Can have isIdle=false && isAnimating=false → what state?

// CORRECT
type OrbState = 'idle' | 'gathering' | 'analyzing' | 'complete';
const [state, setState] = useState<OrbState>('idle');
```

### Pitfall 6: TransformWrapper Canvas Coordinate Mismatch
**What goes wrong:** Click/tap events on canvas don't align with visual position after zoom
**Why it happens:** TransformWrapper transforms DOM but canvas uses internal coordinate system
**How to avoid:** Access transform state from TransformWrapper and inverse-transform click coordinates
**Warning signs:** Clicks work at 1x zoom but misalign when zoomed in/out
```typescript
// Get transform state to convert screen coords to canvas coords
const { transformState } = useControls();
const canvasX = (screenX - transformState.positionX) / transformState.scale;
```

## Code Examples

Verified patterns from official sources:

### Canvas Setup with ResizeObserver (Existing Pattern)
```typescript
// Source: Existing NetworkVisualization.tsx (production code)
const canvasRef = useRef<HTMLCanvasElement>(null);
const containerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const container = containerRef.current;
  const canvas = canvasRef.current;
  if (!container || !canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let animationFrameId: number;

  const resizeCanvas = () => {
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);
  };

  const resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(container);

  resizeCanvas();
  // ... animation loop

  return () => {
    resizeObserver.disconnect();
    cancelAnimationFrame(animationFrameId);
  };
}, []);
```

### Spring-Based Breathing Animation
```typescript
// Source: Context7 Motion docs (/websites/motion_dev)
import { animate } from "motion/dom";
import { spring } from "motion";

// Breathing animation: scale + opacity pulse
animate(
  orbElement,
  {
    scale: [1, 1.05, 1],
    opacity: [0.8, 1, 0.8]
  },
  {
    type: spring,
    duration: 2.5,
    repeat: Infinity,
    bounce: 0.2
  }
);
```

### Pan/Zoom with Custom Reset Button
```typescript
// Source: Context7 react-zoom-pan-pinch docs (/bettertyped/react-zoom-pan-pinch)
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";

const ResetButton = () => {
  const { resetTransform } = useControls();
  return (
    <button
      onClick={() => resetTransform()}
      className="absolute top-4 right-4 z-10"
    >
      Reset View
    </button>
  );
};

export function ProgressiveVisualization() {
  return (
    <TransformWrapper
      initialScale={1}
      minScale={0.5}
      maxScale={3}
      centerOnInit={true}
    >
      <ResetButton />
      <TransformComponent>
        <canvas ref={canvasRef} />
      </TransformComponent>
    </TransformWrapper>
  );
}
```

### Radial Gradient Glass Effect
```typescript
// Source: W3Schools Canvas Radial Gradients + existing globals.css design tokens
function drawGlassOrb(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number) {
  // Use oklch colors from design tokens
  const gradient = ctx.createRadialGradient(
    centerX - radius * 0.3,
    centerY - radius * 0.3,
    0,
    centerX,
    centerY,
    radius
  );

  // Glass-like gradient: white/silver with orange accent
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)'); // Bright center
  gradient.addColorStop(0.3, 'rgba(240, 240, 240, 0.7)');
  gradient.addColorStop(0.6, 'rgba(229, 120, 80, 0.4)'); // Orange glow (--color-accent)
  gradient.addColorStop(1, 'rgba(200, 200, 200, 0.2)'); // Transparent edge

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  // Subtle outer glow
  ctx.shadowColor = 'rgba(229, 120, 80, 0.5)';
  ctx.shadowBlur = 15;
  ctx.fill();
  ctx.shadowBlur = 0; // Reset immediately for performance
}
```

### prefers-reduced-motion Support
```typescript
// Source: Existing NetworkVisualization.tsx pattern
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const animate = () => {
  if (!prefersReducedMotion) {
    // Update positions, run animations
    updateOrbBreathing();
  } else {
    // Static rendering only
  }
  animationFrameId = requestAnimationFrame(animate);
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Framer Motion | Motion library | 2024-2025 | Motion is lighter, same creators, better tree-shaking; already in project at 12.29.2 |
| Custom zoom logic | react-zoom-pan-pinch | 2020+ | Declarative API, battle-tested gestures, accessibility built-in |
| window.resize | ResizeObserver | 2020 | Element-specific, batched updates, devicePixelContentBoxSize for pixel-perfect canvas |
| setInterval animations | requestAnimationFrame | 2015+ | Syncs with display refresh, pauses when tab inactive, smooth 60fps |
| CSS backdrop-filter everywhere | Selective use + canvas alternatives | 2024-2025 | Mobile performance limits; max 2-3 glass elements, 6-8px blur on mobile |

**Deprecated/outdated:**
- **jQuery.animate**: Replaced by Motion, Web Animations API, or CSS transitions
- **Hammer.js**: Replaced by native Pointer Events API and libraries like react-zoom-pan-pinch
- **velocity.js**: Deprecated; use Motion or Web Animations API
- **Custom easing functions**: Spring physics libraries (Motion) handle complex motion better

## Open Questions

Things that couldn't be fully resolved:

1. **Canvas vs DOM for orb rendering**
   - What we know: Canvas 2D can handle glass/glow effects; DOM with CSS might be simpler
   - What's unclear: Performance tradeoff on mobile when combining CSS glass + pan/zoom transforms
   - Recommendation: Test both approaches - Canvas 2D likely more predictable performance, DOM may be easier to implement. CONTEXT.md marks this as "Claude's discretion"

2. **Exact zoom min/max limits**
   - What we know: react-zoom-pan-pinch supports configurable min/max scale
   - What's unclear: Optimal values for 15-20% orb with future segment layout
   - Recommendation: Start with minScale={0.5} maxScale={3}, adjust after segment positioning in Phase 21

3. **Internal orb texture approach**
   - What we know: Three options mentioned in CONTEXT - smooth gradient, noise/grain, layered rings
   - What's unclear: Which will best achieve "glass sphere with something alive inside" aesthetic
   - Recommendation: Implement all three as functions, toggle via dev flag, user/designer picks best. CONTEXT.md explicitly grants discretion here.

4. **State transition timing curves**
   - What we know: Motion supports spring physics with bounce/stiffness params
   - What's unclear: Exact bounce values for "gathering" vs "complete" to match desired feel
   - Recommendation: Start with bounce: 0.25 (moderate), tune during visual QA. Spring physics auto-adjusts to interruptions.

## Sources

### Primary (HIGH confidence)
- Context7 /websites/motion_dev - Motion library API, spring animations, state-based animations (1474 code snippets)
- Context7 /bettertyped/react-zoom-pan-pinch - Pan/zoom implementation, custom controls, gesture handling (66 code snippets)
- MDN Canvas API Tutorial: Optimizing Canvas - https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- Existing codebase: NetworkVisualization.tsx - Verified ResizeObserver + canvas pattern, devicePixelRatio handling, requestAnimationFrame loop
- Existing codebase: globals.css - Design tokens in oklch, glass effect utilities, mobile optimization

### Secondary (MEDIUM confidence)
- [A look at 2D vs WebGL canvas performance](https://semisignal.com/a-look-at-2d-vs-webgl-canvas-performance/) - Canvas 2D 15ms vs WebGL 40ms initial load
- [Next-level frosted glass with backdrop-filter](https://www.joshwcomeau.com/css/backdrop-filter/) - Mobile limits: 2-3 glass elements, 6-8px blur
- [HTML5 Canvas Performance and Optimization Tips](https://gist.github.com/jaredwilli/5469626) - Offscreen canvas, sub-pixel rendering, layer strategies
- [State Machines in React](https://mastery.games/post/state-machines-in-react/) - Animation state pattern: 'open' | 'opening' | 'closed' | 'closing'
- [Progressive Disclosure - NN/g](https://www.nngroup.com/articles/progressive-disclosure/) - UI pattern definition and layered information approach
- [Canvas with React.js](https://medium.com/@pdx.lucasm/canvas-with-react-js-32e133c05258) - useRef + useEffect canvas pattern

### Tertiary (LOW confidence)
- Various WebSearch results on glassmorphism trends 2026 - Design aesthetic context but not technical implementation
- FreeFrontend CSS examples - Inspirational but not production patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Motion and react-zoom-pan-pinch are Context7-verified, existing codebase uses canvas patterns
- Architecture: HIGH - Patterns verified in production code (NetworkVisualization) and official library docs
- Pitfalls: HIGH - Sourced from MDN official docs, verified in existing codebase issues (retina blur, state management)
- Performance: HIGH - MDN optimization guide + verified mobile limits from multiple sources

**Research date:** 2026-01-31
**Valid until:** ~60 days (stable domain - canvas APIs, established libraries; Motion updates won't break core patterns)

**Notes:**
- Existing NetworkVisualization.tsx provides battle-tested foundation for canvas setup
- Motion library already in project (12.29.2) - no new major dependency
- Design tokens in globals.css already define oklch colors, glass utilities, mobile optimizations
- CONTEXT.md grants discretion on texture approach, rendering method, exact zoom limits - research provides options for each
