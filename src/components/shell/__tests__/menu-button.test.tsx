/** @vitest-environment happy-dom */
/**
 * The drawer's opener: a plain button that reads the shell store only (no query, no provider, no
 * request) and opens the drawer through it. Real store, nothing stood in.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useShellStore } from "@/stores/shell-store";
import { OPENER_SELECTOR } from "../drawer";
import { MenuButton } from "../menu-button";

const opener = () => screen.getByRole("button", { name: "Open menu" });

beforeEach(() => {
  useShellStore.setState({ drawerOpen: false, accountFace: null });
});

describe("MenuButton", () => {
  it("picture: a button named Open menu with the shell's face", () => {
    useShellStore.setState({ accountFace: { picture: null, initials: "NL" } });
    render(<MenuButton variant="picture" />);
    const button = opener();
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(button.textContent).toBe("NL");
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).toHaveAttribute("aria-expanded", "false");
    // The 36 round picture inside a 44 touch area, as Home's picture is drawn today. A flex box, so
    // the button is the circle's 36 whatever the circle holds (no line box under a picture).
    expect(button.className.split(/\s+/)).toEqual(expect.arrayContaining(["flex", "tap-44", "shrink-0", "rounded-full"]));
    const circle = button.firstElementChild as HTMLElement;
    expect(circle.className.split(/\s+/)).toEqual(expect.arrayContaining(["h-9", "w-9", "rounded-full"]));

    act(() => useShellStore.getState().openDrawer());
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("picture: an empty circle until the face is published, and face draws as given", () => {
    const view = render(<MenuButton variant="picture" />);
    expect(opener().textContent).toBe("");
    expect(opener().firstElementChild).not.toBeNull();

    act(() => useShellStore.getState().setAccountFace({ picture: null, initials: "NL" }));
    expect(opener().textContent).toBe("NL");
    view.unmount();

    // Given a face, it draws that one and not the shell's (a preview or a screen test has no shell).
    render(<MenuButton variant="picture" face={{ picture: null, initials: "JM" }} />);
    expect(opener().textContent).toBe("JM");
  });

  it("lines: the 38 square button with three lines, no text, the same name and state", () => {
    useShellStore.setState({ accountFace: { picture: null, initials: "NL" } });
    render(<MenuButton variant="lines" />);
    const button = opener();
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    // No text node: the band's tests read its textContent; the shell's face is not drawn here.
    expect(button.textContent).toBe("");
    // Back's 38 button: a rounded square since 2026-11-26 (radius 8, Claude-like), not a circle.
    expect(button.className.split(/\s+/)).toEqual(expect.arrayContaining(["h-[38px]", "w-[38px]", "rounded-lg"]));
    expect(button.className.split(/\s+/)).not.toContain("rounded-full");
    const svg = button.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    const paths = Array.from(svg.querySelectorAll("path"), (path) => path.getAttribute("d"));
    expect(paths).toEqual(["M5 7h14M5 12h14M5 17h14"]);
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).toHaveAttribute("aria-expanded", "false");

    act(() => useShellStore.getState().openDrawer());
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it.each(["picture", "lines"] as const)("a tap opens the drawer (%s)", (variant) => {
    render(<MenuButton variant={variant} />);
    fireEvent.click(opener());
    expect(useShellStore.getState().drawerOpen).toBe(true);
    // A second tap does not close it: only the drawer closes itself.
    fireEvent.click(opener());
    expect(useShellStore.getState().drawerOpen).toBe(true);
  });

  it.each(["picture", "lines"] as const)("both are phone only and carry the opener mark (%s)", (variant) => {
    render(<MenuButton variant={variant} />);
    const button = opener();
    expect(button.className.split(/\s+/)).toContain("md:hidden");
    expect(button.matches(OPENER_SELECTOR)).toBe(true);
  });
});
