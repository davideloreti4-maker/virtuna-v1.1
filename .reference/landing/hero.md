# Hero Section - Societies.io

## Screenshot Reference
`_assets/landing-full-dark.png` (top section)

---

## Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ [Nav]                                                           │
│   Logo + "Artificial Societies"     "Sign in"  [Book a Meeting] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Human Behavior,                     ┌─────────────────┐       │
│   Simulated.  (orange)                │  3D Network     │       │
│                                       │  Visualization  │       │
│   AI personas that replicate          │  (Three.js)     │       │
│   real-world attitudes...             │                 │       │
│                                       │  + Persona Card │       │
│   [Get in touch]                      │    (floating)   │       │
│                                       └─────────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## HTML Structure

```html
<nav class="flex justify-between items-center px-8 py-3.5 bg-background">
  <a href="/" class="flex items-center gap-2">
    <img src="/logo.svg" alt="" />
    <p class="font-sans text-white">Artificial Societies</p>
  </a>
  <div class="flex items-center gap-4">
    <p class="cursor-pointer text-white">Sign in</p>
    <button class="bg-accent text-white px-4 py-2 rounded text-sm font-medium">
      Book a Meeting
    </button>
  </div>
</nav>

<section class="relative">
  <!-- Background canvas for animation -->
  <canvas class="absolute inset-0" />

  <div class="flex items-center justify-between max-w-6xl mx-auto px-6 py-24">
    <!-- Left: Text content -->
    <div class="max-w-xl">
      <h1 class="font-display text-[52px] leading-[62px] font-[350] text-white">
        Human Behavior,<br>
        <span class="text-accent">Simulated.</span>
      </h1>
      <p class="text-white/90 text-xl leading-[30px] font-[450] mt-6">
        AI personas that replicate real-world attitudes, beliefs, and opinions.
      </p>
      <button class="mt-8 bg-accent text-white px-4 py-2 rounded text-sm font-medium">
        Get in touch
      </button>
    </div>

    <!-- Right: 3D visualization + Persona card -->
    <div class="relative">
      <!-- Three.js canvas: 626x550 -->
      <div class="w-[626px] h-[550px]">
        <!-- Network graph visualization -->
      </div>

      <!-- Floating persona card (positioned bottom-right) -->
      <div class="absolute bottom-0 right-0 bg-background-elevated rounded-lg p-4">
        <!-- Persona card content -->
      </div>
    </div>
  </div>
</section>
```

---

## Styles

### Navigation
```css
nav {
  background-color: rgb(13, 13, 13);
  padding: 14px 32px;
}
```

### Hero Heading
```css
h1 {
  font-family: "Funnel Display", sans-serif;
  font-size: 52px;
  font-weight: 350;
  line-height: 62.4px;
  color: rgb(255, 255, 255);
}

h1 span {
  color: rgb(229, 120, 80); /* Orange accent */
}
```

### Hero Paragraph
```css
p {
  font-family: Satoshi, sans-serif;
  font-size: 20px;
  font-weight: 450;
  line-height: 30px;
  color: rgb(255, 255, 255);
}
```

### CTA Button
```css
button {
  background-color: rgb(229, 120, 80);
  color: rgb(255, 255, 255);
  font-size: 14px;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 4px;
}
```

---

## Animations

### Text entrance
- Opacity: 0 → 1
- Transform: translateY(20px) → translateY(0)
- Easing: ease-out-cubic
- Staggered per element

### 3D Network
- Uses Three.js (r181)
- Interactive: rotate, zoom, pan
- Nodes connected with lines
- Animated node positions

### Persona Card
- Fades in with slight translateY
- Contains avatar (initials), name, role, company, bio
- Demographic tags with icons

---

## Persona Card Detail

```html
<div class="bg-background-elevated rounded-lg p-4 w-72">
  <!-- Header -->
  <div class="flex items-center gap-3 mb-3">
    <div class="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center text-white text-sm">
      AP
    </div>
    <div>
      <div class="text-white font-medium">Aisha Patel</div>
      <div class="text-gray-400 text-sm">Data Scientist</div>
    </div>
  </div>

  <!-- Company & Bio -->
  <div class="mb-3">
    <div class="text-gray-400 text-sm">AI Dynamics</div>
    <div class="text-gray-300 text-sm">Building machine learning models...</div>
  </div>

  <!-- Tags -->
  <div class="flex flex-wrap gap-2">
    <span class="text-xs text-gray-400 flex items-center gap-1">
      <MapPin size={12} /> Toronto, Canada
    </span>
    <span class="text-xs text-gray-400 flex items-center gap-1">
      <GenderFemale size={12} /> Female
    </span>
    <!-- More tags... -->
  </div>
</div>
```

---

## Delta Notes (Your Implementation)
- [ ] Compare with your current hero
- [ ] Match heading typography exactly
- [ ] Implement 3D network or placeholder
- [ ] Add persona card component
- [ ] Match spacing and layout
