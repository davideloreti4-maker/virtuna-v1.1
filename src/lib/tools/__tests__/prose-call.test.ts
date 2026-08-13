/**
 * prose-call.test.ts — the detector and the withholding guard.
 *
 * ⚠️ Every assertion here was verified RED against the unfixed code before being kept. This lane's
 * most expensive recurring bug is a test that cannot fail (session 11 mutation 3 passed against a
 * first-match implementation because it said "the best idea" to a plural-only regex; session 12's
 * exemplar-fence guard had 3 of 4 assertions go green against the fully-present defect). The
 * mutation battery is `.scratch/mutate-prose-call.sh`.
 */
import { describe, expect, it, vi } from "vitest";

import { createProseCallGuard, detectProseCall, isProseCallPinEnabled } from "@/lib/tools/prose-call";

describe("detectProseCall", () => {
  it("fires on each generator the loop binds", () => {
    // The two shapes captured verbatim in session 11 §7, plus the third generator.
    expect(detectProseCall(`generate_hooks(topic="stand-up comedy podcast", count=5)`)).toBe(true);
    expect(detectProseCall(`generate_ideas(topic='stand-up comedy podcast')`)).toBe(true);
    expect(detectProseCall(`write_script(topic="morning focus")`)).toBe(true);
  });

  it("fires when the call is embedded in real prose", () => {
    expect(
      detectProseCall(
        `Great — for a stand-up comedy podcast:\n\ngenerate_hooks(topic="stand-up comedy podcast", count=5)`,
      ),
    ).toBe(true);
  });

  it("does NOT fire on read_concept", () => {
    // Deliberately absent, mirroring guess-pin.ts's omission of `read`: not a generator, and the
    // corpus never exercised it. A fire here would pin a turn to a generator the creator never
    // asked for.
    expect(detectProseCall(`read_concept(url="https://example.com/x")`)).toBe(false);
  });

  it("does NOT fire on a generator NAME without a call", () => {
    // The name alone is discussion, not an assertion of intent. §7.5's precision rests on the
    // model having asserted the specific call — by name, WITH args.
    expect(detectProseCall("I could use generate_hooks for this, but let's talk angles first.")).toBe(
      false,
    );
    expect(detectProseCall("generate_hooks is the tool for that.")).toBe(false);
  });

  it("does NOT fire on ordinary prose that merely starts like a generator name", () => {
    expect(detectProseCall("I generated a lot of ideas (twelve, actually) for this.")).toBe(false);
    expect(detectProseCall("Let's write scripts (plural) once the hook lands.")).toBe(false);
  });
});

describe("isProseCallPinEnabled", () => {
  it("is OFF unless the flag is exactly \"true\"", () => {
    // House convention for a DARK flag, matching ENGINE_GUESS_PIN. A half-set flag must read off.
    // (`!== "false"` is the default-ON form and is wrong here — see the design §8.)
    for (const value of [undefined, "", "false", "TRUE", "1", "yes", " true"]) {
      vi.stubEnv("ENGINE_PROSE_CALL_PIN", value as string);
      expect(isProseCallPinEnabled()).toBe(false);
    }
    vi.stubEnv("ENGINE_PROSE_CALL_PIN", "true");
    expect(isProseCallPinEnabled()).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe("createProseCallGuard", () => {
  /** Feed a string one character at a time — the worst case for any withholding logic. */
  function streamByChar(guard: ReturnType<typeof createProseCallGuard>, text: string) {
    for (const ch of text) guard.push(ch);
  }

  it("passes ordinary prose straight through, withholding nothing", () => {
    const seen: string[] = [];
    const guard = createProseCallGuard((d) => seen.push(d));
    streamByChar(guard, "Here are five angles that fit a comedy podcast.");
    // Asserted BEFORE close: nothing may be sitting in the buffer on a turn with no generator token.
    expect(seen.join("")).toBe("Here are five angles that fit a comedy podcast.");
    expect(guard.close(false)).toBe("Here are five angles that fit a comedy podcast.");
  });

  it("withholds the call and DROPS it when the pin fires", () => {
    const seen: string[] = [];
    const guard = createProseCallGuard((d) => seen.push(d));
    streamByChar(guard, `Great — for a podcast:\ngenerate_hooks(topic="x", count=5)`);
    // The creator must never read the malformed call. A token already streamed cannot be recalled,
    // so this has to be true DURING the stream, not merely after close.
    expect(seen.join("")).not.toContain("generate_hooks");
    expect(guard.close(true)).toBe("Great — for a podcast:\n");
    expect(seen.join("")).toBe("Great — for a podcast:\n");
  });

  it("RELEASES the withheld call verbatim when the pin does not fire", () => {
    // The alternative is eating the creator's sentence on a turn we then do nothing about.
    const seen: string[] = [];
    const guard = createProseCallGuard((d) => seen.push(d));
    streamByChar(guard, `Try this:\ngenerate_hooks(topic="x")`);
    expect(guard.close(false)).toBe(`Try this:\ngenerate_hooks(topic="x")`);
    expect(seen.join("")).toBe(`Try this:\ngenerate_hooks(topic="x")`);
  });

  it("releases a false start with nothing lost", () => {
    // "generated" begins like "generate_" and must cost the creator no text at all.
    const seen: string[] = [];
    const guard = createProseCallGuard((d) => seen.push(d));
    streamByChar(guard, "I generated a lot of ideas for you.");
    expect(seen.join("")).toBe("I generated a lot of ideas for you.");
    expect(guard.close(false)).toBe("I generated a lot of ideas for you.");
  });

  it("keeps text that follows the call on a later line", () => {
    const seen: string[] = [];
    const guard = createProseCallGuard((d) => seen.push(d));
    streamByChar(guard, `Ok:\ngenerate_hooks(topic="x")\nThose should land well.`);
    expect(guard.close(true)).toBe("Ok:\n\nThose should land well.");
  });

  it("reports whether a call was seen", () => {
    const a = createProseCallGuard(() => {});
    streamByChar(a, "no calls here");
    expect(a.sawProseCall()).toBe(false);

    const b = createProseCallGuard(() => {});
    streamByChar(b, `generate_ideas(topic="x")`);
    expect(b.sawProseCall()).toBe(true);
  });
});
