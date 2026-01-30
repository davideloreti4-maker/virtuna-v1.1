# Testimonials & Case Studies - Societies.io

## Screenshot Reference
`_assets/landing-full-dark.png` (case study + quotes sections)

---

## Case Study Section (Teneo)

### Structure
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────────────────────┐  ┌──────────────────────────┐    │
│  │ Case Study              │  │                          │    │
│  │                         │  │  [Quote marks]           │    │
│  │ [Teneo Logo]            │  │                          │    │
│  │                         │  │  "What we were able to   │    │
│  │ How Teneo used          │  │   accomplish with        │    │
│  │ Artificial Societies    │  │   Artificial Societies   │    │
│  │ to simulate 180,000+    │  │   would simply have      │    │
│  │ human perspectives.     │  │   been impossible..."    │    │
│  │                         │  │                          │    │
│  │ Read more →             │  │  Sparky Zivin            │    │
│  │                         │  │  Global Head of Research │    │
│  └──────────────────────────┘  └──────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### HTML Structure
```html
<section class="py-24">
  <div class="max-w-6xl mx-auto px-6">
    <div class="grid grid-cols-2 gap-8">

      <!-- Left: Case Study Card -->
      <div class="bg-background-elevated rounded-lg p-8">
        <span class="text-sm text-gray-400">Case Study</span>
        <img
          src="/logos/teneo-logo-dark.png"
          alt="Teneo"
          class="h-12 w-auto mt-4"
        />
        <p class="text-white text-lg mt-6">
          How Teneo used Artificial Societies to simulate 180,000+ human perspectives.
        </p>
        <a href="/case-studies/teneo" class="flex items-center gap-2 text-white mt-6 hover:opacity-80">
          <span>Read more</span>
          <ArrowRight size={16} />
        </a>
      </div>

      <!-- Right: Quote -->
      <div class="flex flex-col justify-center">
        <img src="/icons/quote.svg" class="w-8 h-8 mb-4 opacity-50" />
        <blockquote class="text-white text-xl leading-[34px]">
          What we were able to accomplish with Artificial Societies would
          simply have been impossible with traditional market research
        </blockquote>
        <div class="mt-6">
          <div class="text-white font-medium">Sparky Zivin</div>
          <div class="text-gray-400 text-sm">Global Head of Research, Teneo</div>
        </div>
      </div>

    </div>
  </div>
</section>
```

---

## Pulsar Partnership Section

### Structure
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────────────────────┐  ┌──────────────────────────┐    │
│  │ [Quote marks]           │  │ Strategic partnership    │    │
│  │                         │  │                          │    │
│  │ "By fusing Pulsar's     │  │ [Pulsar Logo]            │    │
│  │  real-world audience    │  │                          │    │
│  │  intelligence with      │  │ Powering the future of   │    │
│  │  Artificial Societies'  │  │ audience intelligence... │    │
│  │  live simulations..."   │  │                          │    │
│  │                         │  │                          │    │
│  │ Francesco D'Orazio      │  │                          │    │
│  │ CEO, Pulsar             │  │                          │    │
│  └──────────────────────────┘  └──────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### HTML Structure
```html
<section class="py-24">
  <div class="max-w-6xl mx-auto px-6">
    <div class="grid grid-cols-2 gap-8">

      <!-- Left: Quote -->
      <div class="flex flex-col justify-center">
        <img src="/icons/quote.svg" class="w-8 h-8 mb-4 opacity-50" />
        <blockquote class="text-white text-xl leading-[34px]">
          By fusing Pulsar's real-world audience intelligence with
          Artificial Societies' live simulations, we're turning static
          personas into dynamic conversations.
        </blockquote>
        <div class="mt-6">
          <div class="text-white font-medium">Francesco D'Orazio</div>
          <div class="text-gray-400 text-sm">Chief Executive Officer, Pulsar</div>
        </div>
      </div>

      <!-- Right: Partnership Card -->
      <div class="bg-background-elevated rounded-lg p-8">
        <span class="text-sm text-gray-400">Strategic partnership</span>
        <img
          src="/logos/pulsar-logo.svg"
          alt="Pulsar"
          class="h-10 w-auto mt-4"
        />
        <p class="text-white text-lg mt-6">
          Powering the future of audience intelligence. Together, we're
          redefining what's possible in understanding human behavior at scale.
        </p>
      </div>

    </div>
  </div>
</section>
```

---

## Styles

### Blockquote
```css
blockquote {
  font-family: Satoshi;
  font-size: 20px;
  font-weight: 400;
  line-height: 34px;
  color: rgb(255, 255, 255);
}
```

### Quote Attribution - Name
```css
.author-name {
  font-family: Satoshi;
  font-weight: 500;
  color: rgb(255, 255, 255);
}
```

### Quote Attribution - Title
```css
.author-title {
  font-family: Satoshi;
  font-size: 14px;
  color: rgb(204, 204, 204);
}
```

### Card Label ("Case Study", "Strategic partnership")
```css
.label {
  font-size: 14px;
  color: rgb(204, 204, 204);
}
```

---

## Assets

### Teneo Logo
- URL: `https://societies.io/assets/teneo-logo-dark-jwgUPXrf.png`
- Dimensions: 220x48px
- Format: PNG with transparency

### Pulsar Logo
- Inline SVG or separate file
- Light colored for dark background

### Quote Icon
- Simple quotation mark SVG
- Semi-transparent (50% opacity)

---

## Delta Notes
- [ ] Match 2-column layout
- [ ] Download/recreate logos
- [ ] Add quote icon
- [ ] Match blockquote styling
- [ ] Add case study link
