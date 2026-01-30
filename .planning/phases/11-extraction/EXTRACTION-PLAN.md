# Comprehensive Extraction Plan — app.societies.io

**Target:** Extract EVERYTHING from app.societies.io in dark mode
**Method:** Playwright tests that click through the entire app systematically
**Output:** Screenshots, videos, GIFs for every screen, state, component, and user flow

---

## Extraction Setup

### Prerequisites
```bash
# Already installed
@playwright/test ^1.58.0
```

### Dark Mode
Force dark mode via CSS injection or prefers-color-scheme emulation:
```typescript
await context.addInitScript(() => {
  document.documentElement.classList.add('dark');
  localStorage.setItem('theme', 'dark');
});
```

### Viewports
- Desktop: 1440x900
- Mobile: 375x812

### Output Structure
```
extraction/
├── screenshots/
│   ├── desktop/
│   │   ├── 01-dashboard/
│   │   ├── 02-society-selector/
│   │   ├── 03-test-type-selector/
│   │   ├── 04-forms/
│   │   ├── 05-simulation/
│   │   ├── 06-results/
│   │   ├── 07-history/
│   │   ├── 08-settings/
│   │   ├── 09-modals/
│   │   └── 10-navigation/
│   └── mobile/
│       └── [same structure]
├── videos/
│   ├── flows/
│   │   ├── 01-complete-test-flow.webm
│   │   ├── 02-society-creation.webm
│   │   ├── 03-test-history.webm
│   │   └── 04-settings-navigation.webm
│   └── components/
│       ├── loading-animation.webm
│       └── hover-states.webm
└── gifs/
    ├── loading-phases.gif
    ├── results-expand.gif
    └── mobile-drawer.gif
```

---

## Part 1: Dashboard & Layout

### 1.1 Dashboard States
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `dashboard-empty.png` | Fresh state, no tests run | Navigate to `/dashboard` |
| `dashboard-with-results.png` | After a test completes | Run simulation first |
| `dashboard-loading.png` | During page load | Capture during navigation |

### 1.2 App Shell Components
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `sidebar-collapsed.png` | Sidebar default state | - |
| `sidebar-hover-{item}.png` | Each nav item hovered | Hover each: Dashboard, Settings |
| `context-bar.png` | Top context bar | - |
| `network-visualization.png` | Main network graph | - |
| `filter-pills-default.png` | Filter pills row | - |
| `filter-pills-selected.png` | With filters active | Click filters |
| `legend-pills.png` | Legend for role levels | - |

---

## Part 2: Society Selector (Complete)

### 2.1 Society Selector Modal
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `society-selector-trigger.png` | Button in sidebar | - |
| `society-selector-open.png` | Modal open | Click trigger |
| `society-selector-hover-item.png` | Hovering a society | Hover item |
| `society-selector-selected.png` | Item selected state | - |
| `society-card-menu-open.png` | Three-dot menu open | Click menu |
| `society-card-menu-hover.png` | Menu item hover | Hover option |

### 2.2 Create Society Flow
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `create-society-trigger.png` | Create button visible | - |
| `create-society-modal.png` | Modal opened | Click "Create" |
| `create-society-step1.png` | Name input | - |
| `create-society-step2.png` | AI matching animation | Fill name, proceed |
| `create-society-complete.png` | Society created | Complete flow |

**Video:** `society-creation-flow.webm` — Full flow from click to completion

---

## Part 3: View Selector (Complete)

### 3.1 View Selector Dropdown
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `view-selector-closed.png` | Default closed state | - |
| `view-selector-open.png` | Dropdown open | Click selector |
| `view-selector-country.png` | Country submenu | Hover Country |
| `view-selector-city.png` | City submenu | Hover City |
| `view-selector-generation.png` | Generation submenu | Hover Generation |
| `view-selector-role-level.png` | Role Level submenu | Hover Role Level |
| `view-selector-option-hover.png` | Option hover state | Hover any option |
| `view-selector-selected.png` | After selection | Select an option |

---

## Part 4: Test Type Selector (All 11 Types)

### 4.1 Selector Modal
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `test-type-trigger.png` | "New Test" button | - |
| `test-type-modal-open.png` | Full modal with all types | Click trigger |
| `test-type-category-survey.png` | Survey category | - |
| `test-type-category-marketing.png` | Marketing Content category | - |
| `test-type-category-social.png` | Social Media Posts category | - |
| `test-type-category-communication.png` | Communication category | - |
| `test-type-category-product.png` | Product category | - |

### 4.2 Each Test Type (hover + selected)
For each of the 11 types:
- `test-type-{type}-hover.png`
- `test-type-{type}-selected.png`

Types: survey, article, website-content, advertisement, linkedin-post, instagram-post, x-post, tiktok-script, email-subject-line, email, product-proposition

---

## Part 5: Forms (All Types)

