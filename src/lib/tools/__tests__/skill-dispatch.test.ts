/**
 * skill-dispatch.test.ts — the chat-as-agent dispatcher (skill-dispatch.ts). Hermetic: `complete` and
 * the skill registry are injected, so nothing hits the model or the paid engine. Locks the behaviours
 * the spike proved live: routes to the right skill, abstains for pure chat, and — critically — the
 * paid-engine LEASH caps runs and errors are absorbed.
 */

import { describe, it, expect, vi } from "vitest";
import { runSkillDispatch, SKILL_TOOLS, type SkillTool, type ChatComplete } from "@/lib/tools/skill-dispatch";

const CTX = { platform: "tiktok" as const, profileRow: null, audience: null };

function mkSkill(name: string, opts: { paid?: boolean; run?: SkillTool["run"] } = {}): SkillTool {
  return {
    name,
    skillKey: name,
    ...((opts.paid ?? true) ? { billable: "ideas" as const } : {}),
    schema: { type: "function", function: { name, parameters: { type: "object", properties: {} } } },
    run:
      opts.run ??
      vi.fn(async (args) => ({ blocks: [{ type: "idea-card", props: { topic: args.topic } }], warnings: [] })),
  };
}

// An ANALYSIS skill (the second adapter shape): primaryArg "draft", not "topic".
function mkAnalysisSkill(name: string, opts: { run?: SkillTool["run"] } = {}): SkillTool {
  return {
    name,
    skillKey: name,
    billable: "ideas",
    primaryArg: "draft",
    schema: { type: "function", function: { name, parameters: { type: "object", properties: {} } } },
    run:
      opts.run ??
      vi.fn(async (args) => ({ blocks: [{ type: "reaction-distribution", props: { draft: args.draft } }], warnings: [] })),
  };
}

const call = (name: string, topic: unknown, id: string) => ({
  id,
  function: { name, arguments: JSON.stringify(topic === undefined ? {} : { topic }) },
});

const draftCall = (name: string, draft: unknown, id: string) => ({
  id,
  function: { name, arguments: JSON.stringify(draft === undefined ? {} : { draft }) },
});
const toolResp = (...calls: unknown[]) => ({ choices: [{ message: { content: null, tool_calls: calls } }] });
const stop = (content = "done") => ({ choices: [{ message: { content, tool_calls: [] } }] });

function scripted(responses: unknown[]): ChatComplete {
  let i = 0;
  return vi.fn(async () => responses[Math.min(i++, responses.length - 1)]) as unknown as ChatComplete;
}

/**
 * A permissive TILL — every skill from `mkSkill` is billable by default, and since 2026-07-29 a
 * billable skill does not run without one (fail closed). So the routing tests below have to pay,
 * and this is the wallet that always says yes. The refusal paths get their own tills, in the
 * "the till" block at the bottom.
 */
const okTill = () => ({
  authorize: vi.fn(async () => ({ ok: true as const })),
  charge: vi.fn(async () => {}),
});

const DEPS = (complete: ChatComplete, skills: SkillTool[], extra: Record<string, unknown> = {}) => ({
  complete,
  skills,
  model: "test-model",
  seed: 1,
  till: okTill(),
  ...extra,
});

