# Survey Form

## Screenshots
- `_assets/survey-form.png` - Main survey form
- `_assets/survey-question-types.png` - Question type dropdown open

## Description
The Survey form has a unique structure compared to other test types. It allows creating single-select or open-response questions with customizable options.

## Form Structure

### Question Section
```
┌─────────────────────────────────────────────────────────┐
│ Write your question...                     [≡ Single ▼] │
└─────────────────────────────────────────────────────────┘
```

### Options Section (Single Select mode)
```
○ Option 1                                    [▲] [▼]
○ Option 2                                    [▲] [▼]

[+ Add choice]
```

### Footer
```
[📋 Survey]                                   [Ask ⚡]
```

## Form Fields

### Question Input
- Type: Textarea
- Placeholder: "Write your question..."
- Position: Top of form
- Width: ~80% of form width

### Question Type Dropdown
- Button label: "Single" (with list icon)
- Position: Top-right of question input
- Options:
  - **Single select** - Radio button style, one answer
  - **Open response** - Free text input

### Options List (Single Select mode only)
- Each option has:
  - Radio button indicator (○)
  - Editable textbox (placeholder: "Option 1", "Option 2", etc.)
  - Up arrow button (disabled if first)
  - Down arrow button (disabled if last)
- Default: 2 options
- Add choice button at bottom

### Add Choice Button
- Icon: Plus (+)
- Text: "Add choice"
- Action: Adds new option to list

## Buttons

### Type Selector (left)
- Icon: Document icon
- Label: "Survey"
- Action: Opens test type selector modal

### Submit Button (right)
- Label: "Ask"
- Icon: Lightning bolt (⚡)
- Style: Filled/primary button
- Action: Submits survey to simulation

## Styles

### Form Container
- Background: Dark (#1e1e1e)
- Border radius: 12px
- Padding: 20px
- Position: Bottom of viewport

### Question Input
- Background: Transparent
- Border: None (borderless)
- Font size: 16px
- Color: White
- Placeholder color: Gray (#888)

### Question Type Button
- Background: Dark gray
- Border radius: 6px
- Padding: 8px 12px
- Icon + text layout

### Options
- Radio indicator: Circle outline
- Input: Borderless, transparent
- Reorder buttons: Small, icon-only

### Add Choice Button
- Background: Transparent
- Color: White
- Hover: Subtle highlight

### Submit Button
- Background: White
- Color: Black
- Border radius: 8px
- Padding: 10px 20px
- Font weight: Medium

## Behavior

### Question Type Change
- Selecting "Single select" shows options list
- Selecting "Open response" hides options list

### Option Reordering
- Up arrow moves option up
- Down arrow moves option down
- First option: up arrow disabled
- Last option: down arrow disabled

### Validation
- Question required
- At least 2 options for single select
- Options cannot be empty

## Differences from Content Forms
| Feature | Survey | Content Forms |
|---------|--------|---------------|
| Question input | Textarea | Textarea |
| Options | Yes (dynamic list) | No |
| Question types | Dropdown | No |
| Upload Images | No | Yes |
| Help Me Craft | No | Yes |
| Submit label | "Ask" | "Simulate" |
