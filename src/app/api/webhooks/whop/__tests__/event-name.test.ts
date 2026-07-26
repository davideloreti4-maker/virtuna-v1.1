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
});
