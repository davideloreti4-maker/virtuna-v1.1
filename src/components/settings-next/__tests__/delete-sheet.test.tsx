/** @vitest-environment happy-dom */
/**
 * Delete account (spec 2026-11-26-settings-design, 2.4), through the real screen: the row opens the
 * sheet; a plan that renews gives "Cancel your plan first", anything else the typed confirm.
 * `onDelete` and `onRecheckPlan` are the container's seam (the server decides; the test answers for
 * it). Stand-in: `matchMedia`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import type { PlanView } from "@/lib/settings/plan-view";

import { SettingsScreen, type DeleteResult, type SettingsScreenProps } from "../settings-screen";
import { CANCELLED, IN_TRIAL, MANAGE_HREF, NO_PLAN, PAID, PAST_DUE, STUDIO, later, press, props, ready, widthIs } from "./fixtures";

beforeEach(() => widthIs("phone"));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const BLOCKED = "Cancel your plan first";
const CONFIRM = "Delete nia@example.com?";

const row = () => screen.getByRole("button", { name: /^Delete account\b.*everything in it/ });
const dialog = (name: string) => screen.findByRole("dialog", { name });
const field = () => screen.getByRole("textbox", { name: "Type DELETE" }) as HTMLInputElement;
const type = (value: string) => fireEvent.change(field(), { target: { value } });
/** The sheet's own button (the row behind it is out of reach while the sheet is open). */
const deleteButton = () => within(screen.getByRole("dialog")).getByRole("button", { name: /^(Delete account|Deleting…)$/ });
const gone = () => waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

async function openOn(view: PlanView | null, over: Partial<SettingsScreenProps> = {}) {
  const all = props({ plan: view ? ready(view) : { state: "loading" }, ...over });
  const utils = render(<SettingsScreen {...all} />);
  press(row());
  await screen.findByRole("dialog");
  return { ...utils, all };
}

function show(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("Delete account: a plan that renews", () => {
  it.each([
    ["renewing", PAID, "Your Creator plan renews on 14 Dec and is billed by Whop. Deleting your account would not stop it."],
    ["Studio", STUDIO, "Your Studio plan renews on 2 Dec and is billed by Whop. Deleting your account would not stop it."],
    ["in the trial", IN_TRIAL, "Your Creator plan renews on 29 Nov and is billed by Whop. Deleting your account would not stop it."],
    ["payment failed", PAST_DUE, "Your Creator plan renews on 14 Dec and is billed by Whop. Deleting your account would not stop it."],
    ["a day not known", { ...PAID, on: null }, "Your Creator plan renews and is billed by Whop. Deleting your account would not stop it."],
  ] as const)("says to cancel it first, and where: %s", async (_state, view, body) => {
    await openOn(view);
    const sheet = within(await dialog(BLOCKED));
    expect(sheet.getByText(body)).toBeInTheDocument();
    expect(sheet.getByText("Cancel it on Whop, then come back: a cancelled plan does not stop you deleting.")).toBeInTheDocument();
    const link = sheet.getByRole("link", { name: "Cancel on Whop, opens Whop in a new tab" });
    expect(link).toHaveAttribute("href", MANAGE_HREF);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    // Nothing here deletes.
    expect(sheet.queryByRole("textbox")).toBeNull();
    expect(sheet.queryByRole("button", { name: "Delete account" })).toBeNull();
  });

  it("Close closes it and the focus goes back to the row", async () => {
    await openOn(PAID);
    const sheet = within(await dialog(BLOCKED));
    press(sheet.getAllByRole("button", { name: "Close" })[0]!);
    await gone();
    expect(row()).toHaveFocus();
  });

  it("reads the plan again when the page is shown again, only while the sheet is open", async () => {
    const onRecheckPlan = vi.fn();
    render(<SettingsScreen {...props({ onRecheckPlan })} />);
    show("visible");
    window.dispatchEvent(new Event("focus"));
    expect(onRecheckPlan).not.toHaveBeenCalled();

    press(row());
    const sheet = await dialog(BLOCKED);
    show("hidden");
    expect(onRecheckPlan).not.toHaveBeenCalled();
    show("visible");
    expect(onRecheckPlan).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("focus"));
    expect(onRecheckPlan).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(sheet, { key: "Escape" });
    await gone();
    show("visible");
    window.dispatchEvent(new Event("focus"));
    expect(onRecheckPlan).toHaveBeenCalledTimes(2);
  });

  it("when the plan no longer renews, the open sheet becomes the confirm, the focus in its field", async () => {
    const { rerender, all } = await openOn(PAID);
    await dialog(BLOCKED);
    rerender(<SettingsScreen {...all} plan={ready(CANCELLED)} />);
    expect(await dialog(CONFIRM)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Cancel on Whop/ })).toBeNull();
    expect(field()).toHaveFocus();
  });

  it("the confirm does not read the plan again", async () => {
    const onRecheckPlan = vi.fn();
    await openOn(CANCELLED, { onRecheckPlan });
    show("visible");
    window.dispatchEvent(new Event("focus"));
    expect(onRecheckPlan).not.toHaveBeenCalled();
  });
});

