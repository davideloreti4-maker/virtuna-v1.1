# Phase 21: Particle System - Research

**Researched:** 2026-01-31
**Domain:** Canvas 2D particle animation, state-driven particle behavior, requestAnimationFrame patterns
**Confidence:** HIGH

## Summary

Phase 21 implements the ambient particle flow surrounding the visualization orb and the dramatic "rush toward center" effect when processing begins. This builds directly on Phase 20's canvas foundation and orb component.

The research reveals a clear path: use native Canvas 2D with a custom particle system rather than external libraries. The project already has an established `NetworkVisualization` component using Canvas 2D with requestAnimationFrame, devicePixelRatio handling, and prefers-reduced-motion support. Following this pattern provides consistency and avoids dependency bloat.

Key findings:
- Custom Canvas 2D particle systems outperform library abstractions for targeted effects like "rush toward point"
- Object pooling is essential for 60fps mobile performance (50-80 particles on mobile, 200-300 on desktop)
- Simplex noise creates organic flowing motion for the idle state captivating effect
- State machine pattern (idle/processing) cleanly separates particle behaviors
- Existing project patterns (NetworkVisualization) provide a proven React+Canvas architecture

**Primary recommendation:** Build a custom `ParticleSystem` component using Canvas 2D, following the established `NetworkVisualization` pattern. Use simplex-noise for organic idle movement and distance-based force calculations for the processing rush effect.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Canvas 2D API | Native | Particle rendering | No dependency, 60fps capable, existing project pattern |
| requestAnimationFrame | Native | Animation loop | Browser-synchronized, battery-efficient, auto-pauses |
| simplex-noise | ^4.0.3 | Organic noise movement | Lightweight (2kb), TypeScript native, 72M ops/sec |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| simplex-noise | ^4.0.3 | Organic idle motion | Flowing particle paths, non-linear drift |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom Canvas 2D | tsParticles | tsParticles adds 50kb+ bundle, less control over "rush toward center" effect |
| Custom Canvas 2D | Three.js particles | Overkill for 2D, Phase 20 uses Canvas 2D already |
| simplex-noise | Hand-rolled Perlin | simplex-noise is battle-tested, TypeScript native |

**Installation:**
```bash
pnpm add simplex-noise
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   └── visualization/
│       ├── particle-system.tsx      # Main particle component
│       ├── use-particle-physics.ts  # Physics simulation hook
│       └── particle-types.ts        # TypeScript interfaces
├── lib/
│   └── particle-utils.ts            # Easing, noise, vector math
```

### Pattern 1: React Canvas Animation Pattern
**What:** Separate animation engine from rendering layer using refs and effects
**When to use:** Any canvas animation in React
**Example:**
```typescript
// Source: MDN Canvas API + CSS-Tricks requestAnimationFrame patterns
const ParticleSystem = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationIdRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      updateParticles(particlesRef.current, time);
      drawParticles(ctx, particlesRef.current);
      animationIdRef.current = requestAnimationFrame(animate);
    };

    animationIdRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationIdRef.current);
  }, []);

  return <canvas ref={canvasRef} />;
};
```

### Pattern 2: Object Pooling for Particles
**What:** Pre-allocate particle array and reset properties instead of creating/destroying
**When to use:** Always for particle systems to avoid GC pauses
**Example:**
```typescript
// Source: Web search verified pattern
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  alpha: number;
}

const createParticlePool = (count: number): Particle[] => {
  return Array.from({ length: count }, () => ({
    x: 0, y: 0, vx: 0, vy: 0, active: false, alpha: 1
  }));
};

const resetParticle = (p: Particle, x: number, y: number) => {
  p.x = x;
  p.y = y;
  p.vx = (Math.random() - 0.5) * 2;
  p.vy = (Math.random() - 0.5) * 2;
  p.active = true;
  p.alpha = 1;
};
```

### Pattern 3: State-Driven Particle Behavior
**What:** Separate idle and processing behaviors via state prop
**When to use:** When particle behavior changes based on application state
**Example:**
```typescript
// Source: Architecture pattern for Phase 21 requirements
type ParticleState = 'idle' | 'processing';

const updateParticle = (
  p: Particle,
  state: ParticleState,
  centerX: number,
  centerY: number,
  noise2D: (x: number, y: number) => number,
  time: number
) => {
  if (state === 'idle') {
    // Organic flowing motion using simplex noise
    const angle = noise2D(p.x * 0.01, p.y * 0.01 + time * 0.001) * Math.PI * 2;
    p.vx += Math.cos(angle) * 0.1;
    p.vy += Math.sin(angle) * 0.1;
  } else if (state === 'processing') {
    // Rush toward center
    const dx = centerX - p.x;
    const dy = centerY - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const force = 0.5 / Math.max(dist * 0.1, 1);
    p.vx += (dx / dist) * force;
    p.vy += (dy / dist) * force;
  }

  // Apply velocity with damping
  p.x += p.vx;
  p.y += p.vy;
  p.vx *= 0.98;
  p.vy *= 0.98;
};
```

