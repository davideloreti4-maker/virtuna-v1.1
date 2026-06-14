/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { Footer } from "@/components/layout/footer";

/**
 * NAV-02 unit coverage for the flat-warm marketing <Footer>.
 *
 * Behaviors under test (PLAN 01-05, UI-SPEC §Component Inventory item 3 +
 * Copywriting Contract):
 *  - NAV-02: renders the Numen brand (NumenLogo "Numen" wordmark) AND no longer
 *    carries any old "Artificial Societies" content.
 *  - NAV-02: provides in-page anchor links mirroring the header nav set
 *    (#how-it-works, #the-simulation, #pricing, #faq).
 *  - NAV-02: shows legal/social placeholders — Privacy, Terms, X, TikTok.
 *
 * These assertions encode the NEW contract and therefore FAIL against the old
 * societies footer (which used "Artificial Societies" + calendly "Book a meeting"
 * + founders@societies.io + a "Subprocessors" link + LinkedIn societies.io).
 * This is the RED step.
 */
describe("<Footer>", () => {
  describe("brand (NAV-02)", () => {
    it("renders the NumenLogo via the 'Numen' wordmark", () => {
      render(<Footer />);
      // The NumenLogo wordmark renders the brand text "Numen".
      expect(screen.getAllByText("Numen").length).toBeGreaterThanOrEqual(1);
    });

    it("contains no old 'Artificial Societies' content", () => {
      render(<Footer />);
      expect(screen.queryByText(/artificial societies/i)).toBeNull();
    });
  });

  describe("in-page anchor mirror (NAV-02)", () => {
    it.each([
      ["#how-it-works"],
      ["#the-simulation"],
      ["#pricing"],
      ["#faq"],
    ])("links to the nav anchor %s", (anchor) => {
      render(<Footer />);
      const links = screen
        .getAllByRole("link")
        .filter((el) => el.getAttribute("href") === anchor);
      expect(links.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("legal/social placeholders (NAV-02)", () => {
    it.each([["Privacy"], ["Terms"], ["X"], ["TikTok"]])(
      "renders the %s placeholder label",
      (label) => {
        render(<Footer />);
        expect(
          screen.getByText(new RegExp(`^${label}$`))
        ).toBeInTheDocument();
      }
    );
  });
});
