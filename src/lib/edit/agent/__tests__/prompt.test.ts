/**
 * What the agent tells the model (part 3, Task 14's Step 0): the craft, "How it should look", between the role and the catalogue.
 * Its numbers are decisions, held here against the code they speak of: the schemas' smallest sizes, the first cut's hook, and the
 * review's shortest read.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WORDS } from "../../worker/__tests__/rows";
import { CaptionsSchema } from "../../doc";
import { PARTS } from "../../parts";
import { catalogue } from "../catalogue";
import { HOOK } from "../first-cut";
import { SHORTEST_READ_MS, type Finding } from "../../review";
import { DEFAULT_CAPTIONS, newEdit, type Asset } from "../../doc";
import { CUT_NEAR_MS, CUT_NEAR_SAYS, contextOf } from "../context";
import { kitTerms } from "../loop";
import { CRAFT, ONLY, SAYS, closingMessage, refusedMessage, requestMessage, reviewedMessage, sections, stillsMessage, systemPrompt, unreadableMessage } from "../prompt";

const HEAD = "HOW IT SHOULD LOOK";

/** The craft section: from its heading to the catalogue. */
function craft(): string {
  const system = systemPrompt();
  const [from, to] = [system.indexOf(HEAD), system.indexOf(catalogue())];
  expect(from).toBeGreaterThan(0);
  expect(to).toBeGreaterThan(from);
  return system.slice(from, to);
}

describe("the system prompt", () => {
  it("is the role, then how it should look, then the catalogue, the same every time", () => {
    const system = systemPrompt();
    expect(system.startsWith("You edit a creator's short vertical video")).toBe(true);
    expect(system.endsWith(catalogue())).toBe(true);
    expect(system.indexOf(HEAD)).toBeLessThan(system.indexOf(catalogue()));
    expect(systemPrompt()).toBe(system);
  });
});

