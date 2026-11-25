/** @vitest-environment happy-dom */
/**
 * posted-preview.test.tsx — the preview as it will be posted, the overlay alone (spec E17; plan 2026-11-25-editor-screens-b,
 * Task 6, ruling S10; drawing screen 7): a dialog over the black, not modal, its close button taking the focus; Escape and the
 * button close it; the switch of apps is one choice of three, by tap and by arrow key; the sound's button; the phone drawn at
 * its own size and scaled whole to the place the layout gives it, the app's buttons in the video's box, cut as the stage is,
 * with the edit's title for the post's caption; the creator's controls where the layout puts them.
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PostedPreview } from "../posted-preview";
import { clipOf, phoneOf, postedLayout, type App } from "../posted";

const TITLE = "Good morning, a title long enough to be cut at the end of its lines";
const SCRUBBER = <div data-testid="scrubber" />;

function preview(app: App, more: { area?: { w: number; h: number }; muted?: boolean } = {}) {
  const closeRef = createRef<HTMLButtonElement>();
  const onApp = vi.fn();
  const onClose = vi.fn();
  const onMute = vi.fn();
  const layout = postedLayout(app, more.area ?? { w: 393, h: 852 });
  const view = render(
    <PostedPreview app={app} onApp={onApp} onClose={onClose} layout={layout} title={TITLE} scrubber={SCRUBBER} closeRef={closeRef} muted={more.muted ?? false} onMute={onMute} />,
  );
  return { ...view, closeRef, onApp, onClose, onMute, layout };
}
/** The overlay with the page's part of it: the app chosen is held, as the page holds it, and its close button's ref. */
function Held({ onClose = () => {} }: { onClose?: () => void }) {
  const [app, setApp] = useState<App>("tiktok");
  const closeRef = useRef<HTMLButtonElement>(null);
  return (
    <PostedPreview
      app={app} onApp={setApp} onClose={onClose} layout={postedLayout(app, { w: 393, h: 852 })} title={TITLE} scrubber={SCRUBBER} closeRef={closeRef} muted={false} onMute={() => {}}
    />
  );
}
/** A box's place and size as drawn, in px. */
const boxOf = (element: HTMLElement) => [element.style.left, element.style.top, element.style.width, element.style.height].map((side) => Number.parseFloat(side));
const expectBox = (element: HTMLElement, box: { left: number; top: number; width: number; height: number }) =>
  boxOf(element).forEach((side, index) => expect(side).toBeCloseTo([box.left, box.top, box.width, box.height][index]!, 4));
