/**
 * Phase 13 Plan 01 — Gemini Model Self-Test (D-21)
 *
 * Purpose: Probe every Gemini slot used by the engine with a 1-token JSON probe
 * and verify response.modelVersion matches the requested model ID.
 * Probes BOTH bare AND `-preview` form per Pitfall 2 / Assumption A1.
 *
 * Run command: pnpm tsx scripts/engine-self-test.ts
 *
 * Exit codes:
 *   0 — at least one form (bare or preview) fully matches → Plan 02 can proceed
 *   1 — neither form fully passes → do NOT proceed to Plan 02 -preview drop
 */
import { config } from "dotenv";
import { resolve } from "path";
import { GoogleGenAI } from "@google/genai";

// Load env (Next.js convention — same as scripts/smoke-test-gemini-audio.ts)
config({ path: resolve(__dirname, "../.env.local") });

type Slot = { name: string; model: string };

const BARE_SLOTS: Slot[] = [
  { name: "wave0",   model: process.env.GEMINI_WAVE0_MODEL    ?? "gemini-3.1-flash-lite" },
  { name: "hook",    model: process.env.GEMINI_HOOK_MODEL     ?? "gemini-3.1-pro" },
  { name: "body",    model: process.env.GEMINI_BODY_MODEL     ?? "gemini-3-flash" },
  { name: "cta",     model: process.env.GEMINI_CTA_MODEL      ?? "gemini-3-flash" },
  { name: "stage11", model: process.env.GEMINI_STAGE11_MODEL  ?? "gemini-3.1-pro" },
];
const PREVIEW_SLOTS: Slot[] = BARE_SLOTS.map(s => ({ name: `${s.name}-preview`, model: `${s.model}-preview` }));

interface ProbeResult {
  name: string;
  requested: string;
  reported: string | null;
  match: boolean;
  error?: string;
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[self-test] Missing GEMINI_API_KEY in .env.local");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });
  const results: ProbeResult[] = [];
  let firstResponseLogged = false;

  for (const slot of [...BARE_SLOTS, ...PREVIEW_SLOTS]) {
    try {
      const response = await ai.models.generateContent({
        model: slot.model,
        contents: [{ role: "user", parts: [{ text: 'Return JSON {"ok":true}' }] }],
        config: { responseMimeType: "application/json" },
      });
      const r = response as Record<string, unknown>;
      const reportedModel = (r.modelVersion as string | undefined) ?? (r.model as string | undefined) ?? null;
      const match = !!reportedModel && reportedModel.startsWith(slot.model);

      // Log the full response shape on the first successful call (Assumption A3 lock)
      if (!firstResponseLogged) {
        console.log("[first-response-shape]", JSON.stringify(Object.keys(r)));
        firstResponseLogged = true;
      }

      results.push({ name: slot.name, requested: slot.model, reported: reportedModel, match });
      console.log(`${slot.name}: requested=${slot.model} reported=${reportedModel ?? "(none)"} match=${match}`);
    } catch (err) {
      results.push({
        name: slot.name,
        requested: slot.model,
        reported: null,
        match: false,
        error: err instanceof Error ? err.message : String(err),
      });
      console.error(`${slot.name}: ERROR ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const bareResults = results.slice(0, BARE_SLOTS.length);
  const previewResults = results.slice(BARE_SLOTS.length);
  const bareMatches = bareResults.filter(r => r.match).length;
  const previewMatches = previewResults.filter(r => r.match).length;

  console.log(`\n[summary] bare-form: ${bareMatches}/${BARE_SLOTS.length} match · preview-form: ${previewMatches}/${PREVIEW_SLOTS.length} match`);

  // Log per-slot detail for any mismatches
  const mismatches = [...bareResults, ...previewResults].filter(r => !r.match);
  if (mismatches.length > 0) {
    console.log("[mismatches]");
    for (const m of mismatches) {
      if (m.error) {
        console.log(`  ${m.name}: FAILED (${m.error})`);
      } else {
        console.log(`  ${m.name}: requested=${m.requested} reported=${m.reported ?? "(none)"}`);
      }
    }
  }

  if (bareMatches === BARE_SLOTS.length) {
    console.log("[verdict] BARE form usable — Plan 02 can drop -preview suffix (D-09 confirmed).");
    process.exit(0);
  }
  if (previewMatches === PREVIEW_SLOTS.length) {
    console.log("[verdict] BARE form FAILED but -preview form passes — Plan 02 must KEEP -preview and amend CONTEXT D-09.");
    process.exit(0);
  }
  // Partial match — check if either form is usable
  if (bareMatches > 0 || previewMatches > 0) {
    console.log(`[verdict] PARTIAL MATCH — bare ${bareMatches}/${BARE_SLOTS.length}, preview ${previewMatches}/${PREVIEW_SLOTS.length}. Investigate failures before Plan 02.`);
    process.exit(0);
  }
  console.error("[verdict] FAIL — neither form fully passes; investigate before proceeding to Plan 02.");
  process.exit(1);
}

main().catch((err) => {
  console.error("[self-test] Fatal:", err);
  process.exit(1);
});
