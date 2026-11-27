/** @vitest-environment happy-dom */
/**
 * StartFlow (plan 01-start-and-profile, Task 8): screens 2–4 and the step machine, rendered for real with the
 * real local storage, address (happy-dom's history) and events. Stand-ins only at the edges: the router (Back
 * to the landing page) and the code calls to Supabase, which the account step imports.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/auth/otp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/otp")>()),
  sendOtp: vi.fn(async () => ({ ok: true })),
  verifyOtp: vi.fn(async () => ({ ok: true })),
}));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { __funnelBuffer, __resetFunnel } from "@/lib/analytics/funnel-events";
import { START_STORAGE_KEY } from "@/lib/onboarding/answers";

import { StartFlow } from "../start-flow";
import { START_WORDS as W } from "../start-words";

const TIKTOK = { platforms: ["tiktok"], tiktokHandle: "niacooks", nicheSource: "typed" };
const ALL = { ...TIKTOK, niche: "budget meals for students", goal: "growth" };

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/start");
  __resetFunnel();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function open(path = "/start", stored?: unknown) {
  if (stored) window.localStorage.setItem(START_STORAGE_KEY, JSON.stringify(stored));
  window.history.replaceState(null, "", path);
  render(<StartFlow account={null} />);
  return screen.findByRole("heading", { level: 1 });
}
const title = () => screen.getByRole("heading", { level: 1 }).textContent;
const kept = () => JSON.parse(window.localStorage.getItem(START_STORAGE_KEY) ?? "null");
const shown = () => __funnelBuffer().filter((e) => e.event === "start_step").map((e) => e.payload.step);
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const bar = () => screen.queryByRole("progressbar");

describe("Where do you post?", () => {
  it("a fresh visit starts here, step 1 of 3, Continue off until a platform is picked", async () => {
    await open();
    expect(title()).toBe(W.platformTitle);
    expect(window.location.search).toBe("?step=platform");
    expect(bar()).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByText(W.stepOf(1))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: W.continue })).toBeDisabled();
    expect(shown()).toEqual(["platform"]);
  });

  it("TikTok with a handle: on to the niche, the answers kept, the step in the address", async () => {
    await open();
    press("TikTok");
    expect(screen.getByRole("button", { name: "TikTok" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByLabelText(/Your TikTok handle/), { target: { value: "@NiaCooks" } });
    press(W.continue);
    expect(title()).toBe(W.nicheTitle);
    expect(window.location.search).toBe("?step=niche");
    expect(kept()).toEqual({ ...TIKTOK, step: "niche" });
    expect(shown()).toEqual(["platform", "niche"]);
  });

  it("a handle that cannot be one: said under the field, still here", async () => {
    await open();
    press("TikTok");
    fireEvent.change(screen.getByLabelText(/Your TikTok handle/), { target: { value: "nia cooks" } });
    press(W.continue);
    expect(screen.getByRole("alert")).toHaveTextContent(W.handleBad("tiktok"));
    expect(title()).toBe(W.platformTitle);
  });

  it("both platforms, Skip the handle: no handle kept, and no 'work it out'", async () => {
    await open();
    press("TikTok");
    press("Instagram");
    expect(screen.getByLabelText(/Your Instagram handle/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Your TikTok handle/), { target: { value: "niacooks" } });
    press(W.skipHandle);
    expect(kept()).toEqual({ platforms: ["tiktok", "instagram"], nicheSource: "typed", step: "niche" });
    expect(screen.queryByRole("button", { name: /Let Maven work it out/ })).toBeNull();
  });

  it("Back on the first step goes to the landing page", async () => {
    await open();
    press(W.back);
    expect(router.push).toHaveBeenCalledWith("/");
  });
});

describe("What are your videos about?", () => {
  it("too short is said; their words go on to the goal", async () => {
    await open("/start", { ...TIKTOK, step: "niche" });
    const field = screen.getByLabelText(W.nicheLabel);
    expect(field).toHaveAttribute("placeholder", W.nichePlaceholder);
    expect(field).toHaveAttribute("maxLength", "60");
    fireEvent.change(field, { target: { value: "a" } });
    press(W.continue);
    expect(screen.getByRole("alert")).toHaveTextContent(W.nicheShort);
    fireEvent.change(field, { target: { value: "  budget meals  for students " } });
    press(W.continue);
    expect(title()).toBe(W.goalTitle);
    expect(kept()).toMatchObject({ niche: "budget meals for students", nicheSource: "typed", step: "goal" });
  });

  it("with a TikTok handle, Maven may work it out from the account", async () => {
    await open("/start", { ...TIKTOK, step: "niche" });
    expect(screen.getByText(W.workItOutLine("niacooks"))).toBeInTheDocument();
    press(/Let Maven work it out/);
    expect(title()).toBe(W.goalTitle);
    expect(kept()).toEqual({ ...TIKTOK, nicheSource: "account", step: "goal" });
  });

  it("Back returns to the platform, with what was picked", async () => {
    await open("/start", { ...TIKTOK, step: "niche" });
    press(W.back);
    expect(title()).toBe(W.platformTitle);
    expect(window.location.search).toBe("?step=platform");
    expect(screen.getByRole("button", { name: "TikTok" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText(/Your TikTok handle/)).toHaveValue("niacooks");
  });
});

describe("Your 90-day goal", () => {
  it("Continue off until a goal is picked; then the account step, which has no bar", async () => {
    await open("/start", { ...TIKTOK, niche: "budget meals for students", step: "goal" });
    expect(bar()).toHaveAttribute("aria-valuenow", "3");
    expect(screen.getByRole("button", { name: W.continue })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: W.goal.engagement }));
    press(W.continue);
    expect(title()).toBe(W.accountTitle);
    expect(bar()).toBeNull();
    expect(kept()).toMatchObject({ goal: "engagement", step: "account" });
  });
});

describe("resume and the address", () => {
  it("a refresh resumes at the stored step", async () => {
    expect(await open("/start", { ...TIKTOK, step: "niche" })).toHaveTextContent(W.nicheTitle);
  });

  it("an address past the first open question shows that question, and says so in the address", async () => {
    expect(await open("/start?step=goal")).toHaveTextContent(W.platformTitle);
    expect(window.location.search).toBe("?step=platform");
  });

  it("an address may go back to an answered step", async () => {
    expect(await open("/start?step=platform", { ...ALL, step: "account" })).toHaveTextContent(W.platformTitle);
  });

  it("everything answered: the account step", async () => {
    expect(await open("/start?step=account", { ...ALL, step: "goal" })).toHaveTextContent(W.accountTitle);
  });

  it("the browser's Back walks the steps", async () => {
    await open("/start", { ...TIKTOK, step: "niche" });
    act(() => {
      window.history.replaceState(null, "", "/start?step=platform");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(title()).toBe(W.platformTitle);
  });
});
