/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { EditorActions, ErrorLine, SettingsRow } from "../row-parts";

afterEach(cleanup);

describe("SettingsRow: the page's last card", () => {
  it("alone: one row, Settings, to Settings", () => {
    render(<SettingsRow />);
    expect(screen.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([["Settings", "/settings"]]);
  });

  // Plan 2026-11-24-earn (ruling 10): Earn above Settings, its name and the chevron, nothing at the right.
  it("with Earn: Earn above Settings in the one card, each its name alone, each a row at least 64 tall", () => {
    const { container } = render(<SettingsRow earn />);
    const links = screen.getAllByRole("link");
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Earn", "/earn"],
      ["Settings", "/settings"],
    ]);
    for (const a of links) expect(a.className).toMatch(/(^|\s)min-h-16(\s|$)/);
    expect(container.children).toHaveLength(1);
  });

  it("the Settings row is the same markup with or without Earn", () => {
    render(<SettingsRow />);
    const alone = screen.getByRole("link", { name: "Settings" }).outerHTML;
    cleanup();
    render(<SettingsRow earn />);
    expect(screen.getByRole("link", { name: "Settings" }).outerHTML).toBe(alone);
  });
});

describe("EditorActions", () => {
  it("with nothing to save, Save waits and says so without leaving the tab order; Cancel still cancels", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<EditorActions busy={false} saveDisabled onSave={onSave} onCancel={onCancel} />);
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).not.toHaveAttribute("aria-busy");
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("the count sits at the left under the id a field can point at", () => {
    render(<EditorActions count="57 / 200" countId="about-count" busy={false} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("57 / 200")).toHaveAttribute("id", "about-count");
  });
});

describe("ErrorLine", () => {
  it("is announced, under the id a field can point at", () => {
    render(<ErrorLine id="about-error">{"Couldn't save. Try again."}</ErrorLine>);
    expect(screen.getByRole("alert")).toHaveAttribute("id", "about-error");
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save. Try again.");
  });
});
