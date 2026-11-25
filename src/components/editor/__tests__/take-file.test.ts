/** take-file.test.ts — a file as a take to edit (plan 2026-11-24-editor-screens-a, Task 9): the edit tool's limits, not Simulate's. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetUpload, uploadOf } from "../uploads";
import { editTakeProblem, sendTake, takeTypeOf } from "../take-file";

const TAKE = "22222222-2222-4222-8222-222222222222";
const file = (name: string, type: string, size = 10) => ({ name, type, size });

afterEach(() => {
  forgetUpload(TAKE);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("a take's type and limits", () => {
  it("reads the type from the name when the device gave none", () => {
    expect(takeTypeOf(file("IMG_0042.MOV", ""))).toBe("video/quicktime");
    expect(takeTypeOf(file("take.mp4", ""))).toBe("video/mp4");
    expect(takeTypeOf(file("take.webm", "video/webm"))).toBe("video/webm");
  });

  it("takes an MP4 or a MOV of up to 2 GB, past Simulate's 200 MB", () => {
    expect(editTakeProblem(file("IMG_0042.MOV", "video/quicktime", 1.5 * 1024 ** 3))).toBeNull();
    expect(editTakeProblem(file("take.webm", "video/webm"))).toBe("A video to edit is an MP4 or a MOV file.");
    expect(editTakeProblem(file("take.mp4", "video/mp4", 2 * 1024 ** 3 + 1))).toBe("A video to edit is at most 2 GB.");
    expect(editTakeProblem(file("take.mp4", "video/mp4", 0))).toBe("This video is empty.");
  });
});

describe("sendTake", () => {
  it("signs for the file as a take with the type it is sent as, and starts its upload", async () => {
    const asked: { path: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (path: string, init?: RequestInit) => {
      asked.push({ path: String(path), body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (String(path) === "/api/edit/takes") return new Response(JSON.stringify({ take: { id: TAKE }, uploadUrl: "https://r2.test/put" }), { status: 201 });
      return new Response(JSON.stringify({ job: { id: "j" } }), { status: 202 });
    }));
    const put: string[] = [];
    vi.stubGlobal("XMLHttpRequest", class {
      upload = { onprogress: null as ((event: { loaded: number }) => void) | null };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      status = 0;
      open(method: string, url: string) {
        put.push(`${method} ${url}`);
      }
      setRequestHeader(name: string, value: string) {
        put.push(`${name}: ${value}`);
      }
      send() {}
      abort() {} // the upload is forgotten after the test while it still goes: its PUT is stopped
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local/1");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const sent = await sendTake(new File([new Uint8Array(10)], "IMG_0042.MOV", { type: "" }));
    expect(sent).toEqual({ ok: true, takeId: TAKE });
    expect(asked[0]).toEqual({ path: "/api/edit/takes", body: { name: "IMG_0042.MOV", bytes: 10, type: "video/quicktime" } });
    expect(uploadOf(TAKE)).toMatchObject({ status: "sending", total: 10, localUrl: "blob:local/1" });
    // The device gave no type: the file goes to R2 as the type it was signed for, the only one the address takes.
    expect(put).toEqual(["PUT https://r2.test/put", "Content-Type: video/quicktime"]);
  });

  it("that the route refuses gives the route's sentence, and no upload is started", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "a take is an MP4 or QuickTime video" }), { status: 400 })));
    const objectUrl = vi.spyOn(URL, "createObjectURL");
    expect(await sendTake(new File([new Uint8Array(10)], "take.mp4", { type: "video/mp4" }))).toEqual({ ok: false, problem: "A take is an MP4 or QuickTime video." });
    expect(objectUrl).not.toHaveBeenCalled();
  });

  it("says why a file cannot be sent, before asking anything", async () => {
    const fetching = vi.fn();
    vi.stubGlobal("fetch", fetching);
    expect(await sendTake(new File([new Uint8Array(10)], "clip.webm", { type: "video/webm" }))).toEqual({ ok: false, problem: "A video to edit is an MP4 or a MOV file." });
    expect(fetching).not.toHaveBeenCalled();
  });
});
