/** @vitest-environment happy-dom */
/**
 * SettingsNext — Settings with its data (spec 2026-11-26-settings-design, 2.4, 2.6 and 5): the real
 * screen, the real plan view, the real hooks (`useSubscription`, `useChangePassword` through TanStack
 * Query, `useThemeChoice`), the real CheckoutModal. Stand-ins only at the edges: `fetch` (a small server
 * for `/api/subscription`, `/api/settings/plan-state`, the delete and the password routes, and Whop's
 * checkout route), the browser Supabase client (`auth.getUser`, `auth.signOut`), `window.location.assign`,
 * the build-time flag (on), `matchMedia` (a phone) and the clock's date (Date only: 26 Nov 2026).
 * Every id and address is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.setConfig({ testTimeout: 30_000 });
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

const auth = {
  getUser: vi.fn(),
  signOut: vi.fn(),
};
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));

import { SettingsNext } from "../settings-next";
import { press, widthIs } from "./fixtures";

interface Call { method: string; url: string; body: unknown; contentType?: string | null }
let calls: Call[];
let subscription: Record<string, unknown>;
let liveAnswer: () => Response | Promise<Response>;
let deleteAnswer: () => Response | Promise<Response>;
let passwordAnswer: () => Response;
let assign: ReturnType<typeof vi.fn<(url: string | URL) => void>>;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const sent = (method: string, url: string) => calls.filter((c) => c.method === method && c.url === url);

const CREATOR = {
  tier: "starter",
  status: "active",
  isTrial: false,
  trialEndsAt: null,
  trialUsed: true,
  whopConnected: true,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: "2026-12-14T10:00:00.000Z",
  usage: { used: 188, limit: 500, remaining: 312, enforced: true, inTrial: false, renewsAt: "2026-12-14T10:00:00.000Z", periodStart: "2026-11-14T10:00:00.000Z" },
};
const FREE = { tier: "free", status: "active", isTrial: false, trialEndsAt: null, trialUsed: false, whopConnected: false, cancelAtPeriodEnd: false, currentPeriodEnd: null, usage: null };
const RENEWING = { membership: { status: "active", cancelAtPeriodEnd: false, renewsAt: "2026-12-14T10:00:00.000Z" } };
const CANCELLED_LIVE = { membership: { status: "active", cancelAtPeriodEnd: true, renewsAt: "2026-12-14T10:00:00.000Z" } };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-26T12:00:00.000Z"));
  widthIs("phone");
  calls = [];
  subscription = { ...CREATOR };
  liveAnswer = () => json(RENEWING);
  deleteAnswer = () => json({ deleted: true });
  passwordAnswer = () => json({ success: true });
  auth.getUser.mockReset().mockResolvedValue({ data: { user: { id: "acct-nia", email: "nia@example.com", app_metadata: { providers: ["email"] } } }, error: null });
  auth.signOut.mockReset().mockResolvedValue({ error: null });
  assign = vi.fn<(url: string | URL) => void>();
  vi.spyOn(window.location, "assign").mockImplementation(assign);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call: Call = {
        method: init?.method ?? "GET",
        url: String(input).split("?")[0]!,
        body: typeof init?.body === "string" ? JSON.parse(init.body) : (init?.body ?? null),
        contentType: new Headers(init?.headers).get("content-type"),
      };
      calls.push(call);
      switch (`${call.method} ${call.url}`) {
        case "GET /api/subscription":
          return json(subscription);
        case "GET /api/settings/plan-state":
          return liveAnswer();
        case "POST /api/settings/account/delete":
          return deleteAnswer();
        case "PATCH /api/settings/account/password":
          return passwordAnswer();
        case "POST /api/whop/checkout":
          return json({ checkoutConfigId: null, trialApplied: true });
        default:
          return json({ error: "Not found" }, 404);
      }
    }),
  );
});

let clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  for (const client of clients) client.clear();
  clients = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function renderSettings() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <SettingsNext />
    </QueryClientProvider>,
  );
}

const planCard = () => within(screen.getByRole("region", { name: "Plan" }));
const planReady = () => screen.findByText(/^\$49 a month · renews 14 Dec$|^Ends 14 Dec\. Nothing more is billed\.$|^Try any plan/);
const rowButton = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}\\b`) });

/** Opens Delete account on its confirm, types DELETE and presses the sheet's button. */
async function deleteNow() {
  press(rowButton("Delete account"));
  const sheet = within(await screen.findByRole("dialog", { name: "Delete nia@example.com?" }));
  fireEvent.change(sheet.getByRole("textbox", { name: "Type DELETE" }), { target: { value: "DELETE" } });
  await act(async () => press(sheet.getByRole("button", { name: "Delete account" })));
  return sheet;
}

