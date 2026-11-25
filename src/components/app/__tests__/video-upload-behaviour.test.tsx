/** @vitest-environment happy-dom */
// VideoUpload's validation and preview, as the component does them today (validateVideoFile, useVideoMeta).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { VideoUpload } from "@/components/app/video-upload";

let videos: HTMLVideoElement[];
let revoked: string[];
beforeEach(() => {
  videos = [];
  revoked = [];
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:t/1");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation((u: string) => void revoked.push(u));
  const real = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((t: string, o?: ElementCreationOptions) => {
    const el = real(t, o);
    if (t === "video") videos.push(el as HTMLVideoElement);
    return el;
  }) as typeof document.createElement);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function pick(file: File) {
  const input = screen.getByLabelText("Upload video file") as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

describe("VideoUpload: validation and preview", () => {
  it("input accepts video/*", () => {
    render(<VideoUpload file={null} onFileSelect={() => {}} />);
    expect(screen.getByLabelText("Upload video file").getAttribute("accept")).toBe("video/*");
  });

  it("wrong type shows the alert and does not select", () => {
    const onFileSelect = vi.fn();
    render(<VideoUpload file={null} onFileSelect={onFileSelect} />);
    pick(new File(["x"], "a.txt", { type: "text/plain" }));
    expect(screen.getByRole("alert").textContent).toBe("Please select a video file (MP4, MOV, WebM)");
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it("oversize shows the alert", () => {
    const onFileSelect = vi.fn();
    render(<VideoUpload file={null} onFileSelect={onFileSelect} />);
    const f = new File(["x"], "a.mp4", { type: "video/mp4" });
    Object.defineProperty(f, "size", { value: 300 * 1024 * 1024 });
    pick(f);
    expect(screen.getByRole("alert").textContent).toBe("File too large (300.0 MB). Maximum size is 200MB.");
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it("valid file selects", () => {
    const onFileSelect = vi.fn();
    render(<VideoUpload file={null} onFileSelect={onFileSelect} />);
    const f = new File(["x"], "a.mov", { type: "" });
    pick(f);
    expect(onFileSelect).toHaveBeenCalledWith(f);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("preview shows size, duration badge, thumbnail; revokes on unmount", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: () => {} } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,AA");
    const f = new File(["xx"], "take.mp4", { type: "video/mp4" });
    const { unmount } = render(<VideoUpload file={f} onFileSelect={() => {}} />);
    expect(screen.getByText("2 B")).toBeInTheDocument();
    const v = videos[0]!;
    Object.defineProperty(v, "duration", { value: 75.4, configurable: true });
    act(() => v.onloadeddata?.(new Event("loadeddata")));
    expect(screen.getByText("1:15")).toBeInTheDocument();
    act(() => v.onseeked?.(new Event("seeked")));
    expect(screen.getByAltText("Thumbnail of take.mp4").getAttribute("src")).toBe("data:image/jpeg;base64,AA");
    unmount();
    expect(revoked).toContain("blob:t/1");
  });
});
