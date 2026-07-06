/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Header } from "@/components/layout/header";

/**
 * NAV-01 + NAV-03 unit coverage for the flat-matte marketing <Header>.
 *
 * Behaviors under test (PLAN 01-04, UI-SPEC §Component Inventory item 2):
 *  - NAV-01: renders the MavenLogo ("Maven" wordmark) brand
 *  - NAV-01: "Try it free" CTA href is exactly /signup (SIGNUP_URL)
 *  - NAV-01: "Sign in" link href is exactly /login (LOGIN_URL)
 *  - NAV-03: a mobile menu toggle (aria-label="Open menu") opens a flat panel
 *  - NAV-03: tapping a link inside the panel closes it (closes on tap)
 *
 * These assertions encode the NEW contract and therefore FAIL against the old
 * glass societies header (which used "Book a Meeting"→calendly + Sign in→/auth/login
 * + an aria-label="Toggle navigation menu" trigger). This is the RED step.
 */
describe("<Header>", () => {
  describe("brand (NAV-01)", () => {
    it("renders the MavenLogo via the 'Maven' wordmark", () => {
      render(<Header />);
      // The MavenLogo wordmark renders the brand text "Maven".
      expect(screen.getAllByText("Maven").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("CTA + auth hrefs (NAV-01)", () => {
    it("'Try it free' is a link whose href is exactly /signup", () => {
      render(<Header />);
      const cta = screen.getByRole("link", { name: /try it free/i });
      expect(cta).toHaveAttribute("href", "/signup");
    });

    it("'Sign in' is a link whose href is exactly /login", () => {
      render(<Header />);
      const signIn = screen.getByRole("link", { name: /sign in/i });
      expect(signIn).toHaveAttribute("href", "/login");
    });
  });

  describe("mobile collapse (NAV-03)", () => {
    it("renders a menu toggle with aria-label='Open menu'", () => {
      render(<Header />);
      expect(
        screen.getByRole("button", { name: /open menu/i })
      ).toBeInTheDocument();
    });

    it("opens a nav panel when the toggle is clicked", async () => {
      const user = userEvent.setup();
      render(<Header />);

      // The disclosure panel is not present before the toggle is clicked.
      expect(screen.queryByTestId("mobile-nav-panel")).toBeNull();

      await user.click(screen.getByRole("button", { name: /open menu/i }));

      // After clicking, the flat panel appears and the trigger flips to "Close menu".
      expect(screen.getByTestId("mobile-nav-panel")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /close menu/i })
      ).toBeInTheDocument();
    });

    it("closes the panel when a nav link inside it is tapped (closes on tap)", async () => {
      const user = userEvent.setup();
      render(<Header />);

      await user.click(screen.getByRole("button", { name: /open menu/i }));
      const panel = screen.getByTestId("mobile-nav-panel");
      expect(panel).toBeInTheDocument();

      // Tap a nav link within the open panel.
      const panelLink = within(panel).getByRole("link", {
        name: /how it works/i,
      });
      await user.click(panelLink);

      // The panel collapses (open → closed transition).
      expect(screen.queryByTestId("mobile-nav-panel")).toBeNull();
    });
  });

  /**
   * GAP-4 / WR-02 / WR-03 — accessible mobile disclosure.
   * Escape-to-close, focus trap while open, focus restore to the trigger on
   * close, and a non-destructive body scroll-lock that saves/restores the prior
   * overflow value (no bare `= ""` clobber).
   */
  describe("mobile a11y — Escape / focus / scroll-lock (GAP-4, WR-02, WR-03)", () => {
    it("closes the panel and flips the trigger back to 'Open menu' when Escape is pressed", async () => {
      const user = userEvent.setup();
      render(<Header />);

      await user.click(screen.getByRole("button", { name: /open menu/i }));
      expect(screen.getByTestId("mobile-nav-panel")).toBeInTheDocument();

      await user.keyboard("{Escape}");

      // The panel collapses and the trigger reverts to "Open menu".
      expect(screen.queryByTestId("mobile-nav-panel")).toBeNull();
      expect(
        screen.getByRole("button", { name: /open menu/i })
      ).toBeInTheDocument();
    });

    it("restores focus to the trigger button after closing via Escape", async () => {
      const user = userEvent.setup();
      render(<Header />);

      const trigger = screen.getByRole("button", { name: /open menu/i });
      await user.click(trigger);
      expect(screen.getByTestId("mobile-nav-panel")).toBeInTheDocument();

      await user.keyboard("{Escape}");

      // Focus returns to the (now "Open menu") trigger button.
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: /open menu/i })
      );
    });

    it("restores focus to the trigger button after closing via a link tap", async () => {
      const user = userEvent.setup();
      render(<Header />);

      const trigger = screen.getByRole("button", { name: /open menu/i });
      await user.click(trigger);
      const panel = screen.getByTestId("mobile-nav-panel");

      await user.click(
        within(panel).getByRole("link", { name: /how it works/i })
      );

      expect(screen.queryByTestId("mobile-nav-panel")).toBeNull();
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: /open menu/i })
      );
    });

    it("traps focus inside the panel — Tab from the last focusable wraps to the first", async () => {
      const user = userEvent.setup();
      render(<Header />);

      await user.click(screen.getByRole("button", { name: /open menu/i }));
      const panel = screen.getByTestId("mobile-nav-panel");

      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>("a[href], button")
      );
      expect(focusables.length).toBeGreaterThan(1);
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;

      // Park focus on the last focusable, then Tab — focus must wrap to the first
      // and never escape the panel container.
      last.focus();
      expect(document.activeElement).toBe(last);
      await user.tab();
      expect(document.activeElement).toBe(first);
      expect(panel.contains(document.activeElement)).toBe(true);

      // Shift+Tab from the first wraps back to the last (still inside the panel).
      await user.tab({ shift: true });
      expect(document.activeElement).toBe(last);
      expect(panel.contains(document.activeElement)).toBe(true);
    });

    it("saves and restores the prior body overflow value (WR-02 — no clobber)", async () => {
      const user = userEvent.setup();
      // Simulate a pre-existing scroll-lock owner.
      document.body.style.overflow = "scroll";
      render(<Header />);

      await user.click(screen.getByRole("button", { name: /open menu/i }));
      // While open the body is locked.
      expect(document.body.style.overflow).toBe("hidden");

      await user.keyboard("{Escape}");
      // On close the PRIOR value is restored — not clobbered to "".
      expect(document.body.style.overflow).toBe("scroll");

      // Cleanup so the global body style does not leak to other tests.
      document.body.style.overflow = "";
    });
  });
});
