/** @vitest-environment happy-dom */
/**
 * The new-look auth screens, rendered for real with the real `useEmailOtp`. Stood in for: only the
 * network edges (Supabase's OTP calls in `@/lib/auth/otp`, the server actions, the Supabase client)
 * and the router. OTP_LENGTH and the cooldown are the real ones.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

const sendOtp = vi.fn();
const verifyOtp = vi.fn();
vi.mock("@/lib/auth/otp", async (real) => ({
  ...(await real<typeof import("@/lib/auth/otp")>()),
  sendOtp: (email: string) => sendOtp(email),
  verifyOtp: (email: string, code: string) => verifyOtp(email, code),
}));

const loginAction = vi.fn();
const signupAction = vi.fn();
vi.mock("@/app/(onboarding)/login/actions", () => ({ login: (...a: unknown[]) => loginAction(...a) }));
vi.mock("@/app/(onboarding)/signup/actions", () => ({ signup: (...a: unknown[]) => signupAction(...a) }));
vi.mock("@/app/(onboarding)/forgot-password/actions", () => ({ requestPasswordReset: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signInWithOAuth: vi.fn() } }) }));

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn(), push: vi.fn() }) }));

import { LoginNext } from "../login-next";
import { SignupNext } from "../signup-next";

const REAL_UA = navigator.userAgent;
const setUserAgent = (ua: string) => Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });

beforeEach(() => {
  sendOtp.mockResolvedValue({ ok: true });
  verifyOtp.mockResolvedValue({ ok: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  setUserAgent(REAL_UA);
});

const google = () => screen.queryByRole("button", { name: "Continue with Google" });
const passwordInstead = () => screen.queryByRole("button", { name: "Sign in with a password instead" });

async function sendCodeTo(email: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  });
}

describe("LoginNext", () => {
  it("offers Google first in an ordinary browser, then the emailed code and the password", () => {
    render(<LoginNext />);
    expect(google()).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(passwordInstead()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("does not draw Google inside a TikTok webview, where Google refuses", () => {
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_32.5.0 BytedanceWebview/d8a21c6");
    render(<LoginNext />);
    expect(google()).toBeNull();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("sends the code, holds only the code step on the card, and opens the session on the sixth digit", async () => {
    render(<LoginNext next="/library" />);
    await sendCodeTo("nia@example.com");

    expect(sendOtp).toHaveBeenCalledWith("nia@example.com");
    expect(screen.getByText("nia@example.com")).toBeInTheDocument();
    expect(google()).toBeNull();
    expect(passwordInstead()).toBeNull();
    const code = screen.getByLabelText("6-digit code");
    expect(code).toHaveFocus();
    expect(screen.getByRole("button", { name: /^Resend in \d+s$/ })).toBeDisabled();

    await act(async () => {
      fireEvent.change(code, { target: { value: "12 34 56" } });
    });
    expect(verifyOtp).toHaveBeenCalledWith("nia@example.com", "123456");
    expect(replace).toHaveBeenCalledWith("/library");
  });

  it("says why a code was refused, empties the field, and stays on the step", async () => {
    verifyOtp.mockResolvedValue({ ok: false, error: "That code has expired. Send a new one." });
    render(<LoginNext />);
    await sendCodeTo("nia@example.com");
    await act(async () => {
      fireEvent.change(screen.getByLabelText("6-digit code"), { target: { value: "000000" } });
    });

    expect(screen.getByRole("alert")).toHaveTextContent("That code has expired. Send a new one.");
    expect(screen.getByLabelText("6-digit code")).toHaveValue("");
    expect(replace).not.toHaveBeenCalled();
  });

  it("gives the other ways back after Change email", async () => {
    render(<LoginNext />);
    await sendCodeTo("nia@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Change email" }));
    expect(google()).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("nia@example.com");
  });

  it("shows a refused send in the email step without moving on", async () => {
    sendOtp.mockResolvedValue({ ok: false, error: "That doesn't look like a valid email address." });
    render(<LoginNext />);
    await sendCodeTo("nia@");
    expect(screen.getByRole("alert")).toHaveTextContent("That doesn't look like a valid email address.");
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByLabelText("6-digit code")).toBeNull();
  });

  it("tells the visitor why they are here before the form", () => {
    render(<LoginNext deleted expired message="That reset link has expired." error="Invalid login credentials." />);
    const notes = screen.getAllByRole("status").map((n) => n.textContent);
    expect(notes).toEqual(["Your account was deleted.", "That reset link has expired.", "Your session ended. Sign in again."]);
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid login credentials.");
  });

  it("opens the password form on request, with the way to reset it", () => {
    render(<LoginNext />);
    fireEvent.click(passwordInstead()!);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<LoginNext deleted />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("SignupNext", () => {
  it("refuses two different passwords here and sends nothing", async () => {
    render(<SignupNext />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "nia@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret-one" } });
    fireEvent.change(screen.getByLabelText("Password again"), { target: { value: "secret-two" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Those passwords don't match.");
    expect(screen.getByLabelText("Password again")).toHaveAttribute("aria-invalid", "true");
    expect(signupAction).not.toHaveBeenCalled();
  });

  it("shows the server's refusal as written", () => {
    render(<SignupNext error="An account with this email already exists. Try signing in instead." />);
    expect(screen.getByRole("alert")).toHaveTextContent("An account with this email already exists.");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });
});
