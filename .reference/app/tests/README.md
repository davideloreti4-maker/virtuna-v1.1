# Test Feature - Reference Documentation

This directory contains comprehensive documentation for the "test" feature in app.societies.io.

## Overview

The test feature allows users to simulate surveys and content testing with an AI-powered "society" of virtual respondents. Tests can gauge audience reactions to various content types before real-world deployment.

## Test Types (11 total)

### Category 1: Survey
- **Survey** - Ask questions with single-select or open-response options

### Category 2: Marketing Content
- **Article** - Test long-form written content
- **Website Content** - Test website copy and imagery
- **Advertisement** - Test ad creatives and messaging

### Category 3: Social Media Posts
- **LinkedIn Post** - Test professional social content
- **Instagram Post** - Test visual social content
- **X Post** - Test short-form social content (formerly Twitter)
- **TikTok Script** - Test video script content

### Category 4: Communication
- **Email Subject Line** - Test email subject lines
- **Email** - Test full email content

### Category 5: Product
- **Product Proposition** - Test product descriptions/pitches

## Key Screenshots

| File | Description |
|------|-------------|
| `_assets/test-type-selector.png` | Modal showing all 11 test types |
| `_assets/survey-form.png` | Survey creation form |
| `_assets/survey-results.png` | Results view with insights |
| `_assets/survey-simulating.png` | Loading state during simulation |

## Documentation Files

- `type-selector.md` - Test type selection modal
- `survey-form.md` - Survey form (unique structure)
- `content-forms.md` - All content-type forms (shared structure)
- `results.md` - Results/response view
- `history.md` - Test history in sidebar

## Common UI Patterns

### Content Forms (Article, Website, Ad, Social, Email, Product)
All content forms share the same structure:
- Textarea input with type-specific placeholder
- Type selector button (opens test type modal)
- Upload Images button
- Help Me Craft button (AI assistance)
- Simulate button (submit)

### Survey Form (Unique)
Survey form has a distinct structure:
- Question textarea
- Question type dropdown (Single select / Open response)
- Dynamic options list with add/remove/reorder
- Survey type selector
- Ask button (submit)

## Results View Structure

1. **Header** - Share Survey button
2. **Results Panel**
   - Question type label (e.g., "Single Select")
   - Question text
   - Response percentages with visual bars
3. **Insights Section** - AI-generated analysis
4. **Conversation Section** - Themed response categories with sample quotes
