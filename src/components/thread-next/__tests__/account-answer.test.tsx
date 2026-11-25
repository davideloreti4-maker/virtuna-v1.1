/** @vitest-environment happy-dom */

/**
 * AccountAnswer — the account read's own card (thread depth, second part §3), rendered for real
 * from reads shaped like a real run (`ACCOUNT_READ_FULL`, `ACCOUNT_READ_BARE`: the runner's
 * mechanical lines). Every word on it comes through the real `accountCardOf`.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import type { AccountReadBlock } from "@/lib/tools/blocks";
import { AccountAnswer, accountLands } from "../account-answer";
import { accountCardOf } from "@/lib/thread-next/account-card";
import { ACCOUNT_READ_BARE, ACCOUNT_READ_FULL, accountRead } from "./fixtures/answers";

afterEach(cleanup);

const part = (name: string) => document.querySelector<HTMLElement>(`[data-part="${name}"]`);
const GROUPS = ["account-who", "account-works", "account-fix", "account-habits"] as const;
const groupsInOrder = () =>
  [...document.querySelectorAll<HTMLElement>("[data-part^='account-']")]
    .map((el) => el.dataset.part)
    .filter((name): name is string => (GROUPS as readonly string[]).includes(name ?? ""));
const button = () => screen.queryByRole("button", { name: /^Ideas from what works/ });
const iOf = (el: Element | null | undefined) => (el as HTMLElement | null)?.style.getPropertyValue("--i") ?? null;

/** `ACCOUNT_READ_FULL` with some props replaced. */
const fullWith = (props: Partial<AccountReadBlock["props"]>): AccountReadBlock => ({
  ...ACCOUNT_READ_FULL,
  props: { ...ACCOUNT_READ_FULL.props, ...props },
});
const patternsWith = (p: Partial<NonNullable<AccountReadBlock["props"]["patterns"]>>) =>
  fullWith({ patterns: { ...ACCOUNT_READ_FULL.props.patterns!, ...p } });

