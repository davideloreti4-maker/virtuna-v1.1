# 260607-00u · UI/UX Refinement Spec — "Ask the expert" dock v2

**Status:** LOCKED via sketch iteration + AskUserQuestion. Do not revisit decisions.
**Visual SSOT:** `.planning/sketches/chat-dock-redesign-v2.html` (overall) + `.planning/sketches/chat-composer-variants.html` **variant A** (composer).
**Nature:** Refactor of the EXISTING, working chat feature (v1 shipped). Backend persistence/streaming/Qwen already work — do not regress them.

## Files in play
- `src/components/command-bar/CommandBar.tsx` — dock host (dual-mode)
- `src/components/command-bar/ExpertChatThread.tsx` — thread overlay
- `src/components/command-bar/ExpertChatInput.tsx` — composer
- `src/hooks/queries/use-expert-chat.ts` — SSE hook (add stop/regenerate)
- `src/app/api/analyze/[id]/chat/route.ts` — system prompt lives here
- `src/lib/chat/seed-prompts.ts` — deriveSeedPrompts
- `src/lib/chat/seed-context.ts` — context builder

## LOCKED design decisions

### 1. One unified panel (kills the two-floating-box problem)
- Merge thread + composer into a SINGLE panel container (one border, one shadow, one glass gradient). **Delete `THREAD_BOTTOM_OFFSET` / `BAR_HEIGHT_PX` magic numbers** (`CommandBar.tsx:30-32`). Thread and composer are siblings inside one `.panel`, not two fixed elements.
- Panel structure: **sticky header → scrollable thread → sticky footer(composer)**. Only the thread scrolls.

### 2. Header
- Only rendered when a conversation exists (messages.length > 0 or streaming). At rest: NO header, grabber chevron only.
- Contents: Numen mark (reuse `numen-logo.tsx` / node mark) + "Ask the expert" title · right: Clear (icon-only, `⌘⌫`) + Collapse chevron. Sticky top, subtle blurred bg.
- **One collapse control only** — header chevron when conversing; the floating grabber appears ONLY at rest. Remove the redundancy.

### 3. Thread
- `role="log"`, `aria-live="polite"` **throttled — announce on completion, NOT per token** (avoid the aria-live storm hit before).
- User message: right-aligned, neutral bubble `bg-white/[0.055]`, max ~74%.
- Apollo: bubble-less full-width text, `max-width:64ch`, neutral `--fg-secondary` body, `--fg` bold.
- **Markdown rendered** (bold, bullets, short paragraphs). Use `react-markdown` if already a dep; else a minimal SAFE renderer (no raw HTML injection — sanitize). Bullet markers coral.
- **§corpus citations** inline as small coral-outline pills (e.g. `§2.5`), `title=` = section name on hover. Same section taxonomy InsightHero uses.
- **Frame-tag** under answers that reference a board frame: non-interactive `↗ Content craft` pill (v1 = static; v2-feature will make it pan the camera). Render only when the answer names a frame.
- **Copy + Regenerate** controls on hover (Regenerate on the last answer only).
- **Jump-to-latest** pill appears when scrolled up during/after streaming.

### 4. Composer — VARIANT A (locked)
- **Send embedded INSIDE the field** (30px, anchored field's right). NOT a detached external button.
- Field height ~40px (down from ~50), matched radius, real `focus-within` ring, bg `rgba(255,255,255,.045)`.
- **Send: subtle/grey when empty → coral shadow-button when text present.** While streaming, send is replaced by a **Stop** button.
- **Suggestion row ABOVE the field** with a leading `✦ Try` label; chips uniform, horizontally scrollable, bold key-terms (`Add a **CTA**`, `Biggest **risk**?`).
- Placeholder is capability-hinting + single voice everywhere: `"Ask why it flops, how to fix the hook…"`.

### 5. Rest state (no conversation yet)
- No header; grabber chevron above panel.
- Composer with idle (grey) send. `Suggested` label + 3 prompts bound to the **actual weakest signals** (lowest dimension, missing CTA, biggest risk) — sharp copy, not generic.
- "+ New analysis" demoted bottom-right.

### 6. States
- **Streaming**: live token caret in the answer + Stop button in composer; input disabled.
- **Error / rate-limit (429 cap)**: amber (NOT red) inline row + recovery link ("Start a new analysis"). Per-analysis cap already enforced server-side.

### 7. Mobile (<768px)
- **True full-height sheet** (top offset → bottom). **FIX the bug**: inline `maxHeight: min(60vh…)` (`ExpertChatThread.tsx:80`) overrides `max-sm:max-h-none` — gate the inline maxHeight to desktop only so mobile is full-height.
- Drag handle + explicit close button. Thread flexes, composer pinned at bottom.

### 8. Keyboard layer
- `⌘K` focus Ask (from board) · `Esc` collapse · `Enter` send / `Shift+Enter` newline (exists) · `↑` in empty input edits/resends last question · `⌘⌫` clear conversation.

### 9. a11y + motion
- `prefers-reduced-motion` disables dots/caret/pulse. Focus-visible rings on chips + send + header buttons. Verify secondary-text contrast ≥4.5:1 on glass.

### 10. Styling
- Raycast tokens: borders 6% / hover 10%, glass gradient, 12px panel radius, 8px input/button radius. **Coral reserved for accents + active send only.** Square language (not pill).

## Backend
- **System prompt** (`route.ts`): instruct CONCISE, STRUCTURED answers — bold lead sentence + ≤3 bullets (short paragraph allowed); cite corpus §refs when grounded; name the single most-relevant board frame (so the UI can render the frame-tag). Stay **Qwen on DashScope only**. Keep grounding on the cached row (zero engine cost).
- **deriveSeedPrompts**: bind to weakest signals (lowest dimension score, CTA=None, biggest-risk) with sharp copy. Update unit tests.
- Frame-tag + §citations: simplest reliable path = have the model emit them in a light structured form the renderer parses; keep pragmatic, sanitize.

## Tasks (atomic commits)
1. **Backend** — refine system prompt (concise/structured/citations/frame) + sharpen deriveSeedPrompts to weakest-signal; update tests.
2. **Thread** — markdown render + §citation pills + frame-tag + copy/regenerate + role=log/throttled aria-live + jump-to-latest.
3. **Unify panel + composer A + states** — single panel (drop magic gap), sticky header/footer, composer variant A, streaming/stop, error/rate-limit, one collapse control.
4. **Mobile sheet fix + keyboard + a11y** — true full-height sheet, ⌘K/Esc/↑/⌘⌫, reduced-motion, focus rings.

## Guardrails
- Do NOT regress v1 backend (persistence, streaming, GET replay, Qwen-only, per-analysis cap).
- Frame-citation **camera-jump** + coach/what-if remain DEFERRED to v2-the-feature.
- Run affected tests + `npm run build` before final commit. **Regenerate/patch `database.types.ts` is NOT needed** (no schema change).
