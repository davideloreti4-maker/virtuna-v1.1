# Test Results View

## Screenshots
- `_assets/survey-results.png` - Main results view
- `_assets/survey-results-full.png` - Full results with conversation section
- `_assets/survey-simulating.png` - Loading state during simulation

## Description
After submitting a test, the results view displays the simulation outcomes including quantitative results, AI-generated insights, and categorized conversation themes.

## Loading States

### Simulation Progress
The simulation goes through several phases:
1. **"Distributing your survey..."** - Initial distribution
2. **"Collecting responses..."** - Gathering virtual responses
3. **"Analyzing responses..."** - Processing data
4. **"Drafting results..."** - Generating insights

### Loading UI
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│     ● Collecting responses...                    ~2 min │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- Status indicator: Green dot
- Status text: Current phase
- Time estimate: "~2 minutes"
- Background: Network visualization animates with yellow particles

## Results View Structure

### Header
```
                                          [Share Survey 📤]
```

### Results Panel
```
┌─────────────────────────────────────────────────────────┐
│ Single Select                                           │
│                                                         │
│ What is your favorite color?                            │
│                                                         │
│ Blue  ████████████████████████████████████████  100%   │
│ Red   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    0%   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ Insights ⓘ                                              │
│                                                         │
│ Entrepreneurs in Zurich overwhelmingly favor blue.      │
│ 100% of respondents chose blue as their favorite color; │
│ red received no votes.                                  │
│                                                         │
│ Qualitative feedback suggests associations with         │
│ calmness, Swiss landscapes (lakes, sky, Alps), and      │
│ technology.                                             │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ Conversation ⓘ                                          │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Calming Associations                                │ │
│ │ Approximately 40% of the thoughts mention 'calming' │ │
│ │ and its association with nature...                  │ │
│ │                                                     │ │
│ │ "Calming and professional, like a clear sky"        │ │
│ │ "Blue is kinda chill."                              │ │
│ │ "Calming...reminds me of the lake"                  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Safe and Standard                                   │ │
│ │ About 25% consider blue a 'safe,' 'standard,'...    │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Sections

### 1. Share Button
- Position: Top-right of results panel
- Label: "Share Survey"
- Icon: Upload/share icon
- Action: Opens sharing options

### 2. Question Type Label
- Text: "Single Select" (or "Open Response")
- Style: Small, muted text
- Position: Top of results card

### 3. Question Text
- Displays the original question
- Style: Medium font, white text

### 4. Response Results (Single Select only)
- Each option shows:
  - Option text
  - Progress bar (filled portion = percentage)
  - Percentage value
- Sorted by percentage (highest first)
- Bar colors: Orange/amber for responses

### 5. Insights Section
- Header: "Insights" with info icon (ⓘ)
- Content: AI-generated analysis paragraphs
- Includes:
  - Key findings
  - Statistical summary
  - Actionable recommendations

### 6. Conversation Section
- Header: "Conversation" with info icon (ⓘ)
- Contains themed categories:
  - Theme title (e.g., "Calming Associations")
  - Percentage/description (e.g., "Approximately 40%...")
  - Sample quotes from virtual respondents

## Styles

### Results Panel
- Background: Dark (#1a1a1a)
- Border radius: 12px
- Padding: 24px
- Position: Right side of screen
- Width: ~35% of viewport
- Max-height: Full viewport (scrollable)

### Share Button
- Background: Transparent
- Border: 1px solid #444
- Border radius: 8px
- Padding: 10px 20px
- Color: White

### Question Type Label
- Font size: 12px
- Color: Muted gray (#888)
- Text transform: None

### Question Text
- Font size: 18px
- Font weight: 500
- Color: White
- Margin-bottom: 16px

### Progress Bars
- Container background: #333
- Fill color: #f5a623 (orange/amber)
- Height: 8px
- Border radius: 4px

### Percentage Text
- Font size: 14px
- Color: White
- Position: Right-aligned

### Section Headers
- Font size: 14px
- Color: White
- Font weight: 500
- Info icon: Small, clickable for tooltip

### Insights Text
- Font size: 14px
- Color: #ccc (light gray)
- Line height: 1.6

### Conversation Cards
- Background: #252525
- Border radius: 8px
- Padding: 16px
- Margin-bottom: 12px

### Theme Title
- Font size: 16px
- Font weight: 600
- Color: White

### Theme Description
- Font size: 14px
- Color: #aaa

### Sample Quotes
- Font size: 13px
- Color: #999
- Style: Italic
- Quoted with curly quotes

## Network Visualization

### During Simulation
- Background shows society network graph
- Nodes: Blue circles (people)
- Edges: Gray lines (connections)
- Animation: Yellow particles flow through network

### After Results
- Network remains visible
- Nodes turn orange/amber
- Static visualization
- Represents respondent population

## Sidebar Update

When test completes:
- New entry appears in sidebar
- Shows truncated test name
- Click to view/revisit results
- Delete icon (X) on hover
