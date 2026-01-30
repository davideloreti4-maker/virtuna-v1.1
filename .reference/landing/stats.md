# Stats / Accuracy Section - Societies.io

## Screenshot Reference
`_assets/landing-full-dark.png` (86% accuracy section)

---

## Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────────────────────┐  ┌──────────────────────────┐    │
│  │ Validated accuracy      │  │                          │    │
│  │                         │  │  ┌────────────────────┐  │    │
│  │ 86%                     │  │  │ [AS] Artificial    │  │    │
│  │                         │  │  │ Societies   86%    │  │    │
│  │ Standard AI personas    │  │  ├────────────────────┤  │    │
│  │ plateau at 61-67%       │  │  │ [G] Gemini 2.5     │  │    │
│  │ accuracy. Artificial    │  │  │ Pro         67%    │  │    │
│  │ Societies achieves 86%. │  │  ├────────────────────┤  │    │
│  │ That's 5 points off     │  │  │ [G] Gemini 2.5     │  │    │
│  │ the human replication   │  │  │ Flash       64%    │  │    │
│  │ ceiling...              │  │  ├────────────────────┤  │    │
│  │                         │  │  │ [O] GPT-5    62%   │  │    │
│  │ Read the full           │  │  ├────────────────────┤  │    │
│  │ evaluation report →     │  │  │ [G] Gemini 2.0     │  │    │
│  │                         │  │  │ Flash       61%    │  │    │
│  └──────────────────────────┘  │  └────────────────────┘  │    │
│                                │                          │    │
│                                │  Proportional allocation │    │
│                                │  accuracy across 1,000   │    │
│                                │  survey replications     │    │
│                                └──────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## HTML Structure

```html
<section class="py-24">
  <div class="max-w-6xl mx-auto px-6">
    <div class="grid grid-cols-2 gap-8 items-start">

      <!-- Left: Stat + Description -->
      <div>
        <span class="text-sm text-gray-400">Validated accuracy</span>
        <h2 class="font-display text-[52px] font-[350] text-white mt-4">
          86%
        </h2>
        <p class="text-white/80 text-lg leading-relaxed mt-6">
          Standard AI personas plateau at 61–67% accuracy. Artificial Societies
          achieves 86%. That's 5 points off the human replication ceiling.
          Our personas don't just answer questions, they give reasons like real people.
        </p>
        <a
          href="https://storage.googleapis.com/as-website-assets/Artificial%20Societies%20Survey%20Eval%20Report%20Jan26.pdf"
          class="text-white mt-6 inline-block hover:underline"
        >
          Read the full evaluation report →
        </a>
      </div>

      <!-- Right: Comparison Chart -->
      <div class="bg-background-elevated rounded-lg p-6">
        <div class="space-y-3">

          <!-- Artificial Societies (highlighted) -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <img src="/logos/as-icon.svg" class="w-6 h-6" />
              <span class="text-white">Artificial Societies</span>
            </div>
            <span class="text-white font-medium">86%</span>
          </div>

          <!-- Gemini 2.5 Pro -->
          <div class="flex items-center justify-between opacity-70">
            <div class="flex items-center gap-3">
              <img src="/logos/gemini.svg" class="w-6 h-6" />
              <span class="text-white">Gemini 2.5 Pro</span>
            </div>
            <span class="text-white">67%</span>
          </div>

          <!-- Gemini 2.5 Flash -->
          <div class="flex items-center justify-between opacity-70">
            <div class="flex items-center gap-3">
              <img src="/logos/gemini.svg" class="w-6 h-6" />
              <span class="text-white">Gemini 2.5 Flash</span>
            </div>
            <span class="text-white">64%</span>
          </div>

          <!-- GPT-5 -->
          <div class="flex items-center justify-between opacity-70">
            <div class="flex items-center gap-3">
              <img src="/logos/openai.svg" class="w-6 h-6" />
              <span class="text-white">GPT-5</span>
            </div>
            <span class="text-white">62%</span>
          </div>

          <!-- Gemini 2.0 Flash -->
          <div class="flex items-center justify-between opacity-70">
            <div class="flex items-center gap-3">
              <img src="/logos/gemini.svg" class="w-6 h-6" />
              <span class="text-white">Gemini 2.0 Flash</span>
            </div>
            <span class="text-white">61%</span>
          </div>

        </div>

        <p class="text-gray-400 text-sm mt-6 text-center">
          Proportional allocation accuracy across 1,000 survey replications
        </p>
      </div>

    </div>
  </div>
</section>
```

---

## Styles

### Big Stat Number
```css
.stat-number {
  font-family: "Funnel Display", sans-serif;
  font-size: 52px;
  font-weight: 350;
  color: rgb(255, 255, 255);
}
```

### Comparison List Item
```css
.comparison-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
}

.comparison-item.other {
  opacity: 0.7;
}
```

### Chart Caption
```css
.caption {
  font-size: 14px;
  color: rgb(204, 204, 204);
  text-align: center;
}
```

---

## Comparison Data

| Model | Accuracy |
|-------|----------|
| Artificial Societies | 86% |
| Gemini 2.5 Pro | 67% |
| Gemini 2.5 Flash | 64% |
| GPT-5 | 62% |
| Gemini 2.0 Flash | 61% |

---

## Assets

### Model Logos
- Artificial Societies icon (network/node icon)
- Google Gemini icon
- OpenAI icon

### External Link
- Evaluation report PDF: `https://storage.googleapis.com/as-website-assets/Artificial%20Societies%20Survey%20Eval%20Report%20Jan26.pdf`

---

## Delta Notes
- [ ] Create comparison list component
- [ ] Match typography for big stat
- [ ] Add model logos/icons
- [ ] Style link with arrow
