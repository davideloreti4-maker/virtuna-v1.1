# Extracted Styles from Societies.io

**Date**: 2026-01-30
**Source**: https://app.societies.io (authenticated dashboard)
**Viewport**: 1440x900
**Method**: Playwright MCP automated extraction

---

## Key Discoveries

### Font Family
- **Primary font**: `Inter` (NOT Satoshi!)
- All text uses Inter font family throughout the app

### Global Colors
| Usage | RGB | Hex |
|-------|-----|-----|
| Body background | rgb(6, 6, 6) | #060606 |
| Sidebar bg | rgba(21, 21, 21, 0.314) | ~#151515 @ 31% opacity |
| Sidebar/card border | rgb(40, 40, 40) | #282828 |
| Selector border | rgb(58, 58, 58) | #3A3A3A |
| Section label | rgb(153, 163, 169) | #99A3A9 |
| Nav/muted text | rgb(184, 184, 184) | #B8B8B8 |
| Version text | rgb(101, 101, 101) | #656565 |
| Card description | rgb(221, 221, 221) | #DDDDDD |
| White text | rgb(255, 255, 255) | #FFFFFF |
| Orange accent | rgb(255, 156, 57) | #FF9C39 |
| Overlay | rgba(6, 6, 6, 0.667) | ~#060606 @ 67% |
| Semi-transparent panel | rgba(21, 21, 21, 0.667) | ~#151515 @ 67% |

---

## 1. SIDEBAR

### Container
```css
width: 240px;
background: rgba(21, 21, 21, 0.314);
border-right: 1px solid rgb(40, 40, 40);
padding: 16px 18px 0;
display: flex;
flex-direction: column;
justify-content: space-between;
height: 100vh;
```

### Logo
```css
width: 32px;
height: 32px;
```

### Section Labels ("Current Society", "Current View")
```css
color: rgb(153, 163, 169);
font-size: 12px;
font-weight: 400;
line-height: 18px;
font-family: Inter;
text-transform: none; /* NOT uppercase! */
```

### Society Selector Button
```css
background: transparent;
border: 1px solid rgb(58, 58, 58);
border-radius: 6px;
padding: 8px 12px;
width: 203px;
height: 39px;
font-size: 16px;
font-weight: 400;
line-height: 24px;
gap: 8px;
display: flex;
align-items: center;
justify-content: space-between;
```

### View Selector Button
```css
/* Same as Society but: */
border-radius: 8px;
gap: 4px;
```

### Create New Test
```css
color: rgb(184, 184, 184);
font-size: 14px;
font-weight: 400;
line-height: 21px;
padding: 8px;
margin: 0 -8px;
gap: 12px;
border-radius: 8px;
width: 219px;
height: 37px;
```

### Nav Items (Manage plan, Leave Feedback, etc.)
```css
color: rgb(184, 184, 184);
font-size: 14px;
font-weight: 400;
line-height: 21px;
padding: 8px;
margin: 0 -8px;
gap: 12px;
height: 38px;
border-radius: 8px;
display: flex;
align-items: center;
justify-content: space-between;
```

### Version Text
```css
color: rgb(101, 101, 101);
font-size: 12px;
font-weight: 400;
line-height: 18px;
```

---

## 2. MAIN CONTENT AREA

### Filter Pills (Country pills at top)
```css
background: rgba(21, 21, 21, 0.314);
border: 1px solid rgb(40, 40, 40);
border-radius: 9000px; /* pill shape */
padding: 8px 16px;
gap: 8px;
font-size: 14px;
font-weight: 400;
line-height: 21px;
color: rgb(255, 255, 255);
height: 39px;
```

### Main Content Panel
```css
background: rgb(6, 6, 6);
border: 1px solid rgb(40, 40, 40);
border-radius: 24px;
gap: 12px;
```

---

## 3. SOCIETY SELECTOR VIEW

### Section Heading (Personal Societies, Target Societies)
```css
color: rgb(255, 255, 255);
font-size: 18px;
font-weight: 600;
line-height: 30.6px;
font-family: Inter, sans-serif;
```

### Card Title (LinkedIn, Zurich Founders, etc.)
```css
color: rgb(255, 255, 255);
font-size: 14px;
font-weight: 400;
line-height: 21px;
```

### Card Description
```css
color: rgb(221, 221, 221);
font-size: 12px;
font-weight: 400;
line-height: 18px;
```