describe("AccountAnswer, with everything", () => {
  it("who, what works, to fix, the habits, the button with its price, in that order", () => {
    render(<AccountAnswer block={ACCOUNT_READ_FULL} />);
    const who = part("account-who")!;
    expect(within(who).getByText("@creator_one")).toBeInTheDocument();
    expect(within(who).getByText("12.4K followers · 86 videos")).toBeInTheDocument();

    const works = part("account-works")!;
    expect(within(works).getByRole("heading", { level: 3, name: "What works" })).toBeInTheDocument();
    const rows = within(works).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/^How I meal prep a week for \$12854K views$/);
    expect(rows[1]).toHaveTextContent(/^Stop buying protein bars, make these146K views$/);

    const fix = part("account-fix")!;
    expect(within(fix).getByRole("heading", { level: 3, name: "To fix" })).toBeInTheDocument();
    expect([...fix.querySelectorAll("p")].map((p) => p.textContent)).toEqual([
      "The middle loses people. Tighten it and cut the dead air.",
      "Your openings lose people in the first seconds. Sharpen the first line.",
    ]);

    expect(part("account-habits")).toHaveTextContent(/^21 of 30 videos are 30 s or shorter\. Three videos open with “How I…”\.$/);

    const primary = button()!;
    expect(primary).toHaveAccessibleName("Ideas from what works, 1 credit");
    expect(primary).toHaveTextContent("1 credit");

    expect(groupsInOrder()).toEqual(["account-who", "account-works", "account-fix", "account-habits"]);
    expect(part("account-habits")!.compareDocumentPosition(primary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("one card; the rows are not links; nothing of what is left out on purpose", () => {
    const { container } = render(<AccountAnswer block={ACCOUNT_READ_FULL} />);
    expect(container.querySelectorAll('[data-answer="card"]')).toHaveLength(1);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    const text = container.textContent ?? "";
    // `working` as text, the track record, the strip of all covers, the runner's raw lines.
    expect(text).not.toContain("854,000 views");
    expect(text).not.toContain("82");
    expect(text).not.toContain("lurker");
    expect(text).not.toContain("Dorm kitchen");
    expect(text).not.toContain("Your account");
    expect(container.querySelectorAll('[data-part="account-cover"]')).toHaveLength(2);
  });

  it("each group lands in its own place, one after another; the button last", () => {
    render(<AccountAnswer block={ACCOUNT_READ_FULL} />);
    expect(GROUPS.map((g) => part(g)!.classList.contains("land"))).toEqual([true, true, true, true]);
    expect(GROUPS.map((g) => iOf(part(g)))).toEqual(["0", "1", "2", "3"]);
    expect(iOf(button()!.closest(".land"))).toBe("4");
    expect(accountLands(accountCardOf(ACCOUNT_READ_FULL.props)).last).toBe(4);
  });

  it("the hairlines are the look's line colour, above each group after who; who has none", () => {
    render(<AccountAnswer block={ACCOUNT_READ_FULL} />);
    expect(part("account-who")!.className).not.toMatch(/\bborder-t\b/);
    for (const g of ["account-works", "account-fix", "account-habits"]) {
      expect(part(g)!.className.split(/\s+/)).toEqual(expect.arrayContaining(["border-t", "border-border"]));
    }
  });

  it("the sizes as written: the handle 15 / 21 at 640, the counts 13 / 18, a caption 15 / 21 at 520 on one line", () => {
    render(<AccountAnswer block={ACCOUNT_READ_FULL} />);
    const cls = (el: Element | null) => (el as HTMLElement).className.split(/\s+/);
    expect(cls(screen.getByText("@creator_one"))).toEqual(expect.arrayContaining(["text-ui", "font-[640]", "leading-[21px]"]));
    expect(cls(screen.getByText("12.4K followers · 86 videos"))).toEqual(
      expect.arrayContaining(["text-meta", "leading-[18px]", "text-foreground-secondary"]),
    );
    const title = screen.getByText("How I meal prep a week for $12");
    expect(cls(title)).toEqual(expect.arrayContaining(["truncate", "text-ui", "font-[520]", "leading-[21px]"]));
    expect(cls(screen.getByText("854K views"))).toEqual(expect.arrayContaining(["text-meta", "tabular-nums", "text-foreground-secondary"]));
    expect(cls(part("account-habits"))).toEqual(expect.arrayContaining(["text-meta", "leading-[19px]", "text-foreground-secondary"]));
  });

  it("has no axe violations", async () => {
    const { container } = render(<AccountAnswer block={ACCOUNT_READ_FULL} onIdeas={() => {}} />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("AccountAnswer, a part with nothing to show takes no room", () => {
  it("no fix: no 'To fix'; the habits and the button move up a place", () => {
    render(<AccountAnswer block={ACCOUNT_READ_BARE} />);
    expect(part("account-fix")).toBeNull();
    expect(screen.queryByText("To fix")).toBeNull();
    expect(groupsInOrder()).toEqual(["account-who", "account-works", "account-habits"]);
    expect(iOf(part("account-habits"))).toBe("2");
    expect(iOf(button()!.closest(".land"))).toBe("3");
  });

  it("no videos: no 'What works' and no button", () => {
    render(<AccountAnswer block={fullWith({ analyzedVideos: [] })} />);
    expect(part("account-works")).toBeNull();
    expect(screen.queryByText("What works")).toBeNull();
    expect(button()).toBeNull();
    expect(part("account-fix")).not.toBeNull();
  });

  it("no profile: the handle alone, the initials from the handle", () => {
    render(<AccountAnswer block={fullWith({ profile: undefined })} />);
    const who = part("account-who")!;
    expect(within(who).getByText("@creator_one")).toBeInTheDocument();
    expect(who.querySelectorAll("p")).toHaveLength(1);
    expect(part("account-avatar")).toHaveTextContent(/^CR$/);
  });

  it("neither habit: no line", () => {
    render(<AccountAnswer block={patternsWith({ formatMix: [], recurringHooks: [] })} />);
    expect(part("account-habits")).toBeNull();
    expect(iOf(button()!.closest(".land"))).toBe("3");
  });

  it("the thin read: who alone", () => {
    render(<AccountAnswer block={accountRead({ handle: "creator_one", fallback: "thin", profile: undefined, analyzedVideos: undefined, patterns: undefined })} />);
    expect(groupsInOrder()).toEqual(["account-who"]);
    expect(button()).toBeNull();
  });
});

describe("AccountAnswer, the words", () => {
  it("a line the runner may add some day follows the general rule", () => {
    render(<AccountAnswer block={patternsWith({ fix: ["pacer: the cut is slow — trim the pauses"] })} />);
    expect([...part("account-fix")!.querySelectorAll("p")].map((p) => p.textContent)).toEqual(["The cut is slow. Trim the pauses."]);
  });

  it("a long caption stays on one line, cut with an ellipsis; a hashtag-only caption is whole", () => {
    const long = "How I meal prep a whole week for twelve dollars and still have time to study for every single exam #mealprep #fyp";
    render(
      <AccountAnswer
        block={fullWith({
          analyzedVideos: [
            { caption: long, views: 854_000, videoUrl: "/fixtures/a" },
            { caption: "#mealprep #budget", views: 146_000, videoUrl: "/fixtures/b" },
          ],
        })}
      />,
    );
    const title = screen.getByText(long.replace(" #mealprep #fyp", ""));
    expect(title).toHaveClass("truncate");
    expect(title).not.toHaveTextContent("#");
    expect(screen.getByText("#mealprep #budget")).toHaveClass("truncate");
  });
});

describe("AccountAnswer, the pictures", () => {
  it("an avatar shows its picture, alt empty; when it fails to load, the initials", () => {
    render(<AccountAnswer block={ACCOUNT_READ_FULL} />);
    const avatar = part("account-avatar")!;
    const img = avatar.querySelector("img")!;
    expect(img).toHaveAttribute("src", "/avatars/creator-one.jpg");
    expect(img).toHaveAttribute("alt", "");
    expect(avatar).not.toHaveTextContent("CO");
    fireEvent.error(img);
    expect(avatar.querySelector("img")).toBeNull();
    expect(avatar).toHaveTextContent(/^CO$/);
  });

  it("no picture: the initials on the sunken fill, round", () => {
    render(<AccountAnswer block={ACCOUNT_READ_BARE} />);
    const avatar = part("account-avatar")!;
    expect(avatar.querySelector("img")).toBeNull();
    expect(avatar).toHaveTextContent(/^CR$/);
    expect(avatar.className.split(/\s+/)).toEqual(expect.arrayContaining(["size-10", "rounded-full", "bg-surface-sunken"]));
  });

  const covers = () => [...document.querySelectorAll<HTMLElement>('[data-part="account-cover"]')];
  const videoRows = () => [...part("account-works")!.querySelectorAll<HTMLElement>("li")];
  const mark = (cover: HTMLElement) => cover.querySelector('[data-part="account-cover-mark"]');
  /** The classes of a row and of its words: the same whatever its cover does, so the titles never move. */
  const layout = () => videoRows().map((r) => [r.className, r.children[1]?.className]);

  // Fix round 3 (spec §3 point 2): the tiles always stay. A cover that is missing or fails to load
  // leaves its tile with the look's video mark (as a chat's tile on Home), so nothing moves after a
  // failed load. Was (round 2): no tiles when neither loaded.
  it("a cover is 30 by 40 at radius 6 on the sunken fill; loaded, the picture and no mark", () => {
    render(<AccountAnswer block={ACCOUNT_READ_FULL} />);
    expect(covers()).toHaveLength(2);
    for (const cover of covers()) {
      expect(cover.className.split(/\s+/)).toEqual(expect.arrayContaining(["h-10", "w-[30px]", "rounded-sm", "bg-surface-sunken"]));
      expect(mark(cover)).toBeNull();
    }
    const img = covers()[0]!.querySelector("img")!;
    expect(img).toHaveAttribute("src", "/covers/c8.jpg");
    expect(img).toHaveAttribute("alt", "");
  });

  it("a cover that fails to load: its tile stays, with the video mark, and nothing moves", () => {
    render(<AccountAnswer block={ACCOUNT_READ_FULL} />);
    const before = layout();
    fireEvent.error(covers()[1]!.querySelector("img")!);
    expect(covers()).toHaveLength(2);
    expect(covers()[0]!.querySelector("img")).toHaveAttribute("src", "/covers/c8.jpg");
    expect(mark(covers()[0]!)).toBeNull();
    expect(covers()[1]!.querySelector("img")).toBeNull();
    const failed = mark(covers()[1]!)!;
    expect(failed.tagName.toLowerCase()).toBe("svg");
    expect(failed).toHaveAttribute("aria-hidden", "true");
    expect(failed).toHaveAttribute("width", "16");
    expect(failed).toHaveClass("text-foreground-secondary");
    fireEvent.error(covers()[0]!.querySelector("img")!);
    expect(covers().map((c) => mark(c) !== null)).toEqual([true, true]);
    expect(layout()).toEqual(before);
  });

  it("a missing cover: its tile with the video mark, the rows laid out as with pictures", () => {
    const { unmount } = render(<AccountAnswer block={ACCOUNT_READ_FULL} />);
    const withPictures = layout();
    unmount();
    render(<AccountAnswer block={ACCOUNT_READ_BARE} />);
    expect(covers()).toHaveLength(2);
    for (const cover of covers()) {
      expect(cover.querySelector("img")).toBeNull();
      expect(mark(cover)).not.toBeNull();
    }
    expect(layout()).toEqual(withPictures);
  });
});

describe("AccountAnswer, the button", () => {
  it("sends the ask once per press, with the two videos as the card shows them", () => {
    const onIdeas = vi.fn();
    render(<AccountAnswer block={ACCOUNT_READ_FULL} onIdeas={onIdeas} />);
    fireEvent.click(button()!);
    expect(onIdeas).toHaveBeenCalledTimes(1);
    expect(onIdeas).toHaveBeenCalledWith(
      "Give me ideas built on what already works on my account:\n" +
        "- How I meal prep a week for $12 (854K views)\n" +
        "- Stop buying protein bars, make these (146K views)",
    );
  });

  it("without a handler: drawn, and a press does nothing", () => {
    render(<AccountAnswer block={ACCOUNT_READ_FULL} />);
    const primary = button()!;
    expect(primary).toBeInTheDocument();
    expect(() => fireEvent.click(primary)).not.toThrow();
  });
});

// Fix round 1 (review M1): a read stored months ago may lack fields the type calls required.
describe("AccountAnswer, a stored read with fields missing", () => {
  it("draws what it can read and throws nothing", () => {
    const old = {
      type: "account-read",
      props: {
        handle: "creator_one",
        profile: { displayName: "Nia Lee" },
        analyzedVideos: [{ views: 854_000 }, { caption: "How I meal prep #mealprep" }, { caption: "Stop buying protein bars", views: 146_000 }],
        patterns: { fix: ["lurker: retention drops mid-video — tighten the middle and cut dead air"] },
      },
    } as unknown as AccountReadBlock;
    render(<AccountAnswer block={old} />);
    expect(groupsInOrder()).toEqual(["account-who", "account-works", "account-fix"]);
    expect(part("account-who")!.querySelectorAll("p")).toHaveLength(1);
    expect(part("account-avatar")).toHaveTextContent(/^NL$/);
    expect(within(part("account-works")!).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Stop buying protein bars146K views"]);
    expect(part("account-fix")).toHaveTextContent("The middle loses people. Tighten it and cut the dead air.");
    expect(button()).toBeInTheDocument();
  });

  it("a block with nothing but a type and a handle: who alone", () => {
    render(<AccountAnswer block={{ type: "account-read", props: { handle: "creator_one", patterns: {}, analyzedVideos: "none" } } as unknown as AccountReadBlock} />);
    expect(groupsInOrder()).toEqual(["account-who"]);
    expect(button()).toBeNull();
  });
});
