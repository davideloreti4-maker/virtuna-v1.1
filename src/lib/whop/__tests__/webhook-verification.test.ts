import { describe, it, expect, vi, afterEach } from "vitest";
import { createHmac } from "crypto";
import { verifyWebhookSignature } from "../webhook-verification";

/**
 * Whop signs webhooks with **Standard Webhooks**: the UNPREFIXED `webhook-id`,
 * `webhook-timestamp`, `webhook-signature` headers.
 *
 * This module previously read `svix-id` / `svix-timestamp` / `svix-signature` ONLY. Against
 * a real Whop delivery all three resolved to "", so verification failed and the route
 * answered 401 to every webhook — meaning a customer could complete a purchase and never be
 * granted their tier. There was no test file at all, so nothing caught it.
 *
 * The signing construction itself was always correct (Standard Webhooks is the spec Svix
 * donated — same `{id}.{timestamp}.{body}` content, same base64-decoded secret, same `v1,`
 * prefixed base64 HMAC-SHA256), so these tests pin the HEADER NAMES above all.
 */

const SECRET_BODY = "c3VwZXJzZWNyZXR2YWx1ZWZvcnRlc3Rpbmcx"; // base64
const SECRET = `whsec_${SECRET_BODY}`;
const PAYLOAD = JSON.stringify({ event: "membership.activated", data: { id: "mem_1" } });
const WEBHOOK_ID = "msg_2abc";

/** Sign exactly the way Whop does. */
function sign(id: string, timestamp: number, payload: string, secret = SECRET_BODY) {
  const mac = createHmac("sha256", Buffer.from(secret, "base64"))
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64");
  return `v1,${mac}`;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("verifyWebhookSignature — header naming", () => {
  it("accepts Whop's Standard Webhooks headers (webhook-*)", () => {
    const ts = nowSeconds();
    const headers = new Headers({
      "webhook-id": WEBHOOK_ID,
      "webhook-timestamp": String(ts),
      "webhook-signature": sign(WEBHOOK_ID, ts, PAYLOAD),
    });

    expect(verifyWebhookSignature(PAYLOAD, headers, SECRET)).toBe(true);
  });

  it("still accepts legacy svix-* headers", () => {
    const ts = nowSeconds();
    const headers = new Headers({
      "svix-id": WEBHOOK_ID,
      "svix-timestamp": String(ts),
      "svix-signature": sign(WEBHOOK_ID, ts, PAYLOAD),
    });

    expect(verifyWebhookSignature(PAYLOAD, headers, SECRET)).toBe(true);
  });

  it("accepts a plain record as well as a Headers object", () => {
    const ts = nowSeconds();
    const headers = {
      "webhook-id": WEBHOOK_ID,
      "webhook-timestamp": String(ts),
      "webhook-signature": sign(WEBHOOK_ID, ts, PAYLOAD),
    };

    expect(verifyWebhookSignature(PAYLOAD, headers, SECRET)).toBe(true);
  });

  it("works with or without the whsec_ prefix on the secret", () => {
    const ts = nowSeconds();
    const headers = new Headers({
      "webhook-id": WEBHOOK_ID,
      "webhook-timestamp": String(ts),
      "webhook-signature": sign(WEBHOOK_ID, ts, PAYLOAD),
    });

    expect(verifyWebhookSignature(PAYLOAD, headers, SECRET_BODY)).toBe(true);
  });
});

describe("verifyWebhookSignature — fails closed", () => {
  it("rejects when the signature headers are absent entirely", () => {
    expect(verifyWebhookSignature(PAYLOAD, new Headers(), SECRET)).toBe(false);
  });

  it("rejects a signature computed over a DIFFERENT body", () => {
    const ts = nowSeconds();
    const headers = new Headers({
      "webhook-id": WEBHOOK_ID,
      "webhook-timestamp": String(ts),
      "webhook-signature": sign(WEBHOOK_ID, ts, '{"event":"tampered"}'),
    });

    expect(verifyWebhookSignature(PAYLOAD, headers, SECRET)).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    const ts = nowSeconds();
    const headers = new Headers({
      "webhook-id": WEBHOOK_ID,
      "webhook-timestamp": String(ts),
      "webhook-signature": sign(WEBHOOK_ID, ts, PAYLOAD, "b3RoZXJzZWNyZXR2YWx1ZQ=="),
    });

    expect(verifyWebhookSignature(PAYLOAD, headers, SECRET)).toBe(false);
  });

  it("rejects a replayed delivery older than the 5-minute tolerance", () => {
    const ts = nowSeconds() - 400; // beyond the 300s window
    const headers = new Headers({
      "webhook-id": WEBHOOK_ID,
      "webhook-timestamp": String(ts),
      "webhook-signature": sign(WEBHOOK_ID, ts, PAYLOAD),
    });

    expect(verifyWebhookSignature(PAYLOAD, headers, SECRET)).toBe(false);
  });

  it("rejects an unparseable timestamp rather than treating it as epoch 0", () => {
    const headers = new Headers({
      "webhook-id": WEBHOOK_ID,
      "webhook-timestamp": "not-a-number",
      "webhook-signature": sign(WEBHOOK_ID, nowSeconds(), PAYLOAD),
    });

    expect(verifyWebhookSignature(PAYLOAD, headers, SECRET)).toBe(false);
  });

  it("rejects a header carrying no v1 signature", () => {
    const ts = nowSeconds();
    const headers = new Headers({
      "webhook-id": WEBHOOK_ID,
      "webhook-timestamp": String(ts),
      "webhook-signature": "v0,deadbeef",
    });

    expect(verifyWebhookSignature(PAYLOAD, headers, SECRET)).toBe(false);
  });
});
