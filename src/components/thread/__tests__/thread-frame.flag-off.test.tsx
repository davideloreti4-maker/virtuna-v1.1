/** @vitest-environment happy-dom */

/**
 * The thread frame with the new look OFF (plan 2026-11-20, thread field, Task 4): the props the
 * new look added change nothing. Chips stay under every settled answer, the bubble keeps no tile,
 * and the legacy bubble and label render as before. The flag-on half is
 * `src/components/thread-next/__tests__/thread-frame.flag-on.test.tsx`.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Final review (8): `videoOfTurn` is the new look's reading of a turn's video; with the flag off
// it must not run at all. A call-through spy (the real function, counted), not a stand-in.
vi.mock("@/components/thread-next/user-turn", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/thread-next/user-turn")>();
  return { ...actual, videoOfTurn: vi.fn(actual.videoOfTurn) };
});

import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { videoOfTurn } from "@/components/thread-next/user-turn";
import { ThreadAssistantTurn, ThreadShell, ThreadUserTurn } from "../thread-shell";
import { PersistedThreadStream } from "../persisted-thread-stream";

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const hooksTurn = (ask: string, line: string) => ({
  userTurn: ask,
  blocks: [
    { type: "run-header", props: { skill: "hooks", audienceLabel: "@mrbeast", platform: "tiktok", hookLine: null } },
    {
      type: "hook-card",
      props: {
        hookLine: line,
        audienceArchetype: "the sceptic",
        mechanism: "pattern-break",
        seedHook: line,
        rank: 1,
        band: "Strong",
        fraction: "6/10 stop",
        scrollQuote: "wait, what?",
        model: "sim1-flash",
        scored: true,
        channel: null,
      },
    },
    { type: "markdown", props: { text: "#1 is your strongest." } },
  ],
});

afterEach(cleanup);

describe("flag off: the thread frame as before", () => {
  it("runs the flag-off build", () => {
    expect(NEW_LOOK_ENABLED).toBe(false);
  });

  it("chips stay under every settled answer", () => {
    renderWithClient(
      <PersistedThreadStream persistedTurns={[hooksTurn("first ask", "First line"), hooksTurn("second ask", "Second line")]} />,
    );
    expect(screen.getAllByTestId("followup-row")).toHaveLength(2);
  });

  it("a saved question with no answer changes nothing: a row under each answer", () => {
    renderWithClient(
      <PersistedThreadStream
        persistedTurns={[hooksTurn("first ask", "First line"), hooksTurn("second ask", "Second line"), { userTurn: "take.mp4", blocks: [] }]}
      />,
    );
    expect(screen.getAllByTestId("followup-row")).toHaveLength(2);
  });

  it("the bubble is the legacy one and a video draws no tile", () => {
    render(<ThreadUserTurn text="take.mp4" video={{ posterUrl: "https://frames.example/first.jpg", durationLabel: "0:29" }} />);
    expect(screen.getByText("take.mp4").className).toContain("bg-white/[0.055]");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("ThreadShell ignores a staged file", () => {
    const take = new File(["video-bytes"], "take.mp4", { type: "video/mp4" });
    render(<ThreadShell userTurn="take.mp4" userVideoFile={take} />);
    expect(screen.getByText("take.mp4").className).toContain("bg-white/[0.055]");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("a turn's blocks are not read for a video (videoOfTurn never runs)", () => {
    vi.mocked(videoOfTurn).mockClear();
    renderWithClient(<PersistedThreadStream persistedTurns={[hooksTurn("first ask", "First line"), hooksTurn("second ask", "Second line")]} />);
    expect(screen.getAllByText(/ask$/).length).toBeGreaterThan(0);
    expect(videoOfTurn).not.toHaveBeenCalled();
  });

  it("the label is the legacy caps label", () => {
    render(
      <ThreadAssistantTurn>
        <p>On it.</p>
      </ThreadAssistantTurn>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Maven" }).className).toContain("uppercase");
  });
});
