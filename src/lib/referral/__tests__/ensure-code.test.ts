/**
 * ensureReferralCode (plan 2026-11-24-earn, step A; ruling 36): the loop the Settings page ran inline,
 * moved. The account's code, made on first view: read it; none, insert a new one, and try again (at most
 * five times in all) only when another account already holds that code (Postgres 23505). The read is the
 * caller's own (the session client); the write is the server's (the service client, for the id the caller
 * passes from the session).
 * Real: the function and the code generator. Stood in for: the database behind the two clients
 * (`fake-referral-db.ts`, with the session held to its own rows where a test says so). Every id and code is
 * made up.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { fakeReferralDb, type FakeReferralDb } from "@/lib/earn/__tests__/fake-referral-db";
import { CODE_ATTEMPTS, ensureReferralCode, referralLink } from "../ensure-code";

const USER = "acct-nia";
let db: FakeReferralDb;
type Client = Parameters<typeof ensureReferralCode>[0];
const session = () => db.sessionClient() as unknown as Client;
const service = () => db.serviceClient() as unknown as Client;
const ensure = () => ensureReferralCode(session(), USER, service);
const inserts = () => db.state.calls.filter((c) => c.table === "referral_codes" && c.op === "insert");
const CODE = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;

beforeEach(() => {
  db = fakeReferralDb();
});

describe("ensureReferralCode", () => {
  it("an account with a code: that code, nothing written, and no service client made", async () => {
    db.state.tables.referral_codes!.push({ id: "c1", user_id: USER, code: "K349Z4QP" });
    let made = 0;
    expect(
      await ensureReferralCode(session(), USER, () => {
        made += 1;
        return service();
      }),
    ).toBe("K349Z4QP");
    expect(made).toBe(0);
    expect(inserts()).toEqual([]);
    expect(db.state.calls).toEqual([expect.objectContaining({ table: "referral_codes", op: "select", columns: "code", filters: [["user_id", USER]], client: "session" })]);
  });

  it("an account without one: a new 8-character code is written for it and answered", async () => {
    const code = await ensure();
    expect(code).toMatch(CODE);
    expect(db.state.tables.referral_codes).toEqual([expect.objectContaining({ user_id: USER, code })]);
    expect(inserts()).toHaveLength(1);
    // A second view reads it back.
    expect(await ensure()).toBe(code);
    expect(inserts()).toHaveLength(1);
  });

  it("a code another account took first: tries a new code", async () => {
    db.state.codeTaken = 2;
    const code = await ensure();
    expect(code).toMatch(CODE);
    expect(inserts()).toHaveLength(3);
    const tried = inserts().map((c) => c.values!.code);
    expect(new Set(tried).size).toBe(3);
  });

  it(`gives up after ${CODE_ATTEMPTS} taken codes: null, nothing stored`, async () => {
    expect(CODE_ATTEMPTS).toBe(5);
    db.state.codeTaken = 99;
    expect(await ensure()).toBeNull();
    expect(inserts()).toHaveLength(5);
    expect(db.state.tables.referral_codes).toEqual([]);
  });

  it("any other refusal stops at once: null after one try", async () => {
    db.state.insertError = "42501";
    expect(await ensure()).toBeNull();
    expect(inserts()).toHaveLength(1);
  });
});

describe("who writes the code (ruling 36)", () => {
  it("the service client writes it, for the caller's id and nothing else; the session client only reads", async () => {
    const code = await ensure();
    expect(inserts()).toEqual([expect.objectContaining({ client: "service", values: { user_id: USER, code } })]);
    expect(db.state.calls.filter((c) => c.client === "session").map((c) => c.op)).toEqual(["select"]);
  });

  it("the row is written with the service client, with the session held to its own rows", async () => {
    db.state.sessionAs = USER;
    const code = await ensure();
    expect(code).toMatch(CODE);
    expect(inserts().map((c) => c.client)).toEqual(["service"]);
    // The session reads its own row back.
    expect(await ensure()).toBe(code);
  });

  it("where the table takes a new row from the service client only: a code is made all the same", async () => {
    db.state.sessionAs = USER;
    db.state.serverWritesOnly = true;
    const code = await ensure();
    expect(code).toMatch(CODE);
    expect(db.state.tables.referral_codes).toEqual([expect.objectContaining({ user_id: USER, code })]);
    expect(await ensure()).toBe(code);
  });

  it("no service client can be made (its settings are missing): null, nothing stored, nothing thrown", async () => {
    expect(
      await ensureReferralCode(session(), USER, () => {
        throw new Error("supabaseUrl is required.");
      }),
    ).toBeNull();
    expect(inserts()).toEqual([]);
    expect(db.state.tables.referral_codes).toEqual([]);
  });
});

describe("referralLink", () => {
  const saved = process.env.NEXT_PUBLIC_APP_URL;
  const restore = () => {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = saved;
  };

  it("is the app's address with ?ref=, as Settings has always built it", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://maven.example.test";
    try {
      expect(referralLink("K349Z4QP")).toBe("https://maven.example.test/?ref=K349Z4QP");
    } finally {
      restore();
    }
  });

  it("without an app address: the local one", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    try {
      expect(referralLink("K349Z4QP")).toBe("http://localhost:3000/?ref=K349Z4QP");
    } finally {
      restore();
    }
  });
});
