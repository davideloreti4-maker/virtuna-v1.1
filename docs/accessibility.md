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
| `foreground-muted` (#848586) | On background | 5.4:1 | PASS AA | Used for placeholders, captions |
| `foreground-muted` (#848586) | On surface | 4.7:1 | PASS AA | Used for muted text |
| `foreground-muted` (#848586) | On surface-elevated | 4.2:1 | AA Large only | Used in dropdowns |
| `accent-foreground` (#1a0f0a) | On accent (#FF7F50) | 7.2:1 | PASS AAA | Dark brown text on coral |
| `error` (#de3b3d) | On surface | 4.02:1 | AA Large only | Error messages |
| `error` (#de3b3d) | On surface-elevated | 3.59:1 | AA Large only | Error in elevated context |
| `info` (#0088f2) | On surface-elevated | 4.34:1 | AA Large only | Info in elevated context |

---

## Per-Component Requirements

### Button

| Context | Requirement | Status |
|---------|------------|--------|
| `secondary`: foreground on surface | 4.5:1 normal text | PASS (16.55:1) |
| `primary`: accent-foreground on accent | 4.5:1 normal text | PASS (7.2:1) -- dark brown on coral |
| `ghost`: foreground on transparent (inherits bg) | 4.5:1 normal text | PASS (18.87:1 on background) |
| `destructive`: white on error | 4.5:1 normal text | Verify -- white on #de3b3d |
| Focus ring | Visible 2px accent ring | PASS -- uses focus-visible ring-accent |
| Disabled state | 50% opacity | Exempt (WCAG allows disabled controls to fail contrast) |

**Notes:**
- Primary variant contrast resolved with dark brown accent-foreground (#1a0f0a)
- Destructive variant should be verified with actual white-on-error ratio

### Input / InputField

| Context | Requirement | Status |
|---------|------------|--------|
| Placeholder: foreground-muted on surface | 4.5:1 normal text | PASS (4.7:1) |
| Label: foreground on background | 4.5:1 normal text | PASS (18.87:1) |
| Error text: error on background | 4.5:1 normal text | PASS (4.58:1) |
| Error text: error on surface | 4.5:1 normal text | MARGINAL (4.02:1) -- fails AA normal |
| Helper text: foreground-muted on background | 4.5:1 normal text | PASS (5.4:1) |
| Border: border on surface | 3:1 UI component | Verify -- border is rgba(255,255,255,0.08) |
| Focus border: accent on surface | 3:1 UI component | PASS (6.67:1) |

**Notes:**
- Placeholder and helper text both pass AA with updated #848586 muted color
- Error text on elevated surfaces is borderline -- consider using error on background only

### Select / SearchableSelect

| Context | Requirement | Status |
|---------|------------|--------|
| Trigger text: foreground on surface | 4.5:1 normal text | PASS (16.55:1) |
| Placeholder: foreground-muted on surface | 4.5:1 normal text | PASS (4.7:1) |
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
| Dismiss button: foreground-muted | 3:1 UI component | PASS (4.7:1 on surface) |
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
| Role/company: foreground-muted on surface | 4.5:1 normal text | PASS (4.7:1) |
| Decorative quotes | Decorative | Exempt |
| Featured border glow | Decorative | Exempt |

**Note:** TestimonialCard role/company text passes AA with updated #848586 muted color.

### Spinner

| Context | Requirement | Status |
|---------|------------|--------|
| Spinner stroke: foreground-muted (inherits currentColor) | 3:1 UI component | PASS (5.4:1 on background) |
| Determinate track: 20% opacity | Decorative guide | Exempt |

### Typography (Heading, Text, Caption, Code)

| Context | Requirement | Status |
|---------|------------|--------|
| Heading: foreground on background | 4.5:1 (3:1 for h1/h2 large text) | PASS (18.87:1) |
| Text: foreground on background | 4.5:1 normal text | PASS (18.87:1) |
| Text muted: foreground-muted on background | 4.5:1 normal text | PASS (5.4:1) |
| Caption: foreground-muted on background | 4.5:1 normal text | PASS (5.4:1) |
| Code: inherits foreground on surface bg | 4.5:1 normal text | PASS (16.55:1) |

**Note:** `Text muted` and `Caption` pass AA normal text with updated #848586 muted color (5.4:1 on background).

### Divider

| Context | Requirement | Status |
|---------|------------|--------|
| Divider line: bg-border on background | 3:1 UI component | Verify -- border token is subtle |
| Label text: foreground-muted | 4.5:1 normal text | PASS (5.4:1) |

---

## Summary of Action Items

### Resolved (previously failing, now fixed)

1. **Button primary:** `accent-foreground` updated to `#1a0f0a` -- now 7.2:1 PASS AAA
2. **`foreground-muted`:** Updated to `#848586` -- now 5.4:1 on background (PASS AA), 4.7:1 on surface (PASS AA)

### Remaining (Passes AA Large only)

3. **`foreground-muted` on `surface-elevated`:** 4.2:1 -- borderline, passes AA Large
4. **`error` on elevated surfaces:** 3.59-4.02:1 -- affects error messages in dialogs/cards
5. **`info` on `surface-elevated`:** 4.34:1 -- marginal, close to passing

### Design Decisions

- **Disabled states** (50% opacity) are exempt from contrast requirements per WCAG
- **Decorative elements** (shadows, progress bars) are exempt
- **`foreground-muted`** (#848586) now passes AA on background and surface contexts

---

## Cross-Reference

- Token values and ratios: [`verification/reports/contrast-audit.md`](../verification/reports/contrast-audit.md)
- Token definitions: [`docs/tokens.md`](./tokens.md)
- Component source: [`src/components/ui/`](../src/components/ui/)
