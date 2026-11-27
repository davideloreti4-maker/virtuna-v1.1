/**
 * plain-dashes.test.ts — the dash pass on everything the creator reads in the chat thread.
 *
 * The voice rule (chat-voice.ts) halved the em dash rate in real runs and stopped there: 7 of 12
 * answers still carried one. So the dash is removed by construction, the way the artefact guard
 * removes a leaked hook line: a pure pass for stored text, and a stream guard that must give the
 * creator, token by token, exactly what the pure pass gives the stored row.
 */

import { describe, expect, it, vi } from "vitest";
import { plainDashes, createDashGuard } from "@/lib/tools/plain-dashes";

describe("plainDashes: ranges read as 'to'", () => {
  it.each([
    ["Post 3–5 times a week.", "Post 3 to 5 times a week."],
    ["Aim for 45—90 seconds.", "Aim for 45 to 90 seconds."],
    ["Keep it at 5–10% volume.", "Keep it at 5 to 10% volume."],
    ["Post 3 – 5 times.", "Post 3 to 5 times."],
    ["Post from 10 AM–2 PM.", "Post from 10 AM to 2 PM."],
    ["Monday–Friday works.", "Monday to Friday works."],
  ])("%s", (input, out) => {
    expect(plainDashes(input)).toBe(out);
  });

  it("a hyphen is not a dash", () => {
    const s = "A talking-head video for 18-24 year olds.";
    expect(plainDashes(s)).toBe(s);
  });
});

describe("plainDashes: a clause dash", () => {
  it.each([
    ["Card two is the strongest — it lands.", "Card two is the strongest. It lands."],
    ["It frames the video as a story—it has stakes.", "It frames the video as a story. It has stakes."],
    ["Pick this – that one is weaker.", "Pick this. That one is weaker."],
    ["Three to five times a week — not daily.", "Three to five times a week. Not daily."],
    ['The third one — "I have twenty dollars" works.', 'The third one. "I have twenty dollars" works.'],
    ["Really? — yes.", "Really? Yes."],
    ["Your voice is the asset — protect it", "Your voice is the asset. Protect it"],
    ["That is it —", "That is it."],
  ])("one in a sentence ends the sentence: %s", (input, out) => {
    expect(plainDashes(input)).toBe(out);
  });

  it("two in one sentence are a pair: both become commas", () => {
    expect(plainDashes("For straight storytelling — sitting down and telling a story — talking-head wins.")).toBe(
      "For straight storytelling, sitting down and telling a story, talking-head wins.",
    );
  });

  it("each sentence is counted on its own", () => {
    expect(plainDashes("One — two. Three — four — five.")).toBe("One. Two. Three, four, five.");
  });

  it("before a line break it becomes a colon; at a line start, a list marker", () => {
    expect(plainDashes("Here is why —\n— it is short\n— it is clear")).toBe("Here is why:\n- it is short\n- it is clear");
  });
});

describe("plainDashes: quotes and code are left exactly as written", () => {
  it.each([
    ['Open with "Twenty dollars — seven dinners" tonight.'],
    ["Open with “Twenty dollars — seven dinners” tonight."],
    ["Open with «Twenty dollars — seven dinners» tonight."],
    ["Run `a — b` as is."],
    ["```\nconst x = a — b;\n```"],
  ])("%s", (s) => {
    expect(plainDashes(s)).toBe(s);
  });

  it("a dash outside the quote still goes, and the quote's own dash does not count toward a pair", () => {
    expect(plainDashes('Use "Twenty — seven" first — it is clearer.')).toBe('Use "Twenty — seven" first. It is clearer.');
  });

  it("an unclosed quote stops at the line break", () => {
    expect(plainDashes('He said "wait\nThen — go.')).toBe('He said "wait\nThen. Go.');
  });

  it("text with no dash comes back unchanged", () => {
    const s = "Post at 7 pm. Your viewers are home by then.\n\n**Bold** stays.";
    expect(plainDashes(s)).toBe(s);
  });
});

// ─── Shapes a first version damaged (review 2026-11-26) ─────────────────────────────────────
// Each is also a fixture of the split property test below.
const DAMAGE: Array<[string, string, string]> = [
  ["bold closes before the stop", "**Why it works —** the number is first.", "**Why it works**. The number is first."],
  ["a currency range", "Spend $5–$10 a day.", "Spend $5 to $10 a day."],
  ["a percent range", "Expect 5%–10% more.", "Expect 5% to 10% more."],
  ["a minus sign, not a clause", "Views dropped –5% this week.", "Views dropped -5% this week."],
  ["three dashes are all commas", "Film it — fast — cheap — today.", "Film it, fast, cheap, today."],
  ["no capital when the second letter is one", "Pick it — iPhone users scroll fast.", "Pick it. iPhone users scroll fast."],
  ["e.g. does not end the sentence", "Use a prop — e.g. a pan — then cut.", "Use a prop, e.g. a pan, then cut."],
  ["i.e., vs. and etc. do not either", "Post short — i.e. vs. long, etc. — then check.", "Post short, i.e. vs. long, etc. then check."],
  ["a single capital and a stop is an initial", "Ask J. Smith — he knows — first.", "Ask J. Smith, he knows, first."],
  ["a table cell stays", "| Day | Time |\n| — | 7 pm |", "| Day | Time |\n| — | 7 pm |"],
  ["a URL stays", "See https://example.com/a—b — it helps.", "See https://example.com/a—b. It helps."],
  ["an @handle stays", "Ask @meal—prep — she knows.", "Ask @meal—prep. She knows."],
  ["low German quotes stay", "Say „Zwanzig — sieben“ first.", "Say „Zwanzig — sieben“ first."],
  ["single curly quotes stay", "Say ‘Twenty — seven’ first.", "Say ‘Twenty — seven’ first."],
  ["an inch mark is not a quote", 'At 5\'10" — tall enough — you fit.', 'At 5\'10", tall enough, you fit.'],
  ["a subordinating word takes a comma", "Post at 7 — when they're home.", "Post at 7, when they're home."],
  ["because, if, so, which and who too", "Keep it short — because they scroll.", "Keep it short, because they scroll."],
  ["an indented list keeps its indent", "Steps:\n  — film it\n  — post it", "Steps:\n  - film it\n  - post it"],
];

