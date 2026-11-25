/**
 * deps.ts — the agent's two network boundaries as its route reaches them (part 3, Task 13a): Qwen (`askQwen`) and the worker's
 * stills (`stillsOf`). The route reads them from here at each call, so the suite replaces them here and nowhere else; all that
 * lies between them (the door, the review, the loop, the first cut and the styles) is the real code.
 *
 * Server only, as `stillsOf` is.
 */
import { stillsOf } from "../worker/stills";
import { askQwen, type Ask } from "./model";

export const agentDeps: { ask: Ask; stills: typeof stillsOf } = { ask: askQwen, stills: stillsOf };
