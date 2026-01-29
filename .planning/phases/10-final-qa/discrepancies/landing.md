# Landing Page Discrepancies

**Compared:** 2026-01-29
**Viewport:** 1440x900 (Desktop)
**Reference:** societies.io (light mode reference screenshots)

## Source of Truth: societies.io

### Reference Analysis Summary

Based on societies.io reference screenshots at 1440px viewport:

**Header:**
- Logo: "A" mark SVG + "Artificial Societies" text
- Nav: "Sign in" text link + orange "Book a Meeting" button
- Solid background, sticky positioning

**Hero Section:**
- Headline: "Human Behavior," on line 1, "Simulated." in accent color on line 2
- Subheadline: "AI personas that replicate real-world attitudes, beliefs, and opinions."
- CTA: Orange "Get in touch" button
- Right side: Network visualization with floating persona card

**Backers Section:**
- "Backed by" label with investor logos in a row
- Additional "With Investors from" section below

**Features Section:**
- Section label, heading, description
- 4-column grid of feature cards with icons

**Stats Section:**
- Left: "86%" stat with description and link
- Right: Comparison chart with AI model accuracy bars

**Testimonials Sections:**
- Case study section with Teneo logo and quote
- Partnership section with Pulsar logo and quote

**FAQ Section:**
- "Common questions" heading
- Accordion items with expand/collapse

**Footer:**
- CTA section: "Ready to understand your audience?"
- Footer bar: Brand, legal links, social icons

---

## Header Discrepancies