### 5.1 Content Form (10 types use this)
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `form-{type}-empty.png` | Empty form state | Select type |
| `form-{type}-focused.png` | Textarea focused | Click textarea |
| `form-{type}-filled.png` | With content | Type content |
| `form-{type}-validation-error.png` | Empty submit error | Submit empty |
| `form-{type}-char-count.png` | Character counter visible | Type long content |

### 5.2 Survey Form (Unique)
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `form-survey-empty.png` | Empty survey | Select Survey type |
| `form-survey-question-added.png` | One question | Add question |
| `form-survey-multiple-questions.png` | 3+ questions | Add more |
| `form-survey-option-hover.png` | Option hover | Hover option |
| `form-survey-validation.png` | Validation errors | Submit incomplete |

---

## Part 6: Simulation Flow (Complete)

### 6.1 Loading Phases (4 phases)
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `simulation-phase1.png` | Phase 1 loading | Submit form |
| `simulation-phase2.png` | Phase 2 loading | Wait ~2s |
| `simulation-phase3.png` | Phase 3 loading | Wait ~2s |
| `simulation-phase4.png` | Phase 4 loading | Wait ~2s |
| `simulation-complete.png` | Loading done | Wait for completion |

**Video:** `simulation-loading-phases.webm` — All 4 phases animation
**GIF:** `loading-phases.gif` — Looping loading animation

### 6.2 Loading States Detail
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `loading-spinner.png` | Main spinner | During any phase |
| `loading-progress-bar.png` | Progress indicator | If visible |
| `loading-text-phase1.png` | Phase 1 text | - |
| `loading-text-phase2.png` | Phase 2 text | - |
| `loading-text-phase3.png` | Phase 3 text | - |
| `loading-text-phase4.png` | Phase 4 text | - |

---

## Part 7: Results Panel (Complete)

### 7.1 Results Overview
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `results-panel-default.png` | Initial state | After simulation |
| `results-panel-scrolled.png` | Scrolled down | Scroll panel |

### 7.2 Impact Score Section
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `results-impact-score.png` | Score display | - |
| `results-impact-label-poor.png` | "Poor" label | Mock data |
| `results-impact-label-average.png` | "Average" label | Mock data |
| `results-impact-label-good.png` | "Good" label | Mock data |
| `results-impact-label-excellent.png` | "Excellent" label | Mock data |

### 7.3 Attention Breakdown
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `results-attention-collapsed.png` | Section collapsed | - |
| `results-attention-expanded.png` | Section expanded | Click expand |
| `results-attention-chart.png` | Pie/bar chart | - |
| `results-attention-hover.png` | Hover segment | Hover chart |

### 7.4 Variants Section
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `results-variants-collapsed.png` | Section collapsed | - |
| `results-variants-expanded.png` | Section expanded | Click expand |
| `results-variant-original.png` | Original content | - |
| `results-variant-ai-1.png` | AI variant 1 | - |
| `results-variant-ai-2.png` | AI variant 2 | - |
| `results-variant-hover.png` | Hover variant card | Hover |
| `results-variant-copy.png` | Copy button hover | Hover copy |

### 7.5 Insights Section
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `results-insights-collapsed.png` | Section collapsed | - |
| `results-insights-expanded.png` | Section expanded | Click expand |
| `results-insight-item.png` | Single insight | - |

### 7.6 Themes Section
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `results-themes-collapsed.png` | Section collapsed | - |
| `results-themes-expanded.png` | Section expanded | Click expand |
| `results-theme-card.png` | Theme card | - |
| `results-theme-quotes.png` | Quotes expanded | Click theme |

### 7.7 Share Button
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `results-share-button.png` | Share button | - |
| `results-share-hover.png` | Button hover | Hover |
| `results-share-menu.png` | Share menu open | Click |

---

## Part 8: Test History (Complete)

### 8.1 History List
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `history-empty.png` | No tests yet | Clear localStorage |
| `history-single-item.png` | One test | Run one test |
| `history-multiple-items.png` | 3+ tests | Run multiple |
| `history-item-hover.png` | Item hover state | Hover item |
| `history-item-selected.png` | Item selected | Click item |

### 8.2 History Item Actions
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `history-item-menu-trigger.png` | Three-dot menu | - |
| `history-item-menu-open.png` | Menu open | Click menu |
| `history-item-menu-hover.png` | Menu item hover | Hover option |

### 8.3 Delete Flow
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `delete-modal-open.png` | Confirmation modal | Click Delete |
| `delete-modal-hover-cancel.png` | Cancel hover | Hover Cancel |
| `delete-modal-hover-confirm.png` | Confirm hover | Hover Delete |

**Video:** `test-history-flow.webm` — Select, view, delete flow

---

## Part 9: Settings (All Tabs)

### 9.1 Settings Navigation
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `settings-page-default.png` | Default/Profile tab | Navigate to /settings |
| `settings-tab-hover.png` | Tab hover state | Hover tab |

