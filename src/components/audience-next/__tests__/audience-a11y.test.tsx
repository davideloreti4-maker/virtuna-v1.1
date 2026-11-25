/** @vitest-environment happy-dom */
/**
 * Audience by keyboard and screen reader (spec 2026-11-25-audience, 10: "the ring's groups are reachable as
 * the rows; the sheet returns focus"), on every state of the dev preview, rendered through `DevAudience` as
 * `/dev/audience` renders it: the real screens and parts on the real model. Stand-ins: the build-time flag
 * (on), `matchMedia` (a phone), the router (the new audience page's Back), `fetch` (a spy that must stay
 * unused) and the sheets' clock for their first moment (`settleClock`, so a press counts).
 *
 * What a browser decides is not here: the visible focus ring, and that nothing scrolls sideways at 320.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

vi.setConfig({ testTimeout: 60_000 });
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/dev/audience" }));

import { DevAudience, type DevAudienceState } from "@/app/(app)/dev/audience/dev-audience";
import { DEV_PAGES } from "@/app/(app)/dev/audience/fixtures";
import { settleClock } from "@/components/thread-next/answer-sheet";
import { AUDIENCE_STRINGS as S, moreLabel } from "@/lib/audience-next/audience-words";
import { startBuild } from "@/lib/audience-next/build-state";
import { readAgainRequestOf } from "@/lib/audience-next/build-request";
import { useShellStore } from "@/stores/shell-store";

/** Every state `/dev/audience` opens in (its `page.tsx` keeps the list; its test checks each is known). */
const STATES: readonly DevAudienceState[] = [
  "own", "other", "described", "few", "bare", "not-default", "group", "menu", "switcher", "read-again", "reading",
  "reading-thin", "reading-failed", "none", "loading", "failed", "new", "new-describe", "building", "slow", "thin",
  "build-failed",
];

/** The states that open on a modal layer over the page. */
const LAYERED: ReadonlySet<DevAudienceState> = new Set(["group", "menu", "switcher", "read-again"]);

const OWN = DEV_PAGES.own.page;
let tick = 0;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
  settleClock.now = () => (tick += 1000);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  settleClock.now = () => performance.now();
  useShellStore.setState({ pushedTitle: "" });
});

/** The dev preview inside a `main`, as the app's shell holds every page. */
async function show(state: DevAudienceState) {
  const view = render(
    <main>
      <DevAudience state={state} />
    </main>,
  );
  await act(async () => {});
  return view;
}

/** What a control is called, for reading a Tab order: a group's row by its group, else its name. */
function nameOf(el: Element): string {
  const row = el.getAttribute("data-group-row");
  if (row) return `row ${row}`;
  return el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "";
}

/** The controls Tab reaches from the top of the page, in order, until it comes round again. */
async function tabOrder(): Promise<string[]> {
  const user = userEvent.setup();
  (document.activeElement as HTMLElement | null)?.blur();
  const seen: Element[] = [];
  for (let i = 0; i < 40; i += 1) {
    await user.tab();
    const el = document.activeElement;
    if (!el || el === document.body || seen.includes(el)) break;
    seen.push(el);
  }
  return seen.map(nameOf);
}

describe("Audience by keyboard and screen reader: every state of the dev preview", () => {
  it("knows the same states as /dev/audience", () => {
    expect(new Set(STATES).size).toBe(22);
  });

  it.each(STATES)("%s: no axe violations", async (state) => {
    await show(state);
    if (!LAYERED.has(state)) {
      // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
      expect(await axe(document.body)).toHaveNoViolations();
      return;
    }
    // The open layer on its own, as the parts' own tests check it.
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(screen.getByRole("dialog"))).toHaveNoViolations();
    // And the whole page under it, but for one rule. A modal Radix layer hides the page behind it from a
    // screen reader (`aria-hidden`) and keeps two tabbable focus guards beside it, while its focus trap keeps
    // the focus inside the layer: `aria-hidden-focus` cannot see the trap.
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(document.body, { rules: { "aria-hidden-focus": { enabled: false } } })).toHaveNoViolations();
  });

  it.each(STATES)("%s: every control has a name", async (state) => {
    await show(state);
    const controls = [...screen.queryAllByRole("button"), ...screen.queryAllByRole("link"), ...screen.queryAllByRole("textbox"), ...screen.queryAllByRole("radio")];
    for (const control of controls) expect(control).toHaveAccessibleName();
  });
});

