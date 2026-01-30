# Test Type Selector Modal

## Screenshot
`_assets/test-type-selector.png`

## Description
Modal that appears when clicking "Create a new test" from the sidebar. Allows users to select from 11 different test types.

## Layout

### Header
- Title: "What would you like to simulate?"
- Close button (X) in top-right

### Categories & Options

```
SURVEY
├── Survey (icon: document)

MARKETING CONTENT
├── Article (icon: pencil)
├── Website Content (icon: browser)
└── Advertisement (icon: megaphone)

SOCIAL MEDIA POSTS
├── LinkedIn Post (icon: LinkedIn logo)
├── Instagram Post (icon: Instagram logo)
├── X Post (icon: X logo)
└── TikTok Script (icon: TikTok logo)

COMMUNICATION
├── Email Subject Line (icon: envelope)
└── Email (icon: envelope)

PRODUCT
└── Product Proposition (icon: lightbulb)
```

### Footer
- "Request a new context" button with + icon

## Styles

### Modal Container
- Background: Semi-transparent dark overlay
- Modal: Dark gray background (#1a1a1a or similar)
- Border radius: 12px
- Padding: 24px

### Category Labels
- Text: Uppercase, small font size
- Color: Muted gray (#888)
- Margin-bottom: 12px

### Test Type Buttons
- Background: Transparent
- Hover: Subtle highlight
- Padding: 12px 16px
- Border radius: 8px
- Display: Flex (icon + text)
- Icon size: 20px
- Text color: White

### Search Input (when selector is open from form)
- Placeholder: "Search contexts..."
- Icon: Search icon (magnifying glass)
- Full width at top of modal

## Behavior
- Click outside modal to close
- Click test type to select and open corresponding form
- ESC key closes modal
- Search filters available test types

## Icons
Each test type has a distinctive icon:
- Survey: Document/clipboard
- Article: Pencil/pen
- Website Content: Browser window
- Advertisement: Megaphone/speaker
- LinkedIn Post: LinkedIn "in" logo
- Instagram Post: Instagram camera logo
- X Post: X logo (formerly Twitter bird)
- TikTok Script: TikTok music note logo
- Email Subject Line: Envelope
- Email: Envelope
- Product Proposition: Lightbulb
