/** @vitest-environment happy-dom */
/**
 * The legacy EmailOtpForm after its state moved into `useEmailOtp`: the same flow, the same words.
 * Only Supabase's OTP calls are stood in for.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const sendOtp = vi.fn();
const verifyOtp = vi.fn();
vi.mock("@/lib/auth/otp", async (real) => ({
  ...(await real<typeof import("@/lib/auth/otp")>()),
  sendOtp: (email: string) => sendOtp(email),
  verifyOtp: (email: string, code: string) => verifyOtp(email, code),
}));

import { EmailOtpForm } from "../email-otp-form";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EmailOtpForm (legacy look)", () => {
  it("sends, moves to the code, and authenticates on the sixth digit", async () => {
    sendOtp.mockResolvedValue({ ok: true });
    verifyOtp.mockResolvedValue({ ok: true });
    const onAuthenticated = vi.fn();
    render(<EmailOtpForm onAuthenticated={onAuthenticated} submitLabel="Continue" />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "nia@example.com" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    });
    expect(sendOtp).toHaveBeenCalledWith("nia@example.com");
    expect(screen.getByText("We sent a code to")).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByLabelText("6-digit code"), { target: { value: "123456" } });
    });
    expect(verifyOtp).toHaveBeenCalledWith("nia@example.com", "123456");
    expect(onAuthenticated).toHaveBeenCalledOnce();
  });

  it("goes back to the email with Change email", async () => {
    sendOtp.mockResolvedValue({ ok: true });
    render(<EmailOtpForm onAuthenticated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "nia@example.com" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Change email" }));
    expect(screen.getByLabelText("Email")).toHaveValue("nia@example.com");
  });
});
