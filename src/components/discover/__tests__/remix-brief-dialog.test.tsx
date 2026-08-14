/** @vitest-environment happy-dom */
/**
 * THE PRE-BRIEF (D3) — the one field that decides what the remix is FOR.
 *
 * `brief` has been accepted by the route since phase 1 (`route.ts:73`, `z.string().max(200)`) and
 * flows all the way to the adapt call as `AdaptInput.target` (`remix-runner.ts:342`). Nothing in
 * the UI has ever sent it. A backend field with no producer is the silent-no-op shape that made
 * the empty profile columns invisible for months — the field looks wired and does nothing.
 *
 * D3's ruling, and the whole reason it is not just another optional input:
 *
 *   > one optional free-text line, skippable. Empty = today's behaviour. Present = it REPLACES
 *   > the profile niche as the adaptation target, not augments it. Cross-niche transfer is the
 *   > case it exists for.
 *
 * "Replaces" is why an empty brief must be ABSENT from the body rather than `""`. The runner
 * reads `target: input.brief ?? null`, so a blank string is a truthy-empty target that silently
 * overrides the creator's niche with nothing — the exact defect the field exists to avoid.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";

import { RemixBriefDialog, useRemixBrief, MAX_BRIEF } from "../remix-brief-dialog";

afterEach(cleanup);

const onConfirm = vi.fn();

beforeEach(() => onConfirm.mockClear());

function open() {
  render(
    <RemixBriefDialog
      open
      onOpenChange={() => {}}
      onConfirm={onConfirm}
      sourceHook="I replaced my whole workflow with three prompts"
    />,
  );
  // By role: the sheet has exactly one field, and its <label> deliberately repeats the dialog
  // title (which is the question), so a text-based lookup matches both.
  return screen.getByRole("textbox");
}

describe("RemixBriefDialog — the brief is optional, and empty means ABSENT", () => {
  it("confirms with the typed brief", async () => {
    const input = open();
    fireEvent.change(input, { target: { value: "a cold-email teardown for B2B founders" } });
    fireEvent.click(screen.getByRole("button", { name: /^remix$/i }));

    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith("a cold-email teardown for B2B founders"),
    );
  });

  /**
   * NOT a nitpick. `target: input.brief ?? null` treats "" as a supplied target, so a blank
   * string replaces the creator's niche with nothing rather than falling back to it.
   */
  it("confirms with NULL when the field is left blank — never an empty string", async () => {
    const input = open();
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(null));
  });

  /**
   * The sheet stands between a tap and a BILLED run, so backing out must be visible and free.
   * An earlier draft's second button was "Skip", which also started the run — leaving Escape as
   * the only no-spend exit, and nothing on screen said so.
   */
  it("Cancel spends nothing — it closes and confirms NOTHING", async () => {
    const onOpenChange = vi.fn();
    render(
      <RemixBriefDialog
        open
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        sourceHook="a hook"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirms with NULL when the field holds only whitespace", async () => {
    const input = open();
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: /^remix$/i }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(null));
  });

  it("trims before sending — a stray trailing space is not part of the target", async () => {
    const input = open();
    fireEvent.change(input, { target: { value: "  podcast clips for founders  " } });
    fireEvent.click(screen.getByRole("button", { name: /^remix$/i }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("podcast clips for founders"));
  });

  /** The route caps at 200 (`z.string().max(200)`). A body over it is a 400, not a long brief. */
  it("cannot submit more than the route accepts", () => {
    const input = open() as HTMLInputElement;
    expect(input.maxLength).toBe(MAX_BRIEF);
    expect(MAX_BRIEF).toBe(200);
  });

  it("submits on Enter — one line, one key", async () => {
    const input = open();
    fireEvent.change(input, { target: { value: "a founder story" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("a founder story"));
  });

  it("names the source it is about, so the sheet is not a context-free box", () => {
    open();
    expect(screen.getByText(/replaced my whole workflow with three prompts/i)).toBeTruthy();
  });

  /**
   * Measured on screen at 1440 and 390: the quoted source originally carried the same rounded
   * border and tinted fill as the input, so the sheet read as a two-field form with the first
   * field pre-filled. There must be exactly ONE control here.
   */
  it("the quoted source is not a second form field", () => {
    open();
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelectorAll("input, textarea")).toHaveLength(1);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  it("the field carries an accessible name — a bare box announces as nothing", () => {
    const input = open();
    expect(input).toHaveAccessibleName(/what do you want to make from this/i);
  });

  it("says what SKIPPING does, not merely that it is allowed", () => {
    open();
    expect(screen.getByText(/adapt it to your niche/i)).toBeTruthy();
  });
});

describe("useRemixBrief — asking, confirming, dismissing", () => {
  it("ask() opens the sheet and fires nothing yet", () => {
    const launch = vi.fn();
    const { result } = renderHook(() => useRemixBrief(launch));

    act(() => result.current.ask("vid-1", "https://tiktok.com/x", "a hook"));

    expect(result.current.dialogProps.open).toBe(true);
    expect(launch).not.toHaveBeenCalled();
  });

  it("confirming launches the remix with the id, url and brief", () => {
    const launch = vi.fn();
    const { result } = renderHook(() => useRemixBrief(launch));

    act(() => result.current.ask("vid-1", "https://tiktok.com/x", "a hook"));
    act(() => result.current.dialogProps.onConfirm("podcast clips"));

    expect(launch).toHaveBeenCalledWith("vid-1", "https://tiktok.com/x", "podcast clips");
  });

  it("closes the sheet on confirm so a second tap is a fresh brief, not the last one", () => {
    const launch = vi.fn();
    const { result } = renderHook(() => useRemixBrief(launch));

    act(() => result.current.ask("vid-1", "https://tiktok.com/x", "a hook"));
    act(() => result.current.dialogProps.onConfirm("podcast clips"));

    expect(result.current.dialogProps.open).toBe(false);
  });

  it("dismissing launches NOTHING — closing the sheet is not consent to spend a credit", () => {
    const launch = vi.fn();
    const { result } = renderHook(() => useRemixBrief(launch));

    act(() => result.current.ask("vid-1", "https://tiktok.com/x", "a hook"));
    act(() => result.current.dialogProps.onOpenChange(false));

    expect(launch).not.toHaveBeenCalled();
    expect(result.current.dialogProps.open).toBe(false);
  });

  it("a row with no URL never opens the sheet — there is nothing to remix", () => {
    const launch = vi.fn();
    const { result } = renderHook(() => useRemixBrief(launch));

    act(() => result.current.ask("vid-1", null, "a hook"));

    expect(result.current.dialogProps.open).toBe(false);
    // The launcher still runs so it can own the "no URL to remix" message, as it always has.
    expect(launch).toHaveBeenCalledWith("vid-1", null, null);
  });
});
