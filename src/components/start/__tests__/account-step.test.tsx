/** @vitest-environment happy-dom */
/**
 * AccountStep (plan 01-start-and-profile, Task 7): screen 5, rendered for real with the real storage, events
 * and save call. Stand-ins only at the edges: the code calls to Supabase (`sendOtp`, `verifyOtp`), `fetch` (the
 * save route), the router.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/auth/otp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/otp")>()),
  sendOtp: vi.fn(async () => ({ ok: true })),
  verifyOtp: vi.fn(async () => ({ ok: true })),
}));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { __funnelBuffer, __resetFunnel } from "@/lib/analytics/funnel-events";
import { sendOtp, verifyOtp } from "@/lib/auth/otp";
import { START_STORAGE_KEY, type StartAnswers } from "@/lib/onboarding/answers";
import { FIRST_BUILD_KEY } from "@/lib/onboarding/first-build";

import { AccountStep } from "../account-step";
import { START_WORDS as W } from "../start-words";

const ANSWERS: StartAnswers = { platforms: ["tiktok"], tiktokHandle: "niacooks", niche: "budget meals for students", nicheSource: "typed", goal: "growth" };
const BUILD = { handle: "niacooks", type: "personal", platform: "tiktok", goalIntent: "grow", name: "@niacooks" };

let answer: { status: number; body: unknown };
let posts: unknown[];

beforeEach(() => {
  window.localStorage.setItem(START_STORAGE_KEY, JSON.stringify({ ...ANSWERS, step: "account" }));
  window.sessionStorage.clear();
  __resetFunnel();
  answer = { status: 200, body: { next: "/audience/new?guide=1", build: BUILD } };
  posts = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) !== "/api/onboarding/start" || init?.method !== "POST") throw new Error(`unexpected ${String(input)}`);
      posts.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify(answer.body), { status: answer.status });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  window.localStorage.clear();
});

const events = () => __funnelBuffer().map((e) => e.event);
const typeEmail = (value: string) => fireEvent.change(screen.getByLabelText(W.emailLabel), { target: { value } });
const press = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const typeCode = (value: string) => fireEvent.change(screen.getByLabelText(W.codeLabel), { target: { value } });

describe("AccountStep", () => {
  it("shows the setup as chips, and the consent line over the button", () => {
    render(<AccountStep answers={ANSWERS} account={null} />);
    expect(screen.getByRole("heading", { level: 1, name: W.accountTitle })).toBeInTheDocument();
    for (const chip of ["budget meals for students", "TikTok @niacooks", "More views and followers"]) expect(screen.getByText(chip)).toBeInTheDocument();
    expect(screen.getByText(W.consent)).toBeInTheDocument();
  });

  it("the consent box is unticked at first; ticked, the save carries it", async () => {
    render(<AccountStep answers={ANSWERS} account={{ email: "nia@hey.com" }} />);
    const box = screen.getByRole("checkbox", { name: W.consentBox });
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    expect(box).toBeChecked();
    await act(async () => press(W.continue));
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    expect(posts).toEqual([{ answers: ANSWERS, emailConsent: true }]);
    expect(__funnelBuffer().at(-1)!.payload).toMatchObject({ emailConsent: true });
  });

  it("the box stands above the code: it can be ticked before the sixth digit saves", async () => {
    render(<AccountStep answers={ANSWERS} account={null} />);
    typeEmail("nia@hey.com");
    await act(async () => press(W.sendCode));
    fireEvent.click(screen.getByRole("checkbox", { name: W.consentBox }));
    await act(async () => typeCode("419207"));
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    expect(posts).toEqual([{ answers: ANSWERS, emailConsent: true }]);
  });

  it("'work it out' shows as the niche from their videos", () => {
    render(<AccountStep answers={{ ...ANSWERS, niche: undefined, nicheSource: "account" }} account={null} />);
    expect(screen.getByText(W.nicheFromVideos)).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<AccountStep answers={ANSWERS} account={null} />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });

  it("email, code, saved: the building screen with the first build held, the visit cleared", async () => {
    render(<AccountStep answers={ANSWERS} account={null} />);
    expect(screen.getByRole("button", { name: W.sendCode })).toBeDisabled();
    typeEmail("nia@hey.com");
    await act(async () => press(W.sendCode));
    expect(sendOtp).toHaveBeenCalledWith("nia@hey.com");
    expect(screen.getByText(W.codeTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: W.resendIn(45) })).toBeDisabled();

    await act(async () => typeCode("419 207"));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/audience/new?guide=1"));
    expect(verifyOtp).toHaveBeenCalledWith("nia@hey.com", "419207");
    expect(posts).toEqual([{ answers: ANSWERS, emailConsent: false }]);
    expect(JSON.parse(window.sessionStorage.getItem(FIRST_BUILD_KEY)!)).toEqual(BUILD);
    expect(window.localStorage.getItem(START_STORAGE_KEY)).toBeNull();
    expect(events()).toEqual(["otp_start", "otp_done", "profile_saved"]);
    expect(__funnelBuffer()[2]!.payload).toMatchObject({ next: "/audience/new?guide=1", emailConsent: false, nicheSource: "typed", goal: "growth", platforms: "tiktok", handle: true });
  });

  it("a code that could not be sent: the message, still on the email", async () => {
    vi.mocked(sendOtp).mockResolvedValueOnce({ ok: false, error: "Too many codes requested. Wait a minute, then try again." });
    render(<AccountStep answers={ANSWERS} account={null} />);
    typeEmail("nia@hey.com");
    await act(async () => press(W.sendCode));
    expect(screen.getByRole("alert")).toHaveTextContent("Too many codes requested");
    expect(screen.queryByText(W.codeTitle)).toBeNull();
  });

  it("a wrong code: the message, the boxes empty, nothing saved", async () => {
    vi.mocked(verifyOtp).mockResolvedValueOnce({ ok: false, error: "That code isn't right. Check the digits and try again." });
    render(<AccountStep answers={ANSWERS} account={null} />);
    typeEmail("nia@hey.com");
    await act(async () => press(W.sendCode));
    await act(async () => typeCode("111111"));
    expect(screen.getByRole("alert")).toHaveTextContent("That code isn't right");
    expect(screen.getByLabelText(W.codeLabel)).toHaveValue("");
    expect(posts).toHaveLength(0);
    expect(events()).toEqual(["otp_start"]);
  });

  it("while the code is checked the box and Change email are locked, and the save carries the box as it stands", async () => {
    let finish!: (r: { ok: boolean }) => void;
    vi.mocked(verifyOtp).mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    render(<AccountStep answers={ANSWERS} account={null} />);
    typeEmail("nia@hey.com");
    await act(async () => press(W.sendCode));
    const box = screen.getByRole("checkbox", { name: W.consentBox });
    fireEvent.click(box);
    await act(async () => typeCode("419207"));
    expect(box).toBeDisabled();
    expect(screen.getByRole("button", { name: W.changeEmail })).toBeDisabled();
    fireEvent.click(box);
    await act(async () => finish({ ok: true }));
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    expect(posts).toEqual([{ answers: ANSWERS, emailConsent: (box as HTMLInputElement).checked }]);
    expect(__funnelBuffer().at(-1)!.payload).toMatchObject({ emailConsent: (box as HTMLInputElement).checked });
  });

  it("after a wrong code the code field has the focus again", async () => {
    vi.mocked(verifyOtp).mockResolvedValueOnce({ ok: false, error: "That code isn't right. Check the digits and try again." });
    render(<AccountStep answers={ANSWERS} account={null} />);
    typeEmail("nia@hey.com");
    await act(async () => press(W.sendCode));
    const input = screen.getByLabelText(W.codeLabel);
    act(() => input.blur());
    await act(async () => typeCode("111111"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(document.activeElement).toBe(input);
  });

  it("Change email goes back to the email", async () => {
    render(<AccountStep answers={ANSWERS} account={null} />);
    typeEmail("nia@hey.com");
    await act(async () => press(W.sendCode));
    press(W.changeEmail);
    expect(screen.getByRole("button", { name: W.sendCode })).toBeEnabled();
  });

  it("a save that fails keeps them here; Continue tries again", async () => {
    answer = { status: 500, body: { error: "Failed to save" } };
    render(<AccountStep answers={ANSWERS} account={null} />);
    typeEmail("nia@hey.com");
    await act(async () => press(W.sendCode));
    await act(async () => typeCode("419207"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(W.saveFailed));
    expect(router.replace).not.toHaveBeenCalled();

    answer = { status: 200, body: { next: "/home", build: null } };
    await act(async () => press(W.continue));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/home"));
    expect(posts).toHaveLength(2);
    expect(window.sessionStorage.getItem(FIRST_BUILD_KEY)).toBeNull();
  });

  it.each(["https://evil.test/x", "//evil.test", "/\\evil.test"])("an answer to leave for %s is refused", async (next) => {
    answer = { status: 200, body: { next, build: null } };
    render(<AccountStep answers={ANSWERS} account={{ email: "nia@hey.com" }} />);
    await act(async () => press(W.continue));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(W.saveFailed));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("signed in already: no email, Continue saves", async () => {
    render(<AccountStep answers={ANSWERS} account={{ email: "nia@hey.com" }} />);
    expect(screen.queryByLabelText(W.emailLabel)).toBeNull();
    expect(screen.getByText(W.signedInAs("nia@hey.com"))).toBeInTheDocument();
    await act(async () => press(W.continue));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/audience/new?guide=1"));
    expect(sendOtp).not.toHaveBeenCalled();
    expect(events()).toEqual(["profile_saved"]);
  });
});