describe("runSkillDispatch [tools]", () => {
  it("routes an ask to the matching skill and returns its blocks + closing text", async () => {
    const ideas = mkSkill("generate_ideas");
    const complete = scripted([toolResp(call("generate_ideas", "morning routines", "c1")), stop("here you go")]);

    const res = await runSkillDispatch({ ask: "3 ideas about morning routines", context: CTX }, DEPS(complete, [ideas]));

    expect(res.skillRuns).toHaveLength(1);
    expect(res.skillRuns[0]!.name).toBe("generate_ideas");
    expect(res.skillRuns[0]!.blocks).toHaveLength(1);
    expect(res.text).toBe("here you go");
    expect(ideas.run).toHaveBeenCalledWith({ topic: "morning routines", anchor: undefined }, CTX);
  });

  it("abstains for a pure-chat ask (no tool call) — no skill runs", async () => {
    const complete = scripted([stop("strategy talk, no cards")]);

    const res = await runSkillDispatch({ ask: "what makes a good hook?", context: CTX }, DEPS(complete, [mkSkill("generate_ideas")]));

    expect(res.skillRuns).toHaveLength(0);
    expect(res.text).toBe("strategy talk, no cards");
  });

  it("enforces the paid-engine LEASH — a second paid run in one turn is refused, not executed", async () => {
    const ideas = mkSkill("generate_ideas");
    const hooks = mkSkill("generate_hooks");
    const complete = scripted([
      toolResp(call("generate_ideas", "a", "c1"), call("generate_hooks", "b", "c2")),
      stop(),
    ]);

    const res = await runSkillDispatch({ ask: "do both", context: CTX }, DEPS(complete, [ideas, hooks], { maxSkillRuns: 1 }));

    expect(res.skillRuns).toHaveLength(1); // only the first paid run executed
    const refused = res.toolCalls.find((t) => !t.ran);
    expect(refused?.note).toContain("leash");
    expect(hooks.run).not.toHaveBeenCalled();
  });

  it("relays an unknown-skill tool call without running anything", async () => {
    const complete = scripted([toolResp(call("nonexistent", "a", "c1")), stop()]);

    const res = await runSkillDispatch({ ask: "x", context: CTX }, DEPS(complete, [mkSkill("generate_ideas")]));

    expect(res.skillRuns).toHaveLength(0);
    expect(res.toolCalls[0]!.note).toBe("unknown skill");
  });

  it("refuses a tool call with no topic", async () => {
    const complete = scripted([toolResp(call("generate_ideas", undefined, "c1")), stop()]);

    const res = await runSkillDispatch({ ask: "x", context: CTX }, DEPS(complete, [mkSkill("generate_ideas")]));

    expect(res.skillRuns).toHaveLength(0);
    expect(res.toolCalls[0]!.note).toBe("no topic");
  });

  it("absorbs a skill run error without throwing", async () => {
    const ideas = mkSkill("generate_ideas", {
      run: vi.fn(async () => {
        throw new Error("engine down");
      }),
    });
    const complete = scripted([toolResp(call("generate_ideas", "a", "c1")), stop("sorry, that failed")]);

    const res = await runSkillDispatch({ ask: "x", context: CTX }, DEPS(complete, [ideas]));

    expect(res.skillRuns).toHaveLength(0);
    expect(res.toolCalls[0]!.ran).toBe(false);
    expect(res.toolCalls[0]!.note).toBe("error");
  });

  // ── The SECOND adapter shape — analysis skills read a `draft`, not a `topic` ──

  it("routes a draft-shape ask to an analysis skill and passes the draft (not a topic)", async () => {
    const simulate = mkAnalysisSkill("simulate_reaction");
    const complete = scripted([
      toolResp(draftCall("simulate_reaction", "here's my hook: stop scrolling if you're broke", "c1")),
      stop("here's how the room reacts"),
    ]);

    const res = await runSkillDispatch(
      { ask: "how would my audience react to this hook?", context: CTX },
      DEPS(complete, [simulate]),
    );

    expect(res.skillRuns).toHaveLength(1);
    expect(res.skillRuns[0]!.name).toBe("simulate_reaction");
    expect(res.skillRuns[0]!.blocks).toHaveLength(1);
    expect(simulate.run).toHaveBeenCalledWith(
      { topic: undefined, anchor: undefined, draft: "here's my hook: stop scrolling if you're broke" },
      CTX,
    );
  });

  it("refuses an analysis tool call with no draft (its own required arg, not 'topic')", async () => {
    const complete = scripted([toolResp(draftCall("simulate_reaction", undefined, "c1")), stop()]);

    const res = await runSkillDispatch(
      { ask: "x", context: CTX },
      DEPS(complete, [mkAnalysisSkill("simulate_reaction")]),
    );

    expect(res.skillRuns).toHaveLength(0);
    expect(res.toolCalls[0]!.note).toBe("no draft");
  });

  it("registry ships the generators, each requiring `topic`", () => {
    const byName = new Map(SKILL_TOOLS.map((s) => [s.name, s]));

    for (const gen of ["generate_ideas", "generate_hooks", "write_script"]) {
      const s = byName.get(gen)!;
      expect(s).toBeDefined();
      expect(s.primaryArg ?? "topic").toBe("topic");
    }
    // Analysis skills (simulate/predict) were removed from chat dispatch (2026-07-17) — audience-tier
    // ineligible for the default General audience; the standalone selector routes still own them.
    expect(byName.has("simulate_reaction")).toBe(false);
    expect(byName.has("predict_outcome")).toBe(false);
  });
});

/**
 * THE TILL — the money seam, added 2026-07-29.
 *
 * `maxSkillRuns` is a leash, not a price: it caps how many paid runs a dispatch may START and knows
 * nothing about whether the creator can afford them or that anyone was charged. Before this seam,
 * `skill.run()` invoked the real paid pipeline ungated and unbilled. The module is off the live path
 * today, which is the only reason that never cost money — and "if it is ever revived, it needs a
 * billing seam" written in a doc is not a thing that stops a revival.
 *
 * So the property under test is that reviving it WITHOUT a wallet cannot spend the creator's money.
 */