describe("SettingsNext: the page", () => {
  it("shows the outline until the account is read, then the page with its email", async () => {
    let settle!: (value: unknown) => void;
    auth.getUser.mockReturnValueOnce(new Promise((resolve) => (settle = resolve)));
    renderSettings();
    expect(screen.getByTestId("settings-next-loading")).toHaveAttribute("aria-busy", "true");
    await act(async () => settle({ data: { user: { id: "acct-nia", email: "nia@example.com", app_metadata: { providers: ["email"] } } }, error: null }));
    expect(await screen.findByText("nia@example.com")).toBeInTheDocument();
    expect(screen.queryByTestId("settings-next-loading")).toBeNull();
  });

  it("an account that signs in with Google says so", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "acct-nia", email: "nia@example.com", app_metadata: { providers: ["email", "google"] } } }, error: null });
    renderSettings();
    expect(await screen.findByText("nia@example.com · Google")).toBeInTheDocument();
  });

  it("an account read that fails: the page without the email row", async () => {
    auth.getUser.mockRejectedValue(new Error("offline"));
    renderSettings();
    await screen.findByRole("heading", { name: "Account" });
    expect(screen.queryByText("Email")).toBeNull();
  });
});

describe("SettingsNext: the plan, from both reads", () => {
  it("the stored plan and the live read: a renewing Creator plan, its credits", async () => {
    renderSettings();
    await planReady();
    expect(planCard().getByText("Creator")).toBeInTheDocument();
    expect(planCard().getByText("Active")).toBeInTheDocument();
    expect(planCard().getByText("312 of 500 credits left")).toBeInTheDocument();
    expect(sent("GET", "/api/subscription")).toHaveLength(1);
    expect(sent("GET", "/api/settings/plan-state")).toHaveLength(1);
  });

  it("the live read wins over the stored row: a plan cancelled on Whop reads Cancelled", async () => {
    liveAnswer = () => json(CANCELLED_LIVE);
    renderSettings();
    expect(await screen.findByText("Ends 14 Dec. Nothing more is billed.")).toBeInTheDocument();
    expect(planCard().getByText("Cancelled")).toBeInTheDocument();
  });

  it.each([
    ["answers 500", () => json({ error: "x" }, 500)],
    ["cannot be reached", () => Promise.reject(new TypeError("Failed to fetch"))],
  ] as const)("a live read that %s counts as unknown: the stored plan stands", async (_case, answer) => {
    subscription = { ...CREATOR, cancelAtPeriodEnd: true };
    liveAnswer = answer;
    renderSettings();
    expect(await screen.findByText("Ends 14 Dec. Nothing more is billed.")).toBeInTheDocument();
  });

  it("no plan: the trial offered", async () => {
    subscription = { ...FREE };
    liveAnswer = () => json({ membership: null });
    renderSettings();
    expect(await screen.findByText("Try any plan for $1: 50 credits over 3 days.")).toBeInTheDocument();
    expect(planCard().getByText("No plan")).toBeInTheDocument();
  });

  it("the stored plan could not be read: the card says so, and Try again reads both again", async () => {
    let refuse = true;
    const ok = subscription;
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ method: init?.method ?? "GET", url, body: null });
      if (url === "/api/subscription") return refuse ? json({ error: "x" }, 500) : json(ok);
      if (url === "/api/settings/plan-state") return json(RENEWING);
      return json({ error: "Not found" }, 404);
    });
    renderSettings();
    expect(await screen.findByText("Couldn't load your plan.")).toBeInTheDocument();
    refuse = false;
    await act(async () => press(planCard().getByRole("button", { name: "Try again" })));
    expect(await screen.findByText("$49 a month · renews 14 Dec")).toBeInTheDocument();
    expect(sent("GET", "/api/subscription")).toHaveLength(2);
    expect(sent("GET", "/api/settings/plan-state")).toHaveLength(2);
  });

  it("the delete sheet's recheck (the page shown again) reads both again: a plan cancelled meanwhile turns the sheet to the confirm", async () => {
    renderSettings();
    await planReady();
    press(rowButton("Delete account"));
    await screen.findByRole("dialog", { name: "Cancel your plan first" });
    // Cancelled on Whop meanwhile; back on the page.
    subscription = { ...CREATOR, cancelAtPeriodEnd: true };
    liveAnswer = () => json(CANCELLED_LIVE);
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(await screen.findByRole("dialog", { name: "Delete nia@example.com?" })).toBeInTheDocument();
    expect(sent("GET", "/api/subscription")).toHaveLength(2);
    expect(sent("GET", "/api/settings/plan-state")).toHaveLength(2);
  });
});

describe("SettingsNext: the password", () => {
  const newPassword = () => screen.getByLabelText("New password") as HTMLInputElement;
  const again = () => screen.getByLabelText("Type it again") as HTMLInputElement;
  async function save(password: string) {
    await planReady();
    press(rowButton("Password"));
    fireEvent.change(newPassword(), { target: { value: password } });
    fireEvent.change(again(), { target: { value: password } });
    await act(async () => press(screen.getByRole("button", { name: "Save" })));
  }

  it("saved: sent to the password route, the row reads Saved", async () => {
    renderSettings();
    await save("correct horse");
    expect(sent("PATCH", "/api/settings/account/password").map((c) => c.body)).toEqual([{ newPassword: "correct horse" }]);
    await waitFor(() => expect(rowButton("Password")).toHaveTextContent("Saved"));
  });

  it("refused for its length: the length rule's words", async () => {
    passwordAnswer = () => json({ error: "Password should be at least 8 characters." }, 400);
    renderSettings();
    await save("correct horse");
    expect(await screen.findByRole("alert")).toHaveTextContent("8 characters or more");
  });

  it("refused for anything else: the plain failure", async () => {
    passwordAnswer = () => json({ error: "New password should be different from the old password." }, 400);
    renderSettings();
    await save("correct horse");
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save. Try again.");
  });
});