### Pattern 4: Easing Functions for Smooth Transitions
**What:** Cubic ease-in-out for state transitions
**When to use:** Transitioning between idle and processing states
**Example:**
```typescript
// Source: CSS-Tricks canvas easing article
const easeInOutCubic = (t: number): number => {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

// Transition blend factor
const blendStates = (
  idleValue: number,
  processingValue: number,
  progress: number
): number => {
  const easedProgress = easeInOutCubic(progress);
  return idleValue * (1 - easedProgress) + processingValue * easedProgress;
};
```

### Anti-Patterns to Avoid
- **Creating new objects per frame:** Causes GC pauses, always use object pooling
- **Using setInterval/setTimeout:** Use requestAnimationFrame for battery efficiency and vsync
- **Ignoring devicePixelRatio:** Causes blurry rendering on retina displays
- **Skipping cancelAnimationFrame cleanup:** Causes memory leaks when component unmounts

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Organic noise movement | Random velocity jitter | simplex-noise | Perlin/simplex noise produces coherent, flowing motion without sudden direction changes |
| High-DPI canvas scaling | Manual pixel calculations | devicePixelRatio pattern | Browser provides correct scaling factor, tested across devices |
| Animation timing | Manual timestamp math | requestAnimationFrame delta | Browser handles vsync, inactive tab throttling, and provides accurate timestamps |

**Key insight:** Particle physics (attraction, noise-based flow) looks simple but achieving smooth, organic motion requires proven algorithms. Use simplex-noise for flow, not random values.

## Common Pitfalls

### Pitfall 1: Memory Leaks from Animation Loops
**What goes wrong:** Animation continues running after component unmounts, consuming CPU/memory
**Why it happens:** Missing cleanup in useEffect, or cleanup called after next animation frame request
**How to avoid:** Store animation frame ID in ref, call cancelAnimationFrame in cleanup
**Warning signs:** CPU usage stays high after navigating away, memory grows over time

### Pitfall 2: Garbage Collection Pauses
**What goes wrong:** Visible stutter every few seconds as GC runs
**Why it happens:** Creating new particle objects each frame instead of pooling
**How to avoid:** Pre-allocate particle array, reset properties instead of creating new objects
**Warning signs:** Performance timeline shows regular GC events during animation

### Pitfall 3: Blurry Canvas on Retina Displays
**What goes wrong:** Particles appear fuzzy/pixelated on high-DPI screens
**Why it happens:** Canvas pixel dimensions don't match CSS dimensions scaled by devicePixelRatio
**How to avoid:** Set canvas.width/height to CSS size * devicePixelRatio, then scale context
**Warning signs:** Comparing animation on retina vs non-retina shows quality difference

### Pitfall 4: Jerky State Transitions
**What goes wrong:** Particles jump suddenly when switching from idle to processing
**Why it happens:** Instant velocity change without interpolation
**How to avoid:** Ease between state behaviors over 300-500ms, blend velocities
**Warning signs:** Visual "snap" when processing begins

### Pitfall 5: Mobile Performance Issues
**What goes wrong:** Animation drops below 60fps on mobile devices
**Why it happens:** Too many particles, expensive draw operations (shadowBlur), no adaptive quality
**How to avoid:** Limit mobile to 50-80 particles, disable shadowBlur on mobile, use configurable particle count
**Warning signs:** FPS drops visible in performance monitor, battery drain complaints

## Code Examples

Verified patterns from official sources:

### Canvas Setup with High-DPI Support
```typescript
// Source: MDN Canvas optimization guide + existing NetworkVisualization pattern
const setupCanvas = (
  canvas: HTMLCanvasElement,
  container: HTMLElement
): CanvasRenderingContext2D | null => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.scale(dpr, dpr);

  return ctx;
};
```

