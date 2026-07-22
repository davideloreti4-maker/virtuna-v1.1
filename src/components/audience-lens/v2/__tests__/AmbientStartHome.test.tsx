/** @vitest-environment happy-dom */
/**
 * AmbientStartHome — the v2 Start surface mounted as the real empty-home hero.
 *
 * Locks the integration: the creator's name (profile) + the active audience flow through
 * `buildStartData` → the rendered Start, showing the REAL skill menu (SKILL_RUN_META ids) — and a
 * skill tile / composer submit routes to the passed handlers (the composer's real run path).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock("@/hooks/queries/use-profile", () => ({
  useProfile: () => ({ data: { name: "Davide Loreti" } }),
}));

import { AmbientStartHome } from "../AmbientStartHome";
import { GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";

afterEach(cleanup);

describe("AmbientStartHome", () => {
  it("renders the real first name + the categorized skill grid as the default surface", () => {
    const { container } = render(
      <AmbientStartHome audience={GENERAL_AUDIENCE} onSkill={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(container.textContent).toContain("Davide"); // first name (mapped via profile → buildStartData)
    // the grid IS the default Start — the verb groups + skills are visible, no modal/button
    expect(screen.getByText("Make")).toBeTruthy(); // group label (CSS-uppercased; DOM text is "Make")
    expect(screen.getByText("Hooks")).toBeTruthy();
    expect(screen.getByText("Explore")).toBeTruthy();
    expect(screen.queryByText("What would you like to make?")).toBeNull();
  });

  it("picking a skill tile arms it via the handler (option B → the composer)", () => {
    const onSkill = vi.fn();
    render(<AmbientStartHome audience={GENERAL_AUDIENCE} onSkill={onSkill} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText("Hooks"));
    expect(onSkill).toHaveBeenCalledWith("hooks");
  });
});
