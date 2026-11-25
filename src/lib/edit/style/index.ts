/**
 * Styles (part 3, spec §12): one `StyleProfile` in the kit's own terms, whatever its source (X95). A reference's is made from its
 * analysis: the measures (`measuresOf`) and its text on screen as the worker measured it (`textOf`, X101), with Qwen judging only
 * what is not measured on a sheet of its frames (`sheetFrames`, `judgeSheet`), mapped to the kit (`styleOfReference`);
 * `profileOf` and `matchOf` read an edit back against one. Server side: the judgement calls Qwen.
 */
export { DEFAULT_STYLE, StyleProfileSchema, type StyleProfile } from "./profile";
export { MONO_SAT, PUNCH_IN, QUIET_READ, measuresOf, pauseFor, type LookId, type Measures } from "./measures";
export { TEXT_RULES, seenOf, textOf, type TextRead } from "./text";
export { EXTRA_KINDS, SHEET, judgeSheet, sheetFrames, styleOfReference, type ExtraKind, type Judgement } from "./read";
export { TOLERANCE, matchOf, profileOf, type Match, type Profile } from "./match";