describe("runSkillDispatch [the till]", () => {
  it("does NOT run a billable skill when no till is wired — fail closed", async () => {
    const ideas = mkSkill("generate_ideas");
    const complete = scripted([toolResp(call("generate_ideas", "morning routines", "c1")), stop("ok")]);

    const res = await runSkillDispatch(
      { ask: "3 ideas", context: CTX },
      // Deliberately NOT using DEPS: this is the shape a revival gets if it forgets the wallet.
      { complete, skills: [ideas], model: "test-model", seed: 1 },
    );

    expect(ideas.run).not.toHaveBeenCalled();
    expect(res.skillRuns).toHaveLength(0);
    expect(res.toolCalls[0]).toMatchObject({ name: "generate_ideas", ran: false, note: "no till wired" });
  });

  it("still runs a FREE skill with no till — the seam prices, it does not block", async () => {
    const free = mkSkill("free_skill", { paid: false });
    const complete = scripted([toolResp(call("free_skill", "anything", "c1")), stop("ok")]);

    const res = await runSkillDispatch(
      { ask: "go", context: CTX },
      { complete, skills: [free], model: "test-model", seed: 1 },
    );

    expect(free.run).toHaveBeenCalledTimes(1);
    expect(res.skillRuns).toHaveLength(1);
  });

  it("does not run when the till refuses, and relays its reason to the model", async () => {
    const ideas = mkSkill("generate_ideas");
    const complete = scripted([toolResp(call("generate_ideas", "morning routines", "c1")), stop("ok")]);
    const till = {
      authorize: vi.fn(async () => ({ ok: false as const, reason: "out of credits" })),
      charge: vi.fn(async () => {}),
    };

    const res = await runSkillDispatch(
      { ask: "3 ideas", context: CTX },
      DEPS(complete, [ideas], { till }),
    );

    expect(ideas.run).not.toHaveBeenCalled();
    expect(till.charge).not.toHaveBeenCalled();
    expect(res.toolCalls[0]).toMatchObject({ ran: false, note: "refused: no credits" });
  });

  it("charges ONCE on delivery, under the action the skill declared", async () => {
    const ideas = mkSkill("generate_ideas");
    const complete = scripted([toolResp(call("generate_ideas", "morning routines", "c1")), stop("ok")]);
    const till = okTill();

    await runSkillDispatch({ ask: "3 ideas", context: CTX }, DEPS(complete, [ideas], { till }));

    expect(till.authorize).toHaveBeenCalledTimes(1);
    expect(till.authorize).toHaveBeenCalledWith("ideas");
    expect(till.charge).toHaveBeenCalledTimes(1);
    expect(till.charge).toHaveBeenCalledWith("ideas");
  });

  it("does NOT charge for a run that threw — bill on delivery, never on attempt", async () => {
    const ideas = mkSkill("generate_ideas", {
      run: vi.fn(async () => {
        throw new Error("engine exploded");
      }),
    });
    const complete = scripted([toolResp(call("generate_ideas", "morning routines", "c1")), stop("ok")]);
    const till = okTill();

    const res = await runSkillDispatch({ ask: "3 ideas", context: CTX }, DEPS(complete, [ideas], { till }));

    expect(till.authorize).toHaveBeenCalledTimes(1);
    expect(till.charge).not.toHaveBeenCalled();
    expect(res.toolCalls[0]).toMatchObject({ ran: false, note: "error" });
  });

  /**
   * The inverse of the test above, and the one that actually costs the creator something.
   *
   * A charge that threw inside the run's own `try` would be caught by the SAME handler that catches
   * an engine explosion, so a bookkeeping fault would be reported as a RUN failure: the cards are
   * already built at that point, and the creator would watch delivered work be thrown away and the
   * model told the skill errored — while still not being charged. Delivery cannot be un-done by a
   * failed charge, so the run has to stand, and the miss rides out as a warning instead.
   */
  it("keeps a delivered run when the CHARGE throws — a bookkeeping fault is not a run failure", async () => {
    const ideas = mkSkill("generate_ideas");
    const complete = scripted([toolResp(call("generate_ideas", "morning routines", "c1")), stop("ok")]);
    const till = {
      authorize: vi.fn(async () => ({ ok: true as const })),
      charge: vi.fn(async () => {
        throw new Error("wallet unreachable");
      }),
    };

    const res = await runSkillDispatch({ ask: "3 ideas", context: CTX }, DEPS(complete, [ideas], { till }));

    expect(till.charge).toHaveBeenCalledTimes(1);
    expect(res.toolCalls[0]).toMatchObject({ name: "generate_ideas", ran: true });
    expect(res.skillRuns).toHaveLength(1);
    expect(res.skillRuns[0]!.blocks).toHaveLength(1);
    expect(res.skillRuns[0]!.warnings.join(" ")).toMatch(/charge did not record/i);
  });
});