---

## 4. TEST TYPE SELECTOR

### Modal Heading
```css
color: rgb(255, 255, 255);
font-size: 18px;
font-weight: 600;
line-height: 30.6px;
```

### Category Labels (SURVEY, MARKETING CONTENT, etc.)
```css
color: rgb(184, 184, 184);
font-size: 12px;
font-weight: 400;
line-height: 18px;
text-transform: uppercase;
```

### Test Type Button
```css
background: transparent;
border: 1px solid rgb(58, 58, 58);
border-radius: 6px;
padding: 8px 12px;
gap: 8px;
font-size: 16px;
width: 203px;
height: 39px;
```

### Test Option Button (Survey, Article, etc.)
```css
padding: 6px;
gap: 12px;
border-radius: 8px;
width: 248px;
height: 52px;
```

### Request Context Button
```css
color: rgb(221, 221, 221);
padding: 8px 12px;
gap: 8px;
font-size: 14px;
font-weight: 400;
line-height: 21px;
border-radius: 8px;
```

---

## 5. SURVEY FORM

### Question Input
```css
font-size: 16px;
font-weight: 400;
line-height: 24px;
color: rgb(255, 255, 255);
/* Placeholder: "Write your question..." */
```

### Option Input
```css
font-size: 14px;
font-weight: 500;
line-height: 17.5px;
color: rgb(255, 255, 255);
border-bottom: 1px solid rgb(40, 40, 40);
height: 42px;
```

### Single/Multiple Choice Button
```css
padding: 6px 10px;
gap: 6px;
font-size: 16px;
border-radius: 6px;
```

### Add Choice Button
```css
padding: 6px 12px;
gap: 8px;
font-size: 14px;
font-weight: 400;
line-height: 21px;
border-radius: 8px;
```

### Survey Badge
```css
background: rgba(21, 21, 21, 0.667);
border: 1px solid rgb(40, 40, 40);
border-radius: 8px;
padding: 6px 12px;
gap: 8px;
font-size: 14px;
font-weight: 400;
line-height: 21px;
```

---

---

## 6. LEAVE FEEDBACK MODAL (Wave 2)

### Modal Panel
```css
width: 560px;
height: ~509px;
background: rgba(6, 6, 6, 0.667);
border-radius: 12px;
padding: 32px;
```

### Modal Heading
```css
color: rgb(255, 255, 255);
font-size: 18px;
font-weight: 600;
line-height: 30.6px;
font-family: Inter, sans-serif;
```

### Section Labels ("Your details", "Your feedback")
```css
color: rgb(255, 255, 255);
font-size: 14px;
font-weight: 400;
line-height: 21px;
```

### Input Fields
```css
color: rgb(255, 255, 255);
background: rgb(21, 21, 21);
border: 1px solid rgb(58, 58, 58);
border-radius: 8px;
padding: 12px 16px;
font-size: 14px;
font-weight: 500;
height: 48px;
width: 496px;
```

### Textarea
```css
color: rgb(255, 255, 255);
background: rgb(21, 21, 21);
border: 1px solid rgb(51, 51, 51);
border-radius: 8px;
padding: 12px;
font-size: 16px;
height: 120px;
```

### Submit Button (Primary CTA)
```css
color: rgb(6, 6, 6); /* dark text */
background: rgb(238, 243, 245); /* light/white */
border-radius: 8px;
padding: 12px 20px;
font-size: 16px;
font-weight: 400;
height: 40px;
gap: 8px;
```

### Email Link
```css
color: rgb(184, 184, 184);
text-decoration: underline;
font-size: 14px;
```

---

## 7. HOVER STATES (Wave 2)

### Nav Item Hover
```css
/* Normal state */
color: rgb(184, 184, 184); /* #B8B8B8 */
background: transparent;

/* Hover state */
color: rgb(255, 255, 255); /* white */
background: rgb(37, 37, 37); /* #252525 */
border-radius: 8px;
padding: 8px;
```

---

## 8. VIEW SELECTOR DROPDOWN (Wave 2)

### Dropdown Menu Container
```css
background: rgba(6, 6, 6, 0.667);
border: 1px solid rgb(40, 40, 40);
border-radius: 8px;
padding: 8px;
box-shadow: rgba(0, 0, 0, 0.5) 0px 4px 10px 0px;
width: 240px;
gap: 4px;
```