| Element | Property | societies.io | Virtuna | Discrepancy | Status |
|---------|----------|--------------|---------|-------------|--------|
| Header | Background | Solid color (appears light) | bg-background (dark) | Different theme (dark vs light) - INTENTIONAL | N/A |
| Logo | SVG design | "A" with two angled lines | "A" with two angled lines | Matches | OK |
| Logo text | Typography | "Artificial Societies" sans-serif | font-sans text-white | Matches | OK |
| Sign in link | Color | Dark text | text-white | Theme difference - INTENTIONAL | N/A |
| CTA button | Background | Orange/coral (#f97316-ish) | bg-accent (emerald) | Color difference | Pending |
| CTA button | Text | "Book a Meeting" | "Book a Meeting" | Matches | OK |
| Nav spacing | Gap | ~16px between items | gap-4 (16px) | Matches | OK |
| Padding | Horizontal | ~32px | px-8 (32px) | Matches | OK |

## Hero Section Discrepancies

| Element | Property | societies.io | Virtuna | Discrepancy | Status |
|---------|----------|--------------|---------|-------------|--------|
| Headline | Text | "Human Behavior," + "Simulated." | Same | Matches | OK |
| Headline | Font size | ~48-56px | text-[36px] sm:text-[44px] md:text-[52px] | Slightly smaller on mobile | Pending |
| Accent text | Color | Orange/coral | text-accent (emerald) | Color difference | Pending |
| Subheadline | Text | "AI personas that replicate..." | Same content | Matches | OK |
| Subheadline | Font size | ~18-20px | text-lg sm:text-xl (18-20px) | Matches | OK |
| CTA button | Text | "Get in touch" | "Get in touch" | Matches | OK |
| CTA button | Color | Orange/coral | Emerald (accent) | Color difference | Pending |
| Network viz | Position | Right side | Right side, order-1 lg:order-2 | Matches layout | OK |
| Network viz | Content | Dots/lines with persona card | SVG image | Different implementation | Pending |
| Persona card | Present | Yes, floating on network | Not visible in hero | Missing persona card | Pending |

## Backers Section Discrepancies

| Element | Property | societies.io | Virtuna | Discrepancy | Status |
|---------|----------|--------------|---------|-------------|--------|
| Section | Background | Light with subtle border | border-t border-white/10 | Theme difference - INTENTIONAL | N/A |
| "Backed by" label | Typography | Small, muted text | text-sm text-foreground-secondary | Matches | OK |
| Logo display | Treatment | Appears colored or grayscale | brightness-0 invert (white) | Different treatment | Pending |
| Logo grid | Layout | Horizontal row | flex flex-wrap | Matches | OK |
| Spacing | Vertical | ~64px padding | py-16 (64px) | Matches | OK |

## Features Section Discrepancies

| Element | Property | societies.io | Virtuna | Discrepancy | Status |
|---------|----------|--------------|---------|-------------|--------|
| Section label | Text | "Into the future" | "Into the future" | Matches | OK |
| Heading | Text | "Research that was impossible..." | Same | Matches | OK |
| Heading | Font | Display font, ~40px | font-display text-[32px] sm:text-[40px] | Matches | OK |
| Feature cards | Grid | 4-column | lg:grid-cols-4 | Matches | OK |
| Card | Border | Subtle border | border border-white/10 | Matches | OK |
| Card | Padding | ~48px vertical | py-12 px-[26px] | Matches | OK |
| Card icons | Size | ~28px | size={28} | Matches | OK |
| Card icons | Weight | Light | weight="light" | Matches | OK |

## Stats Section Discrepancies

| Element | Property | societies.io | Virtuna | Discrepancy | Status |
|---------|----------|--------------|---------|-------------|--------|
| Layout | Grid | 2-column | grid-cols-1 md:grid-cols-2 | Matches | OK |
| Stat number | Text | "86%" | "86%" | Matches | OK |
| Stat number | Size | ~52px | text-[40px] sm:text-[52px] | Matches | OK |
| Link | Text | "Read the full evaluation report" | Same | Matches | OK |
| Chart | Background | Elevated card | bg-background-elevated | Matches | OK |
| Chart | Items | Model names with percentages | Same models/values | Matches | OK |
| Chart bars | Visual | Horizontal bars with percentages | List with percentages (no bars) | Missing bar visualization | Pending |

## Testimonials Section Discrepancies

| Element | Property | societies.io | Virtuna | Discrepancy | Status |
|---------|----------|--------------|---------|-------------|--------|
| Quote icon | Present | Yes | Quotes icon | Matches | OK |
| Quote text | Size | ~20px | text-xl | Matches | OK |
| Quote text | Style | Regular (not italic) | Regular | Matches | OK |
| Author name | Weight | Medium | font-medium | Matches | OK |
| Author title | Color | Muted gray | text-foreground-muted | Matches | OK |
| Case study card | Logo | Teneo logo | teneo-logo-dark.png | Matches | OK |

## FAQ Section Discrepancies

| Element | Property | societies.io | Virtuna | Discrepancy | Status |
|---------|----------|--------------|---------|-------------|--------|
| Heading | Text | "Common questions" | "Common questions" | Matches | OK |
| Section label | Text | "FAQ" | "FAQ" | Matches | OK |
| Container | Width | Narrower | max-w-3xl | Matches | OK |
| Accordion | Border | Subtle border | border border-white/10 | Matches | OK |
| Accordion | Background | Transparent | bg-transparent | Matches | OK |
| Question text | Size | ~16px | text-base | Matches | OK |
| Expand icon | Rotation | Chevron rotates | CSS transform | Matches | OK |

## Footer Discrepancies

| Element | Property | societies.io | Virtuna | Discrepancy | Status |
|---------|----------|--------------|---------|-------------|--------|
| CTA heading | Text | "Ready to understand your audience?" | Same | Matches | OK |
| CTA button | Text | "Book a meeting" | "Book a meeting" | Matches | OK |
| CTA button | Color | Orange | bg-accent (emerald) | Color difference | Pending |
| Secondary button | Text | "Contact us" | "Contact us" | Matches | OK |
| Brand text | Content | "Artificial Societies" | "Artificial Societies" | Matches | OK |
| Legal links | Items | Privacy, Terms, Subprocessors | Same | Matches | OK |
| Social icons | Items | LinkedIn, X, Email | LinkedinLogo, XLogo, Envelope | Matches | OK |

---

## Summary of Key Discrepancies

### Theme/Color Discrepancies (INTENTIONAL - Virtuna uses dark mode)
1. Background colors (dark vs light)
2. Text colors (white vs dark)
3. Border colors (white/10 vs dark borders)

### Color Accent Discrepancy (TO REVIEW)
1. societies.io uses orange/coral accent
2. Virtuna uses emerald green accent
3. Affects: CTA buttons, "Simulated." text

### Missing/Different Features
1. **Persona card in hero** - societies.io has floating persona card on network visualization
2. **Comparison chart bars** - societies.io shows horizontal bar chart, Virtuna shows list
3. **Logo treatment** - societies.io may show colored logos vs Virtuna's white (inverted)

### Typography Matches
- Font families appear correct (Display + Sans)
- Font sizes are responsive and match at desktop breakpoint
- Line heights and letter spacing appear correct

---

## Fix Priority

1. **HIGH**: Add persona card to hero section (matches reference)
2. **MEDIUM**: Consider accent color (orange vs emerald) - may be intentional branding difference
3. **MEDIUM**: Comparison chart visualization (bars vs list)
4. **LOW**: Logo treatment in backers section

---

*Document created: 2026-01-29*
*Last updated: 2026-01-29*
