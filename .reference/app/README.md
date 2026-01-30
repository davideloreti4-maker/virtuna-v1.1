# App Reference Documentation

This directory contains extracted UI patterns and styles from `app.societies.io` for systematic cloning.

## Screenshots
All screenshots are in `_assets/`:

| File | Description |
|------|-------------|
| `dashboard-main.png` | Main dashboard with network visualization |
| `society-selector-open.png` | Society picker modal with Personal/Target sections |
| `view-selector-open.png` | View dropdown (Country, City, Generation, etc.) |
| `view-role-level.png` | Network colored by Role Level |
| `create-test-step1.png` | Test type selection modal |
| `create-test-survey-form.png` | Survey creation form |
| `survey-question-types.png` | Question type dropdown |
| `context-type-picker.png` | Searchable context type picker |
| `leave-feedback-modal.png` | Feedback form modal |
| `create-target-society.png` | Society creation with AI matching |
| `manage-plan-stripe.png` | Stripe billing portal (external) |
| `product-guide-docs.png` | Documentation site (external) |

## Reference Files

| File | Description |
|------|-------------|
| `dashboard.md` | Main layout, network visualization |
| `sidebar.md` | Left sidebar component with all menu items |
| `society-selector.md` | Society picker modal styles |
| `view-selector.md` | View dropdown and legend pills |
| `create-test.md` | Full test creation flow |
| `modals.md` | Leave Feedback and Create Society modals |

## Key Design Tokens

See `../design-tokens.md` for complete token reference.

### Quick Reference

**Colors:**
- Background: `#0A0A0A`
- Surface: `#18181B`
- Border: `#27272A`
- Muted text: `#71717A`
- Primary: `#6366F1` (indigo)

**Category Colors (Role Level):**
- Executive: `#6366F1`
- Mid Level: `#EC4899`
- Senior: `#10B981`
- Entry: `#F97316`

**Spacing:**
- Sidebar width: `248px`
- Border radius (cards): `12px`
- Border radius (buttons): `8px`
- Border radius (pills): `9999px`

## Components to Build

### Priority 1 - Core Layout
1. [ ] App shell (sidebar + main area)
2. [ ] Sidebar component
3. [ ] Network visualization (placeholder/stub)

### Priority 2 - Dropdowns
4. [ ] Society selector modal
5. [ ] View selector dropdown
6. [ ] Legend pills

### Priority 3 - Test Flow
7. [ ] Test type selector
8. [ ] Survey form
9. [ ] Context picker

### Priority 4 - Secondary
10. [ ] Feedback modal
11. [ ] Create society modal
12. [ ] Settings integration (Stripe link)

## Tech Notes

### Network Visualization
The network uses WebGL rendering (likely Three.js or similar). Options:
- `react-force-graph` - D3 force simulation with WebGL/Canvas
- `@react-three/fiber` - Three.js React bindings
- `sigma.js` - Graph visualization library

For initial clone, can use a static image or simple SVG placeholder.

### State Management
- Current society (selected from picker)
- Current view (Country, City, etc.)
- Test form state (question, options, type)
- Modal open/close states

### External Integrations
- Stripe Customer Portal for billing
- Separate docs site (docs.societies.io)
