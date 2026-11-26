/**
 * plain-dashes.ts — no em or en dash in the text the creator reads in the chat thread.
 *
 * The voice rule (chat-voice.ts) asks for none, and the model still writes them (its system prompt
 * is full of them). So they are removed by construction, by ONE character-by-character reader used
 * two ways:
 *
 *   - `plainDashes(text)`: the whole text through the reader, for stored and one-shot text.
 *   - `createDashGuard(onToken)`: a token stream through the same reader. The reader only ever
 *     looks at characters it has already been given, so the token split cannot change what comes
 *     out (pinned over every 1- and 2-way split): live and reload read the same.
 *
 * Linear: every character is looked at once on the way in, and a held sentence is written out
 * once.
 *
 * WHAT A DASH BECOMES
 *   - a range: " to ". Digits on both sides ("3–5"), with a currency sign or % beside the digit
 *     ("$5–$10", "5%–10%"), or an unspaced en dash between two words ("Monday–Friday").
 *   - a minus: a space before, none after, a number after ("dropped –5%" → "dropped -5%").
 *   - at a line start: the list marker "- ", indentation kept. Before a line break: ":".
 *   - one clause dash in a sentence: a full stop and a capital ("it — this" → "it. This"), or a
 *     comma when a joining word follows ("at 7 — when they're home" → "at 7, when they're home").
 *   - two or more in one sentence: commas.
 *   A closing `*`, `_`, `)` or `]` right after the dash goes before the stop, so bold still closes.
 * Untouched: quotations ("…", “…”, «…», „…“, ‘…’; a straight quote after a digit is an inch mark),
 * `code` and ``` fences, table rows, URLs and @handles. A hyphen is not a dash.
 * Not a sentence end: "e.g.", "i.e.", "vs.", "etc.", and a single capital with a stop ("J.").
 *
 * WHY THE STREAM HOLDS TEXT
 * Whether a dash is one or one of a pair is known only at its sentence's end, so from a dash (and
 * the spaces before it) to that end the reader holds. Text with no dash goes out at once, except
 * trailing spaces, which might be the start of " —". `release()` ends a model round: the next round
 * is read as its own text, the way the loop stores it.
 */

const EM = "—";
const EN = "–";
const isDash = (c: string) => c === EM || c === EN;
const isHSpace = (c: string) => c === " " || c === "\t";
const isSpace = (c: string) => isHSpace(c) || c === "\n" || c === "\r";
const isDigit = (c: string) => c >= "0" && c <= "9";
const isWordChar = (c: string) => c !== "" && /[\p{L}\p{N}]/u.test(c);
const isLower = (c: string) => c >= "a" && c <= "z";
const isUpper = (c: string) => c >= "A" && c <= "Z";
const TERMINATORS = new Set([".", "!", "?"]);
const SOFT_STOPS = new Set([".", "!", "?", ":", ";", ","]);
const CLOSERS = new Set(["*", "_", ")", "]"]);
const CURRENCY = new Set(["$", "€", "£", "¥"]);
const QUOTES: Record<string, string> = {
  '"': '"',
  "“": "”", // “ ”
  "«": "»", // « »
  "„": "“", // „ “
  "‘": "’", // ‘ ’
};
const JOINING_WORDS = new Set(["when", "because", "while", "if", "so", "which", "who"]);
const ABBREVIATIONS = new Set(["e.g", "i.e", "vs", "etc"]);
/** The word right after a dash; sticky, so a long held sentence is not re-sliced per dash. */
const NEXT_WORD = /[A-Za-z]+/y;
/** Enough of a word to recognise an abbreviation, a URL scheme or a handle; longer words are cut. */
const WORD_KEEP = 16;

const isAbbreviation = (word: string) => {
  const w = word.replace(/[.]+$/, "");
  return ABBREVIATIONS.has(w.toLowerCase()) || /^[A-Z]$/.test(w) || /^(?:[A-Za-z]\.)+[A-Za-z]$/.test(w);
};

interface HeldContext {
  /** The two characters before the held text ("" at the start). */
  prev: string;
  prev2: string;
  /** The held text starts a line (only spaces before it on its line). */
  atLineStart: boolean;
}