describe("Audience: what takes the focus by script draws no outline", () => {
  // A heading or a text given the focus by script is not a control: a box round it reads as a fault. The
  // app's focus outline is an unlayered rule that beats a utility, so it is turned off inline. Controls
  // keep their rings.
  it.each(STATES)("%s: every heading or text that takes the focus by script has no outline", async (state) => {
    await show(state);
    const targets = [...document.querySelectorAll<HTMLElement>('[tabindex="-1"]')].filter(
      (el) => el.getAttribute("role") !== "dialog" && !el.matches("button, a, input, textarea, select"),
    );
    for (const el of targets) {
      expect(el.style.outlineStyle, `${el.tagName} “${el.textContent?.slice(0, 40)}”`).toBe("none");
    }
  });
});

describe("Audience by keyboard: the own page on a phone", () => {
  it("Tab goes pill, More, Read again, Simulate, the four rows, All 10, then the two texts' More", async () => {
    await show("own");
    expect(await tabOrder()).toEqual([
      `${S.switcherTitle}: ${OWN.name}`,
      moreLabel(OWN.name),
      S.readAgain,
      S.simulate,
      ...OWN.groups.slice(0, 4).map((g) => `row ${g.group}`),
      `All ${OWN.groups.length}`,
      S.more,
      S.more,
    ]);
  });

  it("the ring is hidden from a screen reader and has nothing to Tab to; its groups are the rows, each named for its group", async () => {
    await show("own");
    const ring = document.querySelector<HTMLElement>('[data-block="ring"]')!;
    for (const svg of ring.querySelectorAll("svg")) expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(ring.querySelectorAll("button, a[href], input, [tabindex]")).toHaveLength(0);
    // What a screen reader hears of the ring: its total.
    expect(within(ring).getByText(`${S.ringTotal} ${S.ringUnit}`)).toHaveClass("sr-only");
    const rows = [...document.querySelectorAll<HTMLElement>("[data-group-row]")];
    expect(rows.map((r) => r.getAttribute("data-group-row"))).toEqual(OWN.groups.slice(0, 4).map((g) => g.group));
    rows.forEach((row, i) => expect(row).toHaveAccessibleName(expect.stringContaining(OWN.groups[i]!.name)));
  });

  it("a row opened by Enter: its sheet; Escape closes it and the focus is on that row again", async () => {
    await show("own");
    const user = userEvent.setup();
    const row = document.querySelector<HTMLElement>(`[data-group-row="${OWN.groups[1]!.group}"]`)!;
    row.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog", { name: OWN.groups[1]!.name })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(row).toHaveFocus());
  });

  it.each([
    ["the switcher", () => screen.getByRole("button", { name: `${S.switcherTitle}: ${OWN.name}` }), S.switcherTitle],
    ["More", () => screen.getByRole("button", { name: moreLabel(OWN.name) }), OWN.name],
    ["Read again", () => within(document.querySelector<HTMLElement>('[data-block="source"]')!).getByRole("button", { name: S.readAgain }), S.readAgain],
  ] as const)("%s, opened by Enter and closed by Escape, gives the focus back to its button", async (_what, button, dialogName) => {
    await show("own");
    const user = userEvent.setup();
    const opener = button();
    opener.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog", { name: dialogName })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("Read again from More: the question closes back onto More", async () => {
    await show("own");
    const user = userEvent.setup();
    const more = screen.getByRole("button", { name: moreLabel(OWN.name) });
    more.focus();
    await user.keyboard("{Enter}");
    const menu = await screen.findByRole("dialog", { name: OWN.name });
    within(menu).getByRole("button", { name: S.readAgain }).focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog", { name: S.readAgain })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(more).toHaveFocus());
  });
});

describe("Audience by screen reader: a read again in place of the page", () => {
  it("the step running now is said politely; the slow line and Keep this page open sit in a polite region", async () => {
    await show("reading");
    const [, watch] = startBuild(readAgainRequestOf(OWN.readAgain!)).plan;
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(watch!);
    expect(status).not.toHaveAttribute("aria-live", "assertive");
    expect(screen.getByText(S.keepOpen).closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
  });

  it("each step says whether it is done, now or next", async () => {
    await show("reading");
    const said = [...document.querySelectorAll("[data-step] .sr-only")].map((s) => s.textContent?.trim());
    expect(said).toEqual([`(${S.stepDone})`, `(${S.stepNow})`, `(${S.stepNext})`]);
  });
});
