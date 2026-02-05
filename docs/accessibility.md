# Accessibility Requirements

> Color contrast requirements per component (WCAG 2.1 AA).
> Scope: color contrast only -- keyboard navigation and screen reader auditing deferred.
> Measured values: [contrast-audit.md](../verification/reports/contrast-audit.md)

## WCAG 2.1 AA Contrast Standards

| Category | Minimum Ratio | Applies To |
|----------|--------------|------------|
| Normal text | 4.5:1 | Text smaller than 24px (or 18.66px bold) |
| Large text | 3:1 | Text 24px+ (or 18.66px+ bold) |
| UI components | 3:1 | Borders, icons, and graphical objects against adjacent colors |

---

## Token-Level Contrast Results

These are the design system's semantic color tokens measured against all background surfaces. Full data in [contrast-audit.md](../verification/reports/contrast-audit.md).

### Passing Tokens (Normal Text AA)

| Token | On Background | On Surface | On Surface-Elevated |
|-------|--------------|------------|---------------------|
| `foreground` (#f8f8f8) | 18.87:1 AAA | 16.55:1 AAA | 14.8:1 AAA |
| `foreground-secondary` (#9c9c9d) | 7.3:1 AAA | 6.41:1 AA | 5.73:1 AA |
| `accent` (#f67d51) | 7.6:1 AAA | 6.67:1 AA | 5.96:1 AA |
| `success` (#46b250) | 7.39:1 AAA | 6.48:1 AA | 5.79:1 AA |
| `warning` (#d9a514) | 8.91:1 AAA | 7.82:1 AAA | 6.99:1 AA |
| `error` (#de3b3d) | 4.58:1 AA | -- | -- |
| `info` (#0088f2) | 5.54:1 AA | 4.86:1 AA | -- |

### Known Failures

| Token | Context | Ratio | Status | Impact |
|-------|---------|-------|--------|--------|
| `foreground-muted` (#6a6b6c) | On background | 3.75:1 | AA Large only | Used for placeholders, captions |
| `foreground-muted` (#6a6b6c) | On surface | 3.29:1 | AA Large only | Used for muted text |
| `foreground-muted` (#6a6b6c) | On surface-elevated | 2.94:1 | Fails all | Used in dropdowns |
| `accent-foreground` (#f8f8f8) | On accent (#f67d51) | 2.48:1 | Fails all | White text on coral |
| `error` (#de3b3d) | On surface | 4.02:1 | AA Large only | Error messages |
| `error` (#de3b3d) | On surface-elevated | 3.59:1 | AA Large only | Error in elevated context |
| `info` (#0088f2) | On surface-elevated | 4.34:1 | AA Large only | Info in elevated context |

---

## Per-Component Requirements

### Button

| Context | Requirement | Status |
|---------|------------|--------|
| `secondary`: foreground on surface | 4.5:1 normal text | PASS (16.55:1) |
| `primary`: accent-foreground on accent | 4.5:1 normal text | FAIL (2.48:1) -- white on coral |
| `ghost`: foreground on transparent (inherits bg) | 4.5:1 normal text | PASS (18.87:1 on background) |
| `destructive`: white on error | 4.5:1 normal text | Verify -- white on #de3b3d |
| Focus ring | Visible 2px accent ring | PASS -- uses focus-visible ring-accent |
| Disabled state | 50% opacity | Exempt (WCAG allows disabled controls to fail contrast) |

**Action items:**
- Primary variant needs contrast remediation: consider darker text on coral, or darker coral shade
- Destructive variant should be verified with actual white-on-error ratio

### Input / InputField

| Context | Requirement | Status |
|---------|------------|--------|
| Placeholder: foreground-muted on surface | 4.5:1 normal text | FAIL (3.29:1) -- acceptable per WCAG for placeholder |
| Label: foreground on background | 4.5:1 normal text | PASS (18.87:1) |
| Error text: error on background | 4.5:1 normal text | PASS (4.58:1) |
| Error text: error on surface | 4.5:1 normal text | MARGINAL (4.02:1) -- fails AA normal |
| Helper text: foreground-muted on background | 4.5:1 normal text | FAIL (3.75:1) -- helper text is muted |
| Border: border on surface | 3:1 UI component | Verify -- border is rgba(255,255,255,0.08) |
| Focus border: accent on surface | 3:1 UI component | PASS (6.67:1) |

**Notes:**
- Placeholder text contrast failure is acceptable per WCAG (placeholder is not a label)
- Helper text using `foreground-muted` should be reconsidered for contrast; `foreground-secondary` passes
- Error text on elevated surfaces is borderline -- consider using error on background only

### Select / SearchableSelect

| Context | Requirement | Status |
|---------|------------|--------|
| Trigger text: foreground on surface | 4.5:1 normal text | PASS (16.55:1) |
| Placeholder: foreground-muted on surface | 4.5:1 normal text | FAIL (3.29:1) -- acceptable for placeholder |
| Dropdown: foreground on surface-elevated | 4.5:1 normal text | PASS (14.8:1) |
| Group label: foreground-secondary on surface-elevated | 4.5:1 normal text | PASS (5.73:1) |
| Selected indicator: accent on surface-elevated | 4.5:1 normal text | PASS (5.96:1) |
| Disabled option: 50% opacity | N/A | Exempt |
| Search input: foreground on surface | 4.5:1 normal text | PASS (16.55:1) |

### Dialog

| Context | Requirement | Status |
|---------|------------|--------|
| Title: foreground on surface-elevated | 4.5:1 normal text | PASS (14.8:1) |
| Description: foreground-secondary on surface-elevated | 4.5:1 normal text | PASS (5.73:1) |
| Overlay: sufficient opacity to distinguish | Visual separation | PASS (bg-black/60) |
| Focus trap | Focus stays within dialog | PASS (Radix-managed) |

### Toast

| Context | Requirement | Status |
|---------|------------|--------|
| Title: foreground on variant background | 4.5:1 normal text | PASS -- foreground on tinted surfaces |
| Description: foreground-secondary on variant bg | 4.5:1 normal text | Verify per variant |
| Success text: success on success/10 bg | 4.5:1 normal text | PASS |
| Error text: error on error/10 bg | 4.5:1 normal text | PASS |
| Warning text: warning on warning/10 bg | 4.5:1 normal text | PASS |
| Info text: info on info/10 bg | 4.5:1 normal text | PASS |
| Dismiss button: foreground-muted | 3:1 UI component | MARGINAL -- 3.29:1 on surface |
| Progress bar | Decorative | Exempt |

### Card / GlassCard

| Context | Requirement | Status |
|---------|------------|--------|
| Card border: border on background | 3:1 UI component | Verify -- border is subtle |
| Card content: foreground on card bg | 4.5:1 normal text | PASS -- card uses gradient-card-bg (dark surface) |
| GlassCard: text on rgba(255,255,255,0.05) | 4.5:1 normal text | PASS -- foreground on near-black |
| GlassCard border: border-glass | 3:1 UI component | Verify |

### Badge

| Context | Requirement | Status |
|---------|------------|--------|
| Default: foreground-secondary on surface | 4.5:1 normal text | PASS (6.41:1) |
| Success: success on success/10 | 4.5:1 normal text | PASS |
| Warning: warning on warning/10 | 4.5:1 normal text | PASS |
| Error: error on error/10 | 4.5:1 normal text | PASS |
| Info: info on info/10 | 4.5:1 normal text | PASS |
| Badge at `sm` size: 10px text | 4.5:1 normal text | Size is small -- ensure readability |

### Toggle

| Context | Requirement | Status |
|---------|------------|--------|
| Track border: border-glass on background | 3:1 UI component | Verify |
| Checked thumb: accent on accent/20 track | 3:1 UI component | PASS -- coral on subtle tint |
| Unchecked thumb: foreground-secondary | 3:1 against track | Verify |
| Label: foreground on background | 4.5:1 normal text | PASS (18.87:1) |
| Disabled: 50% opacity | N/A | Exempt |

### Tabs

| Context | Requirement | Status |
|---------|------------|--------|
| Active tab: foreground on white/5 bg | 4.5:1 normal text | PASS -- foreground on near-black |
| Inactive tab: foreground-secondary | 4.5:1 normal text | PASS (7.3:1 on background) |
| Focus ring: accent/50 | Visible ring | PASS |

### Avatar

| Context | Requirement | Status |
|---------|------------|--------|
| Fallback text: foreground-secondary on surface | 4.5:1 normal text | PASS (6.41:1) |
| AvatarGroup overlap ring | Decorative | Exempt |

### Kbd / ShortcutBadge

| Context | Requirement | Status |
|---------|------------|--------|
| Key text: foreground-secondary on dark gradient | 4.5:1 normal text | PASS -- light gray on near-black |
| Highlighted glow: coral shadow | Decorative enhancement | Exempt |

### ExtensionCard

| Context | Requirement | Status |
|---------|------------|--------|
| Title: foreground on surface | 4.5:1 normal text | PASS (16.55:1) |
| Description: foreground-secondary on surface | 4.5:1 normal text | PASS (6.41:1) |
| Gradient glow overlay | Decorative | Exempt |
| Link overlay | Full card clickable via aria-label | PASS |

### TestimonialCard

| Context | Requirement | Status |
|---------|------------|--------|
| Quote text: foreground on surface | 4.5:1 normal text | PASS (16.55:1) |
| Author name: foreground on surface | 4.5:1 normal text | PASS |
| Role/company: foreground-muted on surface | 4.5:1 normal text | FAIL (3.29:1) |
| Decorative quotes | Decorative | Exempt |
| Featured border glow | Decorative | Exempt |

**Note:** TestimonialCard role/company text uses `foreground-muted` which fails AA. Consider using `foreground-secondary` instead.

### Spinner

| Context | Requirement | Status |
|---------|------------|--------|
| Spinner stroke: foreground-muted (inherits currentColor) | 3:1 UI component | MARGINAL (3.75:1 on background) |
| Determinate track: 20% opacity | Decorative guide | Exempt |

### Typography (Heading, Text, Caption, Code)

| Context | Requirement | Status |
|---------|------------|--------|
| Heading: foreground on background | 4.5:1 (3:1 for h1/h2 large text) | PASS (18.87:1) |
| Text: foreground on background | 4.5:1 normal text | PASS (18.87:1) |
| Text muted: foreground-muted on background | 4.5:1 normal text | FAIL (3.75:1) |
| Caption: foreground-muted on background | 4.5:1 normal text | FAIL (3.75:1) |
| Code: inherits foreground on surface bg | 4.5:1 normal text | PASS (16.55:1) |

**Note:** `Text muted` and `Caption` use `foreground-muted` which fails AA normal text. They pass AA Large (3:1). Consider:
- Using `foreground-secondary` for important muted text
- Reserving `foreground-muted` for truly secondary content where AA Large is acceptable

### Divider

| Context | Requirement | Status |
|---------|------------|--------|
| Divider line: bg-border on background | 3:1 UI component | Verify -- border token is subtle |
| Label text: foreground-muted | 4.5:1 normal text | FAIL (3.75:1) -- label text is small |

---

## Summary of Action Items

### Critical (Fails AA completely)

1. **Button primary:** `accent-foreground` on `accent` at 2.48:1 -- needs contrast fix
2. **`foreground-muted` on `surface-elevated`:** 2.94:1 -- affects dropdowns, elevated contexts

### Recommended (Passes AA Large only)

3. **`foreground-muted` on all surfaces:** 3.29-3.75:1 -- affects Caption, Text muted, placeholders, helper text
4. **`error` on elevated surfaces:** 3.59-4.02:1 -- affects error messages in dialogs/cards
5. **`info` on `surface-elevated`:** 4.34:1 -- marginal, close to passing

### Design Decisions

- **Placeholder text** failing contrast is acceptable per WCAG (placeholders are not labels)
- **Disabled states** (50% opacity) are exempt from contrast requirements per WCAG
- **Decorative elements** (gradient glows, shadows, progress bars) are exempt
- **`foreground-muted`** serves an intentional visual hierarchy role -- consider renaming to signal "below-AA contrast" or providing an alternative token

---

## Cross-Reference

- Token values and ratios: [`verification/reports/contrast-audit.md`](../verification/reports/contrast-audit.md)
- Token definitions: [`docs/tokens.md`](./tokens.md)
- Component source: [`src/components/ui/`](../src/components/ui/)
