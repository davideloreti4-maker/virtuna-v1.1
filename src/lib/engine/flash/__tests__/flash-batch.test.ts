/**
 * S3′ — batched SIM coercion + prompt builder tests.
 *
 * Covers coerceFlashBatchResponse (id-mapping, positional fallback, shape tolerance) +
 * the per-candidate salvage the call fn performs (a short/malformed candidate drops ITSELF,
 * never the batch), and the batched prompt builders (population block reused from the single
 * path; independence directive + per-candidate ids in the user message).
 */
import { describe, it, expect } from "vitest";
import {
  coerceFlashBatchResponse,
  coerceFlashResponse,
  FlashResultSchema,
} from "../flash-schema";
import {
  buildFlashBatchSystemPrompt,
  buildFlashBatchUserContent,
  STABLE_FLASH_SYSTEM_PROMPT,
} from "../flash-prompts";

const ARCHS = [
  "high_engager", "saver", "lurker", "sharer", "tough_crowd",
  "purposeful_viewer", "niche_deep_buyer", "niche_deep_scout", "loyalist", "cross_niche_curiosity",
];

function tenPersonas(verdict: string = "stop") {
  return ARCHS.map((a, i) => ({ archetype: a, verdict: i % 2 ? "scroll" : verdict, quote: `${a} quote` }));
}

/** Mirror of the per-candidate salvage runFlashTextModeBatch performs after coercion. */
function resolveBatch(raw: unknown, ids: string[]) {
  const per = coerceFlashBatchResponse(raw, ids);
  const map = new Map<string, { personas: unknown }>();
  for (const { id, personas } of per) {
    const v = FlashResultSchema.safeParse(coerceFlashResponse({ personas }));
    if (v.success) map.set(id, v.data);
  }
  return map;
}

describe("coerceFlashBatchResponse — id mapping + fallback", () => {
  it("maps candidates by echoed id", () => {
    const raw = { candidates: [{ id: "a", personas: tenPersonas() }, { id: "b", personas: tenPersonas() }] };
    const map = resolveBatch(raw, ["a", "b"]);
    expect([...map.keys()].sort()).toEqual(["a", "b"]);
    expect(map.get("a")!.personas).toHaveLength(10);
  });

  it("falls back to positional order when ids are missing", () => {
    const raw = { candidates: [{ personas: tenPersonas() }, { personas: tenPersonas() }] };
    const map = resolveBatch(raw, ["0", "1"]);
    expect([...map.keys()].sort()).toEqual(["0", "1"]);
  });

  it("falls back to positional when echoed ids drift from expected", () => {
    const raw = { candidates: [{ id: "x", personas: tenPersonas() }, { id: "y", personas: tenPersonas() }] };
    const map = resolveBatch(raw, ["0", "1"]); // expected ids absent from echoed → positional
    expect([...map.keys()].sort()).toEqual(["0", "1"]);
  });

  it("tolerates a bare top-level array of candidates", () => {
    const raw = [{ id: "0", personas: tenPersonas() }];
    expect(resolveBatch(raw, ["0"]).has("0")).toBe(true);
  });

  it("tolerates a fenced JSON string", () => {
    const raw = "```json\n" + JSON.stringify({ candidates: [{ id: "0", personas: tenPersonas() }] }) + "\n```";
    expect(resolveBatch(raw, ["0"]).has("0")).toBe(true);
  });

  it("tolerates the {results:[…]} alias", () => {
    const raw = { results: [{ id: "0", personas: tenPersonas() }] };
    expect(resolveBatch(raw, ["0"]).has("0")).toBe(true);
  });

  it("tolerates a candidate emitted as a bare personas array", () => {
    const raw = { candidates: [tenPersonas()] };
    expect(resolveBatch(raw, ["0"]).has("0")).toBe(true);
  });
});

describe("per-candidate salvage — one bad candidate never nukes the batch", () => {
  it("missing candidate is dropped; the others survive", () => {
    const raw = { candidates: [{ id: "0", personas: tenPersonas() }, { id: "1", personas: tenPersonas() }] };
    const map = resolveBatch(raw, ["0", "1", "2"]); // "2" never returned
    expect(map.has("0")).toBe(true);
    expect(map.has("1")).toBe(true);
    expect(map.has("2")).toBe(false);
  });

  it("a short candidate (9 personas) drops itself; full candidate survives", () => {
    const raw = { candidates: [{ id: "0", personas: tenPersonas() }, { id: "1", personas: tenPersonas().slice(0, 9) }] };
    const map = resolveBatch(raw, ["0", "1"]);
    expect(map.has("0")).toBe(true);
    expect(map.has("1")).toBe(false); // .length(10) fails → dropped, not the batch
  });

  it("verdict casing is salvaged per candidate (Stop/SCROLL → lowercase)", () => {
    const messy = ARCHS.map((a, i) => ({ archetype: a, verdict: i % 2 ? "SCROLL" : "Stop", quote: `${a} q` }));
    const map = resolveBatch({ candidates: [{ id: "0", personas: messy }] }, ["0"]);
    expect(map.has("0")).toBe(true);
  });

  it("whole-response garbage → every candidate dropped (empty map, not a throw)", () => {
    const map = resolveBatch("not json at all", ["0", "1"]);
    expect(map.size).toBe(0);
  });
});

describe("batched prompt builders", () => {
  it("system prompt (no panel) reuses the generic 10-archetype population block", () => {
    const p = buildFlashBatchSystemPrompt();
    for (const a of ARCHS) expect(p).toContain(`### ${a}`);
    // Same population definition bytes as the single path (tough_crowd is the anchor archetype).
    expect(STABLE_FLASH_SYSTEM_PROMPT).toContain("### tough_crowd");
    expect(p).toContain('"candidates"');
    expect(p).toContain("Critical Divergence Requirement");
  });

  it("user content lists each candidate by id + carries the independence directive", () => {
    const u = buildFlashBatchUserContent([{ id: "0", text: "alpha" }, { id: "1", text: "beta" }], "hook");
    expect(u).toContain("id: 0");
    expect(u).toContain("id: 1");
    expect(u).toContain("alpha");
    expect(u).toContain("beta");
    expect(u).toContain("Independence");
    expect(u.toLowerCase()).toContain("do not let");
  });
});
