# Dashboard / Main View

## Screenshot Reference
`_assets/dashboard-main.png`

## Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ ┌──────────┐                                                │
│ │ Sidebar  │        Network Visualization                   │
│ │ (fixed)  │        (WebGL/Three.js canvas)                │
│ │          │                                                │
│ │ - Logo   │              ┌─────────────┐                   │
│ │ - Society│              │ Switzerland │  ← Country pill   │
│ │ - View   │              └─────────────┘                   │
│ │ - Create │                                                │
│ │   Test   │         ●─────●─────●                         │
│ │          │        ╱│╲   ╱│╲   ╱│╲                        │
│ │ ──────── │       ●─●─●─●─●─●─●─●─●                       │
│ │ - Manage │        ╲│╱   ╲│╱   ╲│╱                        │
│ │ - Feedbk │         ●─────●─────●                         │
│ │ - Guide  │                                                │
│ │ - Logout │                                                │
│ │ v2.1     │                                                │
│ └──────────┘                                                │
└─────────────────────────────────────────────────────────────┘
```

## Key Styles

### Background
- **Color**: #0A0A0A (near black)
- Full viewport height
- Dark mode only

### Network Visualization
- Nodes: Circular, various sizes
- Default color: #6366F1 (indigo-500) - single color for Country view
- Multi-color when grouped by Role Level:
  - Executive: #6366F1 (indigo)
  - Mid Level: #EC4899 (pink)
  - Senior: #10B981 (emerald)
  - Entry: #F97316 (orange)
- Connections: Thin white/gray lines (#FFFFFF10 to #FFFFFF30)
- Node opacity varies by "depth" in network

### Country Pill (Legend)
- Position: Top center, above network
- Background: #1F1F23 with border
- Border: 1px solid #27272A
- Border-radius: full (pill shape)
- Padding: 8px 16px
- Contains: Colored dot + label
- Multiple pills when viewing by category (Role Level, etc.)

## Network Behavior
- Canvas-based rendering (WebGL/Three.js)
- Nodes are not individually clickable via DOM
- Network auto-centers on load
- Smooth animations when switching views
- Nodes regroup/recolor when view changes

## Implementation Notes
- Network is rendered in a canvas element, not individual DOM nodes
- Consider using: react-force-graph, three.js, or d3-force
- Sidebar is position: fixed, left: 0
- Main content area fills remaining space
