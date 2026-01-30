# Content Test Forms

All non-survey test types share the same form structure with only the placeholder text and type label changing.

## Screenshots
| Test Type | Screenshot |
|-----------|------------|
| Article | `_assets/article-form.png` |
| Website Content | `_assets/website-content-form.png` |
| Advertisement | `_assets/advertisement-form.png` |
| LinkedIn Post | `_assets/linkedin-post-form.png` |
| Instagram Post | `_assets/instagram-post-form.png` |
| X Post | `_assets/x-post-form.png` |
| TikTok Script | `_assets/tiktok-script-form.png` |
| Email Subject Line | `_assets/email-subject-line-form.png` |
| Email | `_assets/email-form.png` |
| Product Proposition | `_assets/product-proposition-form.png` |

## Form Structure

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│ [Placeholder text varies by type...]                    │
│                                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘

[📝 Type Label]  [🖼 Upload Images]     [Help Me Craft ✨]  [Simulate ⚡]
```

## Placeholder Text by Type

| Test Type | Placeholder |
|-----------|-------------|
| Article | "Write your article..." |
| Website Content | "Upload an image of your website, describe it, or write your website content here..." |
| Advertisement | "Describe your advert or upload an image..." |
| LinkedIn Post | "Write your post..." |
| Instagram Post | "Write your post..." |
| X Post | "Write your post..." |
| TikTok Script | "Write your script..." |
| Email Subject Line | "Write a subject line for an email..." |
| Email | "Write an email..." |
| Product Proposition | "Describe your product..." |

## Form Fields

### Content Textarea
- Type: Textarea (multi-line)
- Placeholder: Varies by test type
- Width: Full width of form
- Height: ~120px (expands with content)
- Background: Dark (#1e1e1e)
- Border: None
- Font size: 16px
- Color: White

## Buttons

### Type Selector (left group)
- Icon: Varies by type
- Label: Type name (e.g., "Article", "LinkedIn Post")
- Style: Outlined/secondary button
- Action: Opens test type selector modal to change type

### Upload Images
- Icon: Image icon (🖼)
- Label: "Upload Images"
- Style: Outlined/secondary button
- Action: Opens file picker for image upload

### Help Me Craft (right group)
- Icon: Sparkles (✨)
- Label: "Help Me Craft"
- Style: Text button with icon
- Action: Opens AI assistance for content creation

### Simulate
- Icon: Lightning bolt (⚡)
- Label: "Simulate"
- Style: Filled/primary button (white background, black text)
- Action: Submits content to simulation

## Styles

### Form Container
- Background: Dark gray (#1e1e1e)
- Border radius: 12px
- Padding: 16px 20px
- Position: Fixed to bottom of viewport
- Box shadow: Subtle upward shadow

### Textarea
- Background: Transparent
- Border: None
- Resize: None
- Font family: System font
- Line height: 1.5

### Button Group Layout
- Flex container with space-between
- Left group: Type selector + Upload Images
- Right group: Help Me Craft + Simulate
- Gap between buttons: 12px

### Type Selector Button
- Background: Transparent
- Border: 1px solid #444
- Border radius: 8px
- Padding: 10px 16px
- Color: White
- Hover: Border color lightens

### Upload Images Button
- Same style as Type Selector

### Help Me Craft Button
- Background: Transparent
- Border: None
- Color: White
- Padding: 10px 16px
- Hover: Subtle background

### Simulate Button
- Background: White
- Color: Black
- Border radius: 8px
- Padding: 10px 24px
- Font weight: 500
- Hover: Slight opacity change

## Icons by Type

| Test Type | Icon |
|-----------|------|
| Article | Pencil ✏️ |
| Website Content | Browser window 🌐 |
| Advertisement | Megaphone 📢 |
| LinkedIn Post | LinkedIn logo |
| Instagram Post | Instagram logo |
| X Post | X logo |
| TikTok Script | TikTok logo ♪ |
| Email Subject Line | Envelope ✉️ |
| Email | Envelope ✉️ |
| Product Proposition | Lightbulb 💡 |

## Behavior

### Content Input
- Auto-expands as user types
- No character limit shown
- Supports multi-line input

### Upload Images
- Accepts common image formats (PNG, JPG, GIF)
- Images appear inline or as thumbnails
- Multiple images supported

### Help Me Craft
- Opens AI assistant dialog
- Helps generate or improve content
- Context-aware to test type

### Type Switching
- Click type selector to change
- Content preserved when switching
- Placeholder updates immediately
