/** @vitest-environment happy-dom */
/**
 * Plan 02-03 Task 1: Intent selector + remix coupling + mode on ContentFormData.
 *
 * Behaviors tested:
 * - Default state: Score selected, all three tabs present
 * - Clicking Remix: Text tab absent, only Video + Link tabs
 * - No caption textarea in Remix mode
 * - Clicking Remix while Text tab is active: resets to video_upload
 * - Back to Score: all three tabs return
 * - URL placeholder in Remix mode
 * - onSubmit payload carries mode correctly
 * - Selected segment fill uses bg-white/[0.08] (not coral)
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Stub heavy child components that are irrelevant to intent-selector behavior
vi.mock("@/components/app/video-upload", () => ({
  VideoUpload: ({ onFileSelect }: { onFileSelect: (f: File | null) => void }) => (
    <div data-testid="video-upload">
      <button
        data-testid="mock-file-select"
        onClick={() => onFileSelect(new File(["x"], "test.mp4", { type: "video/mp4" }))}
      >
        Select file
      </button>
    </div>
  ),
}));
vi.mock("@/components/app/profile-interview-modal", () => ({
  ProfileInterviewModal: () => <div data-testid="profile-modal" />,
}));
vi.mock("@/hooks/use-pending-profile-gate", () => ({
  usePendingProfileGate: () => ({
    isLoading: false,
    interceptOrProceed: (fn: () => void) => { fn(); return { intercepted: false }; },
    resumeAfterModal: () => {},
  }),
}));
vi.mock("@/stores/simulation-store", () => ({
  useSimulationStore: (sel: (s: { apolloTier: string; setApolloTier: (t: string) => void }) => unknown) =>
    sel({ apolloTier: "standard", setApolloTier: () => {} }),
}));
vi.mock("@/stores/board-store", () => ({
  useBoardStore: (sel: (s: { setPendingVideo: () => void; clearPendingVideo: () => void }) => unknown) =>
    sel({ setPendingVideo: () => {}, clearPendingVideo: () => {} }),
}));
vi.mock("@/lib/models", () => ({
  APOLLO_TIERS: [{ id: "standard", name: "Standard" }],
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
}));

// Stub Radix UI primitives used in the form
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import React from "react";
import { ContentForm } from "@/components/app/content-form";
import type { ContentFormData } from "@/components/app/content-form";

// Helper: render ContentForm and capture submit calls
function setup(onSubmit?: (data: ContentFormData) => void) {
  const fn = onSubmit ?? vi.fn();
  const result = render(<ContentForm onSubmit={fn} />);
  return { ...result, onSubmit: fn };
}

describe("ContentForm — Intent Selector", () => {
  it("renders Score segment as selected by default (D-02)", () => {
    setup();
    const scoreBtn = screen.getByRole("tab", { name: /score my content/i });
    expect(scoreBtn).toHaveAttribute("aria-selected", "true");
    const remixBtn = screen.getByRole("tab", { name: /remix a viral video/i });
    expect(remixBtn).toHaveAttribute("aria-selected", "false");
  });

  it("renders a tablist container for the intent selector", () => {
    setup();
    expect(screen.getAllByRole("tablist").length).toBeGreaterThanOrEqual(1);
  });

  it("all three input tabs present in Score mode (D-03)", () => {
    setup();
    // The input tab buttons should include Video, Text, URL
    const tabButtons = screen.getAllByRole("button", { name: /video|text|url|link/i });
    const labels = tabButtons.map((b) => b.getAttribute("aria-label") ?? b.textContent ?? "");
    const hasText = labels.some((l) => /text/i.test(l));
    expect(hasText).toBe(true);
  });

  it("Remix segment click: Text tab removed from DOM (D-04)", () => {
    setup();
    const remixBtn = screen.getByRole("tab", { name: /remix a viral video/i });
    fireEvent.click(remixBtn);
    // The Text input tab button should no longer be in DOM
    const tabButtons = screen.getAllByRole("button").filter(
      (b) => b.getAttribute("aria-label") === "Text"
    );
    expect(tabButtons.length).toBe(0);
  });

  it("Remix segment click: Remix becomes aria-selected=true, Score false", () => {
    setup();
    const remixBtn = screen.getByRole("tab", { name: /remix a viral video/i });
    fireEvent.click(remixBtn);
    expect(remixBtn).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /score my content/i })).toHaveAttribute("aria-selected", "false");
  });

  it("Clicking back to Score after Remix: Text tab returns (D-03)", () => {
    setup();
    const remixBtn = screen.getByRole("tab", { name: /remix a viral video/i });
    fireEvent.click(remixBtn);
    const scoreBtn = screen.getByRole("tab", { name: /score my content/i });
    fireEvent.click(scoreBtn);
    const textBtns = screen.getAllByRole("button").filter(
      (b) => b.getAttribute("aria-label") === "Text"
    );
    expect(textBtns.length).toBeGreaterThanOrEqual(1);
  });

  it("selected segment fill uses bg-white/[0.08], not coral (UI-SPEC §1)", () => {
    setup();
    const scoreBtn = screen.getByRole("tab", { name: /score my content/i });
    // The selected segment should have the white transparency class, not accent/coral
    expect(scoreBtn.className).toContain("bg-white/[0.08]");
    expect(scoreBtn.className).not.toContain("bg-accent");
    expect(scoreBtn.className).not.toContain("coral");
  });
});

describe("ContentForm — Remix Tab Coupling", () => {
  it("switching to Remix while Text tab is active resets to video_upload (Pitfall 8)", () => {
    setup();
    // First, click Text tab to make it active
    const textBtn = screen.getAllByRole("button").find(
      (b) => b.getAttribute("aria-label") === "Text"
    )!;
    fireEvent.click(textBtn);
    // Now textarea for text should be visible (placeholder: "Paste your caption...")
    expect(screen.getByPlaceholderText(/paste your caption/i)).toBeInTheDocument();
    // Switch to Remix
    const remixBtn = screen.getByRole("tab", { name: /remix a viral video/i });
    fireEvent.click(remixBtn);
    // The text textarea should be gone; video upload area should appear
    expect(screen.queryByPlaceholderText(/paste your caption/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("video-upload")).toBeInTheDocument();
  });

  it("no video caption textarea in Remix mode (D-05)", () => {
    setup();
    // Select a file first to trigger caption textarea appearance in score mode
    const remixBtn = screen.getByRole("tab", { name: /remix a viral video/i });
    // Stay in score mode, select file
    const selectFileBtn = screen.getByTestId("mock-file-select");
    fireEvent.click(selectFileBtn);
    // In score mode, caption textarea should be present
    // (it conditionally renders when video_file is set)
    // Now switch to remix mode
    fireEvent.click(remixBtn);
    // Caption textarea should be suppressed
    expect(screen.queryByPlaceholderText(/add a caption for your video/i)).not.toBeInTheDocument();
  });

  it("URL placeholder in Remix mode reads 'Paste a TikTok URL to decode...' (UI-SPEC)", () => {
    setup();
    const remixBtn = screen.getByRole("tab", { name: /remix a viral video/i });
    fireEvent.click(remixBtn);
    // Click the URL / Link tab
    const linkBtn = screen.getAllByRole("button").find(
      (b) => b.getAttribute("aria-label") === "URL" || b.getAttribute("aria-label") === "Link"
    );
    if (linkBtn) fireEvent.click(linkBtn);
    expect(screen.getByPlaceholderText(/paste a tiktok url to decode/i)).toBeInTheDocument();
  });
});

describe("ContentForm — mode in onSubmit payload", () => {
  it("default submit carries mode: 'score'", async () => {
    const onSubmit = vi.fn();
    render(<ContentForm onSubmit={onSubmit} />);
    // Fill in a text caption in score mode (default activeTab is video_upload on non-result route)
    // Switch to text mode first
    const textBtn = screen.getAllByRole("button").find(
      (b) => b.getAttribute("aria-label") === "Text"
    )!;
    fireEvent.click(textBtn);
    const textarea = screen.getByPlaceholderText(/paste your caption/i);
    fireEvent.change(textarea, { target: { value: "this is a test caption for scoring" } });
    const submitBtn = screen.getByRole("button", { name: /submit/i });
    fireEvent.click(submitBtn);
    expect(onSubmit).toHaveBeenCalledOnce();
    const call0 = onSubmit.mock.calls[0];
    expect(call0).toBeDefined();
    const data = call0![0] as ContentFormData;
    expect(data.mode).toBe("score");
  });

  it("Remix submit carries mode: 'remix'", async () => {
    const onSubmit = vi.fn();
    render(<ContentForm onSubmit={onSubmit} />);
    // Switch to remix
    const remixBtn = screen.getByRole("tab", { name: /remix a viral video/i });
    fireEvent.click(remixBtn);
    // Switch to URL tab and enter a valid URL
    const linkBtn = screen.getAllByRole("button").find(
      (b) => b.getAttribute("aria-label") === "URL" || b.getAttribute("aria-label") === "Link"
    )!;
    fireEvent.click(linkBtn);
    const textarea = screen.getByPlaceholderText(/paste a tiktok url to decode/i);
    fireEvent.change(textarea, { target: { value: "https://www.tiktok.com/@user/video/1234567890" } });
    const submitBtn = screen.getByRole("button", { name: /submit/i });
    fireEvent.click(submitBtn);
    expect(onSubmit).toHaveBeenCalledOnce();
    const call1 = onSubmit.mock.calls[0];
    expect(call1).toBeDefined();
    const data = call1![0] as ContentFormData;
    expect(data.mode).toBe("remix");
  });
});
