# Extraction Catalog — app.societies.io

**Generated:** 2026-01-30
**Updated:** 2026-01-30 (full-page screenshots added)
**Total Screenshots:** 207 files (~73MB)
**Source:** app.societies.io (authenticated session)

---

## Directory Structure

```
extraction/screenshots/
├── desktop-fullpage/  # 1440x900 FULL PAGE (✓ Complete sidebar with Version 2.1)
│   ├── dashboard/     # Main dashboard (1 file)
│   ├── forms/         # Test creation forms (3 files)
│   ├── modals/        # Modal dialogs (2 files)
│   ├── results/       # Simulation results (2 files)
│   └── selectors/     # Dropdowns and selectors (6 files)
├── desktop/           # 1440x900 viewport (older - some cutoff at bottom)
│   ├── dashboard/     # Main dashboard states
│   ├── forms/         # Test creation forms
│   ├── history/       # Test history sidebar
│   ├── modals/        # Modal dialogs
│   ├── navigation/    # Sidebar navigation
│   ├── results/       # Simulation results panel
│   ├── selectors/     # Dropdowns and selectors
│   └── settings/      # Settings page
├── mobile/            # 375x812 viewport
│   └── (App shows "expand window" - not mobile-friendly)
└── reference/         # Raw reference screenshots (132 files)
```

---

## ✓ Desktop Full-Page Screenshots (RECOMMENDED FOR PHASE 12)

**Location:** `desktop-fullpage/`
**Viewport:** 1440x900 with fullPage: true
**Note:** These capture the COMPLETE page including "Version 2.1" at sidebar bottom

### Dashboard (1 file)
| File | Description |
|------|-------------|
| `01-dashboard-default.png` | Complete dashboard with sidebar, network viz, legend pills |

### Selectors (6 files)
| File | Description |
|------|-------------|
| `02-society-selector-open.png` | Society selector modal (Personal + Target societies) |
| `03-society-card-hover.png` | Society card hover state |
| `04-society-card-menu.png` | Society card action menu |
| `05-view-selector-open.png` | View dropdown (Country/City/Generation/Role/Sector/Area) |
| `06-view-role-level.png` | Role Level view with colored legend pills |
| `08-test-type-selector.png` | All 11 test types modal |

### Forms (3 files)
| File | Description |
|------|-------------|
| `01-tiktok-form-empty.png` | TikTok Script form placeholder |
| `02-tiktok-form-filled.png` | TikTok Script form with content |
| `03-survey-form-empty.png` | Survey form (question + options) |

### Modals (2 files)
| File | Description |
|------|-------------|
| `01-create-society-modal.png` | Create Target Society modal |
| `02-leave-feedback-modal.png` | Leave Feedback modal (Name/Email/Feedback) |

### Results (2 files)
| File | Description |
|------|-------------|
| `01-results-panel.png` | Results panel (Impact Score, Attention, Variants) |
| `02-results-insights.png` | Results with Insights section |

---

## Desktop Screenshots (1440x900)

### Dashboard
| File | Description | States Captured |
|------|-------------|-----------------|
| `01-dashboard-default.png` | Main dashboard with network visualization | Default, society selected |
| `default.png` | Dashboard default state | Idle |
| `loading.png` | Dashboard loading state | Loading spinner |
| `network-default.png` | Network graph visualization | Country view with legend pills |

### Selectors
| File | Description | States Captured |
|------|-------------|-----------------|
| `02-society-selector-open.png` | Society selector modal open | Personal + Target societies |
| `03-society-card-hover.png` | Society card hover state | Hover highlight |
| `04-society-card-menu.png` | Society card with action menu | Edit/Refresh/Delete options |
| `05-view-selector-open.png` | View dropdown open | Country/City/Generation/Role/Sector/Area |
| `06-view-role-level.png` | Role Level view selected | Executive/Mid/Senior/Entry pills |
| `07-view-role-level-full.png` | Full page Role Level view | Complete layout |
| `08-test-type-selector.png` | Test type selector modal | All 11 test types |