/** One held sentence, from its first dash's leading spaces to its end, written out once. */
function renderHeld(s: string, prot: readonly boolean[], ctx: HeldContext, follow: string): string {
  const n = s.length;
  interface Span {
    from: number;
    dash: number;
    to: number;
    closers: string;
    kind: "list" | "range" | "minus" | "drop" | "colon" | "end" | "clause";
  }
  const spans: Span[] = [];
  for (let i = 0; i < n; i++) {
    if (!isDash(s[i]!) || prot[i]) continue;
    let from = i;
    while (from > 0 && isHSpace(s[from - 1]!) && !prot[from - 1]) from--;
    let to = i + 1;
    while (to < n && !prot[to] && isDash(s[to]!)) to++;
    const dashEnd = to;
    while (to < n && !prot[to] && isHSpace(s[to]!)) to++;
    let closers = "";
    if (to === dashEnd) {
      let j = to;
      while (j < n && !prot[j] && CLOSERS.has(s[j]!)) j++;
      const after = j < n ? s[j]! : follow;
      if (j > to && (after === "" || isSpace(after))) {
        closers = s.slice(to, j);
        to = j;
        while (to < n && !prot[to] && isHSpace(s[to]!)) to++;
      }
    }
    const at = (k: number) => (k >= 0 ? (k < n ? s[k]! : k === n ? follow : "") : k === -1 ? ctx.prev : ctx.prev2);
    const prev = at(from - 1);
    const prev2 = at(from - 2);
    const next = at(to);
    const next2 = at(to + 1);
    const prevNumber = isDigit(prev) || ((prev === "%" || CURRENCY.has(prev)) && isDigit(prev2));
    const nextNumber = isDigit(next) || (CURRENCY.has(next) && isDigit(next2));
    const spacedBefore = from < i;
    const spacedAfter = to > dashEnd && closers === "";
    let kind: Span["kind"];
    if (from === 0 && ctx.atLineStart) kind = "list";
    else if (prevNumber && nextNumber) kind = "range";
    else if (s[i] === EN && !spacedBefore && !spacedAfter && closers === "" && isWordChar(prev) && isWordChar(next))
      kind = "range";
    else if (spacedBefore && !spacedAfter && closers === "" && nextNumber) kind = "minus";
    else if (SOFT_STOPS.has(next)) kind = "drop";
    else if (next === "\n" || next === "\r") kind = "colon";
    else if (next === "") kind = "end";
    else kind = "clause";
    spans.push({ from, dash: i, to, closers, kind });
    i = dashEnd - 1;
  }
  if (spans.length === 0) return s;

  const clauses = spans.filter((sp) => sp.kind === "clause").length;
  let out = "";
  let at = 0;
  for (const sp of spans) {
    out += s.slice(at, sp.from);
    at = sp.to;
    const prev = sp.from > 0 ? s[sp.from - 1]! : ctx.prev;
    const softPrev = SOFT_STOPS.has(prev);
    switch (sp.kind) {
      case "list":
        out += s.slice(0, sp.dash) + (at < n ? "- " : "-");
        break;
      case "range":
        out += " to ";
        break;
      case "minus":
        out += s.slice(sp.from, sp.dash) + "-";
        break;
      case "drop":
        out += sp.closers;
        break;
      case "colon":
      case "end":
        out += sp.closers + (softPrev ? "" : sp.kind === "colon" ? ":" : ".");
        break;
      case "clause": {
        NEXT_WORD.lastIndex = at;
        const word = NEXT_WORD.exec(s)?.[0]?.toLowerCase() ?? "";
        if (clauses >= 2 || JOINING_WORDS.has(word)) {
          out += sp.closers + (softPrev ? " " : ", ");
        } else {
          out += sp.closers + (softPrev ? " " : ". ");
          const c = s[at] ?? "";
          if (isLower(c) && !isUpper(s[at + 1] ?? "")) {
            out += c.toUpperCase();
            at++;
          }
        }
        break;
      }
    }
  }
  return out + s.slice(at);
}

