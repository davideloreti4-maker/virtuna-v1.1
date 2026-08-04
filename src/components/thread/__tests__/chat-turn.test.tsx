/** @vitest-environment happy-dom */
/**
 * Chat-as-agent render lock (CHAT_AGENT_DISPATCH), on the ONE turn renderer.
 *
 * The transport (use-chat-stream) and the route (api/tools/chat) are proven elsewhere; what THIS
 * locks is the last link: a dispatched skill's card-block actually RENDERS as its real card
 * (through MessageBlocks → the card renderer) in the SAME thread — the whole point of "one thread,
 * all skills". Also locks that a plain chat turn (markdown only, no cards) is unchanged.
 *
 * Was chat-thread-view.test.tsx. ChatThreadView is gone: it was a per-skill live surface gated on
 * `activeTool === "chat"`, and that gating is what kept a finished run outside the thread. Every
 * behaviour it owned — typing dots, the dispatch-labelled capsule, cards-above-the-copilot-line,
 * context-aware chips — now lives in <ThreadTurn> and is asserted here against it.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThreadTurn, type LiveRun } from '../thread-turn';
import { FollowupContext } from '@/lib/followup-context';

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

const HOOK_CARD = {
  type: 'hook-card',
  props: {
    hookLine: 'Everyone lied about 5am',
    audienceArchetype: 'the sceptic',
    mechanism: 'pattern-break',
    seedHook: 'Everyone lied about 5am',
    rank: 1,
    band: 'Strong',
    fraction: '6/10 stop',
    scrollQuote: 'wait, what?',
    model: 'sim1-flash',
    scored: true,
    channel: null,
  },
};

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

/** A live chat turn. `skill` is what the agent's `dispatch` frame named ('chat' ⇒ none). */
function liveChat(over: Partial<LiveRun> = {}): LiveRun {
  return { skill: 'chat', isStreaming: false, stages: [], error: null, ...over };
}

