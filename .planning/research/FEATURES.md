# Features Research: Premium Landing Page Design

**Domain:** Premium SaaS Landing Page (Raycast-inspired, iOS 26 aesthetic)
**Researched:** 2026-01-31
**Confidence:** HIGH (verified via multiple sources + official Apple documentation)

---

## Raycast Design Patterns

### Hero Section

**What Makes It Impactful:**

1. **Dramatic Gradient Lighting**
   - Dark background (#0A0A0B or similar near-black) as canvas
   - Multi-color radial gradients (purple, pink, blue spectrum)
   - 800px+ blur radius for seamless color blending
   - Gradients positioned behind/around product mockups creating "ambient glow"
   - Colors follow the spectrum: adjacent hues blend naturally

2. **Headline That Commands Attention**
   - Speaks directly to power users, avoids generic productivity language
   - Large, bold sans-serif typography (48-72px on desktop)
   - High contrast: white text on dark background
   - Tagline as secondary text with reduced opacity

3. **Product-First Visual Hierarchy**
   - Real interface mockups, not abstract illustrations
   - macOS window chrome with traffic light buttons (red, yellow, green)
   - Mockup demonstrates actual functionality, not marketing fluff
   - Subtle floating effect with box shadows

4. **CTA Design**
   - Primary CTA feels like an invitation, not a sales push
   - High contrast button with subtle hover glow
   - Secondary action (usually "Learn more") with ghost styling

### Feature Cards

**The Gradient System:**

Each feature card has a distinct color identity:
- Unique accent gradient per feature (not just one brand color)
- Example: AI features = purple/magenta, Extensions = blue/cyan, Commands = orange/amber
- Gradient applied as subtle glow behind card or as accent border
- Cards maintain dark backgrounds with colored highlights

**Interactive Elements:**

- Hover effects that reveal more information or animate the content
- Scale transformations (1.02-1.05x on hover)
- Color intensity increases on interaction
- Micro-animations that demonstrate the feature (not just decorate)

**Card Structure:**
```
[Icon or Mini Demo]
[Feature Title] - Bold, 18-24px
[Feature Description] - 14-16px, muted color
[Interactive element or CTA]
```

**Implementation Pattern:**
```css
.feature-card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  transition: all 0.3s ease;
}

.feature-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}
```

### Window Mockups

**macOS Window Chrome:**

Traffic light buttons (essential for authenticity):
```css
.traffic-lights {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
}

.traffic-light {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.traffic-light--close { background: #FF5F56; }
.traffic-light--minimize { background: #FFBD2E; }
.traffic-light--maximize { background: #27C93F; }
```

**Glass Panel Effect:**
- Window background: rgba(30, 30, 30, 0.8) or darker
- Strong backdrop-filter blur (20-40px)
- Subtle border: 1px solid rgba(255, 255, 255, 0.1)
- Border-radius: 12-16px (matching macOS Sonoma+)
- Drop shadow for depth separation

**Floating Presentation:**
- Windows appear to float above the gradient background
- Multiple shadows at different distances create depth
- Slight perspective transform for dimensionality
- Parallax on scroll for premium feel

### Navigation

**Premium Nav Patterns:**

1. **Sticky with Blur**
   ```css
   .nav {
     position: sticky;
     top: 0;
     z-index: 50;
     background: rgba(10, 10, 11, 0.8);
     backdrop-filter: blur(20px) saturate(180%);
     border-bottom: 1px solid rgba(255, 255, 255, 0.05);
   }
   ```

2. **Minimal Link Styling**
   - Ghost links (no underlines, no boxes)
   - Opacity change on hover (0.7 -> 1.0)
   - Active state with subtle accent color

3. **Logo Presence**
   - Clean wordmark or icon
   - No excessive branding weight

4. **CTA Prominence**
   - Primary action (Download/Sign up) styled distinctly
   - Usually solid button with brand color

---

## iOS 26 Design Principles

### Depth & Layers

**Three-Layer System:**
- **Foreground:** Interactive controls with crisp edges and soft highlights
- **Midground:** Translucent elements with adaptive tint for readability
- **Background:** Processed with dynamic blur that adapts to content

**Creating Hierarchy:**
- Liquid Glass creates hierarchy through translucency, not opacity
- Foreground controls "float" above content using glass layers
- Content always leads; interface visually recedes
- Real-time rendering adapts to movement with specular highlights

**Implementation:**
```css
/* Foreground element */
.control-foreground {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(2px);
  box-shadow:
    0 8px 32px rgba(31, 38, 135, 0.2),
    inset 0 4px 20px rgba(255, 255, 255, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.8);
}

/* Midground element */
.panel-midground {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

/* Background treatment */
.background-layer {
  backdrop-filter: blur(40px) saturate(180%);
}
```

### Translucency

**Liquid Glass Material Properties:**

1. **Light Bending (Lensing)**
   - Bends and concentrates light in real-time
   - More sophisticated than traditional blur that scatters light
   - CSS approximation: combine blur + subtle displacement

2. **Specular Highlights**
   - Respond to device motion (parallax)
   - On web: simulate with gradient overlays that shift on mouse/scroll
   - Inner glow effects that suggest light reflection

3. **Adaptive Shadows**
   - Shadows adapt to content beneath
   - Multi-layer shadows at different opacities
   - Color-aware (shadows pick up ambient color)

**CSS Three-Layer Pattern:**
```css
/* Main element */
.glass-card {
  position: relative;
  border-radius: 20px;
  isolation: isolate;
  box-shadow: 0px 6px 24px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(1px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* ::before for internal depth */
.glass-card::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: 20px;
  box-shadow: inset 0 0 20px -5px rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.05);
}

/* ::after for backdrop blur */
.glass-card::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: 28px;
  backdrop-filter: blur(8px);
}
```

**Translucency Values:**
- Subtle glass: rgba(255, 255, 255, 0.05-0.10)
- Medium glass: rgba(255, 255, 255, 0.10-0.15)
- Strong glass: rgba(255, 255, 255, 0.15-0.25)
- Blur: 8-20px for UI elements, 40px+ for background panels

### Motion

**Core Animation Principles:**

1. **Spring-Based Curves**
   - Natural, physics-based motion
   - Avoid linear or harsh ease-in-out
   - Recommended: spring(duration: 0.3s, bounce: 0.2)

2. **Timing Guidelines**
   - Micro-interactions: 150-200ms
   - UI transitions: 200-300ms
   - Page transitions: 300-500ms

3. **Key Motion Behaviors**
   - **Materialization:** Elements appear by gradually modulating light
   - **Fluidity:** Gel-like flexibility with instant touch response
   - **Morphing:** Dynamic transformation between states

**Framer Motion Implementation:**
```tsx
// Spring animation for hover
const cardVariants = {
  initial: { scale: 1, y: 0 },
  hover: {
    scale: 1.02,
    y: -4,
    transition: { type: "spring", stiffness: 400, damping: 25 }
  }
};

// Page element entrance
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }
  }
};
```

4. **Parallax (Refined)**
   - Subtle depth shifts on scroll/mouse movement
   - Background elements move slower than foreground
   - Creates depth without feeling gimmicky
   - Respect "Reduce Motion" preference

5. **Accessibility**
   - Always provide reduced motion alternatives
   - Liquid Glass respects prefers-reduced-motion
   - Static fallback for users sensitive to motion

---

## Table Stakes

Features users expect for a premium feel. Missing any = page feels incomplete.

| Feature | Why Expected | Complexity | Implementation Notes |
|---------|--------------|------------|---------------------|
| **Dark Theme** | Industry standard for dev/tech tools | Low | Near-black background (#0A0A0B) |
| **Responsive Design** | Users expect mobile parity | Medium | Same premium feel at all breakpoints |
| **Smooth Scrolling** | Basic UX expectation | Low | CSS scroll-behavior: smooth |
| **Hover States** | Feedback is expected | Low | Opacity, scale, or color shifts |
| **Fast Load** | Sub-3s for perceived premium | Medium | Optimize images, lazy load |
| **Clear Hierarchy** | Readability is non-negotiable | Low | Proper typography scale |
| **Consistent Spacing** | Visual polish indicator | Low | 8px grid system |
| **High-Quality Images** | Blurry = cheap | Low | 2x assets, proper compression |
| **Readable Text** | WCAG 4.5:1 contrast minimum | Medium | Add semi-transparent overlays to glass |
| **Navigation** | Sticky, blurred header | Low | position: sticky + backdrop-filter |

---

## Differentiators

Features that elevate beyond expectations. These make the page memorable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Gradient Ambient Lighting** | Creates cinematic, theatrical feel | Medium | Multi-color radial gradients, 800px+ blur |
| **Interactive Feature Demos** | Shows, not tells | High | Functional mini-apps in cards |
| **Liquid Glass Effects** | iOS 26 alignment, cutting-edge | Medium | Three-layer CSS system |
| **macOS Window Mockups** | Establishes platform credibility | Low | Traffic lights + glass chrome |
| **Per-Feature Color Identity** | Each feature is memorable | Low | Unique gradients per section |
| **Parallax Depth** | Adds dimensionality | Medium | Framer Motion scroll effects |
| **Specular Highlights** | Premium material feel | High | Gradient overlays that shift with mouse |
| **Staggered Animations** | Choreographed entrance | Low | Framer Motion stagger children |
| **Adaptive Shadows** | Dynamic depth | Medium | Multi-layer shadows, color-aware |
| **Magnetic Buttons** | Delightful micro-interaction | Medium | Button follows cursor slightly |

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Excessive Motion** | Causes motion sickness, slows perceived load | Purposeful animation only, respect prefers-reduced-motion |
| **Auto-Playing Video** | Annoying, bandwidth-heavy, accessibility issue | Static hero or user-triggered demos |
| **Too Many Gradients** | Visual chaos, loses impact | 2-3 gradient sources max, well-positioned |
| **Low-Contrast Text on Glass** | Illegibility | Add semi-transparent overlay (10-30% opacity) behind text |
| **Overly Busy Backgrounds** | Distracts from content | Heavy blur (800px+) or simplified backgrounds |
| **Slow Animations** | Feels sluggish, not premium | Keep UI transitions under 300ms |
| **Horizontal Scroll** | UX nightmare on all devices | Proper responsive design, no horizontal overflow |
| **Pop-ups/Modals on Load** | Immediate bounce risk | Earned interactions only |
| **Carousel/Sliders** | Low engagement, accessibility issues | Grid or vertical scroll instead |
| **Parallax on Everything** | Performance issues, disorienting | Subtle, 1-2 elements max |

---

## Feature Dependencies

```
[Dark Theme]
    └─> [Gradient Lighting] (gradients only work on dark)
        └─> [Glass Effects] (glass needs gradient/color behind it)
            └─> [Window Mockups] (mockups use glass)

[Typography System]
    └─> [Hierarchy]
        └─> [Readability on Glass] (requires overlay strategy)

[Animation Foundation]
    └─> [Hover Effects]
    └─> [Scroll Animations]
    └─> [Parallax] (most complex, do last)

[Responsive Foundation]
    └─> [Mobile Glass Effects] (simplified for performance)
    └─> [Touch Interactions] (replace hover with tap)
```

---

## MVP Recommendation

For MVP, prioritize:

1. **Hero Section with Gradient Lighting** - First impression, highest impact
2. **Glass Navigation** - Sets premium tone immediately
3. **macOS Window Mockups** - Establishes credibility
4. **Feature Cards with Color Identity** - Core content presentation
5. **Smooth Scroll Animations** - Polished feel with low effort

**Defer to Post-MVP:**
- Interactive feature demos (high complexity)
- Specular highlights / mouse-following effects (diminishing returns)
- Complex parallax (performance concerns on mobile)
- Magnetic buttons (nice-to-have, not essential)

---

## Implementation Priority Order

1. **Foundation:** Dark theme, typography, spacing, responsive grid
2. **Hero:** Gradient background, headline, macOS mockup
3. **Navigation:** Sticky, blur, ghost links
4. **Feature Cards:** Glass effect, distinct colors, hover states
5. **Animations:** Entrance animations, scroll triggers
6. **Polish:** Parallax, interactive elements, accessibility audit

---

## Sources

### Raycast & Premium Design
- [Raycast Official](https://www.raycast.com/) - Primary design reference
- [Raycast Blog - Making a Wallpaper](https://www.raycast.com/blog/making-a-raycast-wallpaper) - Gradient technique (800px blur)
- [Dark.design - Raycast](https://www.dark.design/website/raycast) - Dark theme categorization
- [Dribbble - Raycast Designs](https://dribbble.com/tags/raycast) - Design exploration

### iOS 26 Liquid Glass
- [Apple Newsroom - New Software Design](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/) - Official Liquid Glass announcement
- [CSS-Tricks - Getting Clarity on Liquid Glass](https://css-tricks.com/getting-clarity-on-apples-liquid-glass/) - Implementation analysis
- [DEV - Recreating Liquid Glass with CSS](https://dev.to/kevinbism/recreating-apples-liquid-glass-effect-with-pure-css-3gpl) - CSS patterns
- [LogRocket - Liquid Glass Effects CSS/SVG](https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/) - Technical implementation
- [Liquid Glass UI](https://liquidglassui.org/) - React component library

### Motion Design
- [Medium - iOS 26 Motion Design Guide](https://medium.com/@foks.wang/ios-26-motion-design-guide-key-principles-and-practical-tips-for-transition-animations-74def2edbf7c) - Animation timing
- [AppleMagazine - iOS 26.2 Animations](https://applemagazine.com/ios-26-2-beta-2-liquid-glass-animations/) - Spring curves

### Glassmorphism & Accessibility
- [NN/G - Glassmorphism Best Practices](https://www.nngroup.com/articles/glassmorphism/) - Authoritative UX guidance
- [Alpha Efficiency - Dark Mode Glassmorphism](https://alphaefficiency.com/dark-mode-glassmorphism) - Dark theme specifics
- [New Target - Glassmorphism Accessibility](https://www.newtarget.com/web-insights-blog/glassmorphism/) - Contrast strategies

### Landing Page Trends
- [SaaSFrame - 10 SaaS Landing Page Trends 2026](https://www.saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples) - Current patterns
- [Lapa Ninja - Gradient Landing Pages](https://www.lapa.ninja/category/gradient/) - 452 examples