/** The character-by-character reader. `feed` and `end` append to `out`; the caller drains it. */
function createReader() {
  let out = "";
  // Protection state.
  let fence = false;
  let code = false;
  let closer: string | null = null;
  let ticks = 0;
  let lineStart = true;
  let tableRow = false;
  let word = "";
  let wordProtected = false;
  let prev = "";
  let prev2 = "";
  // Holding state.
  let spaces = ""; // trailing spaces, no dash yet in this sentence
  let spacesCtx: HeldContext | null = null;
  let held: string | null = null; // from the first dash of the sentence on
  let heldProt: boolean[] = [];
  let heldCtx: HeldContext = { prev: "", prev2: "", atLineStart: true };
  let endPending = false;
  let endWord = "";

  const settleTicks = () => {
    if (ticks === 0) return;
    if (fence) {
      if (ticks >= 3) fence = false;
    } else if (closer === null) {
      if (ticks >= 3) fence = true;
      else if (ticks % 2 === 1) code = !code;
    }
    ticks = 0;
  };

  const writeHeld = (follow: string) => {
    if (held === null) return;
    out += renderHeld(held, heldProt, heldCtx, follow);
    held = null;
    heldProt = [];
    endPending = false;
  };

  /** Mode with no dash in the sentence yet: out at once, trailing spaces held. */
  const looseChar = (c: string, isProtected: boolean) => {
    if (isHSpace(c)) {
      if (spaces === "") spacesCtx = { prev, prev2, atLineStart: lineStart };
      spaces += c;
      return;
    }
    if (isDash(c) && !isProtected) {
      heldCtx = spacesCtx && spaces !== "" ? spacesCtx : { prev, prev2, atLineStart: lineStart };
      held = spaces + c;
      heldProt = [...spaces].map(() => false).concat(false);
      spaces = "";
      return;
    }
    out += spaces + c;
    spaces = "";
  };

  const feed = (c: string) => {
    if (c !== "`") settleTicks();

    // Word tracking (URLs, @handles, abbreviations), on every character.
    if (isSpace(c)) {
      word = "";
      wordProtected = false;
    } else {
      if (word.length < WORD_KEEP) word += c;
      if (word === "@" || word === "www." || (prev2 === ":" && prev === "/" && c === "/")) wordProtected = true;
    }
    if (lineStart && !isHSpace(c) && c === "|" && !fence) tableRow = true;

    let isProtected: boolean;
    if (c === "`" && !tableRow) {
      ticks++;
      isProtected = true;
    } else if (fence || tableRow) isProtected = true;
    else if (c === "\n") isProtected = false;
    else if (code) isProtected = true;
    else if (closer !== null) {
      isProtected = true;
      if (c === closer) closer = null;
    } else if (QUOTES[c] !== undefined && !(c === '"' && isDigit(prev))) {
      closer = QUOTES[c]!;
      isProtected = true;
    } else isProtected = wordProtected;

    if (held === null) {
      looseChar(c, isProtected);
    } else if (endPending && isSpace(c) && !isAbbreviation(endWord)) {
      writeHeld(c);
      looseChar(c, isProtected);
    } else if (c === "\n") {
      writeHeld("\n");
      out += "\n";
    } else {
      endPending = false;
      held += c;
      heldProt.push(isProtected);
      if (TERMINATORS.has(c) && !isProtected) {
        endPending = true;
        endWord = word;
      }
    }

    if (c === "\n") {
      if (!fence) {
        code = false;
        closer = null;
      }
      tableRow = false;
      lineStart = true;
    } else if (!isHSpace(c)) lineStart = false;
    prev2 = prev;
    prev = c;
  };

  const end = () => {
    settleTicks();
    if (held !== null) writeHeld("");
    else {
      out += spaces;
      spaces = "";
    }
  };

  const drain = () => {
    const s = out;
    out = "";
    return s;
  };

  return { feed, end, drain };
}

/** The pure pass. Text with no em or en dash comes back unchanged. */
export function plainDashes(text: string): string {
  if (!text.includes(EM) && !text.includes(EN)) return text;
  const reader = createReader();
  for (let i = 0; i < text.length; i++) reader.feed(text[i]!);
  reader.end();
  return reader.drain();
}

export interface DashGuard {
  /** Feed a streamed delta; emits whatever is now final. */
  push: (delta: string) => void;
  /** End of a model round: emit what is held; the next round is read as its own text. */
  release: () => void;
  /** End of the turn: release, and return everything emitted. */
  flush: () => string;
}

export function createDashGuard(onToken: (delta: string) => void): DashGuard {
  let reader = createReader();
  let all = "";
  const emit = () => {
    const s = reader.drain();
    if (!s) return;
    all += s;
    onToken(s);
  };
  const release = () => {
    reader.end();
    emit();
    reader = createReader();
  };
  return {
    push(delta) {
      for (let i = 0; i < delta.length; i++) reader.feed(delta[i]!);
      emit();
    },
    release,
    flush() {
      release();
      return all;
    },
  };
}
