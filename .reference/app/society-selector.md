# Society Selector Dropdown

## Screenshot Reference
`_assets/society-selector-open.png`

## Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Personal Societies  ⓘ                                          │
│ ┌──────────────────────────┐  ┌──────────────────────────┐    │
│ │ ┌──────┐                 │  │ ┌──────┐                 │    │
│ │ │Setup │                 │  │ │Setup │                 │    │
│ │ └──────┘                 │  │ └──────┘                 │    │
│ │                          │  │                          │    │
│ │ [in] LinkedIn            │  │ [X] X (formerly Twitter) │    │
│ │ Your personal LinkedIn   │  │ Your X network built     │    │
│ │ network built around...  │  │ around your followers.   │    │
│ └──────────────────────────┘  └──────────────────────────┘    │
│                                                                 │
│ Target Societies  ⓘ                                            │
│ ┌────────────────────┐  ┌────────────────────┐  ┌────────────┐│
│ │                    │  │ ┌──────┐    [⋮]    │  │ ┌───────┐  ││
│ │                    │  │ │Custom│           │  │ │Example│  ││
│ │ + Create Target    │  │ └──────┘           │  │ └───────┘  ││
│ │   Society          │  │ [📁] Zurich        │  │ [💰] Startup│
│ │                    │  │      Founders      │  │    Investors│
│ │                    │  │ Entrepreneurs...   │  │ Individuals.│
│ └────────────────────┘  └────────────────────┘  └────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Popup/Modal Styles

### Container
```css
background: #18181B; /* zinc-900 */
border: 1px solid #27272A;
border-radius: 12px;
padding: 24px;
min-width: 600px;
max-width: 800px;
box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
```

### Section Headings
```css
font-size: 14px;
font-weight: 600;
color: white;
margin-bottom: 16px;
display: flex;
align-items: center;
gap: 8px;
```

Info icon:
- Size: 16px
- Color: #71717A
- Cursor: help

### Personal Society Cards
```css
background: transparent;
border: 1px dashed #3F3F46; /* zinc-700 */
border-radius: 12px;
padding: 16px;
min-width: 200px;
cursor: pointer;
transition: border-color 0.2s;
```

Hover:
```css
border-color: #52525B;
border-style: solid;
```

### "Setup" Badge
```css
background: #F97316; /* orange-500 */
color: white;
font-size: 12px;
font-weight: 500;
padding: 4px 12px;
border-radius: 6px;
```

### Platform Icons
- LinkedIn: Official "in" logo, blue (#0A66C2)
- X/Twitter: X logo, white

### Target Society Cards

#### Create Card (dashed border)
```css
background: transparent;
border: 1px dashed #3F3F46;
border-radius: 12px;
padding: 24px;
display: flex;
align-items: center;
justify-content: center;
cursor: pointer;
```

Text: "Create Target Society"

#### Existing Society Card
```css
background: #18181B;
border: 1px solid #27272A;
border-radius: 12px;
padding: 16px;
position: relative;
cursor: pointer;
```

Selected state:
```css
border-color: #6366F1; /* indigo-500 */
```

### Badge Types

#### "Custom" Badge
```css
background: #27272A;
color: #A1A1AA;
font-size: 11px;
font-weight: 500;
padding: 2px 8px;
border-radius: 4px;
```

#### "Example" Badge
Same as Custom badge

### Society Card Icons
- Folder/briefcase icon for generic societies
- Coin/money icon for investor-type societies
- Size: 24px
- Color: white

### Three-dot Menu (⋮)
- Position: Top right of card
- Color: #71717A
- Hover: #A1A1AA

### Menu Dropdown (on ⋮ click)
```css
background: #27272A;
border: 1px solid #3F3F46;
border-radius: 8px;
padding: 4px;
box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
```

Menu items:
- Edit
- Refresh
- Delete

```css
padding: 8px 12px;
font-size: 13px;
color: #E4E4E7;
border-radius: 4px;
cursor: pointer;
```

Hover:
```css
background: #3F3F46;
```

Delete item:
```css
color: #EF4444; /* red-500 on hover */
```

## Implementation Notes
- Modal appears centered over content
- Background has slight blur/dim overlay
- ESC key closes modal
- Click outside closes modal
- Cards are in a flex grid layout with gap
- Personal societies: 2 columns
- Target societies: 3 columns (create + societies)
