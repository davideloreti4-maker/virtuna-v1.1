import { describe, it, expect } from "vitest";
import { normalizeEventName } from "../route";

/**
 * Whop's event naming is inconsistent in two directions at once, both confirmed against the
 * LIVE API on 2026-07-26 (the published docs were wrong about this twice):
 *
 *   - the payload may carry the name under `event` OR `action`
 *   - the name may be underscored (`membership_went_valid`, which is the only spelling the
 *     webhook subscription API accepts) or dotted (`membership.went_valid`, the historical
 *     payload spelling). One real webhook came back holding BOTH conventions at once:
 *     `["membership_went_valid", "membership_went_invalid", "payment.failed"]`.
 *
 * Every one of these must land on the same switch case. A miss is silent: a signed, valid
 * delivery that grants nothing, which is exactly how a customer pays and gets no access.
 */

describe("normalizeEventName", () => {
  it("passes dotted names through unchanged", () => {
    expect(normalizeEventName({ event: "membership.went_valid" })).toBe("membership.went_valid");
    expect(normalizeEventName({ event: "payment.failed" })).toBe("payment.failed");
  });

  it("folds the underscored subscription spelling to the dotted one", () => {
    expect(normalizeEventName({ event: "membership_went_valid" })).toBe("membership.went_valid");
    expect(normalizeEventName({ event: "membership_went_invalid" })).toBe("membership.went_invalid");
    expect(normalizeEventName({ event: "payment_failed" })).toBe("payment.failed");
  });

  it("reads the legacy `action` key when `event` is absent", () => {
    expect(normalizeEventName({ action: "membership.went_valid" })).toBe("membership.went_valid");
    expect(normalizeEventName({ action: "membership_went_valid" })).toBe("membership.went_valid");
  });

  it("prefers `event` when both keys are present", () => {
    expect(
      normalizeEventName({ event: "payment.failed", action: "membership.went_valid" })
    ).toBe("payment.failed");
  });

  it("folds ONLY the first underscore — the rest of the name is not a separator", () => {
    // `membership.cancel_at_period_end_changed`, never `membership.cancel.at.period.end.changed`
    expect(normalizeEventName({ event: "membership_cancel_at_period_end_changed" })).toBe(
      "membership.cancel_at_period_end_changed"
    );
  });

  it("returns an empty string for a missing or non-string name rather than throwing", () => {
    expect(normalizeEventName({})).toBe("");
    expect(normalizeEventName({ event: undefined })).toBe("");
    expect(normalizeEventName({ event: "" })).toBe("");
    expect(normalizeEventName({ event: 42 })).toBe("");
    expect(normalizeEventName({ event: null })).toBe("");
  });

  it("maps every spelling Whop could send to one of the three handled cases", () => {
    const HANDLED = new Set([
      "membership.went_valid",
      "membership.went_invalid",
      "payment.failed",
    ]);
    const asWhopMightSend = [
      { event: "membership_went_valid" },
      { event: "membership.went_valid" },
      { action: "membership_went_valid" },
      { action: "membership.went_valid" },
      { event: "membership_went_invalid" },
      { action: "membership.went_invalid" },
      { event: "payment_failed" },
      { event: "payment.failed" },
    ];
    for (const p of asWhopMightSend) {
      expect(HANDLED.has(normalizeEventName(p))).toBe(true);
    }
  });

  /**
   * The v2 delivery puts the name under `type`. Observed on a real purchase 2026-07-27:
   * payload keys were ["id","api_version","timestamp","data","type","company_id"] — no
   * `event`, no `action`. Reading only those two yielded "", fell through to `default:`,
   * and answered 200 {received:true} having granted nothing. The customer had paid, the
   * signature had verified, and every layer reported success.
   */
  it("reads the v2 `type` key", () => {
    expect(normalizeEventName({ type: "membership_went_valid" })).toBe(
      "membership.went_valid"
    );
    expect(normalizeEventName({ type: "membership.went_valid" })).toBe(
      "membership.went_valid"
    );
  });

  it("keeps `event` and `action` ahead of `type` so existing payloads do not change meaning", () => {
    expect(
      normalizeEventName({ event: "membership_went_invalid", type: "payment.succeeded" })
    ).toBe("membership.went_invalid");
    expect(
      normalizeEventName({ action: "membership_went_invalid", type: "payment.succeeded" })
    ).toBe("membership.went_invalid");
  });

  it("resolves the exact real-world v2 payload to a HANDLED case", () => {
    // Shape as delivered by Whop for the trial purchase that granted nothing.
    const real = {
      id: "evt_x",
      api_version: "v2",
      timestamp: 1785000000,
      company_id: "biz_LyBwGuDUAoMFco",
      type: "membership_went_valid",
      data: {
        id: "mem_kov2c6GxbY3d31",
        status: "trialing",
        plan: { id: "plan_OTX4xMIHYyDoY" },
        product: { id: "prod_zNxqka5RmfYSe" },
        metadata: { supabase_user_id: "cab41c2e-63ae-414e-be94-c1f6074bd676" },
        renewal_period_end: "2026-07-30T10:19:45.367Z",
      },
    };
    // The three cases the switch actually handles.
    const handled = new Set([
      "membership.went_valid",
      "membership.went_invalid",
      "payment.failed",
    ]);
    expect(handled.has(normalizeEventName(real))).toBe(true);
  });
});