const dialog = () => screen.getByRole("dialog", { name: "Preview as posted" });
const radio = (name: string) => screen.getByRole("radio", { name });
const furniture = () => document.querySelector<HTMLElement>("[data-part=furniture]");
const phone = () => document.querySelector<HTMLElement>("[data-part=phone]");
const band = () => document.querySelector<HTMLElement>("[data-part=band]");

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the preview as it will be posted", () => {
  it("is a dialog over the black, not modal, whose close button takes the focus", () => {
    const { closeRef } = preview("tiktok");
    expect(dialog()).not.toHaveAttribute("aria-modal");
    const close = within(dialog()).getByRole("button", { name: "Close preview" });
    expect(closeRef.current).toBe(close);
    expect(document.activeElement).toBe(close);
    expect(document.querySelector("[data-part=posted-ground]")).toHaveClass("fixed", "inset-0", "bg-black", "z-[var(--z-modal-backdrop)]");
    // Above the stage, and through to it but on its controls.
    const over = document.querySelector("[data-part=posted-over]");
    expect(over).toHaveClass("pointer-events-none", "z-[calc(var(--z-modal)+1)]");
    expect(close.closest(".pointer-events-auto")).not.toBeNull();
    expect(screen.getByRole("radiogroup", { name: "App" }).closest(".pointer-events-auto")).not.toBeNull();
    expect(screen.getByTestId("scrubber").closest(".pointer-events-auto")).not.toBeNull();
  });

  it("closes on its button, and on Escape wherever the focus is", () => {
    const { onClose } = preview("tiktok");
    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("stops listening for Escape once it is gone", () => {
    const { onClose, unmount } = preview("tiktok");
    unmount();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("offers TikTok, Reels and Off as one choice, the app chosen checked and the one reached by Tab", () => {
    const { onApp } = preview("reels");
    const group = screen.getByRole("radiogroup", { name: "App" });
    expect(within(group).getAllByRole("radio").map((one) => one.textContent)).toEqual(["TikTok", "Reels", "Off"]);
    expect(radio("Reels")).toHaveAttribute("aria-checked", "true");
    expect(radio("TikTok")).toHaveAttribute("aria-checked", "false");
    expect(radio("Off")).toHaveAttribute("aria-checked", "false");
    expect([radio("TikTok").tabIndex, radio("Reels").tabIndex, radio("Off").tabIndex]).toEqual([-1, 0, -1]);
    expect(radio("Reels")).toHaveClass("bg-surface", "text-foreground");
    expect(radio("Off")).not.toHaveClass("bg-surface");
    fireEvent.click(radio("Off"));
    expect(onApp).toHaveBeenLastCalledWith("off");
  });

  it("moves the choice with the arrow keys, round from one end to the other, the focus with it", () => {
    render(<Held />);
    radio("TikTok").focus();
    fireEvent.keyDown(radio("TikTok"), { key: "ArrowRight" });
    expect(radio("Reels")).toHaveAttribute("aria-checked", "true");
    expect(document.activeElement).toBe(radio("Reels"));
    fireEvent.keyDown(radio("Reels"), { key: "ArrowDown" });
    expect(radio("Off")).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(radio("Off"), { key: "ArrowRight" });
    expect(radio("TikTok")).toHaveAttribute("aria-checked", "true");
    expect(document.activeElement).toBe(radio("TikTok"));
    fireEvent.keyDown(radio("TikTok"), { key: "ArrowLeft" });
    expect(radio("Off")).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(radio("Off"), { key: "ArrowUp" });
    expect(radio("Reels")).toHaveAttribute("aria-checked", "true");
    expect(document.activeElement).toBe(radio("Reels"));
  });

  it("draws TikTok's buttons and words over the video, the edit's title for the caption on two lines, and its band", () => {
    preview("tiktok");
    const drawn = furniture()!;
    expect(drawn.closest("[aria-hidden=true]")).toBe(phone());
    const caption = within(drawn).getByText(TITLE);
    expect(caption).toHaveClass("line-clamp-2", "text-meta");
    expect(within(drawn).getByText("yourname")).toHaveClass("text-ui", "font-[640]");
    for (const count of ["12.4K", "318", "902", "211"]) expect(within(drawn).getByText(count)).toHaveClass("text-caption", "font-[600]");
    expect(within(drawn).getByText("♫ original sound")).toBeInTheDocument();
    expect(drawn.textContent).not.toMatch(/TikTok|Instagram|Reels/);
    // White in both themes, as a glyph over footage, with a light shadow from a token.
    expect(drawn).toHaveClass("text-action-foreground", "dark:text-foreground", "drop-shadow-sm/50");
    // In the video's box on the phone, in its points, cut as the stage is.
    expectBox(drawn, phoneOf("tiktok").video);
    expect(drawn.style.clipPath).toBe(clipOf(phoneOf("tiktok")));
    // The band: five plain marks, the middle one a pill with no word, the others named under them.
    const marks = band()!;
    expect(marks.closest("[aria-hidden=true]")).not.toBeNull();
    expectBox(marks, phoneOf("tiktok").band!);
    expect([...marks.querySelectorAll("[data-part=nav-mark]")].map((mark) => mark.textContent)).toEqual(["Home", "Friends", "", "Inbox", "Profile"]);
  });

  it("draws Reels' over a video cut at its sides, the title on one line, a band with no words", () => {
    preview("reels");
    const drawn = furniture()!;
    expectBox(drawn, phoneOf("reels").video);
    expect(within(drawn).getByText(TITLE)).toHaveClass("truncate", "text-meta");
    expect(within(drawn).getByText("Follow")).toBeInTheDocument();
    for (const count of ["8,915", "112", "47", "260"]) expect(within(drawn).getByText(count)).toBeInTheDocument();
    expect(drawn.textContent).not.toMatch(/TikTok|Instagram|Reels/);
    expect(drawn.style.clipPath).toBe("inset(0px 20.06px 0px 20.06px)");
    expect([...band()!.querySelectorAll("[data-part=nav-mark]")].map((mark) => mark.textContent)).toEqual(["", "", "", "", ""]);
  });

  it("draws nothing over the video with Off: the scrubber alone at the screen's bottom", () => {
    preview("off");
    expect(phone()).toBeNull();
    expect(furniture()).toBeNull();
    expect(band()).toBeNull();
    expect(screen.queryByText(TITLE)).toBeNull();
    expect(within(dialog()).getByTestId("scrubber")).toBeInTheDocument();
  });

  it("draws the whole phone at its own size and scales it to its place: everything on it, type and glyphs too", () => {
    const { layout } = preview("reels", { area: { w: 375, h: 600 } });
    const drawn = phone()!;
    expect(drawn).toHaveAttribute("aria-hidden", "true");
    expect(drawn).toHaveClass("origin-top-left");
    expectBox(drawn, { left: layout.screen.left, top: layout.screen.top, width: 393, height: 852 });
    expect(drawn.style.transform).toBe(`scale(${layout.pt})`);
    expect(drawn.contains(furniture())).toBe(true);
    expect(drawn.contains(band())).toBe(true);
    // Seen at that scale, the furniture is where the stage is: the video's box in px.
    const shown = phoneOf("reels").video;
    expect(layout.screen.left + shown.left * layout.pt).toBeCloseTo(layout.video.left, 6);
    expect(layout.screen.top + shown.top * layout.pt).toBeCloseTo(layout.video.top, 6);
    expect(shown.width * layout.pt).toBeCloseTo(layout.video.width, 6);
  });

  it("puts the creator's controls where the layout says: the row of close, the switch and the sound, and the scrubber", () => {
    const { layout } = preview("tiktok", { area: { w: 375, h: 600 } });
    const row = screen.getByRole("button", { name: "Close preview" }).closest<HTMLElement>("[data-part=controls]")!;
    expectBox(row, layout.controls.top);
    expect([...row.querySelectorAll("button")].map((button) => button.getAttribute("aria-label") ?? button.textContent)).toEqual(["Close preview", "TikTok", "Reels", "Off", "Mute"]);
    const bar = screen.getByTestId("scrubber").closest<HTMLElement>("[data-part=scrubber-place]")!;
    expectBox(bar, layout.controls.bottom);
    expect(bar).toHaveClass("-mt-[env(safe-area-inset-bottom)]");
    // The phone is painted first: the controls are over it, never under.
    const over = document.querySelector("[data-part=posted-over]")!;
    const order = [...over.children];
    expect(order.indexOf(phone()!)).toBeLessThan(order.indexOf(row));
    expect(order.indexOf(phone()!)).toBeLessThan(order.indexOf(bar));
  });

  it("has the sound's button with the creator's controls, as the stage's own: Mute, or Unmute when it has none", () => {
    const { onMute } = preview("tiktok");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Mute" }));
    expect(onMute).toHaveBeenCalledTimes(1);
    cleanup();
    preview("reels", { muted: true });
    expect(within(dialog()).getByRole("button", { name: "Unmute" })).toHaveClass("tap-44", "size-9", "bg-scrim");
    expect(within(dialog()).queryByRole("button", { name: "Mute" })).toBeNull();
  });
});
