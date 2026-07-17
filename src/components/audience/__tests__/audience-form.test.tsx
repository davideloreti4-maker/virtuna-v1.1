/** @vitest-environment happy-dom */
/**
 * AudienceForm mode preset (07-05 / UX-04 / D-08).
 *
 * Locks the description Build path landing a General SIM, without disturbing the
 * byte-identical Socials default:
 *  - Test 1: <AudienceForm initialMode="general" /> → the create POST body has mode==="general".
 *  - Test 2: <AudienceForm /> (no initialMode) → the create POST body has mode==="socials"
 *    (the DB default; the Socials form is byte-identical — no new visible control).
 *  - Test 3: /audience/new?mode=general ⇒ initialMode="general" passed to the form; any other /
 *    absent value ⇒ initialMode undefined (Socials default).
 *
 * Convention reused from persona-edit.test.tsx: happy-dom + next/navigation mock +
 * vi.stubGlobal("fetch", ...).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { Audience } from "@/lib/audience/audience-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

// CalibrationFlow mounts after a successful create — stub it so the test stays on
// the POST assertion and never pulls the heavy calibration tree.
vi.mock("../calibration-flow", () => ({
  CalibrationFlow: () => null,
}));

import { AudienceForm } from "../audience-form";

function savedAudience(): Audience {
  return {
    id: "aud-new-1",
    user_id: "user-1",
    name: "Test audience",
    type: "personal",
    mode: "general",
    platform: "tiktok",
    goal_label: null,
    goal_intent: null,
    is_general: false,
    is_preset: false,
    persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
    personas: [],
    profile: null,
    calibration: null,
    created_at: "2026-06-29T00:00:00.000Z",
    updated_at: "2026-06-29T00:00:00.000Z",
  };
}

function okResponse(audience: Audience) {
  return { ok: true, json: () => Promise.resolve({ audience }) };
}

async function submitNamed(name: string) {
  const nameInput = screen.getByLabelText("Audience name");
  fireEvent.change(nameInput, { target: { value: name } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AudienceForm — mode preset (D-08)", () => {
  it("initialMode='general' → the create POST body carries mode:'general'", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(savedAudience()));
    vi.stubGlobal("fetch", fetchMock);

    render(<AudienceForm initialMode="general" />);
    await submitNamed("My General SIM");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/audiences");
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string) as { mode?: string };
    expect(body.mode).toBe("general");
  });

  it("no initialMode → the create POST body carries mode:'socials' (byte-identical default)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(savedAudience()));
    vi.stubGlobal("fetch", fetchMock);

    render(<AudienceForm />);
    await submitNamed("My Socials audience");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string) as { mode?: string };
    expect(body.mode).toBe("socials");

    // No new visible control — the Socials form markup is byte-identical (D-08 lock).
    expect(screen.queryByText(/General mode/i)).not.toBeInTheDocument();
  });
});

// The /audience/new page-wiring tests moved to audience-create.test.tsx — the page
// renders the three-door AudienceCreate flow now (P4). AudienceForm remains the EDIT
// surface ([id]/page.tsx), and its direct-render contracts above still hold.
