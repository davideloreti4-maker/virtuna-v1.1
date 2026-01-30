# Test History

## Screenshot
`_assets/test-history-sidebar.png`

## Description
Completed tests appear in the sidebar below "Create a new test". Each test is displayed as a clickable item that allows users to revisit results.

## Location
- Position: Sidebar, below "Create a new test" button
- Visibility: Always visible when tests exist

## History Item Structure

```
┌──────────────────────────────────────────┐
│ Favorite color: what is?              ✕  │
└──────────────────────────────────────────┘
```

## Elements

### Test Title
- Text: Truncated test name/question
- Format: First ~25 characters + "..."
- Style: Regular font, white text

### Delete Button
- Icon: X (close icon)
- Visibility: Visible on hover
- Position: Right side of item
- Action: Deletes test from history

## Styles

### History Item Container
- Background: Darker than sidebar (#1a1a1a)
- Padding: 12px 16px
- Border radius: 8px
- Cursor: Pointer
- Hover: Subtle background change

### Selected State
- When viewing a test's results:
  - Background: Slightly lighter (#252525)
  - Left border: Accent color indicator

### Test Title
- Font size: 14px
- Color: White
- Font weight: Regular
- Overflow: Hidden
- Text overflow: Ellipsis
- White-space: Nowrap

### Delete Button
- Size: 16px
- Color: #888 (muted)
- Hover color: #fff
- Background: Transparent
- Padding: 4px

## Behavior

### Clicking Test Item
- Loads test results in main view
- Updates network visualization
- Highlights item as selected

### Deleting Test
- Click X button
- Test removed from list
- No confirmation dialog (based on observed behavior)
- If currently viewing that test, returns to empty state

### Multiple Tests
- Tests listed in reverse chronological order (newest first)
- No visible limit on number of tests
- Scrollable if many tests exist

## Empty State
When no tests exist:
- Only "Create a new test" button visible
- No "No tests yet" message observed

## Integration with Results View

When a test is selected:
1. Sidebar item highlighted
2. Results panel loads on right
3. Network visualization updates
4. Share button becomes available
