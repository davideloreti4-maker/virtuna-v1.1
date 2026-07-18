/** @vitest-environment happy-dom */
/**
 * InputRequestBlockRenderer — the in-thread link field the chat agent surfaces (request_link).
 *
 * Locks the field's contract: it renders inline, a submit runs the Remix (via the remix stream), and
 * a clean completion reloads the host thread (onLinkComplete) and flips to the done receipt. The
 * remix stream + platform context are mocked so nothing hits the network or the paid engine.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { InputRequestBlock } from "@/lib/tools/blocks";
import { validateBlock } from "@/lib/tools/block-registry";

// ── Mutable mock state for the remix stream (flip fields, then re-render) ──────────
const remixState: {
  start: ReturnType<typeof vi.fn>;
  isStreaming: boolean;
  error: string | null;
  isDone: boolean;
  stages: unknown[];
} = { start: vi.fn(async () => {}), isStreaming: false, error: null, isDone: false, stages: [] };

vi.mock("@/hooks/queries/use-remix-stream", () => ({
  useRemixStream: () => remixState,
}));
vi.mock("@/lib/platform-context", () => ({ usePlatform: () => "tiktok" }));

import { InputRequestBlockRenderer } from "../input-request-block";
import { InThreadInputContext } from "@/lib/in-thread-input-context";

const FIELD: InputRequestBlock = {
  type: "input-request",
  props: { kind: "link", action: "remix", label: "Paste the video link", placeholder: "https://…", platform: "tiktok" },
};

function renderField(onLinkComplete = vi.fn()) {
  return render(
    <InThreadInputContext.Provider value={{ onLinkComplete }}>
      <InputRequestBlockRenderer block={FIELD} />
    </InThreadInputContext.Provider>,
  );
}

beforeEach(() => {
  cleanup();
  remixState.start = vi.fn(async () => {});
  remixState.isStreaming = false;
  remixState.error = null;
  remixState.isDone = false;
  remixState.stages = [];
});

describe("InputRequestBlockRenderer", () => {
  it("registry accepts the input-request block (schema round-trip)", () => {
    const res = validateBlock(FIELD);
    expect(res.ok).toBe(true);
  });

  it("renders the field inline with its label + CTA", () => {
    renderField();
    expect(screen.getByLabelText("Paste the video link")).toBeTruthy();
    expect(screen.getByText("Adapt it →")).toBeTruthy();
  });

  it("submitting a URL runs the remix with the block's platform", () => {
    renderField();
    const input = screen.getByLabelText("Paste the video link") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://tiktok.com/@x/video/1" } });
    fireEvent.click(screen.getByText("Adapt it →"));
    expect(remixState.start).toHaveBeenCalledWith("https://tiktok.com/@x/video/1", "tiktok");
  });

  it("an empty field does not run anything", () => {
    renderField();
    fireEvent.click(screen.getByText("Adapt it →"));
    expect(remixState.start).not.toHaveBeenCalled();
  });

  it("a clean completion reloads the host thread and shows the done receipt", () => {
    const onLinkComplete = vi.fn();
    // Mount already-done (no error) → the effect fires the reload once and shows the receipt.
    remixState.isDone = true;
    renderField(onLinkComplete);
    expect(onLinkComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("input-request-done")).toBeTruthy();
    // The field is gone (the real card is now in the thread above).
    expect(screen.queryByText("Adapt it →")).toBeNull();
  });

  it("an error keeps the field (no reload) and shows a plain-language message", () => {
    const onLinkComplete = vi.fn();
    remixState.error = "resolve_failed";
    renderField(onLinkComplete);
    expect(onLinkComplete).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/public video URL/i);
    // Field still available to retry.
    expect(screen.getByText("Adapt it →")).toBeTruthy();
  });
});