describe("how it should look", () => {
  it("says the smallest text, which is the schemas' own", () => {
    expect(CRAFT.smallestPx).toBe(CaptionsSchema.shape.size.minValue);
    expect(CRAFT.smallestPx).toBe(PARTS.callout.props.shape.size.minValue);
    expect(craft()).toContain(`${CRAFT.smallestPx} px`);
  });

  it("says a step someone sees, for bigger and smaller", () => {
    expect(craft()).toMatch(/"Larger" and "smaller"/);
    expect(craft()).toContain("about a third");
  });

  it("says one voice: the captions' font and their highlight colour", () => {
    expect(craft()).toMatch(/captions' font/);
    expect(craft()).toMatch(/captions' highlight colour/);
  });

  it("says a film whose captions have no highlight colour gives new text none, and a call-out the title's voice, unless the creator names one (the native default)", () => {
    // The house's captions have none: told only to take theirs, the model gave call-outs and accents the catalogue's example.
    // Since 2026-11-24 a call-out there is a label in the title's colour and weight, not white letters in the pop look.
    expect(craft()).toContain(
      "- One voice: new text takes the captions' font, and an accent or a call-out takes the captions' highlight colour, unless the creator names another. Where the captions have no highlight colour (highlight null), a call-out is a label in the title's colour and weight, 72 to 96 px (with no title: #111111 at the captions' weight), and a title's accent is null, unless the creator names a look or a colour.",
    );
    expect(craft()).toContain("in the pop look in the captions' highlight colour, or as a label (always a label where the captions have no highlight colour)");
    expect(systemPrompt()).not.toContain("a call-out's letters are white");
  });

  it("says a call-out's size and stay, inside what the door takes and long enough to read", () => {
    const { sizePx, staysMs, inMs } = CRAFT.callout;
    const size = PARTS.callout.props.shape.size;
    expect(sizePx[0]).toBeGreaterThanOrEqual(size.minValue ?? 0);
    expect(sizePx[1]).toBeLessThanOrEqual(size.maxValue ?? 0);
    expect(sizePx[0]).toBeLessThan(sizePx[1]);
    // It comes in over `inMs`: its shortest stay leaves at least as long again to read it, and is the review's own (`short-text`).
    expect(CRAFT.shortestMs).toBe(SHORTEST_READ_MS);
    expect(CRAFT.shortestMs).toBeGreaterThanOrEqual(2 * inMs);
    expect(staysMs[0]).toBeGreaterThanOrEqual(CRAFT.shortestMs);
    expect(staysMs[0]).toBeLessThan(staysMs[1]);
    expect(craft()).toContain(`${sizePx[0]} to ${sizePx[1]} px`);
    expect(craft()).toContain(`lenMs ${staysMs[0]} to ${staysMs[1]}`);
    expect(craft()).toContain(`${CRAFT.shortestMs / 1000} s`);
  });

  it("says a title's length, which is the first cut's hook's, and its stay", () => {
    expect(CRAFT.title.words).toBe(HOOK.title.words);
    expect(craft()).toMatch(/at most eight words/);
    expect(craft()).toContain(`${CRAFT.title.staysS[0]} to ${CRAFT.title.staysS[1]} s`);
    expect(craft()).toMatch(/\*asterisks\*/);
  });

  it("says how a say reads: one short sentence about what they will see, none of the kit's words, a refusal with what would work", () => {
    expect(craft()).toContain("say is one short sentence, in the creator's own kind of words, about what they will see");
    expect(craft()).toContain("It names no preset, operation, setting or number the creator did not use");
    expect(craft()).toContain("A refusal is one sentence that says what would work instead");
    expect(craft()).toContain('A place in the film is told by what is said there ("up to the pause after your second sentence"), a time only when the creator gave one');
    for (const say of SAYS) {
      expect(craft()).toContain(`"${say}"`);
      // Its own examples keep to it: one sentence, short, none of the kit's words, no number.
      expect(kitTerms(say, "")).toEqual([]);
      expect(say.split(/[.!?]\s/)).toHaveLength(1);
      expect(say.split(" ").length).toBeLessThanOrEqual(14);
      expect(say).not.toMatch(/\d/);
    }
    // The role says the same of its length, and that it is English whatever the request's language (X120).
    expect(systemPrompt()).toContain("say is what the creator reads: one short plain sentence, in English whatever language the request is in (a request in German or Italian is understood and done as any other)");
    expect(systemPrompt()).not.toContain("in the language of the request");
    expect(systemPrompt()).not.toContain("one or two plain sentences");
  });

  it("says to try another way before giving up, and to name what would work", () => {
    expect(craft()).toMatch(/another place/);
    expect(craft()).toMatch(/fewer words a page/);
    expect(craft()).toMatch(/names what would/);
  });

  it("says to place a new text by the room, and how a closing line is made", () => {
    expect(craft()).toMatch(/Place every new text by room: a y inside the range of each stretch it shows on/);
    expect(craft()).toMatch(/A line for the end of the film \(a sign-off, an outro\) is a title over its final seconds: an item with anchor "end", at the frames before the end it starts on \(three seconds are 90\) and frames null/);
    expect(craft()).toMatch(/Captions asked larger: a third, when room has a place for it; else the first of room's larger settings, sent whole \(its size, its maxWords and its y\), saying that it is as large as fits/);
    expect(craft()).toMatch(/never pixels or milliseconds\./);
  });

  it("says what to do when a place, a cut or a zoom has no room, and that a file is one the files list (fix round 1)", () => {
    expect(craft()).toMatch(/A place asked for by direction \("further up", "further down", "next to my shoulder"\): a height in that direction inside room's range\. When room has none there, change nothing/);
    expect(craft()).toMatch(/Less silence between the sentences \("tighter", "quicker", "less dead air"\): pauses\.tighten, at about two thirds of what room says the cuts keep now; never trims by hand/);
    // A cut by time is the code's move, and how near a clean cut must lie is said from the one place it is kept (`CUT_NEAR_MS`).
    expect(craft()).toContain(`is time.cut, with the film's own times in ms: the code lands each end on the nearest clean cut within ${CUT_NEAR_SAYS}, so that no word is clipped, and adds how much went to your say`);
    expect(CUT_NEAR_SAYS).toBe("one second");
    expect(CUT_NEAR_MS).toBe(1000);
    expect(craft()).not.toMatch(/half a second/);
    expect(craft()).toMatch(/say where the nearest clean cut is by what is said there \("after your second sentence"\), not in seconds/);
    expect(craft()).toContain("What comes once the speaking is over, or ahead of it (dead air at an end of the film), goes with ends.trim: you say which end, and the code cuts it by the words. Never a trim by hand, never a whole shot taken out for it.");
    expect(craft()).toMatch(/A punch-in or a slow zoom is shot\.zoom on a shot \(with "slow": true for a slow one\), up to what room says the shot may take; never a framing by hand/);
    expect(craft()).toMatch(/Where room says no further, there is no room to zoom there: zoom the others and say which part stays as it is, or change nothing and say what is in the way/);
    expect(craft()).toMatch(/A sound, a clip or a picture is one the files list: never name another/);
  });

  it("says outright that a request about the person or the place is no change to the edit (Task 14b, ruling 5)", () => {
    expect(craft()).toContain("A request about the person (their body, their face, their age, their voice, their clothes) or about the place they are in is not a change to the edit");
    expect(craft()).toContain('A zoom, a look or a cut is not an answer to it. Send "ops": [] and say in one sentence that the edit cannot change that.');
  });

  it("teaches by made-up examples: none is a request of the proof or its quoted words, nor the test take's words (Task 14b)", () => {
    const told = [systemPrompt(), ONLY, closingMessage(), unreadableMessage("x", false), refusedMessage([], true), reviewedMessage([])].join("\n");
    const examples = [...told.matchAll(/"([^"\n]{2,160})"|“([^”\n]{2,160})”/g)].map((match) => match[1] ?? match[2] ?? "");
    expect(examples.length).toBeGreaterThan(20);
    const file = JSON.parse(readFileSync(new URL("../requests.json", import.meta.url), "utf8")) as { takeWords: string[]; requests: { request: string }[] };
    const requests = file.requests.map((each) => each.request);
    // The requests name at most two single words of the take across the whole file (the final review: together they spelled
    // the owner's opening sentence): every word a request says is spoken is one of them, and nothing a request asks to be
    // written is.
    // (What a note or a request holds of the take unquoted only the take can tell, and this file may not hold its words:
    // `scripts/edit-agent-proof.ts examples` counts every string of requests.json against the take on the Mac that has it,
    // and fails on a word of four letters or more beyond these two.)
    expect(file.takeWords.length).toBeLessThanOrEqual(2);
    for (const word of file.takeWords) expect(word).toMatch(/^[A-Za-z]+$/);
    const spoken = requests.flatMap((request) => [...request.matchAll(/when I say ([A-Za-z]+)|the word "([^"]+)"|instead of "([^"]+)"|Zoom in on "([^"]+)"/g)].map((match) => match[1] ?? match[2] ?? match[3] ?? match[4] ?? ""));
    expect(spoken.length).toBeGreaterThanOrEqual(5);
    for (const word of spoken) expect(file.takeWords, `"${word}"`).toContain(word);
    const written = requests.flatMap((request) => [...request.matchAll(/(?:to say|call-out|closing line|write) "([^"]+)"/g)].map((match) => match[1] ?? ""));
    expect(written.length).toBeGreaterThanOrEqual(4);
    for (const text of written) for (const word of file.takeWords) expect(text.toLowerCase().split(/\s+/), `"${text}"`).not.toContain(word.toLowerCase());
    expect(requests.length).toBeGreaterThanOrEqual(27);
    const plain = (text: string) => text.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
    // No example of two words or more is part of a request, and no request is part of one.
    for (const example of examples.filter((each) => plain(each).includes(" "))) {
      for (const request of requests) {
        expect(plain(request).includes(plain(example)), `"${example}" is in the request "${request}"`).toBe(false);
        expect(plain(example).includes(plain(request)), `the request "${request}" is in "${example}"`).toBe(false);
      }
    }
    // Nor is any the text a request itself quotes (a hook's words, a call-out's, a word of the take).
    const quotedByRequests = requests.flatMap((request) => [...request.matchAll(/"([^"]+)"/g)].map((match) => plain(match[1] ?? "")));
    expect(quotedByRequests).toContain("follow for more");
    for (const example of examples) expect(quotedByRequests, `"${example}"`).not.toContain(plain(example));
    // Nor the take the suite's rows hold: no example is one of its words, or holds two of them in a row.
    const words = WORDS.map((word) => plain(word.text));
    for (const example of examples) {
      expect(words, `"${example}"`).not.toContain(plain(example));
      for (let i = 0; i + 1 < words.length; i++) expect(plain(example).includes(`${words[i]} ${words[i + 1]}`), `"${example}"`).toBe(false);
    }
    // The says shown as examples share no word of four letters or more with any request: they cannot be copied as an answer to one.
    const asked = new Set(requests.flatMap((request) => plain(request).split(" ")).filter((word) => word.length >= 4));
    for (const say of SAYS) for (const word of plain(say).split(" ")) expect(asked.has(word), `"${word}" of "${say}"`).toBe(false);
  });

  it("says sparing: one title at a time, call-outs apart", () => {
    expect(craft()).toMatch(/one title on screen/i);
    expect(craft()).toMatch(/three seconds apart/);
    expect(CRAFT.apartS).toBe(3);
  });
});

describe("the role", () => {
  it("keeps sizes and positions as numbers out of say, as it keeps ids, files, milliseconds and frames", () => {
    expect(systemPrompt()).toContain("It names no ids and no files, no milliseconds or frames, and no pixel sizes or positions as numbers");
  });
});

describe("reviewedMessage", () => {
  const finding = (code: Finding["code"], says: string): Finding => ({ code, severity: "error", where: { frame: 12 }, says });

  it("writes each error as the context does, then where its text has room, when it is told", () => {
    const errors = [finding("on-face", "the captions at 0.4 s cover the mouth; move them up or down"), finding("cut-outside-pause", "the film's start is outside a pause")];
    expect(reviewedMessage(errors, ["Room for the captions: now 72px.", null]).split("\n")).toEqual([
      "The review found errors your ops would make, so the edit is unchanged:",
      "- error on-face frame=12 the captions at 0.4 s cover the mouth; move them up or down. Room for the captions: now 72px.",
      "- error cut-outside-pause frame=12 the film's start is outside a pause",
      'Answer again with the whole list of ops for the request, made so that none of these errors comes back. Change only what the request asks for: a text the request did not name stays where it is. Write say as a first answer to the request: the creator saw nothing of this try, so nothing was moved or fixed for them. Or, when what was asked has no room or cannot be done, send "ops": [] and say what is in the way and what would work.',
    ]);
    expect(reviewedMessage(errors).split("\n")[1]).toBe("- error on-face frame=12 the captions at 0.4 s cover the mouth; move them up or down");
    // Anything more the loop has to say comes after the errors, before what to answer.
    expect(reviewedMessage(errors, [], ['Shot "s1": no tighter framing keeps every text clear of the face.']).split("\n").slice(3)).toEqual([
      'Shot "s1": no tighter framing keeps every text clear of the face.',
      'Answer again with the whole list of ops for the request, made so that none of these errors comes back. Change only what the request asks for: a text the request did not name stays where it is. Write say as a first answer to the request: the creator saw nothing of this try, so nothing was moved or fixed for them. Or, when what was asked has no room or cannot be done, send "ops": [] and say what is in the way and what would work.',
    ]);
  });
});

describe("an answer that was not taken", () => {
  it("is answered with what was wrong, and asks for a say written as a first answer: the creator did not see the one refused", () => {
    const again = 'Write say as a first answer to the request: the creator saw nothing of this try, so nothing was moved or fixed for them. Or, when what was asked has no room or cannot be done, send "ops": [] and say what is in the way and what would work.';
    expect(unreadableMessage("it is not JSON", false).endsWith(again)).toBe(true);
    expect(unreadableMessage("it is not JSON", true)).toContain("stopped at the token limit");
    expect(refusedMessage([{ path: "ops.0", id: "m1", message: "it would not show" }]).split("\n")).toEqual([
      "The door refused your ops, so the edit is unchanged:",
      "- ops.0 (m1): it would not show",
      `Answer again with the whole list of ops for the request, fixed. ${again}`,
    ]);
  });
});

describe("the request's message", () => {
  const TAKE: Asset = { id: "take", kind: "video", origin: "filmed", at: { bucket: "edit-media", path: "u1/take.mp4" }, ms: 2000, w: 720, h: 1280, sound: true, words: [{ text: "Hi", startMs: 200, endMs: 600 }] };
  const context = contextOf({ ...newEdit(TAKE), captions: { ...DEFAULT_CAPTIONS, y: 0.5 } }, {}, []);

  it("ends with what to keep to: this change and no other, and what to do when it cannot be done (fix round 2)", () => {
    const message = requestMessage(context, "make it black and white");
    expect(message.endsWith(`request:\nmake it black and white\n\n${ONLY}`)).toBe(true);
    expect(ONLY).toContain('nothing "as well", nothing "instead"');
    expect(ONLY).toContain("If part of it cannot be done, do the rest and say what is missing");
  });

  it("with no moment is the message as it was; with one, the moment's lines sit between the context and the request (slice B, Task 2)", () => {
    const asWas = `${sections(context)}\n\nrequest:\nmake it black and white\n\n${ONLY}`;
    expect(requestMessage(context, "make it black and white")).toBe(asWas);
    expect(requestMessage(context, "make it black and white", undefined)).toBe(asWas);
    expect(requestMessage(context, "zoom in here", "paused frame=3 of film 60f: the lines")).toBe(
      `${sections(context)}\n\nmoment:\npaused frame=3 of film 60f: the lines\n\nrequest:\nzoom in here\n\n${ONLY}`,
    );
  });

  it("a door's refusal of a made-up file says that only the files listed can be used", () => {
    const problems = [{ path: "ops.1", id: null, message: 'there is no file "whoosh" to add' }];
    expect(refusedMessage(problems, true).split("\n")[2]).toBe("No file can be made up: only the files listed can be added or played. Leave out what needs another file, do the rest of the request, and say what is missing.");
    expect(refusedMessage(problems).split("\n")).toHaveLength(3);
  });

  it("the closing call asks for the sentence alone, and that nothing is said to have changed", () => {
    expect(closingMessage()).toBe('You have no answer left, and the edit is unchanged. Answer with {"say": string, "ops": []} only: tell the creator in one plain sentence what could not be done and what would work instead, if anything would. Nothing was changed: do not say that anything was.');
  });

  it("shows a change with what it did as measured, with pictures or without, and offers undo", () => {
    const effect = ["the film is now 1.0 s; it was 2.0 s (1.0 s shorter)", 'words cut out of the film: w0 (1 word: "Hi")'];
    const parts = (content: ReturnType<typeof stillsMessage>) => {
      if (typeof content === "string") throw new Error("the look is not sent as parts");
      return content;
    };
    const plain = parts(stillsMessage([], context, context, "cut the start", effect));
    expect(plain).toHaveLength(1);
    const text = plain[0]?.type === "text" ? plain[0].text : "";
    expect(text).toContain(`What your ops did, as measured:\n- ${effect[0]}\n- ${effect[1]}\n\nrequest:\ncut the start`);
    expect(text).toContain('answer with [{"op":"undo"}] alone, which takes it all back, and say what could not be done and what would work');
    expect(text).not.toContain("Here is how it looks");
    // The say after a look is a first answer too: "It's black and white now." is one, so "now" is not held against it.
    expect(text).toContain('Not "also", "still" or "already"');
    expect(text).not.toContain('"now"');
    // With stills: the frames first, each labelled, then the same.
    const drawn = parts(stillsMessage([{ frame: 12, jpeg: "aGk=", says: "callout c1" }], context, context, "add a call-out", []));
    expect(drawn.map((part) => part.type)).toEqual(["text", "text", "image_url", "text"]);
    const closing = drawn.at(-1);
    expect(closing?.type === "text" && closing.text.includes("Here is how it looks. Hold what your ops did against the request, and judge only your own change: it reads at a glance, clear of the face.")).toBe(true);
    expect(closing?.type === "text" && closing.text.includes("What your ops did")).toBe(false);
  });
});
