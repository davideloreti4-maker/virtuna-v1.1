/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ClaimAccountDialog } from "../claim-account-dialog";
import { beginGoogleLink, linkEmailPassword } from "@/lib/onboarding/claim-account";

/** The post-payment claim step. The mechanics (stamp order, redirect target) are pinned in
 *  lib/onboarding/__tests__/claim-account.test.ts; this file pins which mechanic each
 *  control fires and that failures surface as words, not silence. */

vi.mock("@/lib/onboarding/claim-account", () => ({
  beginGoogleLink: vi.fn(async () => ({ ok: true })),
  linkEmailPassword: vi.fn(async () => ({ ok: true })),
}));

const mockGoogle = vi.mocked(beginGoogleLink);
const mockEmail = vi.mocked(linkEmailPassword);

beforeEach(() => {
  mockGoogle.mockClear().mockResolvedValue({ ok: true });
  mockEmail.mockClear().mockResolvedValue({ ok: true });
});

afterEach(cleanup);

describe("ClaimAccountDialog", () => {
  it("Google is the primary door and fires the link with the page origin", async () => {
    const user = userEvent.setup();
    render(<ClaimAccountDialog open onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(mockGoogle).toHaveBeenCalledWith(window.location.origin);
  });

  it("a refused link (manual linking off project-side) is SAID, not swallowed", async () => {
    mockGoogle.mockResolvedValue({ ok: false, error: "Manual linking is disabled" });
    const user = userEvent.setup();
    render(<ClaimAccountDialog open onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(await screen.findByText(/manual linking is disabled/i)).toBeTruthy();
  });

  it("the email path converts with email + password, then says the verdict waits on the CONFIRMATION", async () => {
    const user = userEvent.setup();
    render(<ClaimAccountDialog open onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/you@example/i), "v@test.local");
    await user.type(screen.getByPlaceholderText(/password/i), "longenough8");
    await user.click(screen.getByRole("button", { name: /link with email/i }));

    expect(mockEmail).toHaveBeenCalledWith("v@test.local", "longenough8");
    // Honest about the extra step: is_anonymous flips on CONFIRM, not on submit.
    expect(await screen.findByText(/check your inbox/i)).toBeTruthy();
    expect(screen.getByText(/opens the moment it.*confirmed/i)).toBeTruthy();
  });

  it("blocks a sub-8-character password before any network call", async () => {
    const user = userEvent.setup();
    render(<ClaimAccountDialog open onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/you@example/i), "v@test.local");
    await user.type(screen.getByPlaceholderText(/password/i), "short");
    await user.click(screen.getByRole("button", { name: /link with email/i }));

    expect(mockEmail).not.toHaveBeenCalled();
    expect(await screen.findByText(/at least 8 characters/i)).toBeTruthy();
  });

  it("never offers a signup — linking attaches to the session that ran the video", () => {
    render(<ClaimAccountDialog open onClose={vi.fn()} />);

    expect(screen.getByText(/never creates a new account/i)).toBeTruthy();
    expect(screen.queryByText(/sign up/i)).toBeNull();
  });
});
