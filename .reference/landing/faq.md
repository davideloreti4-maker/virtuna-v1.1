# FAQ Section - Societies.io

## Screenshot Reference
`_assets/landing-full-dark.png` (FAQ accordion)

---

## Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   FAQ                                                           │
│   Common questions                                              │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ How accurate are your AI personas compared to real      │  │
│   │ humans?                                             [+] │  │
│   └─────────────────────────────────────────────────────────┘  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ Are your simulations backed by research?            [+] │  │
│   └─────────────────────────────────────────────────────────┘  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ What audiences can you simulate?                    [+] │  │
│   └─────────────────────────────────────────────────────────┘  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ How long does it take to get results?               [+] │  │
│   └─────────────────────────────────────────────────────────┘  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ Can I interview the personas for qualitative        [+] │  │
│   │ insights?                                               │  │
│   └─────────────────────────────────────────────────────────┘  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ How do you ensure the personas reflect real human   [+] │  │
│   │ diversity?                                              │  │
│   └─────────────────────────────────────────────────────────┘  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ What industries do you work with?                   [+] │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## HTML Structure

```html
<section class="py-24">
  <div class="max-w-3xl mx-auto px-6">

    <!-- Section Header -->
    <div class="mb-12">
      <span class="text-sm text-gray-400">FAQ</span>
      <h2 class="font-display text-[40px] leading-[44px] font-[350] text-white mt-4">
        Common questions
      </h2>
    </div>

    <!-- Accordion -->
    <div class="space-y-2">

      <div class="border border-white/10 rounded-lg">
        <button class="w-full flex items-center justify-between p-4 text-left cursor-pointer">
          <span class="text-white">
            How accurate are your AI personas compared to real humans?
          </span>
          <ChevronDown class="text-white w-5 h-5 transition-transform" />
        </button>
        <!-- Collapsed content -->
        <div class="hidden px-4 pb-4">
          <p class="text-gray-400">Answer content...</p>
        </div>
      </div>

      <div class="border border-white/10 rounded-lg">
        <button class="w-full flex items-center justify-between p-4 text-left cursor-pointer">
          <span class="text-white">
            Are your simulations backed by research?
          </span>
          <ChevronDown class="text-white w-5 h-5" />
        </button>
      </div>

      <div class="border border-white/10 rounded-lg">
        <button class="w-full flex items-center justify-between p-4 text-left cursor-pointer">
          <span class="text-white">
            What audiences can you simulate?
          </span>
          <ChevronDown class="text-white w-5 h-5" />
        </button>
      </div>

      <div class="border border-white/10 rounded-lg">
        <button class="w-full flex items-center justify-between p-4 text-left cursor-pointer">
          <span class="text-white">
            How long does it take to get results?
          </span>
          <ChevronDown class="text-white w-5 h-5" />
        </button>
      </div>

      <div class="border border-white/10 rounded-lg">
        <button class="w-full flex items-center justify-between p-4 text-left cursor-pointer">
          <span class="text-white">
            Can I interview the personas for qualitative insights?
          </span>
          <ChevronDown class="text-white w-5 h-5" />
        </button>
      </div>

      <div class="border border-white/10 rounded-lg">
        <button class="w-full flex items-center justify-between p-4 text-left cursor-pointer">
          <span class="text-white">
            How do you ensure the personas reflect real human diversity?
          </span>
          <ChevronDown class="text-white w-5 h-5" />
        </button>
      </div>

      <div class="border border-white/10 rounded-lg">
        <button class="w-full flex items-center justify-between p-4 text-left cursor-pointer">
          <span class="text-white">
            What industries do you work with?
          </span>
          <ChevronDown class="text-white w-5 h-5" />
        </button>
      </div>

    </div>
  </div>
</section>
```

---

## Styles

### FAQ Item Container
```css
.faq-item {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
}
```

### FAQ Question Button
```css
.faq-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  text-align: left;
  cursor: pointer;
  background: transparent;
}
```

### FAQ Question Text
```css
.faq-question {
  font-family: Satoshi;
  font-size: 16px;
  color: rgb(255, 255, 255);
}
```

### Chevron Icon
```css
.chevron {
  width: 20px;
  height: 20px;
  color: rgb(255, 255, 255);
  transition: transform 0.2s ease;
}

.expanded .chevron {
  transform: rotate(180deg);
}
```

---

## FAQ Questions

1. How accurate are your AI personas compared to real humans?
2. Are your simulations backed by research?
3. What audiences can you simulate?
4. How long does it take to get results?
5. Can I interview the personas for qualitative insights?
6. How do you ensure the personas reflect real human diversity?
7. What industries do you work with?

---

## Animation

### Expand/Collapse
- Height animation from 0 to auto
- Opacity fade 0 → 1
- Chevron rotation 0° → 180°
- Duration: ~200ms
- Easing: ease-out

---

## Delta Notes
- [ ] Create accordion component (or use Radix/shadcn)
- [ ] Match border styling
- [ ] Add expand/collapse animation
- [ ] Add answer content (if available)
