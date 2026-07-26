/** @vitest-environment happy-dom */
/**
 * ChatThreadView — chat-as-agent render lock (CHAT_AGENT_DISPATCH).
 *
 * The transport (use-chat-stream) and the route (api/tools/chat) are proven elsewhere; what THIS
 * locks is the last link: a dispatched skill's card-block handed to the chat view via
 * streamingCardBlocks actually RENDERS as its real card (through MessageBlocks → the card renderer)
 * in the SAME thread — the whole point of "one thread, all skills". Also locks that a plain chat
 * turn (markdown only, no cards) is unchanged.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChatThreadView } from '../chat-thread-view';
import type { MarkdownBlock } from '@/lib/tools/blocks';

afterEach(cleanup);

// The idea-card renderer mounts the Saved shelf (useQueryClient), so any render including a card
// must sit under a QueryClientProvider.
function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const IDEA_CARD = {
  type: 'idea-card',
  props: {
    title: 'The 5am myth',
    angle: 'contrarian',
    whyItFits: 'your audience distrusts hustle culture',
    mechanism: 'pattern-break',
    seedHook: 'Everyone lied about 5am',
    needsTake: false,
    topic: 'morning routines',
    take: '',
    format: null,
    band: 'Strong',
    fraction: '4/5',
    scored: true,
    scrollQuote: 'Everyone lied to you about 5am',
    model: 'sim1-flash',
  },
};

const baseProps = {
  persistedBlocks: [] as MarkdownBlock[],
  streamingBlocks: [] as MarkdownBlock[],
  isStreaming: false,
  coldStart: false,
  nudgeShown: false,
  error: null,
};

describe('ChatThreadView — chat-as-agent cards', () => {
  it('renders a dispatched skill card inline (streamingCardBlocks → real card renderer)', () => {
    renderWithClient(
      <ChatThreadView
        {...baseProps}
        streamingCardBlocks={[IDEA_CARD]}
        streamingBlocks={[{ type: 'markdown', props: { text: 'Made you an angle — want hooks for it?' } }]}
      />,
    );
    // The idea-card face rendered (title + scroll quote), proving MessageBlocks routed the block.
    expect(screen.getByText('The 5am myth')).toBeTruthy();
    // The closing co-pilot line rendered alongside the card.
    expect(screen.getByText(/want hooks for it/i)).toBeTruthy();
  });

  it('while thinking (streaming, no content yet) shows the lightweight typing indicator, not the heavy skeleton', () => {
    renderWithClient(
      <ChatThreadView {...baseProps} isStreaming={true} userTurn="why do hooks matter?" />,
    );
    // The premium inline typing indicator is present (sr-only label + role=status).
    expect(screen.getByText('Thinking…')).toBeTruthy();
    // The old centered constellation skeleton is NOT used in the chat view anymore.
    expect(screen.queryByTestId('thread-loading-skeleton')).toBeNull();
    // The user's question still shows above the thinking state.
    expect(screen.getByText('why do hooks matter?')).toBeTruthy();
  });

  // NOTE (thread-unification Phase 2): persisted-history RENDER tests moved to
  // persisted-thread-stream.test.tsx — ChatThreadView no longer renders persisted turns (it owns only
  // the live turn + follow-up chips). The chip tests below still pass persistedTurns because the chips
  // key off the last completed turn WITHOUT rendering it.

  it('plain chat turn (markdown only, no cards) is unchanged', () => {
    renderWithClient(
      <ChatThreadView
        {...baseProps}
        streamingBlocks={[{ type: 'markdown', props: { text: 'Post three times a week.' } }]}
      />,
    );
    expect(screen.getByText('Post three times a week.')).toBeTruthy();
    // No idea-card leaked into a plain turn.
    expect(screen.queryByText('The 5am myth')).toBeNull();
  });

  it('while a dispatched skill runs (streaming + live stages, no cards yet) shows the progress SPINE, not typing dots', () => {
    // The gap this locks: a chat-dispatched generator is a 20–65s run, but the route already emits
    // real `stage` events and use-chat-stream exposes them. Without rendering them the whole wait was
    // silent typing dots. Now the live spine renders in their place.
    renderWithClient(
      <ChatThreadView
        {...baseProps}
        isStreaming={true}
        userTurn="give me 3 ideas about morning routines"
        stages={[
          { name: 'Generating', status: 'active' },
          { name: 'Simulating your audience', status: 'pending' },
        ]}
      />,
    );
    // The spine container + the live stage label render.
    expect(screen.getByLabelText('Skill run progress')).toBeTruthy();
    expect(screen.getByText('Generating')).toBeTruthy();
    // The pure-chat typing dots are NOT shown while a skill is running (the spine replaced them).
    expect(screen.queryByText('Thinking…')).toBeNull();
  });

  it('spine survives a pre-tool preamble (streamed text before cards must NOT suppress it)', () => {
    // The loop may stream a short "on it…" line BEFORE it calls the tool. The spine pivots on CARDS,
    // not text — otherwise that preamble would silence the whole run (the exact gap being closed).
    renderWithClient(
      <ChatThreadView
        {...baseProps}
        isStreaming={true}
        streamingBlocks={[{ type: 'markdown', props: { text: 'On it — generating a few angles.' } }]}
        stages={[{ name: 'Generating', status: 'active' }]}
      />,
    );
    // The preamble line AND the live spine both render (no cards yet → run still in progress).
    expect(screen.getByText('On it — generating a few angles.')).toBeTruthy();
    expect(screen.getByLabelText('Skill run progress')).toBeTruthy();
  });

  it('once the dispatched skill cards arrive, the spine gives way to the cards', () => {
    // Cards are produced at the END of the run (onBlock fires after the pipeline finishes), so the
    // moment streamingCardBlocks is non-empty the run is effectively done — the spine unmounts and the
    // real cards carry the turn, even though stages are still present and the stream is still open.
    renderWithClient(
      <ChatThreadView
        {...baseProps}
        isStreaming={true}
        streamingCardBlocks={[IDEA_CARD]}
        stages={[
          { name: 'Generating', status: 'done' },
          { name: 'Simulating your audience', status: 'done' },
          { name: 'Ranking', status: 'done' },
        ]}
      />,
    );
    // The card is shown…
    expect(screen.getByText('The 5am myth')).toBeTruthy();
    // …and the loading spine is gone (its job is done once cards render).
    expect(screen.queryByLabelText('Skill run progress')).toBeNull();
  });

  // ── The run capsule (run-capsule.tsx) — the dispatch event labels + seeds the spine ──────────

  it('a dispatch labels the capsule and seeds the FULL skill plan before any stage event', () => {
    // The `dispatch` SSE frame arrives BEFORE the first stage event. From that moment the wait
    // must be legible: the capsule names the skill + audience and shows the whole pipeline
    // up front (first step active), instead of an unlabeled spine growing one row at a time.
    renderWithClient(
      <ChatThreadView
        {...baseProps}
        isStreaming={true}
        userTurn="write me hooks about morning routines"
        dispatchedSkill="hooks"
        audienceLabel="Bootstrapped Founders"
        stages={[]}
      />,
    );
    // The label line names the skill and the audience…
    expect(screen.getByText('Writing hooks')).toBeTruthy();
    expect(screen.getByText(/for Bootstrapped Founders/)).toBeTruthy();
    // …and the full hooks plan is visible from frame one (STAGE_PLANS.hooks).
    expect(screen.getByText('Generating')).toBeTruthy();
    expect(screen.getByText('Simulating your audience')).toBeTruthy();
    expect(screen.getByText('Ranking')).toBeTruthy();
    // No typing dots — the capsule owns the wait.
    expect(screen.queryByText('Thinking…')).toBeNull();
  });

  it('after the run completes, the capsule collapses to the ✓ receipt ABOVE the cards', () => {
    // Pre-capsule behavior: the spine unmounted the moment cards arrived and the run left no
    // trace — the wait's provenance vanished. Now the same completed run renders the collapsed
    // receipt (the per-skill views' idiom) above the cards for the rest of the turn.
    renderWithClient(
      <ChatThreadView
        {...baseProps}
        isStreaming={true}
        dispatchedSkill="ideas"
        streamingCardBlocks={[IDEA_CARD]}
        stages={[
          { name: 'Generating', status: 'done' },
          { name: 'Simulating your audience', status: 'done' },
          { name: 'Ranking', status: 'done' },
        ]}
      />,
    );
    // The receipt line (SkillProgress collapsed) with the ideas done-label + step count…
    expect(screen.getByText('Ran your audience')).toBeTruthy();
    expect(screen.getByText('3 steps')).toBeTruthy();
    // …the live spine is gone, and the cards render below.
    expect(screen.queryByLabelText('Skill run progress')).toBeNull();
    expect(screen.getByText('The 5am myth')).toBeTruthy();
  });

  it('legacy stream (stages but NO dispatch frame) keeps the unlabeled spine', () => {
    renderWithClient(
      <ChatThreadView
        {...baseProps}
        isStreaming={true}
        stages={[{ name: 'Generating', status: 'active' }]}
      />,
    );
    expect(screen.getByLabelText('Skill run progress')).toBeTruthy();
    // No skill label — the client doesn't know which skill; it must not guess one.
    expect(screen.queryByText('Writing hooks')).toBeNull();
    expect(screen.queryByText('Finding ideas')).toBeNull();
  });

  // ── Follow-up chips (chat-followups) — the redesign of the retired chain-handoff CTA ──────────
  // The old code ALWAYS rendered handoffsFor('idea') ("Develop this →" / "Rewrite for this audience →")
  // regardless of what ran, and tapping switched the active tool. These guards fail against that code.
  const SCRIPT_CARD = {
    type: 'script-card',
    props: {
      title: 'The 5am myth — script',
      hook: 'Everyone lied about 5am',
      beats: [{ label: 'Hook', text: 'Everyone lied about 5am' }],
      band: 'Strong',
      fraction: '4/5',
      scored: true,
      scrollQuote: 'wait, what?',
      model: 'sim1-flash',
    },
  };

  it('follow-up chips are context-aware: a script turn offers script moves, NOT the idea handoff', () => {
    renderWithClient(
      <ChatThreadView
        {...baseProps}
        persistedTurns={[{ userTurn: 'write a script', blocks: [SCRIPT_CARD] }]}
        onFollowup={vi.fn()}
      />,
    );
    // The retired hardcoded CTAs must be gone after a script turn.
    expect(screen.queryByText('Develop this →')).toBeNull();
    expect(screen.queryByText('Rewrite for this audience →')).toBeNull();
    // Script-kind chips render instead (chat-followups.ts).
    expect(screen.getByText('Make it punchier')).toBeTruthy();
    expect(screen.getByText('Hooks for this')).toBeTruthy();
  });

  it('a plain chat answer offers the generative entry points as chips', () => {
    renderWithClient(
      <ChatThreadView
        {...baseProps}
        persistedTurns={[{ userTurn: 'how often should I post?', blocks: [{ type: 'markdown', props: { text: 'Three times a week.' } }] }]}
        onFollowup={vi.fn()}
      />,
    );
    expect(screen.getByText('Give me ideas')).toBeTruthy();
    expect(screen.getByText('Write hooks')).toBeTruthy();
    expect(screen.getByText('Draft a script')).toBeTruthy();
  });

  it('tapping a chip fires onFollowup with the PROMPT (never auto-fires on render)', () => {
    const onFollowup = vi.fn();
    renderWithClient(
      <ChatThreadView
        {...baseProps}
        persistedTurns={[{ userTurn: 'how often should I post?', blocks: [{ type: 'markdown', props: { text: 'Three times a week.' } }] }]}
        onFollowup={onFollowup}
      />,
    );
    // D-05: nothing fired just by rendering.
    expect(onFollowup).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Give me ideas'));
    // The chip sends the full PROMPT (what the agent routes), not the short label.
    expect(onFollowup).toHaveBeenCalledWith('Give me a few content ideas for what we just talked about.');
  });

  it('no chips render while streaming (a turn must complete first)', () => {
    renderWithClient(
      <ChatThreadView {...baseProps} isStreaming={true} userTurn="q" onFollowup={vi.fn()} />,
    );
    expect(screen.queryByTestId('chat-followups')).toBeNull();
  });
  // (persistedTurns-vs-persistedBlocks precedence test retired: ChatThreadView no longer renders EITHER
  //  persisted source — PersistedThreadStream owns history and takes only turns, so the markdown-only
  //  bucket the precedence guarded against no longer exists.)
});
