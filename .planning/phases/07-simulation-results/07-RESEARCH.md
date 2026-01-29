# Phase 7: Simulation & Results - Research

**Researched:** 2026-01-29
**Domain:** UI/UX for simulation flow and results display (v0 MCP mandated)
**Confidence:** HIGH

## Summary

Phase 7 extends the existing simulation flow from Phase 6 to match societies.io exactly. The current implementation has a basic results panel with impact score and attention breakdown, but is missing:
- Multi-phase loading states with progress indicators
- Network placeholder animation during simulation
- Variants section with AI-generated alternatives
- Insights section with AI-generated analysis
- Conversation themes with sample quotes
- Share simulation functionality
- Floating form position at bottom (currently centered in main area)

The societies.io reference shows a sophisticated loading sequence with 4 distinct phases, colored network nodes by country during simulation, a floating content preview that collapses when results appear, and a comprehensive results panel with variants carousel, insights, and conversation themes.

**Primary recommendation:** Use v0 MCP for ALL UI components. Restructure the form position to float at bottom, implement 4-phase loading with progress indicators, expand TestResult interface to include variants/insights/themes, and build results panel sections matching societies.io exactly.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 14+ | App Router framework | Already configured |
| Zustand | 4.x | State management | test-store pattern established |
| Radix UI | Latest | Accessible primitives | Already used for dialogs/dropdowns |
| Tailwind CSS | 3.x | Styling | Project standard |
| Lucide React | Latest | Icons | Project standard |

### Supporting (May Need Addition)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| framer-motion | 11.x | Loading animations | Optional: only if CSS animations insufficient |
| clsx/cn | Existing | Conditional classes | Already available via @/lib/utils |

### No New Libraries Needed
The existing stack is sufficient. All required functionality can be achieved with:
- CSS animations (Tailwind animate-* classes)
- SVG for progress indicators
- Radix for any collapsible sections

**Installation:** No new packages required.

## Architecture Patterns

### Recommended File Structure
```
src/
├── app/(app)/dashboard/
│   └── dashboard-client.tsx    # Modify: restructure layout, add loading phases
├── components/app/
│   ├── simulation/             # NEW: simulation-specific components
│   │   ├── loading-phases.tsx  # 4-phase loading display
│   │   ├── results-panel.tsx   # Full results panel (extracted)
│   │   ├── impact-score.tsx    # Impact score display
│   │   ├── attention-bar.tsx   # Attention breakdown (extract)
│   │   ├── variants-section.tsx # AI variants carousel
│   │   ├── insights-section.tsx # Insights display
│   │   ├── themes-section.tsx  # Conversation themes
│   │   └── share-button.tsx    # Share simulation button
│   └── network-visualization.tsx # Modify: add simulation animation
├── stores/
│   └── test-store.ts           # Modify: add loading phase state
└── types/
    └── test.ts                 # Modify: expand TestResult interface
```

### Pattern 1: Loading Phase State Machine
**What:** Track simulation progress through 4 distinct phases
**When to use:** During simulation status
**Example:**
```typescript
// In test-store.ts
type SimulationPhase =
  | 'analyzing'      // Phase 1: Analyzing content
  | 'matching'       // Phase 2: Matching profiles
  | 'simulating'     // Phase 3: Running simulation
  | 'generating';    // Phase 4: Generating insights

interface TestState {
  // ... existing
  simulationPhase: SimulationPhase | null;
  phaseProgress: number; // 0-100 for current phase
}
```

### Pattern 2: v0 MCP Component Generation Workflow
**What:** Use v0 MCP tool BEFORE writing any component code
**When to use:** Every UI component in this phase
**Example:**
```
1. Identify component to build (e.g., LoadingPhases)
2. Gather reference: screenshot + .reference/ markdown specs
3. Query v0 MCP with detailed prompt including:
   - Component purpose
   - Visual reference description
   - Tailwind/design token requirements
   - Specific styling from societies.io
4. Receive generated code
5. Adapt to project structure (imports, cn utility, etc.)
6. Integrate with state/props
```

### Pattern 3: Floating Form Layout
**What:** Form positioned at bottom of screen like chat input
**When to use:** Dashboard layout restructuring
**Reference:** societies.io TikTok/Instagram script view
```typescript
// Layout structure (from reference screenshots)
<div className="relative flex h-full flex-col">
  {/* Network visualization - full area behind */}
  <NetworkVisualization className="absolute inset-0" />

  {/* Top bar - z-10 */}
  <TopBar />

  {/* Floating content at bottom - z-20 */}
  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl z-20">
    {showForm && <ContentForm />}
    {showLoading && <LoadingPhases />}
    {showResults && <ResultsPanel />}
  </div>
</div>
```

