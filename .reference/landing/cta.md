# CTA & Footer Section - Societies.io

## Screenshot Reference
`_assets/landing-full-dark.png` (bottom section)

---

## Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│               Ready to understand your audience?                │
│                                                                 │
│   Join the world's leading organizations using AI to unlock     │
│   human insights at scale.                                      │
│                                                                 │
│         [Book a meeting]     [Contact us]                       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Artificial Societies        Privacy Policy   [in] [X] [@]     │
│   © 2026 Artificial           Terms of Service                  │
│   Societies. All rights       Subprocessors                     │
│   reserved.                                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## HTML Structure

```html
<footer role="contentinfo" class="py-24">
  <div class="max-w-4xl mx-auto px-6">

    <!-- CTA Section -->
    <div class="text-center mb-16">
      <h2 class="font-display text-[40px] leading-[44px] font-[350] text-white">
        Ready to understand your audience?
      </h2>
      <p class="text-white/80 text-lg mt-4">
        Join the world's leading organizations using AI to unlock human insights at scale.
      </p>
      <div class="flex items-center justify-center gap-4 mt-8">
        <button class="bg-accent text-white px-6 py-3 rounded text-sm font-medium">
          Book a meeting
        </button>
        <button class="border border-white/20 text-white px-6 py-3 rounded text-sm font-medium hover:bg-white/5">
          Contact us
        </button>
      </div>
    </div>

    <!-- Footer Links -->
    <div class="flex items-center justify-between pt-8 border-t border-white/10">

      <!-- Left: Brand -->
      <div>
        <div class="text-white font-medium">Artificial Societies</div>
        <div class="text-gray-400 text-sm mt-1">
          © 2026 Artificial Societies. All rights reserved.
        </div>
      </div>

      <!-- Center: Legal Links -->
      <div class="flex items-center gap-6">
        <a href="/privacy-notice" class="text-gray-400 text-sm hover:text-white">
          Privacy Policy
        </a>
        <a href="/terms-of-service" class="text-gray-400 text-sm hover:text-white">
          Terms of Service
        </a>
        <a href="/subprocessors" class="text-gray-400 text-sm hover:text-white">
          Subprocessors
        </a>
      </div>

      <!-- Right: Social Links -->
      <div class="flex items-center gap-4">
        <a
          href="https://www.linkedin.com/company/artificial-societies"
          class="text-gray-400 hover:text-white"
          aria-label="LinkedIn"
        >
          <LinkedInIcon class="w-5 h-5" />
        </a>
        <a
          href="https://x.com/societiesio"
          class="text-gray-400 hover:text-white"
          aria-label="X"
        >
          <XIcon class="w-5 h-5" />
        </a>
        <a
          href="mailto:founders@societies.io"
          class="text-gray-400 hover:text-white"
          aria-label="Email"
        >
          <MailIcon class="w-5 h-5" />
        </a>
      </div>

    </div>
  </div>
</footer>
```

---

## Styles

### CTA Heading
```css
h2 {
  font-family: "Funnel Display", sans-serif;
  font-size: 40px;
  font-weight: 350;
  line-height: 44px;
  color: rgb(255, 255, 255);
  text-align: center;
}
```

### CTA Subtext
```css
p {
  font-family: Satoshi;
  font-size: 18px;
  color: rgba(255, 255, 255, 0.8);
  text-align: center;
}
```

### Primary CTA Button
```css
.btn-primary {
  background-color: rgb(229, 120, 80);
  color: rgb(255, 255, 255);
  font-size: 14px;
  font-weight: 500;
  padding: 12px 24px;
  border-radius: 4px;
}
```

### Secondary CTA Button (Ghost)
```css
.btn-secondary {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgb(255, 255, 255);
  font-size: 14px;
  font-weight: 500;
  padding: 12px 24px;
  border-radius: 4px;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.05);
}
```

### Footer Text
```css
.brand-name {
  font-family: Satoshi;
  font-weight: 500;
  color: rgb(255, 255, 255);
}

.copyright {
  font-size: 14px;
  color: rgb(204, 204, 204);
}

.legal-link {
  font-size: 14px;
  color: rgb(204, 204, 204);
}

.legal-link:hover {
  color: rgb(255, 255, 255);
}
```

### Social Icons
```css
.social-link {
  color: rgb(204, 204, 204);
}

.social-link:hover {
  color: rgb(255, 255, 255);
}

.social-icon {
  width: 20px;
  height: 20px;
}
```

---

## Links

### Legal Pages
- Privacy Policy: `/privacy-notice`
- Terms of Service: `/terms-of-service`
- Subprocessors: `/subprocessors`

### Social Media
- LinkedIn: `https://www.linkedin.com/company/artificial-societies`
- X (Twitter): `https://x.com/societiesio`
- Email: `mailto:founders@societies.io`

---

## Icons

Social icons are simple SVGs:
- LinkedIn (standard in icon)
- X (formerly Twitter logo)
- Email/Envelope icon

---

## Delta Notes
- [ ] Match CTA layout (centered)
- [ ] Add both button variants
- [ ] Create footer 3-column layout
- [ ] Add social icons
- [ ] Match hover states