describe("SettingsNext: log out, and a plan's checkout", () => {
  it("Log out signs out and goes nowhere itself (the AuthGuard leads to /login)", async () => {
    renderSettings();
    await planReady();
    press(screen.getByRole("button", { name: "Log out" }));
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
  });

  it("See plans' start opens the checkout with the plan and the trial", async () => {
    subscription = { ...FREE };
    liveAnswer = () => json({ membership: null });
    renderSettings();
    await screen.findByText(/^Try any plan/);
    press(planCard().getByRole("button", { name: "See plans" }));
    await screen.findByRole("dialog", { name: "Choose a plan" });
    await act(async () => press(screen.getByRole("button", { name: "Start Creator for $1" })));
    expect(await screen.findByRole("dialog", { name: "Start Creator for $1" })).toBeInTheDocument();
    await waitFor(() => expect(sent("POST", "/api/whop/checkout").map((c) => c.body)).toEqual([{ planId: "starter", trial: true, funnel: false }]));
  });

  it("the trial used: the checkout at full price", async () => {
    subscription = { ...FREE, trialUsed: true };
    liveAnswer = () => json({ membership: null });
    renderSettings();
    await screen.findByText(/^Plans from/);
    press(planCard().getByRole("button", { name: "See plans" }));
    await screen.findByRole("dialog", { name: "Choose a plan" });
    await act(async () => press(screen.getByRole("button", { name: /^Start Creator · / })));
    await waitFor(() => expect(sent("POST", "/api/whop/checkout").map((c) => c.body)).toEqual([{ planId: "starter", trial: false, funnel: false }]));
  });
});

describe("SettingsNext: delete", () => {
  beforeEach(() => {
    subscription = { ...FREE, trialUsed: true };
    liveAnswer = () => json({ membership: null });
  });

  it("deleted: the request says DELETE; sign out, then leave for /login?deleted=1", async () => {
    renderSettings();
    await screen.findByText(/^Plans from/);
    await deleteNow();
    expect(sent("POST", "/api/settings/account/delete").map((c) => c.body)).toEqual([{ confirm: "DELETE" }]);
    // The route answers 415 to anything but JSON.
    expect(sent("POST", "/api/settings/account/delete").map((c) => c.contentType)).toEqual(["application/json"]);
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/login?deleted=1"));
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.signOut.mock.invocationCallOrder[0]).toBeLessThan(assign.mock.invocationCallOrder[0]!);
    // The sheet holds on "Deleting…" until the page is left: nothing offers a second delete.
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Deleting…" })).toBeInTheDocument();
  });

  it("deleted, and the sign-out throws: the page still leaves, and no failure is said", async () => {
    auth.signOut.mockRejectedValue(new Error("network"));
    renderSettings();
    await screen.findByText(/^Plans from/);
    const sheet = await deleteNow();
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/login?deleted=1"));
    expect(sheet.queryByText(/Couldn't delete/)).toBeNull();
    expect(sheet.getByRole("button", { name: "Deleting…" })).toBeInTheDocument();
  });

  it("refused because a plan renews: the sheet says to cancel first, and both reads run again", async () => {
    deleteAnswer = () => json({ error: "plan_renews", renewsAt: "2026-12-14T10:00:00.000Z" }, 409);
    renderSettings();
    await screen.findByText(/^Plans from/);
    await deleteNow();
    expect(await screen.findByRole("dialog", { name: "Cancel your plan first" })).toBeInTheDocument();
    await waitFor(() => expect(sent("GET", "/api/settings/plan-state")).toHaveLength(2));
    expect(sent("GET", "/api/subscription")).toHaveLength(2);
    expect(assign).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it.each([
    ["Whop could not be asked (503)", () => json({ error: "whop_unreachable" }, 503), "Couldn't check your plan with Whop. Try again in a minute."],
    ["the ledger (409)", () => json({ error: "ledger" }, 409), "Couldn't finish deleting your account. Try again."],
    ["a server failure (500)", () => json({ error: "delete_failed" }, 500), "Couldn't finish deleting your account. Try again."],
    ["no answer (the network)", () => Promise.reject(new TypeError("Failed to fetch")), "Couldn't finish deleting your account. Try again."],
  ] as const)("%s: the sheet's words, nothing left", async (_case, answer, words) => {
    deleteAnswer = answer;
    renderSettings();
    await screen.findByText(/^Plans from/);
    const sheet = await deleteNow();
    expect(await sheet.findByText(words)).toBeInTheDocument();
    expect(sheet.getByRole("button", { name: "Delete account" })).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
