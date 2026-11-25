/** @vitest-environment happy-dom */
/**
 * AfterPostingCard — the "After posting" card on a result page (plan 2026-11-24-after-posting, Task 3;
 * spec §3.2 and §3.3; drawing frames 3 to 5): what Maven said next to what the post got, the account's
 * usual in its tone's colour, the counts, the foot with the post's own link, the reading and the
 * unread states, and the menu that removes the link (asked once more). Rendered for real with Radix
 * underneath. Stand-ins: `matchMedia` (the phone's sheet or the desk's menu), and, where a test times
 * a press, the page's clock (`performance.now`). `now` is fixed by the fixtures.
 */
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import type { Posted } from "@/lib/posted/posted";
import { POSTED_STRINGS } from "@/lib/posted/posted-words";
import { AfterPostingCard, type AfterPostingCardProps } from "../after-posting-card";
import { CAPTION, HREF, NOW, PASTED, posted, reading, soFar, unread } from "./posted-fixtures";

function widthIs(view: "phone" | "desk") {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: view === "desk" && /min-width:\s*768px/.test(query),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

beforeEach(() => widthIs("phone"));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderCard(p: Posted, over: Partial<AfterPostingCardProps> = {}) {
  const props: AfterPostingCardProps = { posted: p, now: NOW, onTryAgain: vi.fn(), onRemove: vi.fn(), ...over };
  const view = render(<AfterPostingCard {...props} />);
  return { props, ...view };
}

const card = () => document.querySelector<HTMLElement>("[data-after-posting]")!;
const text = () => card().textContent!.replace(/\s+/g, " ");
const tile = (label: string) => within(card()).getByText(label).closest("[data-tile]") as HTMLElement;
const more = () => screen.getByRole("button", { name: "More: posted link" });
const dialog = () => screen.getByRole("dialog");
/** Radix hands the focus back on a timer once the layer is gone. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));
function clock() {
  vi.useFakeTimers({ toFake: ["performance"] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
}
const later = (ms: number) => vi.advanceTimersByTime(ms);

describe("AfterPostingCard — final", () => {
  it("Maven said and It got side by side, the usual under the views, the counts, the foot", () => {
    renderCard(posted());
    expect(within(card()).getByRole("heading", { level: 2, name: "After posting" })).toBeInTheDocument();
    expect(tile("Maven said").textContent).toBe("Maven said67%would stop to watch");
    expect(tile("It got").textContent).toBe("It got31Kviews1.8× your usual");
    expect(within(card()).getByText("2.1K likes · 84 comments · 310 shares · 420 saves")).toBeInTheDocument();
    expect(within(card()).getByText((_, el) => el?.tagName === "P" && el.textContent === "Posted Fri 20 Nov on TikTok, @nia.cooks · final numbers")).toBeInTheDocument();
  });

  it.each([
    [{ ratio: 1.8, tone: "above" as const }, "1.8× your usual", "text-above"],
    [{ ratio: 0.4, tone: "below" as const }, "0.4× your usual", "text-below-text"],
    [{ ratio: 1, tone: "around" as const }, "1× your usual", "text-foreground-secondary"],
  ])("the usual (%o) is in its tone's colour", (usual, words, colour) => {
    renderCard(posted({ usual }));
    const line = within(card()).getByText(words);
    expect(line).toHaveClass(colour);
    for (const other of ["text-above", "text-below-text"].filter((c) => c !== colour)) expect(line).not.toHaveClass(other);
  });

  it("nothing else on the card is coloured: green and coral only on the usual", () => {
    renderCard(posted({ usual: { ratio: 1.8, tone: "above" } }));
    const coloured = Array.from(card().querySelectorAll("*")).filter((el) => /\btext-(above|below-text|error|accent)\b/.test(el.getAttribute("class") ?? ""));
    expect(coloured.map((el) => el.textContent)).toEqual(["1.8× your usual"]);
  });

  it("final without a usual (fewer than 5 settled posts): the views alone", () => {
    renderCard(posted({ usual: null }));
    expect(tile("It got").textContent).toBe("It got31Kviews");
    expect(text()).not.toContain("your usual");
  });

  it("the handle is the post's own link: a new tab, no opener, no referrer; 44 to tap", () => {
    renderCard(posted());
    const link = within(card()).getByRole("link", { name: "@nia.cooks" });
    expect(link).toHaveAttribute("href", HREF);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveClass("tap-44");
  });

  it("no address for the post: the handle is plain text, not a link", () => {
    renderCard(posted({ href: null }));
    expect(within(card()).queryByRole("link")).toBeNull();
    expect(text()).toContain("Posted Fri 20 Nov on TikTok, @nia.cooks · final numbers");
  });

  it("no post time and no handle: Posted on TikTok", () => {
    renderCard(posted({ postedAt: null, handle: null, href: null }));
    expect(text()).toContain("Posted on TikTok · final numbers");
  });

  it("a video: Maven said what the page says, % watch to the end", () => {
    renderCard(posted({ said: { number: 46, measure: "end" } }));
    expect(tile("Maven said").textContent).toBe("Maven said46%watch to the end");
  });

  it("singular: 1 view", () => {
    renderCard(posted({ usual: null, numbers: { views: 1, likes: 1, comments: 0, shares: 0, saves: 0 } }));
    expect(tile("It got").textContent).toBe("It got1view");
    expect(text()).toContain("1 like · 0 comments · 0 shares · 0 saves");
  });
});

describe("AfterPostingCard — so far", () => {
  it("the views so far, no usual, and the day the numbers are final", () => {
    renderCard(soFar());
    expect(tile("It got").textContent).toBe("It got12.4Kviews so far");
    expect(text()).toContain("890 likes · 31 comments · 96 shares · 140 saves");
    expect(text()).toContain("Posted Mon 23 Nov on TikTok, @nia.cooks · final numbers Thursday");
  });

  it("final tomorrow / today, by the clock it is given", () => {
    const { rerender, props } = renderCard(soFar());
    rerender(<AfterPostingCard {...props} now={new Date(2026, 10, 25, 12)} />);
    expect(text()).toContain("· final numbers tomorrow");
    rerender(<AfterPostingCard {...props} now={new Date(2026, 10, 26, 8)} />);
    expect(text()).toContain("· final numbers today");
  });
});

describe("AfterPostingCard — reading", () => {
  it("the two lines, announced politely; no numbers, no foot", () => {
    renderCard(reading());
    const status = within(card()).getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status.textContent).toBe("Reading the postThis takes about a minute.");
    expect(within(card()).queryByText("It got")).toBeNull();
    expect(within(card()).queryByText("Maven said")).toBeNull();
    expect(text()).not.toContain("TikTok");
    expect(more()).toBeInTheDocument();
  });

  it("a read asked again (Try again) is out: the unread card reads the post", () => {
    renderCard(unread(), { retrying: true });
    expect(within(card()).getByRole("status").textContent).toBe("Reading the postThis takes about a minute.");
    expect(within(card()).queryByText(POSTED_STRINGS.unread)).toBeNull();
    expect(within(card()).queryByRole("button", { name: "Try again" })).toBeNull();
  });
});

describe("AfterPostingCard — could not be read", () => {
  it("the sentence, Try again (ink) and Remove (quiet); no menu, as drawn", () => {
    const { props } = renderCard(unread());
    expect(within(card()).getByText(POSTED_STRINGS.unread)).toBeInTheDocument();
    const tryAgain = within(card()).getByRole("button", { name: "Try again" });
    expect(tryAgain.className).toContain("bg-action");
    expect(within(card()).getByRole("button", { name: "Remove" }).className).not.toContain("bg-action");
    expect(screen.queryByRole("button", { name: "More: posted link" })).toBeNull();
    fireEvent.click(tryAgain);
    expect(props.onTryAgain).toHaveBeenCalledTimes(1);
  });

  it("Remove is asked once more on the card; the focus on Cancel; Cancel goes back with the focus on Remove", () => {
    const { props } = renderCard(unread());
    fireEvent.click(within(card()).getByRole("button", { name: "Remove" }));
    expect(within(card()).getByText(POSTED_STRINGS.removeConfirm)).toBeInTheDocument();
    expect(within(card()).getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(within(card()).queryByRole("button", { name: "Try again" })).toBeNull();
    fireEvent.click(within(card()).getByRole("button", { name: "Cancel" }));
    expect(within(card()).queryByText(POSTED_STRINGS.removeConfirm)).toBeNull();
    expect(within(card()).getByRole("button", { name: "Remove" })).toHaveFocus();
    expect(props.onRemove).not.toHaveBeenCalled();
  });

  it("the second press of a double tap never removes: the confirming Remove waits 500 ms", () => {
    clock();
    const { props } = renderCard(unread());
    fireEvent.click(within(card()).getByRole("button", { name: "Remove" }));
    const confirm = within(card()).getByRole("button", { name: "Remove" });
    later(120);
    fireEvent.click(confirm);
    expect(props.onRemove).not.toHaveBeenCalled();
    later(400);
    fireEvent.click(confirm);
    expect(props.onRemove).toHaveBeenCalledTimes(1);
  });

  it("while a remove is out, the confirming Remove sends nothing more", () => {
    clock();
    const { props, rerender } = renderCard(unread());
    fireEvent.click(within(card()).getByRole("button", { name: "Remove" }));
    later(600);
    fireEvent.click(within(card()).getByRole("button", { name: "Remove" }));
    rerender(<AfterPostingCard {...props} removing />);
    fireEvent.click(within(card()).getByRole("button", { name: "Remove" }));
    expect(props.onRemove).toHaveBeenCalledTimes(1);
    expect(within(card()).getByRole("button", { name: "Remove" })).toHaveAttribute("aria-disabled", "true");
  });
});

describe.each(["phone", "desk"] as const)("AfterPostingCard — the menu (%s)", (view) => {
  beforeEach(() => widthIs(view));

  it('More is named "More: posted link", always shown, with a 44 px tap area; it offers Remove posted link', () => {
    renderCard(posted());
    expect(more()).toHaveClass("tap-44");
    expect(more().className.split(/\s+/).filter((c) => c.startsWith("md:pointer-fine:"))).toEqual([]);
    more().focus();
    fireEvent.click(more());
    expect(screen.getByRole("dialog", { name: "After posting" })).toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: "Remove posted link" })).toHaveFocus();
  });

  it("Remove posted link asks once more; the focus on Cancel; Cancel closes and hands the focus to More", async () => {
    const { props } = renderCard(posted());
    more().focus();
    fireEvent.click(more());
    fireEvent.click(within(dialog()).getByRole("button", { name: "Remove posted link" }));
    expect(within(dialog()).getByText(POSTED_STRINGS.removeConfirm)).toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: "Cancel" })).toHaveFocus();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveFocus();
    expect(props.onRemove).not.toHaveBeenCalled();
  });

  it("the confirming Remove ignores the second press of a double tap; then it removes once, closes, the focus on More", async () => {
    clock();
    const { props } = renderCard(posted());
    more().focus();
    fireEvent.click(more());
    fireEvent.click(within(dialog()).getByRole("button", { name: "Remove posted link" }));
    const confirm = within(dialog()).getByRole("button", { name: "Remove" });
    later(100);
    fireEvent.click(confirm);
    expect(props.onRemove).not.toHaveBeenCalled();
    later(500);
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(props.onRemove).toHaveBeenCalledTimes(1);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveFocus();
  });

  it("the question's rows: the question, Remove, Cancel (Cancel where the menu's item stood on a phone)", () => {
    renderCard(posted());
    more().focus();
    fireEvent.click(more());
    fireEvent.click(within(dialog()).getByRole("button", { name: "Remove posted link" }));
    const rows = Array.from(dialog().querySelectorAll('[data-part="menu-row"]')).map((row) => row.textContent);
    expect(rows).toEqual([POSTED_STRINGS.removeConfirm, "Remove", "Cancel"]);
  });
});

describe("AfterPostingCard — text from outside the app", () => {
  it("a caption or the pasted link that came with the answer is never shown, nor linked", () => {
    const withExtras = { ...posted(), caption: CAPTION, postUrl: PASTED, url: PASTED } as unknown as Posted;
    renderCard(withExtras);
    expect(document.body.textContent).not.toContain(CAPTION);
    expect(document.body.innerHTML).not.toContain("is_from_webapp");
    expect(Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href"))).toEqual([HREF]);
  });
});

describe("AfterPostingCard — accessibility", () => {
  it.each([
    ["final", posted()],
    ["so far", soFar()],
    ["reading", reading()],
    ["unread", unread()],
  ])("%s: no axe violations", async (_name, p) => {
    const { container } = renderCard(p);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up (as You's tests)
    expect(await axe(container)).toHaveNoViolations();
  });

  it("the title can take the focus (where it goes when the ask row it replaced has left)", () => {
    const titleRef = { current: null as HTMLHeadingElement | null };
    renderCard(reading(), { titleRef });
    titleRef.current!.focus();
    expect(within(card()).getByRole("heading", { name: "After posting" })).toHaveFocus();
  });
});