### Anti-Patterns to Avoid
- **Not using v0 MCP:** Every visual component MUST go through v0 first (user mandate)
- **Inline results panel:** Current implementation has results inline in dashboard-client.tsx - extract to proper components
- **Fixed centered positioning:** Current form is centered; must be floating at bottom
- **Hardcoded mock data:** Create realistic mock data generators for variants/insights/themes

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loading animations | Custom keyframes | Tailwind animate-pulse, animate-spin | Consistent, tested |
| Progress indicators | Custom SVG logic | Existing CircularProgress pattern | Already built in Phase 6 |
| Collapsible sections | Custom state | Radix Collapsible or Accordion | Accessibility, keyboard nav |
| Share functionality | Custom modal | Native Web Share API or clipboard | Browser standard |
| Tooltip for info icons | Custom hover state | Radix Tooltip | Accessible, positioned correctly |

**Key insight:** The existing codebase has patterns for circular progress (SimulationResultsPanel) and attention bars (AttentionBar). Extract and reuse these rather than rebuilding.

## Common Pitfalls

### Pitfall 1: Skipping v0 MCP
**What goes wrong:** Components don't match societies.io reference
**Why it happens:** Developer assumes they can build faster without v0
**How to avoid:** Make v0 MCP query the FIRST action in every task
**Warning signs:** Building components without reference screenshot comparison

### Pitfall 2: Form Position During Results
**What goes wrong:** Form disappears or jumps when results appear
**Why it happens:** Not understanding the collapse behavior from societies.io
**How to avoid:**
- Form COLLAPSES to show content preview (not hidden)
- Results appear BELOW the collapsed form
- User can see their original content while viewing results
**Warning signs:** Results panel replacing form entirely

### Pitfall 3: Loading Phase Timing Mismatch
**What goes wrong:** Loading feels wrong - too fast or too slow
**Why it happens:** Arbitrary timing without reference
**How to avoid:**
- Reference: ~2 minutes total on societies.io
- Mock: 4-6 seconds total (per CONTEXT.md)
- Each phase: ~1-1.5 seconds
- Include progress bar alongside step checkmarks
**Warning signs:** Single loading state without phases

### Pitfall 4: Mock Data Quality
**What goes wrong:** Variants/insights/themes look obviously fake
**Why it happens:** Placeholder text without thought
**How to avoid:**
- Create 3-5 realistic variant templates per content type
- Write 3-4 insight templates with placeholder interpolation
- Have 4-6 conversation theme templates with realistic quotes
**Warning signs:** "Lorem ipsum" or identical mock data every time

### Pitfall 5: Network Animation Scope Creep
**What goes wrong:** Spending too much time on network viz
**Why it happens:** Reference shows complex particle animation
**How to avoid:**
- Minimum viable: pulsing dots or subtle color change
- Don't build WebGL/Three.js network - that's explicitly out of scope
- Focus on the results panel UI, not background animation
**Warning signs:** More than 1 task dedicated to network animation

## Code Examples

### societies.io Loading States (from reference)
```
Phase 1: "Analyzing content..."         [checkmark when done]
Phase 2: "Matching profiles..."         [checkmark when done]
Phase 3: "Running simulation..."        [checkmark when done]
Phase 4: "Generating insights..."       [current with spinner]

[=============================     ] ~2 min
```

Visual treatment from screenshot:
- Green dot indicator next to current phase text
- All 4 phases shown, checkmarks appear as each completes
- Thin progress bar below steps
- Time estimate shown (~2 min)

### societies.io Results Panel Structure (from screenshots)
```
┌─────────────────────────────────────────┐
│                            [Share Simulation]
│
│ Impact Score (i)
│ Average                              64/100
│
│ Attention
│ Full    ████████████░░░░░░░░  45%
│ Partial ██████████████░░░░░░  40%
│ Ignore  ████░░░░░░░░░░░░░░░░  15%
│
│ Variants (v)
│ ┌─ Original ─┐  ┌─ Variant 1 ─┐  ┌─ Variant 2 ─┐
│ │ 64         │  │ 77          │  │ 70          │
│ │ Hey found..│  │ Hey invest..│  │ 2 investors │
│ └────────────┘  └─────────────┘  └─────────────┘
│                 [+ Generate New Variants]
│
│ Insights (i)
│ The script received average engagement...
│ Those focused on early-stage AI were...
│ The "5 minutes" claim needs clearer...
│
│ Conversation (i)
│ ┌─ Calming Associations ─────────────────┐
│ │ ~40% mention 'calming' and nature...   │
│ │ "Calming and professional, like sky"   │
│ │ "Blue is kinda chill."                 │
│ └────────────────────────────────────────┘
└─────────────────────────────────────────┘
```

