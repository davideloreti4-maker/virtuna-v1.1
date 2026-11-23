/** @vitest-environment happy-dom */

/**
 * useSealKeys and resultLinkOf (thread answers step 2): the result-page key of each text a card can
 * link, through the real `sealHashOf` (Web Crypto), and the rule that a link exists only for a
 * simulated text whose thread and key are known. The one stand-in is Web Crypto's `digest` (a
 * platform boundary), held or removed to reach the orders and failures a page can meet.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { sealHashOf } from "@/lib/thread-next/seal-hash";
import { resultLinkOf, useSealKeys } from "../use-seal-keys";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useSealKeys", () => {
  it("knows each trimmed text's key a tick after the first render, and at once on a later mount", async () => {
    const first = renderHook(() => useSealKeys(["  abc ", "abc", ""]));
    expect(first.result.current.get("abc")).toBeUndefined();
    await waitFor(() => expect(first.result.current.get("abc")).toBe("ungWv48Bz-"));
    expect(first.result.current.size).toBe(1);
    const again = renderHook(() => useSealKeys(["abc"]));
    expect(again.result.current.get("abc")).toBe("ungWv48Bz-");
  });

  it("two cards with the same text both get its key, whichever card's hash lands", async () => {
    const text = "One text on two cards.";
    const key = await sealHashOf(text);
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(crypto.subtle, "digest")
      // The first card's hash lands once released.
      .mockImplementationOnce(async (algorithm, data) => {
        await held;
        return digest(algorithm, data);
      })
      // The second card's own hash never lands: it must still learn the key the first one found.
      .mockImplementationOnce(() => new Promise<ArrayBuffer>(() => {}));
    const a = renderHook(() => useSealKeys([text]));
    const b = renderHook(() => useSealKeys([text]));
    expect(b.result.current.get(text)).toBeUndefined();
    await act(async () => release());
    await waitFor(() => expect(a.result.current.get(text)).toBe(key));
    expect(b.result.current.get(text)).toBe(key);
  });

  it("no Web Crypto (an insecure page): no key for that text, and nothing thrown", async () => {
    vi.stubGlobal("crypto", { subtle: undefined });
    const { result } = renderHook(() => useSealKeys(["A text on an insecure page."]));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(result.current.has("A text on an insecure page.")).toBe(false);
    expect(result.current.size).toBe(0);
  });

  it("keeps at most 500 keys: past that, the oldest goes first", async () => {
    const texts = Array.from({ length: 501 }, (_, i) => `Bound text ${i}`);
    const { result } = renderHook(() => useSealKeys(texts));
    await waitFor(() => expect(result.current.has("Bound text 500")).toBe(true));
    expect(result.current.has("Bound text 0")).toBe(false);
    expect(result.current.size).toBe(500);
  });
});

describe("resultLinkOf", () => {
  it("a link only for a simulated text with a thread and a key", () => {
    const done = { kind: "done", value: 30 } as const;
    expect(resultLinkOf(done, "t1", "ungWv48Bz-", "hook")).toBe("/simulation/hook/t1/ungWv48Bz-");
    expect(resultLinkOf(done, "t1", "ungWv48Bz-", "opening")).toBe("/simulation/hook/t1/ungWv48Bz-?as=opening");
    expect(resultLinkOf(done, null, "ungWv48Bz-", "hook")).toBeNull();
    expect(resultLinkOf(done, "t1", undefined, "hook")).toBeNull();
    expect(resultLinkOf({ kind: "empty" }, "t1", "ungWv48Bz-", "hook")).toBeNull();
  });
});
