/**
 * The seal map after the composer re-reads a thread's seals (thread answers step 1, Task 6).
 *
 * A reload's read can predate the server's write of a seal the client has just merged (a gauge's
 * run that ended while the read was in flight). For the same thread the server's map is merged over
 * the client's, so that seal is not wiped and its row does not look empty and fire again. For
 * another thread the server's map replaces it: one thread's numbers never show in another.
 */
import { describe, expect, it } from "vitest";

import { reloadedSeals } from "../seal-reload";

const seal = (stopPct: number) => ({ fraction: "", scrollQuote: "", personas: [], population: { stopPct } });

describe("reloadedSeals", () => {
  it("the same thread: keeps a seal the read did not hold yet, and takes the server's for the rest", () => {
    const prev = { "hook one": seal(30), "hook two": seal(10) };
    const fromServer = { "hook two": seal(22), "hook three": seal(45) };
    expect(reloadedSeals(prev, fromServer, true)).toEqual({ "hook one": seal(30), "hook two": seal(22), "hook three": seal(45) });
  });

  it("another thread: the server's map alone", () => {
    expect(reloadedSeals({ "hook one": seal(30) }, { "hook three": seal(45) }, false)).toEqual({ "hook three": seal(45) });
    expect(reloadedSeals({ "hook one": seal(30) }, {}, false)).toEqual({});
  });
});
