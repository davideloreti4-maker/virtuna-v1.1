/**
 * The recipes: pure functions that read an edit and its takes' analyses and give back operations for
 * the door (`applyOps`). The craft is in code, not in the model (N8): where a cut goes, where the
 * captions and the title sit, how loud a shot is and which shots are framed tighter are worked out here
 * from what the worker measured. They run on the server: `captions`, `title` and `punch` judge by `review`.
 */
export { PAUSE_MS, tighten, tightened, type Tightened } from "./tighten";
export { CAPTION_YS, captionSizes, placeCaptions, wordCounts } from "./captions";
export { placeTitle } from "./title";
export { levelled, levelVoice, type Levelled } from "./voice";
export { PUNCH, punchIns, punched, type Punched } from "./punch";
