/** @vitest-environment happy-dom */
/**
 * HomeAudienceIntro — the first-run moment.
 *
 * What these lock:
 *  - it only speaks when a real calibration landed. General, a bare draft row (no personas) and
 *    "no audience" all render NOTHING — announcing the uncalibrated default as an achievement
 *    would be the same fabrication the audience band is careful to avoid.
 *  - the action matches what the creator actually has. Onboarding's describe door leaves NO
 *    connected account, so offering "Read my recent posts" there is a first action that cannot
 *    work. Keyed on `source_account_id`, which is what calibration sets when it connects one.
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
    render(
      <HomeAudienceIntro audience={audience()} onReadAccount={vi.fn()} onArmIdeas={vi.fn()} />,
    );
    expect(screen.getByTestId("home-audience-intro").textContent).toContain("3 people");
    expect(screen.getByTestId("home-audience-intro").textContent).toContain("built from @zachking");
  });

  it.each([
    ["no audience at all", null],
    ["General", audience({ is_general: true })],
    ["a draft with no personas", audience({ personas: [] })],
  ])("renders nothing for %s", (_label, aud) => {
    const { container } = render(
      <HomeAudienceIntro
        audience={aud as Audience | null}
        onReadAccount={vi.fn()}
        onArmIdeas={vi.fn()}
      />,
    );
    expect(container.textContent).toBe("");
  });
});

describe("HomeAudienceIntro — the action matches what they have", () => {
  it("offers the account read when calibration connected an account", () => {
    const onReadAccount = vi.fn();
    render(
      <HomeAudienceIntro
        audience={audience()}
        onReadAccount={onReadAccount}
        onArmIdeas={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /read my recent posts/i }));
    expect(onReadAccount).toHaveBeenCalledTimes(1);
  });

  it("offers Ideas instead when there is no account to read (the describe door)", () => {
    const onReadAccount = vi.fn();
    const onArmIdeas = vi.fn();
    render(
      <HomeAudienceIntro
        audience={audience({
          type: "target",
          platform: "custom",
          name: "Small business owners",
          source_account_id: null,
        })}
        onReadAccount={onReadAccount}
        onArmIdeas={onArmIdeas}
      />,
    );

    // The account read must not even be on offer — it would fail for this creator.
    expect(screen.queryByRole("button", { name: /read my recent posts/i })).toBeNull();
    expect(screen.getByTestId("home-audience-intro").textContent).toContain(
      "built from your description",
    );

    fireEvent.click(screen.getByRole("button", { name: /get content ideas/i }));
    expect(onArmIdeas).toHaveBeenCalledTimes(1);
    expect(onReadAccount).not.toHaveBeenCalled();
  });
});

describe("HomeAudienceIntro — show-once", () => {
  it("stays gone after Dismiss, across a remount, without running anything", () => {
    const onReadAccount = vi.fn();
    const first = render(
      <HomeAudienceIntro
        audience={audience()}
        onReadAccount={onReadAccount}
        onArmIdeas={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(first.container.textContent).toBe("");
    expect(onReadAccount).not.toHaveBeenCalled();

    first.unmount();
    const second = render(
      <HomeAudienceIntro audience={audience()} onReadAccount={vi.fn()} onArmIdeas={vi.fn()} />,
    );
    expect(second.container.textContent).toBe("");
  });

  it("is consumed by taking the action too, not only by dismissing", () => {
    const first = render(
      <HomeAudienceIntro audience={audience()} onReadAccount={vi.fn()} onArmIdeas={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /read my recent posts/i }));
    first.unmount();

    const second = render(
      <HomeAudienceIntro audience={audience()} onReadAccount={vi.fn()} onArmIdeas={vi.fn()} />,
    );
    expect(second.container.textContent).toBe("");
  });
});
