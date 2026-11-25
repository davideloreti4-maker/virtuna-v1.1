/**
 * start-edit.test.ts — the door's rules (plan 2026-11-24-editor-screens-a, Task 16): which skill a staged video is, and the send.
 * The holder (`uploads.ts`), the take's checks and the calls are the real ones. Stood in: the network (`fetch`), the browser's
 * PUT (`XMLHttpRequest`) and the device's object addresses.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetUpload, uploadOf } from "../uploads";
import { sendToEditor, simulates, stageableVideo, videoSkillOf } from "../start-edit";

const TAKE = "22222222-2222-4222-8222-222222222222";
const EDIT = "55555555-5555-4555-8555-555555555555";
const sized = (name: string, type: string, megabytes: number) => ({ name, type, size: megabytes * 1024 * 1024 }) as File;
const take = () => new File([new Uint8Array(10)], "IMG_0042.MOV", { type: "video/quicktime" });

/** The browser's request, stood in: it never ends by itself, and says when it was stopped. */
let stopped = 0;
class Sending {
  upload = { onprogress: null };
  onload = null;
  onerror = null;
  onabort: (() => void) | null = null;
  status = 0;
  open() {}
  setRequestHeader() {}
  send() {}
  abort() {
    stopped += 1;
    this.onabort?.();
  }
}

/** The network: what the two routes answer, and what was asked of them. */
function network(answers: { takes?: Response; edits?: Response | Error }) {
  const asked: { path: string; body: unknown }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (path: string, init?: RequestInit) => {
    asked.push({ path: String(path), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (path === "/api/edit/takes") return answers.takes ?? new Response(JSON.stringify({ take: { id: TAKE }, uploadUrl: "https://r2.test/put" }), { status: 201 });
    if (path === "/api/edit/edits") {
      if (answers.edits instanceof Error) throw answers.edits;
      return answers.edits ?? new Response(JSON.stringify({ id: EDIT, threadId: "t" }), { status: 201 });
    }
    return new Response("{}", { status: 202 });
  }));
  vi.stubGlobal("XMLHttpRequest", Sending);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local/1");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  return { asked, revoke };
}

afterEach(() => {
  forgetUpload(TAKE);
  stopped = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("a staged video", () => {
  it("is staged when either skill takes it, else refused in Simulate's words", () => {
    expect(stageableVideo(sized("clip.mp4", "video/mp4", 20))).toBeNull();
    expect(stageableVideo(sized("IMG_0042.MOV", "video/quicktime", 900))).toBeNull();
    expect(stageableVideo(sized("clip.webm", "video/webm", 900))).toMatch(/^File too large/);
    expect(stageableVideo(sized("notes.pdf", "application/pdf", 1))).toBe("Please select a video file (MP4, MOV, WebM)");
  });

  it("that is an MP4 or a MOV past both limits is refused with the editor's limit, the larger one", () => {
    // Simulate's "Maximum size is 200MB" would be untrue here: this account's field takes a MOV of up to 2 GB.
    expect(stageableVideo(sized("IMG_0042.MOV", "video/quicktime", 3 * 1024))).toBe("A video to edit is at most 2 GB.");
  });

  it("is an Edit when Edit was picked or only Edit takes it, and a Simulate otherwise or with the editor closed", () => {
    expect(simulates(sized("clip.mp4", "video/mp4", 20))).toBe(true);
    expect(simulates(sized("IMG_0042.MOV", "video/quicktime", 900))).toBe(false);
    expect(videoSkillOf(sized("clip.mp4", "video/mp4", 20), "chat", true)).toBe("test");
    expect(videoSkillOf(sized("clip.mp4", "video/mp4", 20), "edit", true)).toBe("edit");
    expect(videoSkillOf(sized("IMG_0042.MOV", "video/quicktime", 900), "test", true)).toBe("edit");
    expect(videoSkillOf(sized("IMG_0042.MOV", "video/quicktime", 900), "edit", false)).toBe("test");
  });
});

describe("sendToEditor", () => {
  it("signs for the take, starts its upload, makes the edit and opens its page", async () => {
    const { asked } = network({});
    const push = vi.fn();
    expect(await sendToEditor(take(), push)).toEqual({ ok: true, id: EDIT });
    expect(asked.map((one) => one.path)).toEqual(["/api/edit/takes", "/api/edit/edits"]);
    expect(asked[0]?.body).toEqual({ name: "IMG_0042.MOV", bytes: 10, type: "video/quicktime" });
    expect(asked[1]?.body).toEqual({ take: TAKE });
    expect(push).toHaveBeenCalledWith(`/edit/${EDIT}`);
    // What the page finds when it opens: the upload under the take's id, going, with the device's own copy to play.
    expect(uploadOf(TAKE)).toMatchObject({ takeId: TAKE, status: "sending", localUrl: "blob:local/1" });
    expect(stopped).toBe(0);
  });

  it("says why it cannot, with no video, or a file the editor does not take, and asks nothing", async () => {
    const { asked } = network({});
    expect(await sendToEditor(null, vi.fn())).toEqual({ ok: false, problem: "Add a video to edit." });
    expect(await sendToEditor(new File([new Uint8Array(10)], "clip.webm", { type: "video/webm" }), vi.fn())).toEqual({ ok: false, problem: "A video to edit is an MP4 or a MOV file." });
    expect(asked).toEqual([]);
  });

  it("stays where it is when the take is not signed for: the route's sentence, no upload, no page", async () => {
    const { asked } = network({ takes: new Response(JSON.stringify({ error: "the edit tool is not open to this account yet" }), { status: 403 }) });
    const push = vi.fn();
    expect(await sendToEditor(take(), push)).toEqual({ ok: false, problem: "The edit tool is not open to this account yet." });
    expect(asked.map((one) => one.path)).toEqual(["/api/edit/takes"]);
    expect(uploadOf(TAKE)).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("leaves nothing half made when the edit is not made: the upload is stopped and forgotten, and no page opens", async () => {
    const { revoke } = network({ edits: new Response(JSON.stringify({ error: "something went wrong" }), { status: 500 }) });
    const push = vi.fn();
    expect(await sendToEditor(take(), push)).toEqual({ ok: false, problem: "Something went wrong." });
    expect(uploadOf(TAKE)).toBeNull();
    expect(stopped).toBe(1);
    expect(revoke).toHaveBeenCalledWith("blob:local/1");
    expect(push).not.toHaveBeenCalled();
  });

  it("leaves nothing half made when the edit's call gets no answer", async () => {
    network({ edits: new TypeError("Failed to fetch") });
    const push = vi.fn();
    expect(await sendToEditor(take(), push)).toEqual({ ok: false, problem: "The editor could not be reached. Check your connection." });
    expect(uploadOf(TAKE)).toBeNull();
    expect(stopped).toBe(1);
    expect(push).not.toHaveBeenCalled();
  });
});
