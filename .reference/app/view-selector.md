# View Selector Dropdown

## Screenshot Reference
`_assets/view-selector-open.png`
`_assets/view-role-level.png`

## Structure

```
┌────────────────────┐
│ VIEWS              │  ← Section label
├────────────────────┤
│ Country            │  ← Menu item (selected)
│ City               │
│ Generation         │
│ Role Level         │
│ Sector             │
│ Role Area          │
└────────────────────┘
```

## Available Views
1. **Country** - Group by country (Switzerland, etc.)
2. **City** - Group by city
3. **Generation** - Group by age generation
4. **Role Level** - Executive, Mid, Senior, Entry
5. **Sector** - Industry sectors
6. **Role Area** - Functional areas

## Dropdown Styles

### Container
```css
background: #18181B; /* zinc-900 */
border: 1px solid #27272A;
border-radius: 8px;
padding: 8px 0;
min-width: 160px;
box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
```

### Section Label ("VIEWS")
```css
font-size: 11px;
font-weight: 600;
color: #71717A; /* zinc-500 */
text-transform: uppercase;
letter-spacing: 0.05em;
padding: 8px 16px;
```

### Menu Items
```css
padding: 10px 16px;
font-size: 14px;
color: #E4E4E7; /* zinc-200 */
cursor: pointer;
transition: background 0.15s;
```

Hover:
```css
background: #27272A;
```

Selected:
```css
color: white;
/* Possibly bold or with checkmark */
```

## Network Legend (when view is selected)

When a multi-category view is selected (e.g., Role Level), the top shows category pills:

### Legend Container
```css
position: absolute;
top: 16px;
left: 50%;
transform: translateX(-50%);
display: flex;
gap: 8px;
z-index: 10;
```

### Legend Pill
```css
background: #1F1F23;
border: 1px solid #27272A;
border-radius: 9999px;
padding: 6px 16px;
display: flex;
align-items: center;
gap: 8px;
font-size: 14px;
color: white;
cursor: pointer;
```

### Color Dot
```css
width: 10px;
height: 10px;
border-radius: 50%;
background: var(--category-color);
```

## Category Colors (Role Level example)
- **Executive Level**: #6366F1 (indigo-500)
- **Mid Level**: #EC4899 (pink-500)
- **Senior Level**: #10B981 (emerald-500)
- **Entry Level**: #F97316 (orange-500)

## Behavior
- Selecting a view immediately recolors/regroups the network
- Legend pills appear at top for multi-category views
- Clicking a legend pill could filter to just that category
- Network nodes animate to new positions/colors

## Implementation Notes
- Use a standard dropdown/select component
- When view changes, emit event to network component
- Network component maps personas to categories and colors
- Consider using Radix UI Dropdown Menu or similar