describe("plainDashes: shapes that must not be damaged", () => {
  it.each(DAMAGE)("%s", (_name, input, out) => {
    expect(plainDashes(input)).toBe(out);
  });
});

// ─── The stream guard ────────────────────────────────────────────────────────

/** Real answers from the measured runs (2026-11-26), plus the edge shapes above. */
const FIXTURES = [
  "Talking head wins for comedy storytelling — your face and delivery are the joke. The humor lives in how you say it.",
  "Card #2 is the strongest — it lands stakes, humor, and a clear open loop in one line. Want me to write a full script on that one?",
  "**45–90 seconds.** That's the working range.\n\nUnder 45 seconds — the format doesn't justify itself — you rush it.",
  'Open with "Twenty dollars — seven dinners" — it is concrete.\nPost 3–5 times a week. Really? — yes.',
  "Here is why —\n— it is short\n```\na — b\n```\nDone — mostly.",
  "No dash here at all. Just plain words.\n",
  "Ends on a dash —",
  ...DAMAGE.map(([, input]) => input),
];

function stream(chunks: string[]): { emitted: string; flushed: string } {
  let emitted = "";
  const g = createDashGuard((d) => {
    emitted += d;
  });
  for (const c of chunks) g.push(c);
  const flushed = g.flush();
  return { emitted, flushed };
}

describe("createDashGuard: the stream equals the stored text, however the tokens split", () => {
  it.each(FIXTURES.map((f) => [f]))("every 1- and 2-way split: %s", (text) => {
    const want = plainDashes(text);
    expect(stream([text])).toEqual({ emitted: want, flushed: want });
    for (let i = 0; i <= text.length; i++) {
      const one = stream([text.slice(0, i), text.slice(i)]);
      expect(one.emitted, `split at ${i}`).toBe(want);
      expect(one.flushed).toBe(want);
      for (let j = i; j <= text.length; j++) {
        const two = stream([text.slice(0, i), text.slice(i, j), text.slice(j)]);
        if (two.emitted !== want) expect(two.emitted, `split at ${i},${j}`).toBe(want);
      }
    }
  });

  it("token by token, one character at a time", () => {
    for (const text of FIXTURES) expect(stream([...text]).emitted).toBe(plainDashes(text));
  });

  it("text with no dash is passed on at once (only trailing spaces wait, in case a dash follows)", () => {
    const onToken = vi.fn();
    const g = createDashGuard(onToken);
    g.push("Post at 7 pm. ");
    expect(onToken.mock.calls.map((c) => c[0]).join("")).toBe("Post at 7 pm.");
    g.push("Done");
    expect(onToken.mock.calls.map((c) => c[0]).join("")).toBe("Post at 7 pm. Done");
  });

  it("a dash is held only until its sentence ends", () => {
    const onToken = vi.fn();
    const g = createDashGuard(onToken);
    g.push("Pick this — it");
    expect(onToken.mock.calls.map((c) => c[0]).join("")).toBe("Pick this");
    g.push(" is clearer. Next");
    expect(onToken.mock.calls.map((c) => c[0]).join("")).toBe("Pick this. It is clearer. Next");
  });

  it("release() closes a round: what was held goes out, and the next round is read on its own", () => {
    let emitted = "";
    const g = createDashGuard((d) => {
      emitted += d;
    });
    g.push("Running it — one sec");
    g.release();
    expect(emitted).toBe("Running it. One sec");
    g.push("Done — here it is.");
    expect(g.flush()).toBe("Running it. One secDone. Here it is.");
    expect(emitted).toBe("Running it. One secDone. Here it is.");
  });

  it("a long answer stays linear enough to stream (committed at line breaks)", () => {
    const para = "Post three times a week — not daily. Keep it short.\n";
    const text = para.repeat(400);
    const t0 = Date.now();
    expect(stream(text.match(/[\s\S]{1,4}/g)!).emitted).toBe(plainDashes(text));
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  it("linear on long text with NO line break, fed one character at a time (the anonymous path)", () => {
    // The artefact guard re-emits a visitor's stream one character at a time, and leaked reasoning
    // rows ran to 18k to 33k characters. A first version re-read the whole text per character.
    const text = "Post three times a week — not daily, because a rushed story gets skipped. ".repeat(450); // ~33k
    expect(text).not.toContain("\n");
    const g = createDashGuard(() => {});
    const t0 = performance.now();
    for (const c of text) g.push(c);
    const out = g.flush();
    const ms = performance.now() - t0;
    console.log(`[plain-dashes] ${text.length} chars one at a time: ${ms.toFixed(0)} ms`);
    expect(out).toBe(plainDashes(text));
    expect(ms).toBeLessThan(300);
  });

  it("flush does not depend on `this`", () => {
    let emitted = "";
    const { push, flush } = createDashGuard((d) => {
      emitted += d;
    });
    push("Done — here it is");
    expect(flush()).toBe("Done. Here it is");
    expect(emitted).toBe("Done. Here it is");
  });
});