### Extended TestResult Interface
```typescript
// Source: Analysis of societies.io reference screenshots
export interface TestResult {
  id: string;
  testType: TestType;
  content: string;
  impactScore: number;
  impactLabel: 'Poor' | 'Below Average' | 'Average' | 'Good' | 'Excellent';
  attention: {
    full: number;
    partial: number;
    ignore: number;
  };
  variants: Variant[];
  insights: string[];
  conversationThemes: ConversationTheme[];
  createdAt: string;
  societyId: string;
}

export interface Variant {
  id: string;
  type: 'original' | 'ai-generated';
  content: string;
  impactScore: number;
  label?: string; // e.g., "Hey founders!", "Hey investors!"
}

export interface ConversationTheme {
  id: string;
  title: string;
  percentage: number;
  description: string;
  quotes: string[];
}
```

### Mock Data Generator Pattern
```typescript
// Source: Pattern for realistic mock data
function generateMockVariants(originalContent: string): Variant[] {
  const variants: Variant[] = [
    {
      id: 'original',
      type: 'original',
      content: originalContent,
      impactScore: Math.floor(Math.random() * 20) + 60, // 60-80
    },
    {
      id: 'variant-1',
      type: 'ai-generated',
      content: generateVariantContent(originalContent, 1),
      impactScore: Math.floor(Math.random() * 15) + 70, // 70-85, usually higher
      label: 'More engaging hook',
    },
    {
      id: 'variant-2',
      type: 'ai-generated',
      content: generateVariantContent(originalContent, 2),
      impactScore: Math.floor(Math.random() * 20) + 65, // 65-85
      label: 'Clearer value prop',
    },
  ];
  return variants;
}
```

## Requirements Mapping (RES-01 to RES-08)

From `.planning/REQUIREMENTS-v1.2.md`:

| Req | Description | Implementation Notes |
|-----|-------------|---------------------|
| RES-01 | 4-phase loading states | LoadingPhases component with state machine |
| RES-02 | Network placeholder | Minimal animation (pulse/dots) - NOT full WebGL |
| RES-03 | Results panel layout | Right side, ~35% width, scrollable, dark bg |
| RES-04 | Impact score display | Large number + label (Poor/Average/Good/Excellent) |
| RES-05 | Attention breakdown | Horizontal stacked bar with Full/Partial/Ignore |
| RES-06 | Variants section | Original + 2 AI variants, each with score |
| RES-07 | Insights section | AI-generated analysis paragraphs |
| RES-08 | Conversation themes | Theme cards with title, %, and sample quotes |

## v0 MCP Integration Strategy

### MANDATORY Workflow (User Requirement)

Every UI component task MUST follow this workflow:

1. **Reference Gathering**
   - Identify relevant screenshot from `.reference/app/tests/_assets/`
   - Read corresponding `.reference/app/tests/*.md` spec
   - Note specific styling requirements

