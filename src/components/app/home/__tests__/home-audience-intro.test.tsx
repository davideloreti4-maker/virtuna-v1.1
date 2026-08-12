/** @vitest-environment happy-dom */
/**
 * HomeAudienceIntro — the first-run moment.
 *
 * What these lock:
 *  - it only speaks when a real calibration landed. General, a bare draft row (no personas) and
 *    "no audience" all render NOTHING — announcing the uncalibrated default as an achievement
 *    would be the same fabrication the audience band is careful to avoid.
 *  - BOTH doors get the same, free action. This used to branch on `source_account_id` and offer
 *    "Read my recent posts" to anyone with a connected account — which walked into a 402 on
 *    every new signup (`account` costs 5 credits, free tier's allowance is 0, enforcement on in
 *    prod). The describe door's creator and the handle door's creator now get one action that
 *    works for both and costs no Apify call.
 *  - show-once survives a remount, and Dismiss consumes it without running anything.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { HomeAudienceIntro } from "../home-audience-intro";
import type { Audience } from "@/lib/audience/audience-types";

function audience(over: Partial<Audience> = {}): Audience {
  return {
    id: "aud-1",
    name: "@zachking",
    type: "personal",
    platform: "tiktok",
    is_general: false,
    personas: [{}, {}, {}],
    source_account_id: "acct-1",
    ...over,
  } as unknown as Audience;
}

beforeEach(() => {
  localStorage.clear();
});

describe("HomeAudienceIntro — only speaks when there is something true to say", () => {
  it("names the audience and where it came from", () => {
    render(<HomeAudienceIntro audience={audience()} onFirstCard={vi.fn()} />);
    expect(screen.getByTestId("home-audience-intro").textContent).toContain("3 people");
    expect(screen.getByTestId("home-audience-intro").textContent).toContain("built from @zachking");
  });

  it.each([
    ["no audience at all", null],
    ["General", audience({ is_general: true })],
    ["a draft with no personas", audience({ personas: [] })],
  ])("renders nothing for %s", (_label, aud) => {
    const { container } = render(
      <HomeAudienceIntro audience={aud as Audience | null} onFirstCard={vi.fn()} />,
    );
    expect(container.textContent).toBe("");
  });
});

describe("HomeAudienceIntro — one free action, both doors", () => {
  it("offers the first card to a creator who connected an account", () => {
    const onFirstCard = vi.fn();
    render(<HomeAudienceIntro audience={audience()} onFirstCard={onFirstCard} />);

    fireEvent.click(screen.getByRole("button", { name: /write me something to post/i }));
    expect(onFirstCard).toHaveBeenCalledTimes(1);
  });

  it("offers the SAME action on the describe door, which has no account to read", () => {
    const onFirstCard = vi.fn();
    render(
      <HomeAudienceIntro
        audience={audience({
          type: "target",
          platform: "custom",
          name: "Small business owners",
          source_account_id: null,
        })}
        onFirstCard={onFirstCard}
      />,
    );

    expect(screen.getByTestId("home-audience-intro").textContent).toContain(
      "built from your description",
    );

    fireEvent.click(screen.getByRole("button", { name: /write me something to post/i }));
    expect(onFirstCard).toHaveBeenCalledTimes(1);
  });

  it("never offers the account read — it 402s for exactly this user", () => {
    // The regression that closed this lane's headline defect. `account` is 5 credits against a
    // free-tier allowance of 0, so the one CTA in the one sentence of onboarding opened a
    // paywall. If this label ever comes back, so does that.
    render(<HomeAudienceIntro audience={audience()} onFirstCard={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /read my recent posts/i })).toBeNull();
  });
});

describe("HomeAudienceIntro — show-once", () => {
  it("stays gone after Dismiss, across a remount, without running anything", () => {
    const onFirstCard = vi.fn();
    const first = render(
      <HomeAudienceIntro audience={audience()} onFirstCard={onFirstCard} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(first.container.textContent).toBe("");
    expect(onFirstCard).not.toHaveBeenCalled();

    first.unmount();
    const second = render(<HomeAudienceIntro audience={audience()} onFirstCard={vi.fn()} />);
    expect(second.container.textContent).toBe("");
  });

  it("is consumed by taking the action too, not only by dismissing", () => {
    const first = render(<HomeAudienceIntro audience={audience()} onFirstCard={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /write me something to post/i }));
    first.unmount();

    const second = render(<HomeAudienceIntro audience={audience()} onFirstCard={vi.fn()} />);
    expect(second.container.textContent).toBe("");
  });
});
