/** @vitest-environment happy-dom */
/**
 * SettingsScreen (spec 2026-11-26-settings-design, section 2), rendered for real: the plan card in
 * each state of the 2.1 table, Appearance, the Account rows and the foot. The handlers are the
 * container's seam (spies, and promises the test settles); no module of ours is stood in for. The
 * flag is on (the new look's Card). See plans and Delete account have their own files.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import type { PlanView } from "@/lib/settings/plan-view";
import { useShellStore } from "@/stores/shell-store";

import { SettingsScreen, type PasswordResult } from "../settings-screen";
import { CANCELLED, IN_TRIAL, MANAGE_HREF, NO_PLAN, NO_PLAN_TRIAL_USED, PAID, PAST_DUE, STUDIO, later, press, props, ready, widthIs } from "./fixtures";

const rowButton = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}\\b`) });
const planCard = () => within(screen.getByRole("region", { name: "Plan" }));
const account = () => within(screen.getByRole("region", { name: "Account" }));

beforeEach(() => widthIs("phone"));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useShellStore.setState({ pushedTitle: "" });
});

describe("SettingsScreen: the page", () => {
  it("names the screen in the phone's header, and once on the page; the name goes on the way out", () => {
    const { unmount } = render(<SettingsScreen {...props()} />);
    expect(useShellStore.getState().pushedTitle).toBe("Settings");
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Settings"]);
    unmount();
    expect(useShellStore.getState().pushedTitle).toBe("");
  });

  it("labels Plan and Account; Appearance and Delete account stand without one", () => {
    render(<SettingsScreen {...props()} />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Plan", "Account"]);
    expect(rowButton("Appearance")).toBeInTheDocument();
    expect(rowButton("Delete account")).toHaveTextContent("Your account and everything in it");
  });

  it("ends with the licence credit for the brain, each name a link", () => {
    render(<SettingsScreen {...props()} />);
    const foot = screen.getByText(/The brain in The Room:/);
    expect(foot).toHaveTextContent('The brain in The Room: "Brain" by dgallichan, CC BY 4.0.');
    const links = within(foot).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://sketchfab.com/3d-models/brain-cadd2bde67404c43b2359a6a3281d84a",
      "https://sketchfab.com/dgallichan",
      "https://creativecommons.org/licenses/by/4.0/",
    ]);
    for (const a of links) {
      expect(a).toHaveAttribute("target", "_blank");
      expect(a.getAttribute("rel")).toContain("noopener");
    }
  });
});

describe("SettingsScreen: the plan card", () => {
  interface Row {
    state: string;
    view: PlanView;
    name: string;
    pill: string | null;
    line: string;
    credits: string | null;
    note: string | null;
    meter: [number, number] | null;
    way: "manage" | "update" | "plans";
  }
  const TABLE: Row[] = [
    { state: "paid, renewing", view: PAID, name: "Creator", pill: "Active", line: "$49 a month · renews 14 Dec", credits: "312 of 500 credits left", note: "Resets 14 Dec", meter: [312, 500], way: "manage" },
    { state: "cancelled, still running", view: CANCELLED, name: "Creator", pill: "Cancelled", line: "Ends 14 Dec. Nothing more is billed.", credits: "312 of 500 credits left", note: "Until 14 Dec", meter: [312, 500], way: "manage" },
    { state: "payment failed", view: PAST_DUE, name: "Creator", pill: "Payment failed", line: "Whop couldn't take the payment. Update your card there to keep your credits.", credits: "312 of 500 credits left", note: "Resets 14 Dec", meter: null, way: "update" },
    { state: "in the trial", view: IN_TRIAL, name: "Creator", pill: "Trial", line: "$1 for 3 days. Becomes Creator, $49 a month, on 29 Nov unless you cancel.", credits: "30 of 50 trial credits left", note: "Ends 29 Nov", meter: [30, 50], way: "manage" },
    { state: "Studio", view: STUDIO, name: "Studio", pill: "Active", line: "$499 a month · renews 2 Dec", credits: "Unlimited credits", note: null, meter: null, way: "manage" },
    { state: "no plan, trial unused", view: NO_PLAN, name: "No plan", pill: null, line: "Try any plan for $1: 50 credits over 3 days.", credits: null, note: null, meter: null, way: "plans" },
    { state: "no plan, trial used", view: NO_PLAN_TRIAL_USED, name: "No plan", pill: null, line: "Plans from $49 a month.", credits: null, note: null, meter: null, way: "plans" },
  ];

  it.each(TABLE)("$state", ({ view, name, pill, line, credits, note, meter, way }) => {
    render(<SettingsScreen {...props({ plan: ready(view) })} />);
    const card = planCard();
    expect(card.getByText(name)).toBeInTheDocument();
    expect(card.getByText(line)).toBeInTheDocument();
    for (const other of ["Active", "Cancelled", "Payment failed", "Trial"]) {
      if (other === pill) expect(card.getByText(other)).toBeInTheDocument();
      else expect(card.queryByText(other)).toBeNull();
    }
    if (credits) expect(card.getByText(credits)).toBeInTheDocument();
    else expect(card.queryByText(/credits left|Unlimited credits/)).toBeNull();
    if (note) expect(card.getByText(note)).toBeInTheDocument();
    else expect(card.queryByText(/^(Resets|Until|Ends) \d+ \w+$/)).toBeNull();

    if (meter) {
      const bar = card.getByRole("meter", { name: "Credits left" });
      expect(bar).toHaveAttribute("aria-valuemin", "0");
      expect(bar).toHaveAttribute("aria-valuenow", String(meter[0]));
      expect(bar).toHaveAttribute("aria-valuemax", String(meter[1]));
    } else {
      expect(card.queryByRole("meter")).toBeNull();
    }

    const manage = card.queryByRole("link", { name: "Manage on Whop, opens Whop in a new tab" });
    const update = card.queryByRole("link", { name: "Update on Whop, opens Whop in a new tab" });
    const plans = card.queryByRole("button", { name: "See plans" });
    expect([manage !== null, update !== null, plans !== null]).toEqual([way === "manage", way === "update", way === "plans"]);
  });

  it("Manage on Whop is a link to Whop in a new tab, with what it is for", () => {
    render(<SettingsScreen {...props()} />);
    const link = planCard().getByRole("link", { name: "Manage on Whop, opens Whop in a new tab" });
    expect(link).toHaveAttribute("href", MANAGE_HREF);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAccessibleDescription("Payment, invoices, cancel");
    expect(within(link).getByText("Manage on Whop")).toBeInTheDocument();
  });

  it("past due: the way out is the button to Whop, in a new tab", () => {
    render(<SettingsScreen {...props({ plan: ready(PAST_DUE) })} />);
    const link = planCard().getByRole("link", { name: "Update on Whop, opens Whop in a new tab" });
    expect(link).toHaveAttribute("href", MANAGE_HREF);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("the meter never says more than the plan holds or less than nothing", () => {
    const { rerender } = render(<SettingsScreen {...props({ plan: ready({ ...PAID, credits: { left: 620, limit: 500, resetsOn: null } }) })} />);
    expect(planCard().getByRole("meter")).toHaveAttribute("aria-valuenow", "500");
    rerender(<SettingsScreen {...props({ plan: ready({ ...PAID, credits: { left: -3, limit: 500, resetsOn: null } }) })} />);
    expect(planCard().getByRole("meter")).toHaveAttribute("aria-valuenow", "0");
  });

  it("while the plan loads: the card's outline, busy, and never No plan or a way to buy", () => {
    render(<SettingsScreen {...props({ plan: { state: "loading" } })} />);
    const region = screen.getByRole("region", { name: "Plan" });
    expect(region.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText("No plan")).toBeNull();
    expect(screen.queryByRole("button", { name: "See plans" })).toBeNull();
    expect(planCard().queryByRole("link")).toBeNull();
    // The rest of the page does not wait for the plan.
    expect(rowButton("Appearance")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("a plan that could not be read: said in the card, with Try again", () => {
    const onRetry = vi.fn();
    render(<SettingsScreen {...props({ plan: { state: "error", onRetry } })} />);
    expect(planCard().getByRole("alert")).toHaveTextContent("Couldn't load your plan.");
    expect(screen.queryByText("No plan")).toBeNull();
    press(planCard().getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("after Try again the focus goes to the card's control once the plan is there", () => {
    const onRetry = vi.fn();
    const { rerender } = render(<SettingsScreen {...props({ plan: { state: "error", onRetry } })} />);
    press(planCard().getByRole("button", { name: "Try again" }));
    rerender(<SettingsScreen {...props({ plan: { state: "loading" } })} />);
    rerender(<SettingsScreen {...props({ plan: ready(NO_PLAN) })} />);
    expect(screen.getByRole("button", { name: "See plans" })).toHaveFocus();
  });
});

describe("SettingsScreen: Appearance", () => {
  const group = () => screen.getByRole("radiogroup", { name: "Appearance" });
  const radio = (name: string) => within(group()).getByRole("radio", { name });

  it.each([
    ["light", "Light"],
    ["dark", "Dark"],
    ["system", "Match system"],
  ] as const)("closed, the row says the choice: %s", (theme, word) => {
    render(<SettingsScreen {...props({ theme })} />);
    expect(rowButton("Appearance")).toHaveTextContent(word);
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("opens in place into three radios, the chosen one checked and holding the focus", () => {
    render(<SettingsScreen {...props({ theme: "dark" })} />);
    press(rowButton("Appearance"));
    expect(within(group()).getAllByRole("radio").map((r) => r.textContent)).toEqual(["Light", "Dark", "Match system"]);
    expect(radio("Light")).toHaveAttribute("aria-checked", "false");
    expect(radio("Dark")).toHaveAttribute("aria-checked", "true");
    expect(radio("Match system")).toHaveAttribute("aria-checked", "false");
    expect(radio("Dark")).toHaveFocus();
    // A radio is not a toggle: no pressed state beside the checked one.
    for (const r of within(group()).getAllByRole("radio")) expect(r).not.toHaveAttribute("aria-pressed");
    expect(screen.queryByRole("button", { name: /^Appearance\b/ })).toBeNull();
  });

  it("a choice applies at once and closes the row; the focus goes back to it", () => {
    const onTheme = vi.fn();
    render(<SettingsScreen {...props({ onTheme })} />);
    press(rowButton("Appearance"));
    press(radio("Match system"));
    expect(onTheme).toHaveBeenCalledTimes(1);
    expect(onTheme).toHaveBeenCalledWith("system");
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(rowButton("Appearance")).toHaveFocus();
  });

  it("the choice already made closes the row and changes nothing", () => {
    const onTheme = vi.fn();
    render(<SettingsScreen {...props({ onTheme })} />);
    press(rowButton("Appearance"));
    press(radio("Light"));
    expect(onTheme).not.toHaveBeenCalled();
    expect(rowButton("Appearance")).toHaveFocus();
  });

  it("Escape closes it and changes nothing", () => {
    const onTheme = vi.fn();
    render(<SettingsScreen {...props({ onTheme })} />);
    press(rowButton("Appearance"));
    fireEvent.keyDown(radio("Light"), { key: "Escape" });
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(onTheme).not.toHaveBeenCalled();
    expect(rowButton("Appearance")).toHaveFocus();
  });

  it("the arrows move between the radios without choosing; one stop for Tab", () => {
    const onTheme = vi.fn();
    render(<SettingsScreen {...props({ onTheme })} />);
    press(rowButton("Appearance"));
    expect(within(group()).getAllByRole("radio").map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    fireEvent.keyDown(radio("Light"), { key: "ArrowRight" });
    expect(radio("Dark")).toHaveFocus();
    fireEvent.keyDown(radio("Dark"), { key: "ArrowDown" });
    expect(radio("Match system")).toHaveFocus();
    fireEvent.keyDown(radio("Match system"), { key: "ArrowRight" });
    expect(radio("Light")).toHaveFocus();
    fireEvent.keyDown(radio("Light"), { key: "ArrowLeft" });
    expect(radio("Match system")).toHaveFocus();
    expect(onTheme).not.toHaveBeenCalled();
    expect(group()).toBeInTheDocument();
  });
});

describe("SettingsScreen: Account", () => {
  const newPassword = () => screen.getByLabelText("New password") as HTMLInputElement;
  const again = () => screen.getByLabelText("Type it again") as HTMLInputElement;
  const type = (first: string, second = first) => {
    fireEvent.change(newPassword(), { target: { value: first } });
    fireEvent.change(again(), { target: { value: second } });
  };
  const saveButton = () => screen.getByRole("button", { name: "Save" });

  it("Email: the account's email, read only", () => {
    render(<SettingsScreen {...props()} />);
    expect(account().getByText("Email")).toBeInTheDocument();
    expect(account().getByText("nia@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Email/ })).toBeNull();
  });

  it("Email names Google for an account that signs in with it", () => {
    render(<SettingsScreen {...props({ account: { email: "nia@example.com", google: true } })} />);
    expect(account().getByText("nia@example.com · Google")).toBeInTheDocument();
  });

  it("no email: the row is left out", () => {
    render(<SettingsScreen {...props({ account: { email: null, google: false } })} />);
    expect(account().queryByText("Email")).toBeNull();
    expect(rowButton("Password")).toBeInTheDocument();
    expect(account().getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("Log out is an action row", () => {
    const onLogOut = vi.fn();
    render(<SettingsScreen {...props({ onLogOut })} />);
    press(account().getByRole("button", { name: "Log out" }));
    expect(onLogOut).toHaveBeenCalledTimes(1);
  });

  it("Password opens in place: its line, two labelled fields, the rule tied to the first", () => {
    render(<SettingsScreen {...props()} />);
    expect(rowButton("Password")).toHaveTextContent("Set or change");
    press(rowButton("Password"));
    expect(account().getByText("Optional. A code by email always signs you in.")).toBeInTheDocument();
    for (const field of [newPassword(), again()]) {
      expect(field).toHaveAttribute("type", "password");
      expect(field).toHaveAttribute("autocomplete", "new-password");
    }
    expect(newPassword()).toHaveAccessibleDescription("8 characters or more");
    expect(newPassword()).toHaveFocus();
    expect(account().getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(saveButton()).toBeInTheDocument();
  });

  it("shorter than 8: said in the row, nothing sent", () => {
    const onPassword = vi.fn(async (): Promise<PasswordResult> => "saved");
    render(<SettingsScreen {...props({ onPassword })} />);
    press(rowButton("Password"));
    type("short12");
    press(saveButton());
    expect(account().getByRole("alert")).toHaveTextContent("8 characters or more");
    expect(newPassword()).toHaveAttribute("aria-invalid", "true");
    expect(onPassword).not.toHaveBeenCalled();
  });

  it("the two differ: said in the row, nothing sent; typing again takes the line away", () => {
    const onPassword = vi.fn(async (): Promise<PasswordResult> => "saved");
    render(<SettingsScreen {...props({ onPassword })} />);
    press(rowButton("Password"));
    type("correct horse", "correct house");
    press(saveButton());
    expect(account().getByRole("alert")).toHaveTextContent("The two don't match");
    expect(again()).toHaveAttribute("aria-invalid", "true");
    expect(onPassword).not.toHaveBeenCalled();
    fireEvent.change(again(), { target: { value: "correct horse" } });
    expect(account().queryByRole("alert")).toBeNull();
  });

  it("saves: Save waits, then the row closes and reads Saved, with the focus", async () => {
    const out = later<PasswordResult>();
    const onPassword = vi.fn(() => out.promise);
    render(<SettingsScreen {...props({ onPassword })} />);
    press(rowButton("Password"));
    type("correct horse");
    press(saveButton());
    expect(onPassword).toHaveBeenCalledWith("correct horse");
    expect(saveButton()).toHaveAttribute("aria-busy", "true");
    expect(newPassword()).toHaveAttribute("readonly");
    // A second press, Cancel and Escape wait for the answer.
    press(saveButton());
    press(account().getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(newPassword(), { key: "Escape" });
    expect(onPassword).toHaveBeenCalledTimes(1);
    expect(newPassword()).toBeInTheDocument();

    await act(async () => out.settle("saved"));
    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(rowButton("Password")).toHaveTextContent("Saved");
    expect(rowButton("Password")).toHaveFocus();
  });

  it("Enter in a field saves", async () => {
    const onPassword = vi.fn(async (): Promise<PasswordResult> => "saved");
    render(<SettingsScreen {...props({ onPassword })} />);
    press(rowButton("Password"));
    type("correct horse");
    await act(async () => {
      fireEvent.keyDown(again(), { key: "Enter" });
    });
    expect(onPassword).toHaveBeenCalledWith("correct horse");
    expect(rowButton("Password")).toHaveTextContent("Saved");
  });

  it("a save the server refused: the row stays open with its words and what was typed", async () => {
    const onPassword = vi.fn(async (): Promise<PasswordResult> => ({ error: "Couldn't save. Try again." }));
    render(<SettingsScreen {...props({ onPassword })} />);
    press(rowButton("Password"));
    type("correct horse");
    await act(async () => press(saveButton()));
    expect(account().getByRole("alert")).toHaveTextContent("Couldn't save. Try again.");
    expect(newPassword().value).toBe("correct horse");
    expect(saveButton()).not.toHaveAttribute("aria-busy");
    // It can be sent again.
    await act(async () => press(saveButton()));
    expect(onPassword).toHaveBeenCalledTimes(2);
  });

  it("a save that never reached the server reads as one that failed", async () => {
    const onPassword = vi.fn(async (): Promise<PasswordResult> => {
      throw new Error("offline");
    });
    render(<SettingsScreen {...props({ onPassword })} />);
    press(rowButton("Password"));
    type("correct horse");
    await act(async () => press(saveButton()));
    expect(account().getByRole("alert")).toHaveTextContent("Couldn't save. Try again.");
    expect(newPassword()).toBeInTheDocument();
  });

  it("Cancel and Escape close it, and what was typed and said is gone", async () => {
    const onPassword = vi.fn(async (): Promise<PasswordResult> => ({ error: "Couldn't save. Try again." }));
    render(<SettingsScreen {...props({ onPassword })} />);
    press(rowButton("Password"));
    type("correct horse");
    await act(async () => press(saveButton()));
    press(account().getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(rowButton("Password")).toHaveTextContent("Set or change");
    expect(rowButton("Password")).toHaveFocus();

    press(rowButton("Password"));
    expect(newPassword().value).toBe("");
    expect(account().queryByRole("alert")).toBeNull();
    fireEvent.keyDown(newPassword(), { key: "Escape" });
    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(rowButton("Password")).toHaveFocus();
  });
});

describe("SettingsScreen: one row open at a time", () => {
  it("opening Password closes Appearance, and the other way round", () => {
    render(<SettingsScreen {...props()} />);
    press(rowButton("Appearance"));
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    press(rowButton("Password"));
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getByLabelText("New password")).toHaveFocus();
    press(rowButton("Appearance"));
    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
  });

  it("a password on its way holds the page: Appearance does not open over it", async () => {
    const out = later<PasswordResult>();
    render(<SettingsScreen {...props({ onPassword: () => out.promise })} />);
    press(rowButton("Password"));
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "correct horse" } });
    fireEvent.change(screen.getByLabelText("Type it again"), { target: { value: "correct horse" } });
    press(screen.getByRole("button", { name: "Save" }));
    press(rowButton("Appearance"));
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    await act(async () => out.settle("saved"));
    press(rowButton("Appearance"));
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
  });
});

describe("SettingsScreen: monochrome", () => {
  /** Any colour utility: status tokens, the accent, or a named hue. */
  const COLOUR = /(?:^|[\s:])(?:bg|text|border|shadow|fill|stroke|ring)-(?:error|success|warning|info|accent|above|below|red|green|amber|orange|yellow|rose|emerald|coral|signal)\b/;

  it.each([
    ["a paid plan", PAID],
    ["payment failed", PAST_DUE],
    ["cancelled", CANCELLED],
    ["in the trial", IN_TRIAL],
    ["no plan", NO_PLAN],
  ] as const)("no class on the page carries a colour: %s", (_state, view) => {
    const { container } = render(<SettingsScreen {...props({ plan: ready(view) })} />);
    press(rowButton("Appearance"));
    const classes = Array.from(container.querySelectorAll<HTMLElement>("[class]"), (el) => el.getAttribute("class") ?? "");
    expect(classes.filter((c) => COLOUR.test(c))).toEqual([]);
  });
});

describe("SettingsScreen: axe", () => {
  it.each([
    ["a paid plan", PAID],
    ["payment failed", PAST_DUE],
    ["no plan", NO_PLAN],
  ] as const)("has no violations, ready: %s", async (_state, view) => {
    const { container } = render(<SettingsScreen {...props({ plan: ready(view) })} />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no violations while the plan loads or could not be read", async () => {
    const { container, rerender } = render(<SettingsScreen {...props({ plan: { state: "loading" } })} />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
    rerender(<SettingsScreen {...props({ plan: { state: "error", onRetry: vi.fn() } })} />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no violations with Appearance open, and with Password open and refused", async () => {
    const { container } = render(<SettingsScreen {...props()} />);
    press(rowButton("Appearance"));
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
    press(rowButton("Password"));
    press(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});
