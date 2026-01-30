# Sidebar Component

## Screenshot Reference
`_assets/dashboard-main.png`

## Structure

```
┌────────────────────────────────┐
│ ∧  Logo            [⊡] Collapse│  ← Header row
├────────────────────────────────┤
│ Current Society                │  ← Label (muted)
│ ┌────────────────────────────┐│
│ │ Zurich Founders         ▼ ││  ← Dropdown button
│ └────────────────────────────┘│
├────────────────────────────────┤
│ Current View                   │  ← Label (muted)
│ ┌────────────────────────────┐│
│ │ Country                    ││  ← Dropdown button
│ └────────────────────────────┘│
├────────────────────────────────┤
│ Create a new test          [+]│  ← Action button
│────────────────────────────────│  ← Separator line
│                                │
│         (spacer)               │
│                                │
│────────────────────────────────│  ← Separator line
│ Manage plan               [⊡] │
│ Leave Feedback            [💬]│
│ Product Guide             [📖]│
│ Log Out                   [→] │
│         Version 2.1            │  ← Muted text
└────────────────────────────────┘
```

## Dimensions
- Width: 248px (fixed)
- Height: 100vh
- Padding: 16px

## Styles

### Container
```css
background: #0A0A0A;
border-right: 1px solid #27272A;
display: flex;
flex-direction: column;
height: 100vh;
width: 248px;
padding: 16px;
```

### Logo
- Stylized "∧" character or SVG
- Color: white
- Size: ~24px
- Cursor: pointer (links to home)

### Collapse Button
- Position: Top right
- Icon: Two overlapping squares
- Size: 20px
- Color: #71717A (zinc-500)
- Hover: #A1A1AA

### Section Labels
```css
font-size: 12px;
color: #71717A; /* zinc-500 */
text-transform: uppercase;
letter-spacing: 0.05em;
margin-bottom: 8px;
```

### Dropdown Buttons
```css
width: 100%;
background: #18181B; /* zinc-900 */
border: 1px solid #27272A; /* zinc-800 */
border-radius: 8px;
padding: 12px 16px;
color: white;
font-size: 14px;
display: flex;
justify-content: space-between;
align-items: center;
cursor: pointer;
```

Hover state:
```css
border-color: #3F3F46; /* zinc-700 */
```

### Create Test Button
```css
display: flex;
justify-content: space-between;
align-items: center;
padding: 12px 0;
color: white;
font-size: 14px;
cursor: pointer;
border-bottom: 1px solid #27272A;
```

Plus icon:
- Size: 16px
- Color: white

### Bottom Menu Items
```css
display: flex;
justify-content: space-between;
align-items: center;
padding: 12px 0;
color: #A1A1AA; /* zinc-400 */
font-size: 14px;
cursor: pointer;
```

Hover:
```css
color: white;
```

Icons:
- Size: 18px
- Color: inherit

### Version Text
```css
text-align: center;
color: #52525B; /* zinc-600 */
font-size: 12px;
margin-top: 8px;
```

## Icons Used
- Collapse: Two overlapping squares
- Society dropdown: Chevron up/down
- View dropdown: None (no chevron visible in screenshot)
- Create test: Plus (+)
- Manage plan: Credit card or settings icon
- Leave Feedback: Chat bubble / message icon
- Product Guide: Book / document icon
- Log Out: Arrow pointing right with exit box

## Collapsed State
When collapsed:
- Width: ~64px
- Only icons visible
- Tooltips on hover
- Logo still visible

## Implementation Notes
- Use flexbox with space-between for items
- Separator using `border-bottom` or `<hr>` with custom styling
- Icons can use Lucide React or similar
