import { describe, expect, it } from "vitest";
import { isSealHash, sealHashOf } from "@/lib/thread-next/seal-hash";
import { MEAL_PREP_HOOKS } from "@/components/thread-next/__tests__/fixtures/answers";

describe("sealHashOf", () => {
  it("is the first 10 characters of the base64url SHA-256 of the trimmed text", async () => {
    // SHA-256("abc") = ba7816bf…; base64 "ungWv48Bz+pB…": url-safe, so "+" is "-".
    expect(await sealHashOf("abc")).toBe("ungWv48Bz-");
    expect(await sealHashOf("  abc \n")).toBe("ungWv48Bz-");
  });

  it("hashes the drawing's hook 1 to its key", async () => {
    expect(await sealHashOf(MEAL_PREP_HOOKS[0]!.props.hookLine)).toBe("VvK87Bp1dO");
  });

  it("three hooks, three keys, each 10 url-safe characters", async () => {
    const keys = await Promise.all(MEAL_PREP_HOOKS.map((b) => sealHashOf(b.props.hookLine)));
    expect(new Set(keys).size).toBe(3);
    for (const key of keys) expect(isSealHash(key)).toBe(true);
  });
});

describe("isSealHash", () => {
  it.each([
    ["ungWv48Bz-", true],
    ["VvK87Bp1dO", true],
    ["0u-rb9rUfX", true],
    ["short", false],
    ["ungWv48Bz-x", false],
    ["ungWv48Bz+", false],
    ["ungWv48Bz/", false],
    ["", false],
  ])("%s → %s", (key, ok) => {
    expect(isSealHash(key)).toBe(ok);
  });
});