describe('ThreadTurn — chat-as-agent cards', () => {
  it('renders a dispatched skill card inline (cards → real card renderer)', () => {
    renderWithClient(
      <ThreadTurn
        blocks={[IDEA_CARD, { type: 'markdown', props: { text: 'Made you an angle — want hooks for it?' } }]}
        live={liveChat({ skill: 'ideas' })}
      />,
    );
    // The idea-card face rendered (title), proving MessageBlocks routed the block.
    expect(screen.getByText('The 5am myth')).toBeTruthy();
    // The closing co-pilot line rendered alongside the card.
    expect(screen.getByText(/want hooks for it/i)).toBeTruthy();
  });

  it('while thinking (streaming, no content yet) shows the lightweight typing indicator, not the heavy skeleton', () => {
    renderWithClient(
      <ThreadTurn userTurn="why do hooks matter?" blocks={[]} live={liveChat({ isStreaming: true })} />,
    );
    expect(screen.getByText('Thinking…')).toBeTruthy();
    // The old centered constellation skeleton is NOT used for a chat wait.
    expect(screen.queryByTestId('thread-loading-skeleton')).toBeNull();
    // The user's question still shows above the thinking state.
    expect(screen.getByText('why do hooks matter?')).toBeTruthy();
  });

  it('plain chat turn (markdown only, no cards) is unchanged', () => {
    renderWithClient(
      <ThreadTurn
        blocks={[{ type: 'markdown', props: { text: 'Post three times a week.' } }]}
        live={liveChat()}
      />,
    );
    expect(screen.getByText('Post three times a week.')).toBeTruthy();
    expect(screen.queryByText('The 5am myth')).toBeNull();
  });

  it('while a dispatched skill runs (streaming + live stages, no cards yet) shows the progress SPINE, not typing dots', () => {
    // The gap this locks: a chat-dispatched generator is a 20–65s run, but the route already emits
    // real `stage` events. Without rendering them the whole wait was silent typing dots.
    renderWithClient(
      <ThreadTurn
        userTurn="give me 3 ideas about morning routines"
        blocks={[]}
        live={liveChat({
          isStreaming: true,
          stages: [
            { name: 'Generating', status: 'active' },
            { name: 'Simulating your audience', status: 'pending' },
          ],
        })}
      />,
    );
    expect(screen.getByLabelText('Skill run progress')).toBeTruthy();
    expect(screen.getByText('Generating')).toBeTruthy();
    // The pure-chat typing dots are NOT shown while a skill is running (the spine replaced them).
    expect(screen.queryByText('Thinking…')).toBeNull();
  });

  it('spine survives a pre-tool preamble (streamed text before cards must NOT suppress it)', () => {
    // The loop may stream a short "on it…" line BEFORE it calls the tool. The spine pivots on the
    // RUN, not on text — otherwise that preamble would silence the whole run.
    renderWithClient(
      <ThreadTurn
        blocks={[{ type: 'markdown', props: { text: 'On it — generating a few angles.' } }]}
        live={liveChat({ isStreaming: true, stages: [{ name: 'Generating', status: 'active' }] })}
      />,
    );
    // The preamble line AND the live spine both render (no cards yet → run still in progress).
    expect(screen.getByText('On it — generating a few angles.')).toBeTruthy();
    expect(screen.getByLabelText('Skill run progress')).toBeTruthy();
  });

  it('once the dispatched skill completes, the spine gives way to the cards', () => {
    // Cards are produced at the END of the run, so the moment every stage is `done` the run is
    // effectively over — the spine collapses and the real cards carry the turn, even though the
    // stream is still open. Gating this on `isStreaming` would hold the cards back.
    renderWithClient(
      <ThreadTurn
        blocks={[IDEA_CARD]}
        live={liveChat({
          isStreaming: true,
          stages: [
            { name: 'Generating', status: 'done' },
            { name: 'Simulating your audience', status: 'done' },
            { name: 'Ranking', status: 'done' },
          ],
        })}
      />,
    );
    expect(screen.getByText('The 5am myth')).toBeTruthy();
    expect(screen.queryByLabelText('Skill run progress')).toBeNull();
  });

  // ── The run capsule — the dispatch event labels + seeds the spine ────────────────────────────

  it('a dispatch labels the capsule and seeds the FULL skill plan before any stage event', () => {
    // The `dispatch` SSE frame arrives BEFORE the first stage event. From that moment the wait must
    // be legible: the capsule names the skill + audience and shows the whole pipeline up front.
    renderWithClient(
      <ThreadTurn
        userTurn="write me hooks about morning routines"
        blocks={[]}
        live={liveChat({
          skill: 'hooks',
          isStreaming: true,
          stages: [],
          audienceLabel: 'Bootstrapped Founders',
          platform: 'tiktok',
        })}
      />,
    );
    // The full hooks plan is visible from frame one (STAGE_PLANS.hooks).
    expect(screen.getByText('Generating')).toBeTruthy();
    expect(screen.getByText('Simulating your audience')).toBeTruthy();
    expect(screen.getByText('Ranking')).toBeTruthy();
    // The skill's own intro names the audience — the turn says what it is doing, for whom.
    expect(screen.getByLabelText(/Pulling hooks for Bootstrapped Founders/)).toBeTruthy();
    // No typing dots — the run owns the wait.
    expect(screen.queryByText('Thinking…')).toBeNull();
  });

  it('after the run completes, the capsule collapses to the ✓ receipt ABOVE the cards', () => {
    renderWithClient(
      <ThreadTurn
        blocks={[IDEA_CARD]}
        live={liveChat({
          skill: 'ideas',
          isStreaming: true,
          stages: [
            { name: 'Generating', status: 'done' },
            { name: 'Simulating your audience', status: 'done' },
            { name: 'Ranking', status: 'done' },
          ],
        })}
      />,
    );
    expect(screen.getByText('Ran your audience')).toBeTruthy();
    expect(screen.getByText('3 steps')).toBeTruthy();
    expect(screen.queryByLabelText('Skill run progress')).toBeNull();
    expect(screen.getByText('The 5am myth')).toBeTruthy();
  });

  it('legacy stream (stages but NO dispatch frame) keeps the unlabeled spine', () => {
    renderWithClient(
      <ThreadTurn blocks={[]} live={liveChat({ isStreaming: true, stages: [{ name: 'Generating', status: 'active' }] })} />,
    );
    expect(screen.getByLabelText('Skill run progress')).toBeTruthy();
    // No skill label — the client doesn't know which skill; it must not guess one.
    expect(screen.queryByText('Writing hooks')).toBeNull();
    expect(screen.queryByText('Finding ideas')).toBeNull();
  });

  // ── Follow-up chips (chat-followups) — the redesign of the retired chain-handoff CTA ──────────
  // The old code ALWAYS rendered handoffsFor('idea') ("Develop this →" / "Rewrite for this
  // audience →") regardless of what ran, and tapping switched the active tool. These fail against
  // that code. A SETTLED turn (no `live`) classifies itself from its block types.

  it('follow-up chips are context-aware: a script turn offers script moves, NOT the idea handoff', () => {
    renderWithClient(<ThreadTurn userTurn="write a script" blocks={[SCRIPT_CARD]} />);
    expect(screen.queryByText('Develop this →')).toBeNull();
    expect(screen.queryByText('Rewrite for this audience →')).toBeNull();
    expect(screen.getByText('Make it punchier')).toBeTruthy();
    expect(screen.getByText('Hooks for this')).toBeTruthy();
  });

  it('a plain chat answer offers the generative entry points as chips', () => {
    renderWithClient(
      <ThreadTurn
        userTurn="how often should I post?"
        blocks={[{ type: 'markdown', props: { text: 'Three times a week.' } }]}
      />,
    );
    expect(screen.getByText('Give me ideas')).toBeTruthy();
    expect(screen.getByText('Write hooks')).toBeTruthy();
    expect(screen.getByText('Draft a script')).toBeTruthy();
  });

  it('tapping a chip fires the followup handler with the PROMPT (never auto-fires on render)', () => {
    const onFollowup = vi.fn();
    renderWithClient(
      <FollowupContext.Provider value={onFollowup}>
        <ThreadTurn
          userTurn="how often should I post?"
          blocks={[{ type: 'markdown', props: { text: 'Three times a week.' } }]}
        />
      </FollowupContext.Provider>,
    );
    // D-05: nothing fired just by rendering.
    expect(onFollowup).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Give me ideas'));
    // The chip sends the full PROMPT (what the agent routes), not the short label — and alongside it
    // the generator it DECLARES (chat-followups.ts `skill`). The sentence alone reads as subject-less,
    // so without the second argument the agent pushes back for a sharper angle and runs nothing.
    expect(onFollowup).toHaveBeenCalledWith(
      'Give me a few content ideas for what we just talked about.',
      'ideas',
    );
  });

  it('a CONVERSATIONAL chip fires with no declared skill — the control', () => {
    // "Which is strongest?" asks for judgement, not an artefact. It must reach the handler with the
    // skill argument UNDEFINED, or the pin would turn a question into a paid run.
    const onFollowup = vi.fn();
    renderWithClient(
      <FollowupContext.Provider value={onFollowup}>
        <ThreadTurn userTurn="hooks for my app" blocks={[HOOK_CARD]} />
      </FollowupContext.Provider>,
    );
    fireEvent.click(screen.getByText('Which is strongest?'));
    expect(onFollowup).toHaveBeenCalledWith(
      'Which of these hooks is strongest for my audience, and why?',
      undefined,
    );
  });

  it('no chips render while the run is still live (a turn must complete first)', () => {
    renderWithClient(
      <ThreadTurn userTurn="q" blocks={[]} live={liveChat({ isStreaming: true })} />,
    );
    expect(screen.queryByTestId('followup-row')).toBeNull();
  });
});