2. **v0 MCP Query**
   - Query v0 with detailed prompt including:
     - Component purpose and context
     - Visual reference description (what's in the screenshot)
     - Color scheme (zinc-800/900, dark theme)
     - Specific measurements from reference
     - Tailwind CSS requirement

3. **Code Adaptation**
   - Take v0 output
   - Adapt imports to project structure (@/components, @/lib/utils)
   - Replace any non-project utilities with cn()
   - Wire up to Zustand store/props

4. **Verification**
   - Visual comparison with reference screenshot
   - v0 MCP can be queried again for comparison analysis

### Component-to-Screenshot Mapping

| Component | Reference Screenshot | Key Details |
|-----------|---------------------|-------------|
| LoadingPhases | `tiktok-simulation-loading.png` | 4 phases, green dot, progress bar |
| ResultsPanel | `tiktok-simulation-results.png`, `tiktok-results-full.png` | Right panel, all sections |
| ImpactScore | `survey-results.png` | "Average" label, 64/100 format |
| AttentionBar | `tiktok-simulation-results.png` | Horizontal stacked, 3 colors |
| VariantsSection | `tiktok-results-full.png` | Carousel of 3 cards, scores |
| InsightsSection | `survey-results-full.png` | "Insights" header with (i), paragraphs |
| ThemesSection | `survey-results-full.png` | "Conversation" header, theme cards |
| ShareButton | `tiktok-simulation-results.png` | Top-right, "Share Simulation" text |

## Visual Comparison Methodology

At END of Phase 7, perform comprehensive visual comparison:

### Process
1. **Capture Current State**
   - Screenshot each state: form, loading, results
   - Full viewport and component-level captures

2. **v0 MCP Analysis**
   - Query v0 with side-by-side prompt:
   ```
   Compare these two images:
   [Virtuna implementation screenshot]
   [societies.io reference screenshot]

   Identify ALL differences including:
   - Color variations (exact hex if possible)
   - Spacing/padding differences
   - Typography (font size, weight, line height)
   - Border radius
   - Shadow differences
   - Layout alignment
   - Missing elements
   - Extra elements

   List each difference with severity (minor/medium/major)
   and suggested fix.
   ```

3. **Fix Iteration**
   - Address each identified difference
   - Re-query v0 for verification
   - Document any intentional deviations

### Areas to Compare
- [ ] Form floating position and styling
- [ ] Loading phase indicators
- [ ] Network background during simulation
- [ ] Results panel overall layout
- [ ] Impact score display
- [ ] Attention breakdown bars
- [ ] Variants carousel/cards
- [ ] Insights section
- [ ] Conversation themes
- [ ] Share button styling
- [ ] Scrolling behavior
- [ ] Responsive behavior (if applicable)

## Recommended Plan Structure

Given v0 MCP requirement and scope, suggested task breakdown:

### Plan 07-01: Layout Restructuring
- Restructure dashboard-client.tsx for floating form
- Move form to bottom position
- Ensure network viz behind

### Plan 07-02: Loading States (v0 MCP)
- v0 MCP query for LoadingPhases component
- Implement 4-phase state machine in test-store
- Wire loading display with progress bar

### Plan 07-03: Extended TestResult and Mock Data
- Expand TestResult interface
- Create mock data generators for variants/insights/themes
- Update submitTest to generate full result

### Plan 07-04: Results Panel Components (v0 MCP)
- v0 MCP for ImpactScore (with label)
- v0 MCP for AttentionBar (horizontal stacked)
- v0 MCP for VariantsSection (carousel)
- v0 MCP for InsightsSection
- v0 MCP for ThemesSection
- v0 MCP for ShareButton
- Assemble ResultsPanel

### Plan 07-05: Integration and Polish
- Wire all components together
- Ensure form collapse behavior
- Test full flow

### Plan 07-06: Visual Comparison and Fixes
- Comprehensive v0 MCP comparison
- Document all differences
- Fix each identified issue
- Re-verify

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single loading spinner | Multi-phase loading with progress | societies.io design | Better UX feedback |
| Full-screen form | Floating bottom form | societies.io design | More context visible |
| Basic score number | Score with rating label | societies.io design | More meaningful feedback |
| No variants | AI-generated alternatives | societies.io core feature | Key differentiator |

**Deprecated/outdated:**
- Current SimulationResultsPanel in dashboard-client.tsx will be replaced/refactored

## Open Questions

1. **Cancel Button Behavior**
   - What we know: CONTEXT.md says cancel button available to abort and return to form
   - What's unclear: Exact visual treatment of cancel button in loading state
   - Recommendation: Query v0 MCP with tiktok-simulation-loading.png for full loading UI

2. **Variants Generation UX**
   - What we know: societies.io shows "Generate New Variants" button
   - What's unclear: Whether to include this in v1 mock (no real AI)
   - Recommendation: Include button but show UI-only toast "Coming soon"

3. **Share Functionality Implementation**
   - What we know: "Share Simulation" button in top-right
   - What's unclear: Copy link vs social share vs both
   - Recommendation: Use clipboard copy with toast notification for v1

## Sources

### Primary (HIGH confidence)
- `.reference/app/tests/results.md` - Detailed results view specs
- `.reference/app/tests/_assets/tiktok-*.png` - TikTok flow screenshots
- `.reference/app/tests/_assets/survey-*.png` - Survey results screenshots
- `.planning/phases/07-simulation-results/07-CONTEXT.md` - User decisions

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS-v1.2.md` - RES-01 to RES-08 requirements
- `.planning/phases/06-test-type-selector-forms/06-04-SUMMARY.md` - Current implementation

### Tertiary (Reference)
- Phase 6 verification report - What currently exists
- Prior phase v0 MCP usage patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Already established in project
- Architecture: HIGH - Follows existing patterns, informed by reference
- v0 MCP workflow: HIGH - Mandated by user, pattern established
- Pitfalls: MEDIUM - Based on reference analysis and project history
- Visual comparison methodology: HIGH - User requirement, v0 MCP capable

**Research date:** 2026-01-29
**Valid until:** 7 days (fast-moving UI work with active reference)
