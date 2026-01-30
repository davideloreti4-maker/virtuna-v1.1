# Backers & Investors Section - Societies.io

## Screenshot Reference
`_assets/landing-full-dark.png` (below hero)

---

## Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Backed by                                                     │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│   │ [icon] P72   │ │ [icon]       │ │ [icon] Y     │           │
│   │ Point72      │ │ Kindred      │ │ Combinator   │           │
│   │ Ventures     │ │ Capital      │ │              │           │
│   └──────────────┘ └──────────────┘ └──────────────┘           │
│                                                                 │
│   With Investors from                                           │
│   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│   │Sequoia │ │Google  │ │DeepMind│ │Prolific│ │Strava  │       │
│   └────────┘ └────────┘ └────────┘ └────────┘ └────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## HTML Structure

```html
<section class="py-16 border-t border-white/10">
  <div class="max-w-6xl mx-auto px-6">

    <!-- Backed by -->
    <div class="mb-12">
      <span class="text-sm text-gray-300 px-4">Backed by</span>
      <div class="flex items-center gap-8 mt-4">
        <div class="flex items-center gap-3">
          <svg><!-- Point72 Ventures logo --></svg>
          <span class="text-white">Point72 Ventures</span>
        </div>
        <div class="flex items-center gap-3">
          <svg><!-- Kindred Capital logo --></svg>
          <span class="text-white">Kindred Capital</span>
        </div>
        <div class="flex items-center gap-3">
          <svg><!-- Y Combinator logo --></svg>
          <span class="text-white">Combinator</span>
        </div>
      </div>
    </div>

    <!-- With Investors from -->
    <div>
      <span class="text-sm text-gray-300 px-4">With Investors from</span>
      <div class="flex items-center gap-6 mt-4">
        <div class="flex items-center gap-2">
          <svg><!-- Sequoia logo --></svg>
          <span class="text-white text-sm">Sequoia</span>
        </div>
        <div class="flex items-center gap-2">
          <svg><!-- Google logo --></svg>
          <span class="text-white text-sm">Google</span>
        </div>
        <div class="flex items-center gap-2">
          <svg><!-- DeepMind logo --></svg>
          <span class="text-white text-sm">DeepMind</span>
        </div>
        <div class="flex items-center gap-2">
          <svg><!-- Prolific logo --></svg>
          <span class="text-white text-sm">Prolific</span>
        </div>
        <div class="flex items-center gap-2">
          <svg><!-- Strava logo --></svg>
          <span class="text-white text-sm">Strava</span>
        </div>
      </div>
    </div>

  </div>
</section>
```

---

## Styles

### Label Text ("Backed by", "With Investors from")
```css
.label {
  font-family: Satoshi;
  font-size: 14px;
  font-weight: 400;
  line-height: 21px;
  color: rgb(245, 245, 245);
  padding: 0 16px;
}
```

### Company Names
```css
.company-name {
  font-family: Satoshi;
  font-size: 14-16px;
  color: rgb(255, 255, 255);
}
```

---

## Logo SVGs (Inline)

All logos are inline SVGs with `fill="currentColor"`. The icons use:
- Point72 Ventures: Custom geometric mark
- Kindred Capital: Dot grid pattern
- Y Combinator: Standard Y logo
- Sequoia: Tree silhouette
- Google: G mark
- DeepMind: Neural network icon
- Prolific: Custom mark
- Strava: Running figure

---

## Animation

- Scroll-triggered fade in
- Elements start with `opacity: 0; transform: translateY(15px)`
- Animate to `opacity: 1; transform: none`
- Staggered per logo item

---

## Delta Notes
- [ ] Collect or recreate logo SVGs
- [ ] Match layout (2 rows)
- [ ] Add scroll animation
- [ ] Match spacing