describe("Delete account: the confirm", () => {
  it("names the account, what goes, and that it can't be undone", async () => {
    await openOn(NO_PLAN);
    const sheet = within(await dialog(CONFIRM));
    expect(
      sheet.getByText(
        "Your chats, audiences, simulations, uploaded and saved videos and the creators you follow are deleted; your connected accounts are disconnected. This can't be undone.",
      ),
    ).toBeInTheDocument();
    expect(sheet.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("without an email it asks about the account", async () => {
    await openOn(NO_PLAN, { account: { email: null, google: false } });
    expect(await dialog("Delete your account?")).toBeInTheDocument();
  });

  it.each([
    ["a cancelled plan with credits left", CANCELLED, "The 312 credits left are lost."],
    ["no plan", NO_PLAN, null],
    ["a cancelled plan with none left", { ...CANCELLED, credits: { left: 0, limit: 500, resetsOn: null } }, null],
    ["a cancelled Studio", { ...STUDIO, state: "cancelled" }, null],
    ["a cancelled plan whose credits were not read", { ...CANCELLED, credits: null }, null],
  ] as const)("says the credits that are lost only when some are left: %s", async (_state, view, sentence) => {
    await openOn(view);
    const sheet = within(await dialog(CONFIRM));
    if (sentence) expect(sheet.getByText(new RegExp(`are disconnected\\. ${sentence.replace(".", "\\.")} This can't be undone\\.$`))).toBeInTheDocument();
    else expect(sheet.queryByText(/credits? left/)).toBeNull();
  });

  it("a plan not known yet does not hold the confirm back: the server decides", async () => {
    await openOn(null);
    expect(await dialog(CONFIRM)).toBeInTheDocument();
  });

  it("the focus starts in the field", async () => {
    await openOn(NO_PLAN);
    await waitFor(() => expect(field()).toHaveFocus());
  });

  it("Delete account waits until the field is exactly DELETE, case as typed", async () => {
    const onDelete = vi.fn(async (): Promise<DeleteResult> => "deleted");
    await openOn(NO_PLAN, { onDelete });
    expect(deleteButton()).toHaveAttribute("aria-disabled", "true");
    for (const text of ["delete", "Delete", "DELET", "DELETE ", "DELETED"]) {
      type(text);
      expect(deleteButton()).toHaveAttribute("aria-disabled", "true");
      press(deleteButton());
    }
    expect(onDelete).not.toHaveBeenCalled();
    type("DELETE");
    expect(deleteButton()).not.toHaveAttribute("aria-disabled");
  });

  it("Enter in the field deletes nothing: the button is the way", async () => {
    const onDelete = vi.fn(async (): Promise<DeleteResult> => "deleted");
    await openOn(NO_PLAN, { onDelete });
    type("DELETE");
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("deleting: the button says so, once, and the sheet stays", async () => {
    const out = later<DeleteResult>();
    const onDelete = vi.fn(() => out.promise);
    await openOn(NO_PLAN, { onDelete });
    const sheet = screen.getByRole("dialog");
    type("DELETE");
    press(deleteButton());
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(deleteButton()).toHaveTextContent("Deleting…");
    expect(deleteButton()).toHaveAttribute("aria-busy", "true");
    expect(within(sheet).getByRole("status")).toHaveTextContent("Deleting…");
    expect(field()).toHaveAttribute("readonly");

    // A second press, Cancel and Escape wait for the answer.
    press(deleteButton());
    press(within(sheet).getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(sheet, { key: "Escape" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Deleted: the container leaves the page; nothing here offers a second delete meanwhile.
    await act(async () => out.settle("deleted"));
    expect(deleteButton()).toHaveTextContent("Deleting…");
    expect(deleteButton()).toHaveAttribute("aria-busy", "true");
  });

  it("refused because a plan renews: the sheet becomes Cancel your plan first", async () => {
    const onDelete = vi.fn(async (): Promise<DeleteResult> => "plan_renews");
    await openOn(CANCELLED, { onDelete });
    type("DELETE");
    await act(async () => press(deleteButton()));
    const sheet = within(await dialog(BLOCKED));
    expect(sheet.getByText("Your Creator plan renews on 14 Dec and is billed by Whop. Deleting your account would not stop it.")).toBeInTheDocument();
    expect(sheet.getByRole("link", { name: "Cancel on Whop, opens Whop in a new tab" })).toHaveFocus();
    expect(sheet.queryByRole("textbox")).toBeNull();
  });

  it("refused with no plan in the page's read: it still says to cancel, without a name", async () => {
    const onDelete = vi.fn(async (): Promise<DeleteResult> => "plan_renews");
    await openOn(NO_PLAN, { onDelete });
    type("DELETE");
    await act(async () => press(deleteButton()));
    const sheet = within(await dialog(BLOCKED));
    expect(sheet.getByText("Your plan renews and is billed by Whop. Deleting your account would not stop it.")).toBeInTheDocument();
  });

  it("after a refusal, a plan read again as cancelled brings the confirm back", async () => {
    const onDelete = vi.fn(async (): Promise<DeleteResult> => "plan_renews");
    const onRecheckPlan = vi.fn();
    const { rerender, all } = await openOn(CANCELLED, { onDelete, onRecheckPlan });
    type("DELETE");
    await act(async () => press(deleteButton()));
    await dialog(BLOCKED);
    // The same read again changes nothing: the server's word stands.
    rerender(<SettingsScreen {...all} plan={ready({ ...CANCELLED })} />);
    expect(screen.getByRole("dialog", { name: BLOCKED })).toBeInTheDocument();
    show("visible");
    expect(onRecheckPlan).toHaveBeenCalledTimes(1);
    // Whop's live state arrives (renews), then the creator cancels there and comes back.
    rerender(<SettingsScreen {...all} plan={ready(PAID)} />);
    expect(screen.getByRole("dialog", { name: BLOCKED })).toBeInTheDocument();
    rerender(<SettingsScreen {...all} plan={ready(CANCELLED)} />);
    expect(await dialog(CONFIRM)).toBeInTheDocument();
  });

  it.each([
    ["whop_unreachable", "Couldn't check your plan with Whop. Try again in a minute."],
    ["failed", "Couldn't finish deleting your account. Try again."],
  ] as const)("%s: said in the sheet, and it can be tried again", async (result, words) => {
    const onDelete = vi.fn(async (): Promise<DeleteResult> => result);
    await openOn(NO_PLAN, { onDelete });
    type("DELETE");
    await act(async () => press(deleteButton()));
    const sheet = within(await dialog(CONFIRM));
    expect(sheet.getByRole("alert")).toHaveTextContent(words);
    expect(field().value).toBe("DELETE");
    expect(deleteButton()).toHaveTextContent("Delete account");
    expect(deleteButton()).not.toHaveAttribute("aria-busy");
    expect(deleteButton()).not.toHaveAttribute("aria-disabled");
    // Trying again takes the line away while it is asked.
    const out = later<DeleteResult>();
    onDelete.mockImplementationOnce(() => out.promise);
    press(deleteButton());
    expect(onDelete).toHaveBeenCalledTimes(2);
    expect(sheet.queryByRole("alert")).toBeNull();
    await act(async () => out.settle(result));
    expect(sheet.getByRole("alert")).toHaveTextContent(words);
  });

  it("a request that never reached the server reads as the failed line", async () => {
    const onDelete = vi.fn(async (): Promise<DeleteResult> => {
      throw new Error("offline");
    });
    await openOn(NO_PLAN, { onDelete });
    type("DELETE");
    await act(async () => press(deleteButton()));
    expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent("Couldn't finish deleting your account. Try again.");
  });

  it("Cancel closes it; each opening starts empty", async () => {
    const onDelete = vi.fn(async (): Promise<DeleteResult> => "failed");
    await openOn(NO_PLAN, { onDelete });
    type("DELETE");
    await act(async () => press(deleteButton()));
    expect(within(screen.getByRole("dialog")).getByRole("alert")).toBeInTheDocument();
    press(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    await gone();
    expect(row()).toHaveFocus();

    press(row());
    const sheet = within(await dialog(CONFIRM));
    expect(field().value).toBe("");
    expect(sheet.queryByRole("alert")).toBeNull();
    expect(deleteButton()).toHaveAttribute("aria-disabled", "true");
  });

  it("from 768 it is a dialog", async () => {
    widthIs("desk");
    await openOn(NO_PLAN);
    expect(await dialog(CONFIRM)).toHaveAttribute("data-sheet-shell", "dialog");
  });

  it("has no axe violations, on either face", async () => {
    const { rerender, all } = await openOn(NO_PLAN);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(await dialog(CONFIRM))).toHaveNoViolations();
    rerender(<SettingsScreen {...all} plan={ready(PAID)} />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(await dialog(BLOCKED))).toHaveNoViolations();
  });
});
