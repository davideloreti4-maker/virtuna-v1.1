/** @vitest-environment happy-dom */
/**
 * You for a /go visitor (an anonymous session), rendered for real (plan 2026-11-24-you, final fix
 * round C3). On the phone the menu leads here, and to Settings (appearance, log out) as well; the card
 * page carries the page's own Settings row, as You does. The card itself still has no
 * button, and nothing on the page sends a request. Stand-ins: `fetch` (to see that nothing is sent)
 * and the build-time flag (on).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { useShellStore } from "@/stores/shell-store";
import { YouScreen, type YouScreenProps } from "../you-screen";
import { YouSignUp } from "../you-sign-up";
import { SIGN_UP_LINE } from "../you-words";

const fetchSpy = vi.fn();
beforeEach(() => {
  fetchSpy.mockReset();
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useShellStore.setState({ pushedTitle: "" });
});

const NONE = { about: null, sells: null, writing_voice_description: null, can_film: null, never_do: null };
const pageProps: YouScreenProps = {
  state: "ready",
  onRetry: () => {},
  who: { name: "Nia Test", initials: "NT", avatar: null, line: "No account connected" },
  read: null,
  facts: NONE,
  niche: { primary: null, sub: null },
  goal: null,
  accounts: [],
  accountsState: "ready",
  accountsNotice: null,
  onRetryAccounts: () => {},
  onSaveFact: async () => true,
  onSaveNiche: async () => true,
  onSaveGoal: async () => true,
  onSaveName: async () => true,
  onPhoto: async () => null,
  onConnect: async () => null,
};

describe("YouSignUp", () => {
  it("the card asking for an account, then the Settings row that leads to Settings", () => {
    render(<YouSignUp />);
    expect(screen.getByRole("heading", { level: 1, name: "You" })).toBeInTheDocument();
    expect(screen.getByText(SIGN_UP_LINE)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    // The card below the line comes after the sign-up card.
    const line = screen.getByText(SIGN_UP_LINE);
    const settings = screen.getByRole("link", { name: "Settings" });
    expect(line.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("the card itself has no button, the page has nothing else to press, and nothing is sent", () => {
    render(<YouSignUp />);
    const card = screen.getByText(SIGN_UP_LINE).parentElement!;
    expect(within(card).queryAllByRole("button")).toEqual([]);
    expect(within(card).queryAllByRole("link")).toEqual([]);
    expect(screen.queryAllByRole("button")).toEqual([]);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // The page's last card also holds Earn (plan 2026-11-24-earn); a /go visitor has no account and no
  // link, so their card holds Settings alone. The Settings row itself is the page's, the same markup.
  it("the Settings row is the page's own, the same markup; no Earn row for a visitor without an account", () => {
    render(<YouScreen {...pageProps} />);
    const onPage = screen.getByRole("link", { name: "Settings" }).outerHTML;
    cleanup();
    render(<YouSignUp />);
    expect(screen.getByRole("link", { name: "Settings" }).outerHTML).toBe(onPage);
    expect(screen.queryByRole("link", { name: "Earn" })).toBeNull();
  });
});
