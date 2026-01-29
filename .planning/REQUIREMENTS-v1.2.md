# Requirements — Virtuna v1.2 (Test Creation)

## Society Management Requirements

### SOC-01: Society Selector Modal
- [ ] Modal opens from sidebar "Current Society" dropdown
- [ ] Personal Societies section with info icon
- [ ] Target Societies section with info icon
- [ ] Personal society cards (LinkedIn, X) with "Setup" badge
- [ ] Platform icons (LinkedIn blue, X white)
- [ ] Card hover states with border highlight
- [ ] ESC key and click outside closes modal

### SOC-02: Target Society Cards
- [ ] "Create Target Society" card with dashed border
- [ ] Existing society cards with solid border
- [ ] Status badges (Custom, Example)
- [ ] Three-dot menu (Edit, Refresh, Delete)
- [ ] Member count display
- [ ] Society icon or default Users icon

### SOC-03: Create Target Society Modal
- [ ] Back button to return to selector
- [ ] Gradient mesh background (purple/blue)
- [ ] Heading: "Who do you want in your society?"
- [ ] Description text about AI matching
- [ ] Textarea with placeholder "e.g. Founders in London..."
- [ ] "Create your society" submit button
- [ ] Full-width white button style

### SOC-04: Society CRUD Operations
- [ ] Create society (local state)
- [ ] Edit society name/description
- [ ] Delete society with immediate removal
- [ ] Select society as current (updates context)
- [ ] Societies persist in local storage

### SOC-05: Society Context
- [ ] Selected society shown in sidebar dropdown
- [ ] Society name shown in filter header
- [ ] Society affects test results mock data

---

## Test Type Selector Requirements

### TEST-01: Test Type Selector Modal
- [ ] Opens from "Create a new test" button
- [ ] Header: "What would you like to simulate?"
- [ ] Close button (X) top-right
- [ ] 5 category sections with labels

### TEST-02: Test Categories & Types
- [ ] SURVEY category: Survey
- [ ] MARKETING CONTENT: Article, Website Content, Advertisement
- [ ] SOCIAL MEDIA POSTS: LinkedIn Post, Instagram Post, X Post, TikTok Script
- [ ] COMMUNICATION: Email Subject Line, Email
- [ ] PRODUCT: Product Proposition
- [ ] Proper icons for each type

### TEST-03: Type Selection Behavior
- [ ] Click type opens corresponding form
- [ ] Search/filter functionality (optional)
- [ ] "Request a new context" footer button
- [ ] ESC/click outside closes modal

---

## Test Form Requirements

### TEST-04: Content Form (Shared Structure)
- [ ] Textarea with type-specific placeholder
- [ ] Auto-expanding textarea
- [ ] Type selector button (opens type modal)
- [ ] "Upload Images" button (UI only)
- [ ] "Help Me Craft" button with sparkles (UI only)
- [ ] "Simulate" primary button

### TEST-05: Form Placeholders by Type
- [ ] Article: "Write your article..."
- [ ] Website Content: "Upload an image of your website..."
- [ ] Advertisement: "Describe your advert..."
- [ ] LinkedIn Post: "Write your post..."
- [ ] Instagram Post: "Write your post..."
- [ ] X Post: "Write your post..."
- [ ] TikTok Script: "Write your script..."
- [ ] Email Subject Line: "Write a subject line..."
- [ ] Email: "Write an email..."
- [ ] Product Proposition: "Describe your product..."

### TEST-06: Survey Form (Unique Structure)
- [ ] Question textarea
- [ ] Question type dropdown (Single Select, Open Response)
- [ ] Dynamic options list for Single Select
- [ ] Add/remove/reorder options
- [ ] Survey type selector button
- [ ] "Ask" submit button

### TEST-07: TikTok Script Form (Functional)
- [ ] Form submits and triggers simulation
- [ ] Mock results display after simulation
- [ ] Full flow from form → loading → results