### Dropdown Label ("VIEWS")
```css
color: rgb(184, 184, 184);
font-size: 12px;
font-weight: 400;
/* Note: Content is uppercase but textTransform is none */
```

### Menu Item
```css
font-size: 16px;
font-weight: 400;
padding: 8px;
height: 37px;
border-radius: 6px;
```

---

## 9. SOCIETY SELECTOR MODAL (Wave 2)

### Modal Panel
```css
width: 1100px;
height: 738px;
background: rgb(6, 6, 6);
border: 1px solid rgb(40, 40, 40);
border-radius: 24px;
```

### Section Heading
```css
color: rgb(255, 255, 255);
font-size: 18px;
font-weight: 600;
line-height: 30.6px;
```

### Setup Badge (Orange)
```css
background: rgb(255, 156, 57); /* #FF9C39 */
color: rgb(255, 255, 255);
border-radius: 9999px; /* pill */
padding: 6px 12px;
font-size: 12px;
```

### Custom/Example Badge
```css
background: rgb(21, 21, 21); /* #151515 */
color: rgb(255, 255, 255);
border-radius: 9999px; /* pill */
padding: 6px 12px;
font-size: 12px;
```

### Card Title
```css
color: rgb(255, 255, 255);
font-size: 16px;
font-weight: 600;
line-height: 24px;
```

### Card Description
```css
color: rgb(221, 221, 221); /* #DDDDDD */
font-size: 12px;
font-weight: 400;
line-height: 18px;
```

---

## 10. TEST TYPE SELECTOR PANEL (Wave 2)

### Panel Container
```css
width: 770px;
height: 434px;
background: rgba(6, 6, 6, 0.667);
border: 1px solid rgb(40, 40, 40);
border-radius: 8px;
padding: 12px;
box-shadow: rgba(0, 0, 0, 0.5) 0px 4px 10px 0px;
```

### Panel Heading
```css
color: rgb(255, 255, 255);
font-size: 18px;
font-weight: 400;
line-height: 30.6px;
```

### Category Labels (SURVEY, MARKETING CONTENT, etc.)
```css
color: rgb(184, 184, 184);
font-size: 12px;
font-weight: 400;
text-transform: uppercase;
```

### Test Type Button
```css
width: 248px;
height: 52px;
border-radius: 8px;
padding: 6px;
gap: 12px;
```

### Test Type Label
```css
color: rgb(255, 255, 255);
font-size: 14px;
font-weight: 400;
```

### Request Context Button
```css
color: rgb(221, 221, 221);
font-size: 14px;
font-weight: 400;
padding: 8px 12px;
border-radius: 8px;
```

---

## SCREENSHOTS CAPTURED

### Wave 1
All saved to `~/.playwright-mcp/`:
1. `societies-dashboard.png` - Main dashboard with network viz
2. `societies-after-click.png` - Dashboard after interaction
3. `societies-modal-open.png` - Society selector open
4. `societies-test-selector.png` - Test type selector panel
5. `societies-survey-form.png` - Survey form

### Wave 2
6. `wave2-dashboard-start.png` - Dashboard at start of Wave 2
7. `wave2-feedback-modal.png` - Leave Feedback modal
8. `wave2-nav-hover.png` - Nav item hover state
9. `wave2-view-dropdown.png` - View selector dropdown
10. `wave2-society-selector.png` - Society selector modal
11. `wave2-test-type-selector.png` - Test type selector panel

---

## CRITICAL DIFFERENCES FROM VIRTUNA

| Element | Virtuna Current | Societies.io Actual |
|---------|-----------------|---------------------|
| Font | Satoshi | **Inter** |
| Sidebar width | 248px | **240px** |
| Sidebar bg | #0A0A0A solid | **rgba(21,21,21,0.31)** |
| Sidebar border | border-zinc-800 | **#282828** |
| Section labels | UPPERCASE | **Normal case** |
| Section label color | text-zinc-500 | **#99A3A9** |
| Nav item color | text-zinc-400 | **#B8B8B8** |
| Nav item padding | py-3 | **p-2 (8px)** |
| Nav item height | auto | **38px** |
| Create test btn | text-white, border-b | **#B8B8B8, no border** |
| Version color | text-zinc-600 | **#656565** |
