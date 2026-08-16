/**
 * probe-guess-narrowing.ts — does every consumer of the pre-router's guess get the
 * narrowing that was measured to matter?
 *
 * `guess-pin.ts` wraps `guessSkill` in `detectGuessPin`, which stands the pin down when the
 * ask NAMES A DIFFERENT TOOL FIRST. That narrowing is not stylistic: its own comment records
 * that the naive rule suppresses 3 confirmed-correct runs to kill 1 false positive, and
 * `repeat-ask.ts` names the same sentence as the single measured harmful guess.
 *
 * Two other call sites in the same route read the guess RAW:
 *   route.ts:496  predispatch (Stage B / B3) -> guessSkill(rawAsk)      RAW
 *   route.ts:569  proseCallPin               -> guessSkill(rawAsk)      RAW
 *   route.ts:519  guessPin                   -> detectGuessPin(rawAsk)  NARROWED
 *
 * Pure functions, no I/O, no LLM, no billing. Free to run.
 *
 *   node node_modules/.bin/tsx scripts/probe-guess-narrowing.ts
 */
import { guessSkill } from "@/lib/tools/pre-router";
import { detectGuessPin } from "@/lib/tools/guess-pin";

/** The ask guess-pin.ts AND repeat-ask.ts both name as THE known harmful guess. */
const KNOWN_FALSE_ALARM = "Yes, run the simulate tool on that hook — I want the reaction card.";

const ASKS: readonly string[] = [
  KNOWN_FALSE_ALARM,
  // guess-pin.ts's own contrast case: the tool word belongs to the SUBJECT, not the ask.
  "3 hooks for my saas software that lets creators simulate how their audience reacts to a post",
  "run the remix tool on that script",
  "predict how this hook performs",
  // Controls — no other tool named at all.
  "give me 5 hooks for my budgeting app",
  "why do most morning routines fail",
];

let disagreements = 0;
console.log(`${"ask".padEnd(62)} | raw guess  | narrowed   | agree?`);
console.log("-".repeat(104));
for (const ask of ASKS) {
  const raw = guessSkill(ask);
  const narrowed = detectGuessPin(ask);
  const agree = raw === narrowed;
  if (!agree) disagreements += 1;
  const shown = ask.length > 60 ? `${ask.slice(0, 57)}...` : ask;
  console.log(
    `${shown.padEnd(62)} | ${String(raw).padEnd(10)} | ${String(narrowed).padEnd(10)} | ${
      agree ? "yes" : "*** NO ***"
    }`,
  );
}

console.log(
  `\n${disagreements} of ${ASKS.length} asks are labelled/pinned differently depending on which ` +
    `call site reads the guess.`,
);
console.log(
  "Every disagreement is an ask where the NARROWED site stands down and the RAW sites do not.",
);
