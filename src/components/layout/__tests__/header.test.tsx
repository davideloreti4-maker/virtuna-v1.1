/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Header } from "@/components/layout/header";

/**
 * NAV-01 + NAV-03 unit coverage for the flat-matte marketing <Header>.
 *
 * Behaviors under test (PLAN 01-04, UI-SPEC §Component Inventory item 2):
 *  - NAV-01: renders the NumenLogo ("Numen" wordmark) brand
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
    it("renders the NumenLogo via the 'Numen' wordmark", () => {
      render(<Header />);
      // The NumenLogo wordmark renders the brand text "Numen".
      expect(screen.getAllByText("Numen").length).toBeGreaterThanOrEqual(1);
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
});
