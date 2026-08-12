/** @vitest-environment happy-dom */

/**
 * The standing offline condition.
 *
 * Two things here are easy to get wrong and expensive to get wrong:
 *  - it must not be an ALERT (being offline is a condition you are living in, not an event), and
 *  - it must carry no accent. This is exactly where a red fill feels natural, and the accent
 *    dosage rule is LOCKED — the sanctioned uses are the live-presence dot, the lit constellation
 *    node and the brand mark. Severity is carried by the words.
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";

import { OfflineNotice } from "@/components/app/offline-notice";

afterEach(() => {
  cleanup();
  Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
});

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value, configurable: true });
}

describe("OfflineNotice", () => {
  it("renders nothing at all while online — zero chrome for the normal case", () => {
    setOnLine(true);
    const { container } = render(<OfflineNotice />);
    expect(container.firstChild).toBeNull();
  });

  it("appears when the connection drops and says what it means", () => {
    setOnLine(false);
    render(<OfflineNotice />);
    expect(screen.getByRole("status").textContent).toMatch(/offline/i);
  });

  it("is polite, not an alert — a standing condition, not an event to interrupt with", () => {
    setOnLine(false);
    render(<OfflineNotice />);
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
  });

  it("disappears the moment the connection returns", () => {
    setOnLine(false);
    render(<OfflineNotice />);
    expect(screen.queryByRole("status")).toBeTruthy();

    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event("online"));
    });

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("carries NO accent — the dosage rule is locked", () => {
    setOnLine(false);
    const { container } = render(<OfflineNotice />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/#FF6363/i);
    expect(html).not.toMatch(/--color-accent/);
    expect(html).not.toMatch(/#fff\b/i);
    expect(html).not.toMatch(/\bbg-red|text-red|border-red/);
  });

  /**
   * The offset is set as a custom property ON THE ELEMENT, not inherited.
   * `--mobile-nav-band` is declared inline on <main> (app-shell.tsx:172), so it reaches only
   * <main>'s descendants — a notice mounted anywhere else resolves it to nothing and the
   * fallback silently becomes 0, which reads as "fine" on desktop and covers the mobile
   * hamburger. Owning the value removes the dependency on where this is mounted.
   */
  it("owns its own top offset so it cannot depend on where it is mounted", () => {
    setOnLine(false);
    render(<OfflineNotice />);
    const el = screen.getByRole("status");
    expect(el.style.getPropertyValue("--offline-notice-top").trim()).not.toBe("");
  });

  it("does not sit at the bottom — the composer dock lives there", () => {
    setOnLine(false);
    render(<OfflineNotice />);
    // composer.tsx:3535 renders the dock at `absolute inset-x-0 bottom-0`; a bottom bar would
    // cover the send button whose disabled state this notice exists to explain.
    expect(screen.getByRole("status").className).not.toMatch(/\bbottom-0\b/);
  });
});
