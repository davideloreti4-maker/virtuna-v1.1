# Requirements — Virtuna v1.4

**Defined:** 2026-01-31
**Core Value:** Mesmerizing visualization MVP — the "wow" moment that works on mobile

## v1.4 Scope: Core Experience MVP

Ship the scroll-stopping visualization with essential interactions. Validate the vision before adding polish.

### Core Visualization (VIZ)

- [ ] **VIZ-01**: Central glowing orb renders as the "AI brain" focal point
- [ ] **VIZ-02**: Orb has ambient "breathing" animation (scale pulse, 2-4s cycle)
- [ ] **VIZ-03**: Particle system surrounds orb with flowing ambient particles
- [ ] **VIZ-04**: Particles rush toward orb when processing begins
- [ ] **VIZ-05**: Dynamic nodes form around orb during processing (abstract, unlabeled)
- [ ] **VIZ-06**: Nodes crystallize into labeled insights when analysis completes
- [ ] **VIZ-07**: Connections between nodes render with animated flow
- [ ] **VIZ-08**: Idle state is captivating (hook before any user action)
- [ ] **VIZ-09**: Dark mode design with gradient accents (purple-to-cyan palette)
- [ ] **VIZ-10**: High contrast, bold effects that survive video compression

### Motion System (MOTION)

- [ ] **MOTION-01**: Three-layer motion: ambient (always), activity (processing), revelation (insights)
- [ ] **MOTION-02**: All motion uses easing curves (never linear)
- [ ] **MOTION-03**: Variable reward timing (non-metronomic, semi-random bursts)
- [ ] **MOTION-04**: Anticipation before reveals (brief wind-up, then payoff)
- [ ] **MOTION-05**: Spring physics for settling and bounce effects

### Interaction (INTERACT)

- [ ] **INTERACT-01**: Nodes are draggable with realistic momentum
- [ ] **INTERACT-02**: Magnetic attraction (cursor/finger draws particles)
- [ ] **INTERACT-03**: Tap node shows quick preview tooltip
- [ ] **INTERACT-04**: Hold node opens bottom sheet with full details
- [ ] **INTERACT-05**: Basic tap feedback (visual response)

### User Experience (UX)

- [ ] **UX-01**: Tap preview shows key metric near node
- [ ] **UX-02**: Bottom sheet detail shows full insight data
- [ ] **UX-03**: Error state handles "no insights found" gracefully
- [ ] **UX-04**: Processing progress indicators (not stuck feeling)

### Performance & Mobile (PERF)

- [ ] **PERF-01**: 60fps on mid-range mobile devices (iPhone 11 class)
- [ ] **PERF-02**: Touch gestures optimized for mobile (tap, hold, drag)
- [ ] **PERF-03**: Particle count adapts to device capability
- [ ] **PERF-04**: GPU acceleration for animations
- [ ] **PERF-05**: Intersection Observer pauses off-screen animations
- [ ] **PERF-06**: Reduced motion mode respects prefers-reduced-motion
- [ ] **PERF-07**: Labels readable on small screens (375px width)

---

## v1.4 Total: 31 requirements

| Category | Count | Focus |
|----------|-------|-------|
| VIZ | 10 | Core visualization |
| MOTION | 5 | Essential animation |
| INTERACT | 5 | Basic interactions |
| UX | 4 | Essential flows |
| PERF | 7 | Mobile performance |

---

## Deferred to v1.5 (Polish & Delight)

### Sound Design (AUDIO) — 7 requirements
- Optional sound toggle
- Ambient hum, whoosh, clicks, crystallization sounds
- Pitch variation by insight type

### Advanced Interactions — 5 requirements
- Fling gesture with physics trajectory
- Orbital spin (rotate whole system)
- Poke orb scatter/reform
- Connection rubber band stretch
- Tap → burst particle explosion

### Advanced Motion — 3 requirements
- Paced revelation (one by one insights)
- Follow-through on animations
- Advanced progress indicators in chaos

### Trust & Credibility — 5 requirements
- Professional mode toggle
- Specific processing labels ("Analyzing 2,847 posts...")
- Confidence indicators
- Visual-to-actual processing mapping
- No fake delays

### UX Polish — 3 requirements
- Swipe between nodes in detail view
- Clear visual affordances
- Onboarding hints for interactions

**v1.5 Total: ~23 requirements**

---

## Out of Scope (Both Versions)

| Feature | Reason |
|---------|--------|
| 3D depth (full Three.js scene) | Complexity, future |
| Custom WebGL shaders | Specialized expertise |
| AI avatar/mascot | Research warns against |
| Audio-reactive visualization | Not core |
| AR/VR modes | Future |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VIZ-01 to VIZ-10 | TBD | Pending |
| MOTION-01 to MOTION-05 | TBD | Pending |
| INTERACT-01 to INTERACT-05 | TBD | Pending |
| UX-01 to UX-04 | TBD | Pending |
| PERF-01 to PERF-07 | TBD | Pending |

**Coverage:**
- v1.4 requirements: 31 total
- Categories: 5 (VIZ, MOTION, INTERACT, UX, PERF)
- Mapped to phases: 0 (roadmap pending)

---
*Requirements defined: 2026-01-31*
*Last updated: 2026-01-31 — Scoped to MVP, v1.5 deferred*