### 9.2 Profile Tab
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `settings-profile-default.png` | Profile section | - |
| `settings-profile-input-focus.png` | Input focused | Click input |
| `settings-profile-edited.png` | After edit | Change value |
| `settings-profile-save-hover.png` | Save button hover | Hover Save |

### 9.3 Account Tab
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `settings-account-default.png` | Account section | Click Account tab |
| `settings-account-password.png` | Password fields | - |
| `settings-account-danger-zone.png` | Delete account section | Scroll down |

### 9.4 Notifications Tab
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `settings-notifications-default.png` | Notifications section | Click tab |
| `settings-notifications-switch-on.png` | Switch ON state | - |
| `settings-notifications-switch-off.png` | Switch OFF state | Toggle |
| `settings-notifications-switch-hover.png` | Switch hover | Hover |

### 9.5 Billing Tab
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `settings-billing-default.png` | Billing section | Click tab |
| `settings-billing-plan-card.png` | Current plan | - |
| `settings-billing-credits.png` | Credits display | - |
| `settings-billing-stripe-link.png` | Stripe portal link | - |

### 9.6 Team Tab
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `settings-team-default.png` | Team section | Click tab |
| `settings-team-member-card.png` | Team member | - |
| `settings-team-invite-button.png` | Invite button | - |
| `settings-team-role-dropdown.png` | Role dropdown | Click role |

---

## Part 10: Modals (All)

### 10.1 Leave Feedback Modal
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `modal-feedback-trigger.png` | Feedback button | - |
| `modal-feedback-open.png` | Modal open | Click trigger |
| `modal-feedback-textarea-focus.png` | Textarea focused | Click |
| `modal-feedback-filled.png` | With content | Type feedback |
| `modal-feedback-submit-hover.png` | Submit hover | Hover |

### 10.2 Create Society Modal (see Part 2)

### 10.3 Delete Test Modal (see Part 8)

### 10.4 Test Type Selector Modal (see Part 4)

---

## Part 11: Mobile Navigation

### 11.1 Mobile Drawer
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `mobile-hamburger.png` | Menu icon | - |
| `mobile-drawer-closed.png` | Drawer hidden | - |
| `mobile-drawer-open.png` | Drawer visible | Click hamburger |
| `mobile-drawer-item-hover.png` | Nav item hover | Hover |
| `mobile-drawer-close.png` | Close button/overlay | - |

**GIF:** `mobile-drawer-animation.gif` — Open/close animation

### 11.2 Mobile-Specific Layouts
| Screenshot | Description | Actions |
|------------|-------------|---------|
| `mobile-dashboard.png` | Dashboard at 375px | - |
| `mobile-results-panel.png` | Results panel | After simulation |
| `mobile-settings.png` | Settings page | Navigate |
| `mobile-form.png` | Test form | Open form |

---

## Part 12: Complete User Flows (Videos)

### 12.1 Complete Test Flow
**File:** `videos/flows/complete-test-flow.webm`
**Duration:** ~60 seconds
**Steps:**
1. Dashboard loads
2. Click "New Test"
3. Select TikTok
4. Fill form with content
5. Click Simulate
6. Watch all 4 loading phases
7. Results appear
8. Expand each results section
9. Copy a variant
10. View in history

### 12.2 Society Management Flow
**File:** `videos/flows/society-management.webm`
**Steps:**
1. Open society selector
2. View existing societies
3. Create new society
4. AI matching animation
5. Society created
6. Select new society
7. Dashboard updates

### 12.3 Settings Flow
**File:** `videos/flows/settings-navigation.webm`
**Steps:**
1. Navigate to settings
2. Tab through all sections
3. Edit profile
4. Toggle notifications
5. View billing
6. View team

### 12.4 History Management Flow
**File:** `videos/flows/history-management.webm`
**Steps:**
1. View history list
2. Select item
3. View results
4. Open menu
5. Delete with confirmation

---

## Playwright Test Structure

```typescript
// extraction/tests/capture-all.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Manual login
    await page.goto('https://app.societies.io');
    await page.pause(); // Wait for manual login
  });

  test('capture dashboard states', async ({ page }) => {
    await page.screenshot({ path: 'screenshots/desktop/01-dashboard/default.png', fullPage: true });
    // ... more captures
  });
});

test.describe('Society Selector', () => {
  // ...
});

// etc for each section
```

---

## Execution Order

1. **Setup** — Login once, save session
2. **Desktop captures** — All sections in order
3. **Desktop videos** — All user flows
4. **Mobile captures** — Switch viewport, repeat
5. **GIF generation** — Post-process videos to GIFs

---

## Notes

- Always scroll to bottom before fullPage screenshots
- Wait for animations to complete (networkidle + timeout)
- Capture hover states with `page.hover()` then `page.screenshot()`
- Videos: close context to save
- Dark mode: inject CSS or emulate prefers-color-scheme

---

*Plan created: 2026-01-30*
*For use with fresh context in Phase 11 execution*
