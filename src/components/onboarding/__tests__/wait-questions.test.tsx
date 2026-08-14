/** @vitest-environment happy-dom */
/**
 * WaitQuestions — the three grounding questions asked during the ~128s calibration wait.
 *
 * What these lock, and why each one is here:
 *  - 🔴 EVERY answer persists the moment it is given. The block lives inside a wait that ENDS on
 *    its own and unmounts it; a save-on-submit design would silently discard whatever the creator
 *    had typed when calibration finished. There is no submit button by construction.
 *  - the writes go through PATCH /api/profile/creator-profile, NOT the supabase client directly.
 *    The retired interview store wrote `.from("creator_profiles").update(...)` itself and so
 *    bypassed `sanitizeText` — free text reached the CreatorContext prompt builder unstripped.
 *    `pain_points` is free text. The assertion is on the request, because that is the defect.
 *  - a FAILED save is visible. `supabase-check-constraints-fail-silently` and the swallowed-write
 *    trap both say the same thing: a write that stores nothing and reports nothing is worse than
 *    an error. It must not block calibration either — hence a quiet inline retry, not a dialog.
 *  - the mount PATCH is what makes `profile_interview_seen_at` mean "was asked" rather than
 *    "answered". Three rows carry that stamp today and the last is 2026-05-31; the column has been
 *    read as creators declining ever since, when the truth is the modal could not be opened.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { WaitQuestions } from "../wait-questions";

const ENDPOINT = "/api/profile/creator-profile";

let fetchMock: ReturnType<typeof vi.fn>;

function okResponse(): Response {
  return { ok: true, json: async () => ({ success: true }) } as unknown as Response;
}

function failResponse(): Response {
  return { ok: false, status: 500, json: async () => ({ error: "nope" }) } as unknown as Response;
}

/** Every PATCH body sent to the profile endpoint, in order, parsed. */
function patchBodies(): Array<Record<string, unknown>> {
  return fetchMock.mock.calls
    .filter(([url, init]) => url === ENDPOINT && init?.method === "PATCH")
    .map(([, init]) => JSON.parse(init.body as string) as Record<string, unknown>);
}

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(okResponse());
  vi.stubGlobal("fetch", fetchMock);
});

describe("WaitQuestions", () => {
  it("asks goal, stage and pain — the three the scrape cannot infer", () => {
    render(<WaitQuestions />);

    expect(screen.getByRole("group", { name: /goal/i })).toBeTruthy();
    expect(screen.getByRole("group", { name: /stage/i })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: /in your way|challenge/i })).toBeTruthy();
  });

  it("stamps the profile as asked on mount, before any answer", async () => {
    render(<WaitQuestions />);

    await waitFor(() => expect(patchBodies().length).toBe(1));
    expect(patchBodies()[0]).toEqual({});
  });

  it("persists a goal the moment it is picked", async () => {
    render(<WaitQuestions />);

    fireEvent.click(screen.getByRole("button", { name: "Growth" }));

    await waitFor(() =>
      expect(patchBodies()).toContainEqual({ primary_goal: "growth" })
    );
  });

  it("persists a stage the moment it is picked", async () => {
    render(<WaitQuestions />);

    fireEvent.click(screen.getByRole("button", { name: "New creator" }));

    await waitFor(() =>
      expect(patchBodies()).toContainEqual({ creator_stage: "new" })
    );
  });

  it("marks the picked option as pressed so the answer is visibly recorded", async () => {
    render(<WaitQuestions />);
    const growth = screen.getByRole("button", { name: "Growth" });

    fireEvent.click(growth);

    await waitFor(() => expect(growth.getAttribute("aria-pressed")).toBe("true"));
  });

  it("persists pain points on blur, trimmed", async () => {
    render(<WaitQuestions />);
    const box = screen.getByRole("textbox", { name: /in your way|challenge/i });

    fireEvent.change(box, { target: { value: "  hooks never land  " } });
    fireEvent.blur(box);

    await waitFor(() =>
      expect(patchBodies()).toContainEqual({ pain_points: "hooks never land" })
    );
  });

  it("does not write an empty pain field", async () => {
    render(<WaitQuestions />);
    const box = screen.getByRole("textbox", { name: /in your way|challenge/i });

    fireEvent.change(box, { target: { value: "   " } });
    fireEvent.blur(box);

    await waitFor(() => expect(patchBodies().length).toBe(1)); // the mount stamp only
    expect(patchBodies().some((b) => "pain_points" in b)).toBe(false);
  });

  it("does not re-send an unchanged pain field on a second blur", async () => {
    render(<WaitQuestions />);
    const box = screen.getByRole("textbox", { name: /in your way|challenge/i });

    fireEvent.change(box, { target: { value: "hooks never land" } });
    fireEvent.blur(box);
    await waitFor(() =>
      expect(patchBodies()).toContainEqual({ pain_points: "hooks never land" })
    );

    fireEvent.blur(box);

    await waitFor(() => expect(patchBodies().length).toBe(2)); // mount stamp + one save
  });

  it("stays quiet when only the mount stamp fails — it is bookkeeping, not an answer", async () => {
    fetchMock.mockResolvedValue(failResponse());
    render(<WaitQuestions />);

    await waitFor(() => expect(patchBodies().length).toBe(1));
    expect(screen.queryByRole("button", { name: /not saved/i })).toBeNull();
  });

  it("surfaces a failed save instead of swallowing it", async () => {
    fetchMock.mockResolvedValue(failResponse());
    render(<WaitQuestions />);

    fireEvent.click(screen.getByRole("button", { name: "Growth" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /not saved/i })).toBeTruthy()
    );
  });

  it("re-sends the answer when the failed save is retried", async () => {
    fetchMock.mockResolvedValue(failResponse());
    render(<WaitQuestions />);
    fireEvent.click(screen.getByRole("button", { name: "Growth" }));
    const retry = await screen.findByRole("button", { name: /not saved/i });

    fetchMock.mockResolvedValue(okResponse());
    fireEvent.click(retry);

    await waitFor(() =>
      expect(
        patchBodies().filter((b) => b.primary_goal === "growth").length
      ).toBe(2)
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /not saved/i })).toBeNull()
    );
  });

  it("keeps the answer selected after a failed save so a retry has something to send", async () => {
    fetchMock.mockResolvedValue(failResponse());
    render(<WaitQuestions />);
    const growth = screen.getByRole("button", { name: "Growth" });

    fireEvent.click(growth);

    await screen.findByRole("button", { name: /not saved/i });
    expect(growth.getAttribute("aria-pressed")).toBe("true");
  });

  it("never renders a submit control — the wait ends on its own", () => {
    render(<WaitQuestions />);

    expect(screen.queryByRole("button", { name: /save|submit|continue|done/i })).toBeNull();
  });
});