### Forms
| File | Description | States Captured |
|------|-------------|-----------------|
| `01-tiktok-form-empty.png` | TikTok Script form empty | Placeholder state |
| `02-tiktok-form-filled.png` | TikTok Script form with content | Filled with sample text |
| `03-survey-form-empty.png` | Survey form structure | Question + Options UI |

### Modals
| File | Description | States Captured |
|------|-------------|-----------------|
| `01-create-society-modal.png` | Create Target Society modal | Input field + description |
| `02-leave-feedback-modal.png` | Leave Feedback modal | Name/Email/Feedback form |

### Results
| File | Description | States Captured |
|------|-------------|-----------------|
| `01-results-panel.png` | Results panel overview | Impact Score, Attention, Variants |
| `02-results-insights.png` | Results with Insights visible | Insights section expanded |
| `03-results-full.png` | Full page results | All sections |
| `04-variant-editing.png` | Variant editing mode | Original + Edit form |
| `panel-default.png` | Results panel default | Basic layout |

### History
| File | Description | States Captured |
|------|-------------|-----------------|
| `empty.png` | Empty history state | No tests yet |
| `with-items.png` | History with test items | Multiple tests listed |

### Navigation
| File | Description | States Captured |
|------|-------------|-----------------|
| `sidebar-default.png` | Sidebar navigation | Full sidebar |

### Settings
| File | Description | States Captured |
|------|-------------|-----------------|
| `default.png` | Settings page | (Links to Stripe) |

---

## Mobile Screenshots (375x812)

| File | Description | Notes |
|------|-------------|-------|
| `01-mobile-dashboard.png` | Mobile view | Shows "Please expand your window" message |

**Note:** app.societies.io does not support mobile viewport. All mobile screenshots show the expand window prompt.

---

## Reference Screenshots (132 files)

Raw screenshots from various extraction sessions, including:
- All 11 form types (Article, Email, TikTok, Instagram, LinkedIn, X Post, etc.)
- Simulation loading states
- Survey results
- Society selector states
- View selector states
- Landing page comparisons
- Various UI states

### Key Reference Files
| File | Description |
|------|-------------|
| `societies-dashboard.png` | Reference dashboard |
| `societies-survey-form.png` | Survey form reference |
| `societies-test-selector.png` | Test type selector reference |
| `survey-results-full.png` | Full survey results |
| `tiktok-results-full.png` | TikTok simulation results |
| `tiktok-simulation-loading.png` | Loading state during simulation |
| `*-form.png` | All 11 form type references |

---

## Coverage Summary

### Captured States
| Category | Desktop | Mobile | Notes |
|----------|---------|--------|-------|
| Dashboard | ✓ Default, Loading | ✗ | Mobile not supported |
| Society Selector | ✓ Open, Hover, Menu | ✗ | |
| View Selector | ✓ Dropdown, Role Level | ✗ | |
| Test Type Selector | ✓ All 11 types | ✗ | |
| Forms | ✓ TikTok, Survey | ✗ | Other forms in reference/ |
| Results | ✓ Panel, Insights, Variants | ✗ | |
| History | ✓ Empty, With Items | ✗ | |
| Modals | ✓ Create Society, Feedback | ✗ | |
| Settings | ✓ Default | ✗ | Links to Stripe |

### Missing States (for Phase 12)
- [ ] Simulation loading phases (4 states)
- [ ] Delete confirmation modal
- [ ] Form validation errors
- [ ] All 11 form types (organized)
- [ ] Network node hover states
- [ ] Test history three-dot menu

---

## Usage for Phase 12

For comparison, use screenshots from:
1. `desktop/` - Organized by component
2. `reference/` - Raw captures for specific states

Compare against Virtuna clone screenshots to identify discrepancies.

---

*Catalog generated: 2026-01-30*
