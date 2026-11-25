/** @vitest-environment happy-dom */
/**
 * use-edit-open.test.tsx — whether the editor is open to the account (plan 2026-11-24-editor-screens-a, Task 16; E11): the real
 * hook under a real query client. Stood in: the network (`fetch`) and the look's flag.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const look = vi.hoisted(() => ({ next: true }));
vi.mock("@/lib/flags/new-look", () => ({
  get NEW_LOOK_ENABLED() {
    return look.next;
  },
}));

import { useEditOpen } from "../use-edit-open";

let answers: Array<() => Response | Promise<Response>> = [];
let asked = 0;
const says = (open: boolean) => () => new Response(JSON.stringify({ open }), { status: 200 });
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });

/** One session's client, as the app has one: the hook mounted twice under it is two screens of one session. */
function session() {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return () => renderHook(() => useEditOpen(), { wrapper });
}

beforeEach(() => {
  look.next = true;
  answers = [];
  asked = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    expect(String(input)).toBe("/api/edit/open");
    asked += 1;
    const next = answers.shift();
    if (!next) throw new Error("asked more often than the test answers");
    return next();
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useEditOpen", () => {
  it("is closed until the route answers, then what it answers, asked once a session", async () => {
    answers = [says(true)];
    const mount = session();
    const first = mount();
    expect(first.result.current).toBe(false);
    await waitFor(() => expect(first.result.current).toBe(true));
    first.unmount();
    expect(mount().result.current).toBe(true);
    expect(asked).toBe(1);
  });

  it("stays closed for an account the route says it is not open to, and does not ask again", async () => {
    answers = [says(false)];
    const mount = session();
    const first = mount();
    await waitFor(() => expect(asked).toBe(1));
    await settle();
    expect(first.result.current).toBe(false);
    first.unmount();
    const second = mount();
    await settle();
    expect(second.result.current).toBe(false);
    expect(asked).toBe(1);
  });

  it("is closed while it could not be asked, and that is no answer: the next screen asks again", async () => {
    answers = [() => new Response(JSON.stringify({ error: "the sign-in service could not be reached; try again" }), { status: 503 }), says(true)];
    const mount = session();
    const first = mount();
    await waitFor(() => expect(asked).toBe(1));
    await settle();
    expect(first.result.current).toBe(false);
    first.unmount();
    const second = mount();
    await waitFor(() => expect(second.result.current).toBe(true));
    expect(asked).toBe(2);
  });

  it("is closed when the route cannot be reached at all", async () => {
    answers = [() => Promise.reject(new TypeError("Failed to fetch"))];
    const { result } = session()();
    await waitFor(() => expect(asked).toBe(1));
    await settle();
    expect(result.current).toBe(false);
  });

  it("asks nothing with the new look off, and is closed", async () => {
    look.next = false;
    const { result } = session()();
    await settle();
    expect(result.current).toBe(false);
    expect(asked).toBe(0);
  });
});
