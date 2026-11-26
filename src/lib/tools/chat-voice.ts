/**
 * chat-voice.ts — how every word the creator reads in the chat thread should sound.
 *
 * The owner's verdict on Maven's chat writing: it "looks a lot like AI and feels bloated /
 * unclear". Measured over 21 days of stored answers: half carried an em dash, and the ones the
 * creator read said "fires both the pattern interrupt and the curiosity gap" and "Four landed — I
 * can spin up a fifth". The cause is upstream: the shared craft corpus (`KC_BASE`) REQUIRES a
 * named mechanism in every claim ("'Curiosity gap' is a named mechanism") and is itself written
 * with a dash every few lines. That corpus also feeds the card writers, so it is not edited here;
 * this rule is appended LAST to each chat prompt and says it overrides it for what the creator reads.
 *
 * Same lessons as `WHY_RULE` (hooks-runner.ts): write from what the viewer sees or does, name the
 * concrete thing. A shape, NO example sentence: the first version had one marked "never reuse its
 * words", and a real hooks closing line pasted its second sentence word for word.
 */

/** The voice rule, word for word. Appended last, so it is the most recent instruction the model reads. */
export const CHAT_VOICE_RULE = `HOW YOU WRITE (this overrides every earlier line about style, bold labels or naming mechanisms, for every word the creator reads):
- Plain, short sentences a creator would say out loud. Lead with the answer.
- No em dashes or en dashes as punctuation: use a period or a comma. Write a range with "to" ("3 to 5 times a week").
- The craft notes above use theory terms so you can think. Never write them: not "curiosity gap", "pattern interrupt", "prediction error", "open loop", "dopamine", "mechanism", "retention hack", "scroll-stopper", "value prop", "leverage". Say what the viewer sees or does instead.
- No openers or filler: not "Here's the real talk", "Great question", "Honestly", "The real answer", "The real answer though", "Here's the thing".
- No slang performance: not "your vibe", "spin up", "hits hardest".
- Refer to a hook or an idea by quoting its own words, with no number or position in front: never "Card 1", "Hook 2", "#3", "Number two", "the second one", "the third one" or "option 2".
- A prose answer is most often two to five sentences. Go longer only when they ask for steps or a plan. No bold headings in a short prose answer.
- Name Maven's own actions by what the creator taps: "Simulate", "Remix", "Script", "Hooks", "Ideas". Never an internal name like "SIM-1 Max" or "SIM-1".
- Your prose under cards that just landed: one or two sentences in one paragraph, no more. The offer of a next step is part of the last sentence, not a line of its own.
- The length lines are about your prose answers. A card you compose keeps the slots its recipe asks for, in the same plain words.
Shape: the answer first, then one reason told as what the viewer sees, hears or does.`;

/**
 * The VIEWER's voice, for persona chat ("the viewers" answering the creator). Their own voice, not
 * Maven's: the persona prompt is built on the same strategist corpus (KC_CHAT_SYSTEM_PROMPT), and
 * measured before this a tough-crowd viewer answered with "There is no curiosity gap, no prediction
 * error", bold "(Pattern Interrupt)" headings and three rewritten hooks. A viewer never talks like
 * that. Appended last, so it is the most recent instruction the model reads.
 */
export const VIEWER_VOICE_RULE = `HOW YOU TALK (you are a viewer, not a strategist: this overrides every earlier line about naming mechanisms, frameworks, structure or style):
- Talk like a person who just watched it, in first person and in your own words: what you saw or heard, how it felt, and what you did (kept watching, scrolled, saved it, sent it to someone).
- A viewer does not know creator or marketing terms. Never use them: not "curiosity gap", "pattern interrupt", "prediction error", "open loop", "mechanism", "dopamine", "retention", "engagement", "algorithm", "value prop", "CTA", "cognitive dissonance". Say what you saw and what you did instead.
- No em dashes or en dashes: use a period or a comma.
- No openers or filler: not "Great question", "Honestly", "Here's the thing", "The real answer", "The bottom line".
- Short, like a reply in a chat: a few sentences. No lists, no bold, no headings.
- Do not coach the creator or write their hooks for them. If they ask what would make you stay, say what you would want to see, as a viewer.`;

/** A system prompt with the voice rule appended last, exactly once. */
export function withChatVoice(system: string): string {
  return `${system}\n\n${CHAT_VOICE_RULE}`;
}

// ─── Closing lines under a pack run from a skill's own surface ───────────────
// The ideas / hooks / script routes each write ONE line under the cards after a run. The lists
// carry the cards' own words and no numbers: "Hook #1 (Strong): …" was read back as "Card 1".

const CLOSING_ASK =
  "Write the closing line under these cards: one or two short sentences in ONE paragraph, under 40 words, no list, no line break. ";

export function ideasClosingPrompt(total: number, ideas: ReadonlyArray<{ title: string; angle: string }>): string {
  const lines = ideas.map((i) => `"${i.title}": ${i.angle}`).join("\n");
  return `You just made ${total} idea card(s) for this creator. They are on screen now, strongest first:

${lines}

${CLOSING_ASK}Say which idea you would film first, by its own words, and one plain reason a viewer would watch it, and end that same sentence or the next with one offer, like writing Hooks for it.`;
}

export function hooksClosingPrompt(total: number, hookLines: readonly string[]): string {
  const lines = hookLines.map((h) => `"${h}"`).join("\n");
  return `You just made ${total} hooks for this creator. They are on screen now, strongest first:

${lines}

${CLOSING_ASK}Say which hook you would open with, by its own words, and what a viewer sees or hears in it that makes them stay, and end that same sentence or the next with one offer, like a Script for it or a Simulate run.`;
}

export function scriptClosingPrompt(beats: ReadonlyArray<{ label: string; content: string }>): string {
  const lines = beats.map((b) => `${b.label}: "${b.content}"`).join("\n");
  return `You just wrote a script for this creator. It is on screen now. Its first beats:

${lines}

${CLOSING_ASK}Say what is strongest about how it opens or turns, quoting a few of its words, and end that same sentence or the next with one offer, like tightening a beat, a Simulate run, or a Remix.`;
}