### TEST-08: Instagram Post Form (Functional)
- [ ] Form submits and triggers simulation
- [ ] Mock results display after simulation
- [ ] Full flow from form → loading → results

---

## Results View Requirements

### RES-01: Simulation Loading States
- [ ] Phase 1: "Distributing your survey..."
- [ ] Phase 2: "Collecting responses..."
- [ ] Phase 3: "Analyzing responses..."
- [ ] Phase 4: "Drafting results..."
- [ ] Green status indicator dot
- [ ] Time estimate display (~2 min)

### RES-02: Network Placeholder
- [ ] Static image or animated dots grid
- [ ] Positioned behind results panel
- [ ] Animation during simulation (optional)

### RES-03: Results Panel Layout
- [ ] Right side of screen (~35% width)
- [ ] Scrollable with max-height
- [ ] Dark background (#1a1a1a)
- [ ] Rounded corners (12px)

### RES-04: Impact Score Display
- [ ] Large score number (0-100)
- [ ] Rating label (Poor, Below Average, Average, Good, Excellent)
- [ ] Color coding by score range

### RES-05: Attention Breakdown
- [ ] Full Attention percentage
- [ ] Partial Attention percentage
- [ ] Ignored percentage
- [ ] Visual bars or pie representation

### RES-06: Variants Section
- [ ] Original content with score
- [ ] AI-generated variant 1 with higher score
- [ ] AI-generated variant 2 with score
- [ ] Expandable/collapsible variant content

### RES-07: Insights Section
- [ ] "Insights" header with info icon
- [ ] AI-generated analysis paragraphs
- [ ] Key findings summary

### RES-08: Conversation Themes
- [ ] "Conversation" header with info icon
- [ ] Theme cards with title and percentage
- [ ] Sample quotes from virtual respondents
- [ ] Multiple theme categories

---

## Test History Requirements

### HIST-01: History in Sidebar
- [ ] Appears below "Create a new test" button
- [ ] Shows truncated test name (25 chars + ...)
- [ ] Reverse chronological order

### HIST-02: History Item Interaction
- [ ] Click loads results in main view
- [ ] Selected item highlighted
- [ ] Delete button (X) on hover

### HIST-03: Delete Functionality
- [ ] Click X removes test immediately
- [ ] No confirmation dialog
- [ ] Returns to empty state if viewing deleted test

### HIST-04: History Persistence
- [ ] Tests stored in local storage
- [ ] Persists across page refreshes
- [ ] Maximum 50 tests stored

---

## Settings & Modals Requirements

### SET-01: User Profile Page
- [ ] Profile photo upload (UI only)
- [ ] Name and email fields
- [ ] Save changes button

### SET-02: Account Settings
- [ ] Email change
- [ ] Password change (UI only)
- [ ] Account deletion warning

### SET-03: Notification Preferences
- [ ] Email notification toggles
- [ ] Product update toggles
- [ ] Marketing communication toggles

### SET-04: Billing UI
- [ ] Current plan display
- [ ] "Manage Plan" button → Stripe link
- [ ] Credits remaining display

### SET-05: Team Management UI
- [ ] Team member list
- [ ] Invite member button (UI only)
- [ ] Role selector (Admin, Member)

### SET-06: Leave Feedback Modal
- [ ] Pre-filled name and email
- [ ] Feedback textarea
- [ ] Email us link
- [ ] Submit button with arrow

---

## QA Requirements

### QA-01: Visual Verification
- [ ] Side-by-side comparison with societies.io screenshots
- [ ] All screens match reference documentation
- [ ] Colors, spacing, typography exact

### QA-02: Functional Testing
- [ ] All interactions work (clicks, forms, modals)
- [ ] Form validation where appropriate
- [ ] Error states handled gracefully

### QA-03: Responsive Testing
- [ ] Mobile view works correctly
- [ ] Tablet view works correctly
- [ ] Desktop view matches reference
- [ ] No horizontal scrolling issues