### Simplex Noise Particle Flow
```typescript
// Source: simplex-noise docs + Codrops ambient canvas backgrounds
import { createNoise2D } from 'simplex-noise';

const noise2D = createNoise2D();

const updateIdleParticle = (
  p: Particle,
  time: number,
  flowScale: number = 0.005,
  flowSpeed: number = 0.0005
) => {
  // Noise returns -1 to 1, multiply by tau for full angle range
  const angle = noise2D(
    p.x * flowScale,
    p.y * flowScale + time * flowSpeed
  ) * Math.PI * 2;

  const flowStrength = 0.1;
  p.vx += Math.cos(angle) * flowStrength;
  p.vy += Math.sin(angle) * flowStrength;
};
```

### Attraction to Center Point
```typescript
// Source: Cruip particle tutorial + physics best practices
const attractToCenter = (
  p: Particle,
  centerX: number,
  centerY: number,
  strength: number = 0.02,
  maxSpeed: number = 5
) => {
  const dx = centerX - p.x;
  const dy = centerY - p.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > 1) {
    // Normalize and apply force
    const force = strength;
    p.vx += (dx / distance) * force;
    p.vy += (dy / distance) * force;
  }

  // Clamp velocity
  const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  if (speed > maxSpeed) {
    p.vx = (p.vx / speed) * maxSpeed;
    p.vy = (p.vy / speed) * maxSpeed;
  }
};
```

### Prefers Reduced Motion Support
```typescript
// Source: Existing NetworkVisualization pattern
const useReducedMotion = (): boolean => {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return reducedMotion;
};
```

### Configurable Particle Count
```typescript
// Source: Phase 21 requirement - particle count configurable for performance
interface ParticleSystemProps {
  particleCount?: number;
  state: 'idle' | 'processing';
  centerX: number;
  centerY: number;
}

const getDefaultParticleCount = (): number => {
  // Detect mobile via screen width (crude but effective)
  if (typeof window === 'undefined') return 100;
  return window.innerWidth < 768 ? 60 : 150;
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| particles.js | tsParticles 3.x | 2022 | TypeScript native, better performance, active maintenance |
| setInterval animation | requestAnimationFrame | 2012+ | Battery efficiency, vsync alignment, auto-throttling |
| Random velocity changes | Simplex/Perlin noise | Standard | Coherent, organic motion instead of jittery movement |
| Fixed particle count | Adaptive particle count | Mobile-first era | 60fps on all devices |

**Deprecated/outdated:**
- particles.js: No longer maintained, use tsParticles if external library needed
- react-particles-js: Deprecated in favor of @tsparticles/react

## Open Questions

Things that couldn't be fully resolved:

1. **Exact particle visual style**
   - What we know: Phase 20 establishes orb with cyan glow, purple-to-cyan palette
   - What's unclear: Should particles use gradient colors, solid cyan, or match existing network dots?
   - Recommendation: Start with semi-transparent cyan (#72C5E0 at 0.6 opacity), iterate based on visual integration with orb

2. **Particle spawn behavior during processing**
   - What we know: Particles rush toward orb center during processing
   - What's unclear: Do particles respawn at edges during processing, or do existing particles just converge?
   - Recommendation: Particles converge without respawning during processing (simpler, more dramatic)

3. **Integration with Phase 22 nodes**
   - What we know: Phase 22 adds nodes that form during processing
   - What's unclear: Do particles transform into nodes, or are they separate systems?
   - Recommendation: Keep systems separate; particles are ambient, nodes are content

## Sources

### Primary (HIGH confidence)
- MDN Canvas API Tutorial - Optimization techniques, requestAnimationFrame
- MDN Basic Animations - Animation loop patterns
- Existing `src/components/app/network-visualization.tsx` - Proven React+Canvas pattern

### Secondary (MEDIUM confidence)
- CSS-Tricks: requestAnimationFrame with React Hooks - Verified cleanup patterns
- CSS-Tricks: Easing Animations in Canvas - Cubic easing implementation
- Cruip: Beautiful Particle Animation with HTML Canvas - Mouse attraction physics
- Codrops: Ambient Canvas Backgrounds - Simplex noise flow patterns
- simplex-noise GitHub - API documentation, TypeScript support

### Tertiary (LOW confidence)
- Web search results for mobile particle performance - General guidelines (50-80 particles mobile)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Canvas 2D is established in codebase, simplex-noise is standard
- Architecture: HIGH - Patterns directly follow existing NetworkVisualization component
- Pitfalls: HIGH - Memory leak and GC issues are well-documented across multiple sources

**Research date:** 2026-01-31
**Valid until:** 2026-03-01 (30 days - stable domain, patterns don't change quickly)
