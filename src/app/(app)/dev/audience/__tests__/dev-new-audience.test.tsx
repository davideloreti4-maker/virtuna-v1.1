/** @vitest-environment happy-dom */
/**
 * /dev/audience's states for a new audience, rendered through `DevAudience` as the page renders them: the
 * form (`new`, `new-describe`) and the read (`building`, `slow`, `thin`, `build-failed`), each made by the
 * real reducer from made-up events. Nothing here sends. Stand-ins: the build-time flag (on), the router,
 * and `fetch` (a spy that must stay unused).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/dev/audience" }));

import { AUDIENCE_STRINGS as S, fromVideos, readCount, thinWhy } from "@/lib/audience-next/audience-words";
import { useShellStore } from "@/stores/shell-store";

import { DevAudience } from "../dev-audience";

const fetchSpy = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchSpy.mockReset();
  router.push.mockReset();
  useShellStore.setState({ pushedTitle: "" });
});

const stepAt = () => [...document.querySelectorAll("[data-step]")].map((li) => li.getAttribute("data-step"));
const lit = () => document.querySelectorAll('[data-wedge][data-look="full"]').length;

describe("/dev/audience: a new audience", () => {
  it("new: the form on your own account, the field empty; a press sends nothing", () => {
    render(<DevAudience state="new" />);
    expect(useShellStore.getState().pushedTitle).toBe(S.newAudience);
    expect(screen.getByRole("radio", { name: S.doorOwn })).toBeChecked();
    expect(screen.getByRole("textbox", { name: S.ownField })).toHaveValue("");
    fireEvent.change(screen.getByRole("textbox", { name: S.ownField }), { target: { value: "nia.tests" } });
    fireEvent.click(screen.getByRole("button", { name: S.build }));
    expect(screen.getByRole("radio", { name: S.doorOwn })).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("new-describe: the form on Describe them, with a description written", () => {
    render(<DevAudience state="new-describe" />);
    expect(screen.getByRole("radio", { name: S.doorDescribe })).toBeChecked();
    expect((screen.getByRole("textbox", { name: S.describeField }) as HTMLTextAreaElement).value.length).toBeGreaterThan(20);
  });

  it("building: the second step now, three wedges lit, the initial, “From your videos · 12 read” with four covers", () => {
    render(<DevAudience state="building" />);
    expect(screen.getByRole("heading", { level: 2, name: S.building })).toBeInTheDocument();
    expect(stepAt()).toEqual(["done", "now", "next"]);
    expect(lit()).toBe(3);
    expect(document.querySelector("[data-face]")).toHaveTextContent("N");
    const card = document.querySelector("[data-evidence]") as HTMLElement;
    expect(within(card).getByText(fromVideos("your"))).toBeInTheDocument();
    expect(within(card).getByText(readCount(12))).toBeInTheDocument();
    expect(card.querySelectorAll("img")).toHaveLength(4);
    expect(screen.getByText(S.keepOpen)).toBeInTheDocument();
    expect(screen.queryByText(S.slow)).toBeNull();
  });

  it("slow: the third step now, seven wedges lit, a picture in the middle, and the three-minute line", () => {
    render(<DevAudience state="slow" />);
    expect(stepAt()).toEqual(["done", "done", "now"]);
    expect(lit()).toBe(7);
    expect(document.querySelector("[data-face] img")).not.toBeNull();
    expect(screen.getByText(S.slow)).toBeInTheDocument();
  });

  it("thin: the title, the sentence, both buttons, and they send nothing", () => {
    render(<DevAudience state="thin" />);
    expect(screen.getByRole("heading", { level: 2, name: S.thinTitle })).toBeInTheDocument();
    expect(screen.getByText(thinWhy("nia.tests"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: S.useGeneral }));
    fireEvent.click(screen.getByRole("button", { name: S.tryAnother }));
    expect(router.push).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("build-failed: the local sentence as an alert, and Try again, which sends nothing", () => {
    render(<DevAudience state="build-failed" />);
    expect(screen.getByRole("alert")).toHaveTextContent(S.accountNotFound);
    fireEvent.click(screen.getByRole("button", { name: S.tryAgain }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
