# Create Test Flow

## Screenshot References
- `_assets/create-test-step1.png` - Type selector
- `_assets/create-test-survey-form.png` - Survey form
- `_assets/survey-question-types.png` - Question type dropdown
- `_assets/context-type-picker.png` - Context picker with search

## Step 1: Type Selection

### Modal Structure
```
┌─────────────────────────────────────────────────────────────────┐
│                                                          [×]    │
│           What would you like to simulate?                      │
│                                                                 │
│ SURVEY              SOCIAL MEDIA POSTS        COMMUNICATION     │
│ ┌──────────┐        ┌──────────┐              ┌──────────┐     │
│ │📋 Survey │        │in LinkedIn│              │✉️ Email   │     │
│ └──────────┘        │   Post   │              │Subject Line│     │
│                     └──────────┘              └──────────┘     │
│ MARKETING           ┌──────────┐              ┌──────────┐     │
│ CONTENT             │📷 Instagram              │✉️ Email   │     │
│ ┌──────────┐        │   Post   │              └──────────┘     │
│ │✏️ Article│        └──────────┘                               │
│ └──────────┘        ┌──────────┐              PRODUCT           │
│ ┌──────────┐        │ X Post   │              ┌──────────┐     │
│ │📄 Website│        └──────────┘              │💡 Product │     │
│ │ Content  │        ┌──────────┐              │Proposition│     │
│ └──────────┘        │🎵 TikTok │              └──────────┘     │
│ ┌──────────┐        │  Script  │                               │
│ │📢 Advert-│        └──────────┘                               │
│ │isement   │                                                    │
│ └──────────┘                                                    │
│                                                                 │
│         + Request a new context                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Test Types

#### Survey
- Icon: 📋 (document with lines)
- Description: Run surveys on your society

#### Marketing Content
- **Article** - Icon: ✏️ (pencil)
- **Website Content** - Icon: 📄 (document)
- **Advertisement** - Icon: 📢 (megaphone)

#### Social Media Posts
- **LinkedIn Post** - Icon: LinkedIn logo
- **Instagram Post** - Icon: Instagram camera
- **X Post** - Icon: X logo
- **TikTok Script** - Icon: TikTok logo

#### Communication
- **Email Subject Line** - Icon: ✉️
- **Email** - Icon: ✉️

#### Product
- **Product Proposition** - Icon: 💡 (lightbulb)

### Type Card Styles
```css
background: transparent;
border: 1px solid #27272A;
border-radius: 12px;
padding: 12px 16px;
display: flex;
align-items: center;
gap: 12px;
cursor: pointer;
transition: all 0.2s;
```

Hover:
```css
border-color: #3F3F46;
background: rgba(255, 255, 255, 0.02);
```

### Category Labels
```css
font-size: 11px;
font-weight: 600;
color: #71717A;
text-transform: uppercase;
letter-spacing: 0.05em;
margin-bottom: 12px;
```

---

## Step 2: Survey Form

### Form Structure
```
┌─────────────────────────────────────────────────────────────────┐
│ Write your question...                          [≡ Single ▼]   │
├─────────────────────────────────────────────────────────────────┤
│ ○ Option 1                                        [↑] [↓]      │
│ ○ Option 2                                        [↑] [↓]      │
│                                                                 │
│ + Add choice                                                    │
├─────────────────────────────────────────────────────────────────┤
│ [📋 Survey]                                    [Ask ⚡]        │
└─────────────────────────────────────────────────────────────────┘
```

### Question Input
```css
background: transparent;
border: none;
font-size: 16px;
color: white;
width: 100%;
padding: 16px 0;
```

Placeholder:
```css
color: #52525B; /* zinc-600 */
```

### Question Type Dropdown
Button with icon:
```css
background: #27272A;
border: 1px solid #3F3F46;
border-radius: 6px;
padding: 6px 12px;
font-size: 13px;
color: #A1A1AA;
display: flex;
align-items: center;
gap: 6px;
cursor: pointer;
```

Options:
- **Single select** - Radio button icon
- **Open response** - Text lines icon

### Option Row
```css
display: flex;
align-items: center;
gap: 12px;
padding: 12px 0;
border-bottom: 1px solid #27272A;
```

Radio circle:
```css
width: 18px;
height: 18px;
border: 2px solid #52525B;
border-radius: 50%;
```

Option input:
```css
background: transparent;
border: none;
font-size: 14px;
color: #A1A1AA;
flex: 1;
```

Reorder buttons (↑ ↓):
```css
color: #52525B;
cursor: pointer;
opacity: 0;
transition: opacity 0.15s;
```

Show on row hover.

### Add Choice Button
```css
display: flex;
align-items: center;
gap: 8px;
padding: 12px 0;
color: #71717A;
font-size: 14px;
cursor: pointer;
```

Hover:
```css
color: #A1A1AA;
```

### Bottom Bar
```css
display: flex;
justify-content: space-between;
align-items: center;
padding: 16px 0;
border-top: 1px solid #27272A;
margin-top: 16px;
```

### Type Badge (Survey)
```css
background: #27272A;
border: 1px solid #3F3F46;
border-radius: 8px;
padding: 8px 16px;
display: flex;
align-items: center;
gap: 8px;
font-size: 14px;
color: #A1A1AA;
cursor: pointer;
```

Clicking opens the type picker again.

### Ask Button
```css
background: white;
color: #0A0A0A;
border: none;
border-radius: 8px;
padding: 10px 20px;
font-size: 14px;
font-weight: 500;
display: flex;
align-items: center;
gap: 8px;
cursor: pointer;
```

Lightning icon: ⚡ - indicates AI-powered

Hover:
```css
background: #E4E4E7;
```

---

## Context Type Picker (with Search)

When clicking the Survey badge, shows searchable type picker:

### Search Input
```css
background: #27272A;
border: 1px solid #3F3F46;
border-radius: 8px;
padding: 12px 16px;
font-size: 14px;
color: white;
width: 300px;
```

Placeholder: "Search contexts..."

### Request New Context Link
```css
color: #71717A;
font-size: 14px;
display: flex;
align-items: center;
gap: 8px;
cursor: pointer;
```

Plus icon before text.

## Implementation Notes
- Form appears as a floating panel at bottom of screen
- Network visualization dimmed behind when form is open
- Form has subtle backdrop blur
- Consider using Radix UI for dropdown menus
- Form state: question text, options array, question type
- "Ask" button triggers AI simulation on the society
