/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NEW_THREAD_SENTINEL,
  clearActiveThreadCookie,
  setActiveThreadCookie,
} from "@/lib/threads/active-thread-cookie";

// The build-time flag, switchable per test (a getter, so the module reads it at call time).
let newLook = true;
vi.mock("@/lib/flags/new-look", () => ({
  get NEW_LOOK_ENABLED() {
    return newLook;
  },
}));

import { opensIntoThread } from "../opens-into-thread";

afterEach(() => {
  newLook = true;
  clearActiveThreadCookie();
});

describe("opensIntoThread: /home starts on a chat's load, not on Home", () => {
  it("new look, the pointer is a thread id: yes", () => {
    setActiveThreadCookie("t1");
    expect(opensIntoThread()).toBe(true);
  });

  it("new look, no pointer (the server opens the newest chat, if there is one): yes", () => {
    clearActiveThreadCookie();
    expect(opensIntoThread()).toBe(true);
  });

  it("new look, a blank new chat (the sentinel): no", () => {
    setActiveThreadCookie(NEW_THREAD_SENTINEL);
    expect(opensIntoThread()).toBe(false);
  });

  it("flag off: never", () => {
    newLook = false;
    setActiveThreadCookie("t1");
    expect(opensIntoThread()).toBe(false);
    clearActiveThreadCookie();
    expect(opensIntoThread()).toBe(false);
  });
});
