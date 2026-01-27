# Phase 1: Explore - societies.io 1:1 Clone

## Date: 2026-01-27

## Page Structure
societies.io is a **single-page hero landing** with:
- Sticky header
- Full-height hero section with node sphere
- No footer
- No additional sections

## Extracted Styles (from societies.io)

### Colors
- **Body Background**: `#0d0d0d` (rgb(13, 13, 13))
- **Orange Accent**: `#E57850` (rgb(229, 120, 80))
- **Text White**: `#ffffff`
- **Text Subtitle**: `#f5f5f5` (rgb(245, 245, 245))

### Typography

**H1 "Human Behavior,"**
- Font: "Funnel Display", sans-serif
- Size: 52px
- Weight: 350
- Line-height: 62.4px (1.2)
- Color: white

**"Simulated." (orange)**
- Same as H1 but color: #E57850

**Subtitle**
- Font: "Satoshi", system fonts
- Size: 28px
- Weight: 400
- Color: #f5f5f5

### Buttons

**CTA "Get in touch"**
- Background: #E57850
- Color: white
- Font size: 15px
- Font weight: 500
- Padding: 14px 28px
- Border-radius: 6px
- Height: ~50px

**Header "Book a Meeting"**
- Background: #E57850
- Color: white
- Font size: 14px
- Font weight: 500
- Padding: 8px 16px
- Border-radius: 4px
- Height: ~37px

**"Sign in" link**
- Color: white
- Font size: 14px

### Layout
- Page is full viewport height
- Content centered
- Two-column layout on desktop (text left, sphere right)

### Special Elements

**Orange Corner Decoration**
- Position: absolute top-left
- Size: ~626x550px
- Grid of orange dots that fade out
- Creates the orange dot cluster effect in top-left corner

**Dot Grid Pattern**
- Subtle white dots on dark background
- ~20px spacing

**Node Sphere**
- Canvas-based 3D rotating sphere
- ~180+ nodes with connections
- One highlighted orange node with glow
- Nodes vary in size and opacity based on Z-depth

## Current Virtuna Differences to Fix

1. **Font**: Using Geist instead of Funnel Display - need to add Google Fonts
2. **H1 size**: Need 52px with weight 350
3. **Orange corner decoration**: Missing entirely - need to add
4. **Node sphere**: Matches fairly well, minor glow refinements
5. **Spacing/layout**: Minor adjustments needed
