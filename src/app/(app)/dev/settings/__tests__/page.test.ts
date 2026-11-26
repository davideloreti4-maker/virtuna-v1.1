/** @vitest-environment happy-dom */
/**
 * /dev/settings exists in the new look only. The flag is a build-time constant, so each case loads the
 * page fresh with the flag set the way that build would have it (as /dev/discover's test does). Each
 * state is rendered for real and shows what it is named for. Stand-in: `matchMedia` (a phone).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { press, widthIs } from "@/components/settings-next/__tests__/fixtures";

vi.setConfig({ testTimeout: 30_000 });

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  return (await import("../page")).default;
}

const search = (params: Record<string, string> = {}) => ({ searchParams: Promise.resolve(params) });

/** What Next throws for notFound(): an error whose digest names the outcome. */
async function thrown(run: () => unknown): Promise<string> {
  try {
    await run();
  } catch (error) {
    return String((error as { digest?: string }).digest ?? error);
  }
  return "nothing thrown";
}

beforeEach(() => widthIs("phone"));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.doUnmock("@/lib/flags/new-look");
  vi.resetModules();
});

async function show(state?: string) {
  const Page = await load(true);
  const element = (await Page(search(state === undefined ? {} : { state }))) as ReactElement<{ state: string }>;
  render(element);
  return element;
}
const plan = () => within(screen.getByRole("region", { name: "Plan" }));
const account = () => within(screen.getByRole("region", { name: "Account" }));

describe("/dev/settings", () => {
  it("is not found with the flag off", async () => {
    const Page = await load(false);
    expect(await thrown(() => Page(search({ state: "paid" })))).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it("an unknown state is not found", async () => {
    const Page = await load(true);
    expect(await thrown(() => Page(search({ state: "nope" })))).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it("opens paid by default: Creator, renews 14 Dec, 312 of 500 credits, the made-up email", async () => {
    const element = await show();
    expect(isValidElement(element) && element.props.state).toBe("paid");
    expect(plan().getByText("Creator")).toBeInTheDocument();
    expect(plan().getByText("$49 a month · renews 14 Dec")).toBeInTheDocument();
    expect(plan().getByText("312 of 500 credits left")).toBeInTheDocument();
    expect(account().getByText("nia@example.com")).toBeInTheDocument();
  });

  it.each([
    ["none", "Try any plan for $1: 50 credits over 3 days."],
    ["none-used", "Plans from $49 a month."],
    ["trial", "$1 for 3 days. Becomes Creator, $49 a month, on 29 Nov unless you cancel."],
    ["cancelled", "Ends 14 Dec. Nothing more is billed."],
    ["pastdue", "Whop couldn't take the payment. Update your card there to keep your credits."],
    ["studio", "Unlimited credits"],
    ["error", "Couldn't load your plan."],
  ])("%s: the plan card says it", async (state, words) => {
    await show(state);
    expect(plan().getByText(words)).toBeInTheDocument();
  });

  it("loading: the plan card's outline, busy, no words", async () => {
    await show("loading");
    expect(screen.getByRole("region", { name: "Plan" }).querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(plan().queryByText(/No plan|Creator/)).toBeNull();
  });

  it("google: the email names Google · noemail: no email row", async () => {
    await show("google");
    expect(account().getByText("nia@example.com · Google")).toBeInTheDocument();
    cleanup();
    await show("noemail");
    expect(account().queryByText("Email")).toBeNull();
  });

  it("delete-blocked: the sheet open on Cancel your plan first", async () => {
    await show("delete-blocked");
    expect(await screen.findByRole("dialog", { name: "Cancel your plan first" })).toBeInTheDocument();
  });

  it.each(["delete-confirm", "delete-failed", "delete-whop"])("%s: the sheet open on the confirm, with the credits lost", async (state) => {
    await show(state);
    const sheet = within(await screen.findByRole("dialog", { name: "Delete nia@example.com?" }));
    expect(sheet.getByText(/The 312 credits left are lost\./)).toBeInTheDocument();
    expect(sheet.getByRole("textbox", { name: "Type DELETE" })).toBeInTheDocument();
  });

  it.each([
    ["delete-failed", "Couldn't finish deleting your account. Try again."],
    ["delete-whop", "Couldn't check your plan with Whop. Try again in a minute."],
  ])("%s: a typed DELETE is answered with the sheet's words", async (state, words) => {
    await show(state);
    const sheet = within(await screen.findByRole("dialog", { name: "Delete nia@example.com?" }));
    fireEvent.change(sheet.getByRole("textbox", { name: "Type DELETE" }), { target: { value: "DELETE" } });
    await act(async () => press(sheet.getByRole("button", { name: "Delete account" })));
    expect(await sheet.findByText(words, {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it("a password with fail in it is refused with the screen's words", async () => {
    await show();
    press(screen.getByRole("button", { name: /^Password\b/ }));
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "failfail" } });
    fireEvent.change(screen.getByLabelText("Type it again"), { target: { value: "failfail" } });
    await act(async () => press(screen.getByRole("button", { name: "Save" })));
    expect(await account().findByRole("alert", {}, { timeout: 2000 })).toHaveTextContent("Couldn't save. Try again.");
  });
});
