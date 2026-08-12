/** @vitest-environment happy-dom */

/**
 * ⚠️ EVERY QUERY HERE GOES THROUGH `screen` / `document.body`, NEVER THROUGH `container`.
 *
 * Radix renders dialog content into a PORTAL on `document.body`, so `container.firstChild` is
 * null and `container.innerHTML` is `""` whether the dialog is open or not. Asserting "renders
 * nothing" or "carries no accent" against `container` is an assertion whose precondition makes
 * the outcome inevitable — it passes against a component that renders a screaming coral modal.
 * Both were written that way first; both were rewritten after the open-state check below proved
 * they could not fail.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";

import { SessionExpiredListener } from "@/components/app/session-expired-listener";
import { SESSION_EXPIRED_EVENT, raiseSessionExpired } from "@/lib/auth/session-expired";

afterEach(cleanup);

function raise() {
  act(() => {
    raiseSessionExpired();
  });
}

describe("SessionExpiredListener", () => {
  it("renders nothing until the session actually dies", () => {
    render(<SessionExpiredListener />);
    // Queried on document.body, so this genuinely fails if the dialog mounts open.
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("explains what happened and offers a way back", () => {
    render(<SessionExpiredListener />);
    raise();

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toMatch(/signed out|session/i);
    expect(screen.getByRole("link", { name: /sign in/i })).toBeTruthy();
  });

  it("says nothing was charged, because nothing was", () => {
    render(<SessionExpiredListener />);
    raise();
    expect(screen.getByRole("dialog").textContent).toMatch(/nothing was charged/i);
  });

  /**
   * The listener is the ONLY thing standing between the user and their unsent draft. It must not
   * navigate on its own — AuthGuard is the declared single owner of that (WR-04) — so the way to
   * /login is a link the user chooses.
   */
  it("offers /login as a link, and never navigates on its own", () => {
    render(<SessionExpiredListener />);
    raise();

    const link = screen.getByRole("link", { name: /sign in/i });
    expect(link.getAttribute("href")).toContain("/login");
    // A real anchor, not a button dressed as one: nothing here calls router.replace.
    expect(link.tagName).toBe("A");
  });

  /**
   * DISMISSIBLE ON PURPOSE. The whole reason this refuses to navigate is that a route change
   * unmounts the composer and destroys a draft that lives only in local `useState`. A modal the
   * user cannot close puts that draft behind glass — visible, unreachable, uncopyable. Closing
   * is how they get back to it.
   */
  it("can be dismissed, so the draft it exists to protect is reachable", () => {
    render(<SessionExpiredListener />);
    raise();
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", code: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("comes back if a later request is refused too", () => {
    render(<SessionExpiredListener />);
    raise();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", code: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    raise();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  /**
   * Accent dosage is LOCKED: monochrome by default, and the sanctioned uses are the live-presence
   * dot, the lit constellation node and the brand mark. A session dialog is none of them, and it
   * is exactly the sort of surface where a red "alert" fill feels natural. Severity is carried by
   * the words.
   *
   * Asserted on CLASS NAMES rather than computed colour: no stylesheet is loaded here, so every
   * computed background would read as transparent and a `bg-accent` would sail through.
   */
  it("carries no accent anywhere in the dialog", () => {
    render(<SessionExpiredListener />);
    raise();

    const dialog = screen.getByRole("dialog");
    const offenders: string[] = [];
    for (const el of [dialog, ...Array.from(dialog.querySelectorAll("*"))]) {
      const cls = el.getAttribute("class") ?? "";
      if (/accent|coral|signal/i.test(cls)) offenders.push(cls);
      const style = el.getAttribute("style") ?? "";
      if (/#FF6363|#FF7F50|#d97757/i.test(style)) offenders.push(style);
    }
    expect(offenders, `accent found in the session dialog: ${offenders.join(" | ")}`).toEqual([]);
  });

  /**
   * Asserted against the LISTENER REGISTRY, not against what is on screen — the same correction
   * `use-online.test.ts` already carries for the same reason.
   *
   * The obvious version — unmount, dispatch, expect no dialog — is worthless: once the component
   * is unmounted there is nothing to render whether or not the handler leaked, so the assertion
   * cannot observe the leak it claims to guard. Mutation-tested: replacing the cleanup with a
   * bare `return;` left that version green.
   */
  it("removes its listener on unmount — the leak is invisible from the rendered output", () => {
    // `vi.spyOn` calls through, so the component still behaves normally while every add/remove
    // is recorded.
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const types = (spy: typeof addSpy) => spy.mock.calls.map(([type]) => type);

    const { unmount } = render(<SessionExpiredListener />);
    expect(types(addSpy)).toContain(SESSION_EXPIRED_EVENT);

    unmount();
    expect(types(removeSpy)).toContain(SESSION_EXPIRED_EVENT);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
