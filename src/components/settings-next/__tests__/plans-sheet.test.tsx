/** @vitest-environment happy-dom */
/**
 * See plans (spec 2026-11-26-settings-design, section 5), through the real screen: the plan card's
 * button opens the sheet, three plans as radios with the real `PLANS`, and the button that starts the
 * chosen one. `onStartPlan` is the container's seam (it mounts Whop's checkout). Stand-in: `matchMedia`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { SettingsScreen } from "../settings-screen";
import { NO_PLAN, NO_PLAN_TRIAL_USED, press, props, ready, widthIs } from "./fixtures";

beforeEach(() => widthIs("phone"));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const seePlans = () => screen.getByRole("button", { name: "See plans" });
const sheet = () => screen.findByRole("dialog", { name: "Choose a plan" });
const radios = () => within(screen.getByRole("radiogroup", { name: "Choose a plan" })).getAllByRole("radio");
const radio = (name: string) => within(screen.getByRole("radiogroup")).getByRole("radio", { name: new RegExp(`^${name}\\b`) });
const start = () => screen.getByRole("button", { name: /^Start / });

describe("See plans", () => {
  it("opens a sheet of three plans, Creator chosen first", async () => {
    render(<SettingsScreen {...props({ plan: ready(NO_PLAN) })} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    press(seePlans());
    expect(await sheet()).toHaveAttribute("data-sheet-shell", "sheet");
    expect(radios().map((r) => r.textContent)).toEqual(["Creator 500 credits a month $49", "Pro 1,500 credits a month $99", "Studio Unlimited credits $499"]);
    expect(radios().map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
    await waitFor(() => expect(radio("Creator")).toHaveFocus());
  });

  it("the trial unused: the button starts the chosen plan for $1 and says what follows", async () => {
    const onStartPlan = vi.fn();
    render(<SettingsScreen {...props({ plan: ready(NO_PLAN), onStartPlan })} />);
    press(seePlans());
    const dialog = within(await sheet());
    expect(start()).toHaveTextContent("Start Creator for $1");
    expect(dialog.getByText("50 credits over 3 days, then $49 a month. Cancel any time on Whop.")).toBeInTheDocument();

    press(radio("Pro"));
    expect(radios().map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);
    expect(start()).toHaveTextContent("Start Pro for $1");
    expect(dialog.getByText("50 credits over 3 days, then $99 a month. Cancel any time on Whop.")).toBeInTheDocument();

    press(start());
    expect(onStartPlan).toHaveBeenCalledTimes(1);
    expect(onStartPlan).toHaveBeenCalledWith("pro", true);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("the trial used: the button says the plan's price, billed by Whop", async () => {
    const onStartPlan = vi.fn();
    render(<SettingsScreen {...props({ plan: ready(NO_PLAN_TRIAL_USED), onStartPlan })} />);
    press(seePlans());
    const dialog = within(await sheet());
    expect(start()).toHaveTextContent("Start Creator · $49 a month");
    expect(dialog.getByText("Billed monthly by Whop. Cancel any time.")).toBeInTheDocument();
    press(radio("Studio"));
    expect(start()).toHaveTextContent("Start Studio · $499 a month");
    press(start());
    expect(onStartPlan).toHaveBeenCalledWith("studio", false);
  });

  it("Creator's own id goes to the checkout, never its public name", async () => {
    const onStartPlan = vi.fn();
    render(<SettingsScreen {...props({ plan: ready(NO_PLAN), onStartPlan })} />);
    press(seePlans());
    await sheet();
    press(start());
    expect(onStartPlan).toHaveBeenCalledWith("starter", true);
  });

  it("the arrows choose the next plan, as a radio group does; one stop for Tab", async () => {
    render(<SettingsScreen {...props({ plan: ready(NO_PLAN) })} />);
    press(seePlans());
    await sheet();
    expect(radios().map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    fireEvent.keyDown(radio("Creator"), { key: "ArrowDown" });
    expect(radio("Pro")).toHaveAttribute("aria-checked", "true");
    expect(radio("Pro")).toHaveFocus();
    expect(radios().map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
    fireEvent.keyDown(radio("Pro"), { key: "ArrowUp" });
    fireEvent.keyDown(radio("Creator"), { key: "ArrowUp" });
    expect(radio("Studio")).toHaveAttribute("aria-checked", "true");
    expect(start()).toHaveTextContent("Start Studio for $1");
  });

  it("closed without a choice: nothing starts, the focus goes back to See plans, and it opens on Creator again", async () => {
    const onStartPlan = vi.fn();
    render(<SettingsScreen {...props({ plan: ready(NO_PLAN), onStartPlan })} />);
    press(seePlans());
    const dialog = await sheet();
    press(radio("Pro"));
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onStartPlan).not.toHaveBeenCalled();
    expect(seePlans()).toHaveFocus();

    press(seePlans());
    await sheet();
    expect(radios().map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
  });

  it("from 768 it is a dialog", async () => {
    widthIs("desk");
    render(<SettingsScreen {...props({ plan: ready(NO_PLAN) })} />);
    press(seePlans());
    expect(await sheet()).toHaveAttribute("data-sheet-shell", "dialog");
  });

  it("has no axe violations", async () => {
    render(<SettingsScreen {...props({ plan: ready(NO_PLAN) })} />);
    press(seePlans());
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(await sheet())).toHaveNoViolations();
  });
});
