# Features Section - Societies.io

## Screenshot Reference
`_assets/landing-full-dark.png` (features grid)

---

## Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Into the future                                               │
│                                                                 │
│   Research that was impossible                                  │
│   is now instant                                                │
│                                                                 │
│   Access high-value audiences. Understand decision-makers.      │
│   Discover critical insights.                                   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────┐  ┌─────────────────────┐             │
│   │ [icon]              │  │ [icon]              │             │
│   │ Unreachable         │  │ Instant insights    │             │
│   │ audiences           │  │                     │             │
│   │                     │  │ Replace weeks of... │             │
│   │ Survey Fortune 500..│  │                     │             │
│   └─────────────────────┘  └─────────────────────┘             │
│                                                                 │
│   ┌─────────────────────┐  ┌─────────────────────┐             │
│   │ [icon]              │  │ [icon]              │             │
│   │ Millions of         │  │ True understanding  │             │
│   │ personas            │  │                     │             │
│   │                     │  │ Go beyond surface...│             │
│   │ Every persona is... │  │                     │             │
│   └─────────────────────┘  └─────────────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## HTML Structure

```html
<section class="py-24">
  <div class="max-w-6xl mx-auto px-6">

    <!-- Section Header -->
    <div class="mb-16">
      <span class="text-sm text-gray-300">Into the future</span>
      <h2 class="font-display text-[40px] leading-[44px] font-[350] text-white mt-4">
        Research that was impossible<br>
        is now instant
      </h2>
      <p class="text-white/80 text-lg mt-6 max-w-2xl">
        Access high-value audiences. Understand decision-makers. Discover critical insights.
      </p>
    </div>

    <!-- Feature Cards Grid (2x2) -->
    <div class="grid grid-cols-2 gap-6">

      <!-- Card 1: Unreachable audiences -->
      <div class="p-8 border border-white/10 rounded-lg">
        <img src="/icons/users-group.svg" class="w-8 h-8 mb-6" />
        <h3 class="font-display text-lg font-medium text-white mb-3">
          Unreachable audiences
        </h3>
        <p class="text-gray-400 text-base leading-relaxed">
          Survey Fortune 500 executives, rare specialists, or hyper-specific
          demographics that traditional panels cannot access.
        </p>
      </div>

      <!-- Card 2: Instant insights -->
      <div class="p-8 border border-white/10 rounded-lg">
        <img src="/icons/lightning.svg" class="w-8 h-8 mb-6" />
        <h3 class="font-display text-lg font-medium text-white mb-3">
          Instant insights
        </h3>
        <p class="text-gray-400 text-base leading-relaxed">
          Replace weeks of recruitment and fieldwork with instant responses.
          Run thousands of interviews before your competitor sends one survey.
        </p>
      </div>

      <!-- Card 3: Millions of personas -->
      <div class="p-8 border border-white/10 rounded-lg">
        <img src="/icons/people-network.svg" class="w-8 h-8 mb-6" />
        <h3 class="font-display text-lg font-medium text-white mb-3">
          Millions of personas
        </h3>
        <p class="text-gray-400 text-base leading-relaxed">
          Every persona is demographically and psychographically calibrated,
          creating responses as nuanced and diverse as real humans.
        </p>
      </div>

      <!-- Card 4: True understanding -->
      <div class="p-8 border border-white/10 rounded-lg">
        <img src="/icons/brain.svg" class="w-8 h-8 mb-6" />
        <h3 class="font-display text-lg font-medium text-white mb-3">
          True understanding
        </h3>
        <p class="text-gray-400 text-base leading-relaxed">
          Go beyond surface-level answers. Our personas reason, reflect,
          and respond with the depth of genuine human cognition.
        </p>
      </div>

    </div>
  </div>
</section>
```

---

## Styles

### Section Label ("Into the future")
```css
.label {
  font-family: Satoshi;
  font-size: 14px;
  color: rgb(245, 245, 245);
}
```

### Section Heading (H2)
```css
h2 {
  font-family: "Funnel Display", sans-serif;
  font-size: 40px;
  font-weight: 350;
  line-height: 44px;
  color: rgb(255, 255, 255);
}
```

### Card Title (H3)
```css
h3 {
  font-family: "Funnel Display", sans-serif;
  font-size: 18px;
  font-weight: 500;
  line-height: 27px;
  color: rgb(255, 255, 255);
  margin-bottom: 12px;
}
```

### Card Description
```css
p {
  font-family: Satoshi;
  font-size: 16px;
  line-height: 24px;
  color: rgb(204, 204, 204);
}
```

### Feature Card Container
```css
.feature-card {
  padding: 48px 26px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: transparent;
}
```

---

## Feature Content

| Icon | Title | Description |
|------|-------|-------------|
| Users Group | Unreachable audiences | Survey Fortune 500 executives, rare specialists, or hyper-specific demographics that traditional panels cannot access. |
| Lightning | Instant insights | Replace weeks of recruitment and fieldwork with instant responses. Run thousands of interviews before your competitor sends one survey. |
| Network | Millions of personas | Every persona is demographically and psychographically calibrated, creating responses as nuanced and diverse as real humans. |
| Brain | True understanding | Go beyond surface-level answers. Our personas reason, reflect, and respond with the depth of genuine human cognition. |

---

## Icons
All icons appear to be from Phosphor Icons library or similar. They are:
- Simple line icons
- ~32px rendered size
- Current color (white in dark mode)

---

## Delta Notes
- [ ] Match 2x2 grid layout
- [ ] Get/create matching icons
- [ ] Match card border style
- [ ] Match typography exactly
