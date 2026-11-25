/**
 * "Simulate again": the new run's id arrives as the first event of the analyze stream
 * (`event: started`, `data: {"id": …}`), long before the run ends. Only the network is stood in
 * for (`fetch`); the stream reading is the real code.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readStartedId, startVideoSimulation } from "../simulate-again";

const encoder = new TextEncoder();

/** A stream that hands out the given text pieces one per pull, and counts how far it was read. */
function sse(pieces: string[]) {
  const read = { pulls: 0, closed: false };
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const piece = pieces[read.pulls++];
      if (piece === undefined) {
        read.closed = true;
        controller.close();
      } else {
        controller.enqueue(encoder.encode(piece));
      }
    },
  });
  return { stream, read };
}

const STARTED = 'event: started\ndata: {"id":"abc"}\n\n';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readStartedId", () => {
  it("gives the id of the started event", async () => {
    const { stream } = sse([STARTED, 'event: phase\ndata: {"phase":"analyzing"}\n\n']);
    await expect(readStartedId(stream)).resolves.toBe("abc");
  });

  it("finds it after other events, across pieces cut anywhere, with CRLF lines", async () => {
    const text = 'event: phase\r\ndata: {"phase":"queued"}\r\n\r\nevent: started\r\ndata: {"id":"r-42"}\r\n\r\n';
    const { stream } = sse([text.slice(0, 7), text.slice(7, 40), text.slice(40, 61), text.slice(61)]);
    await expect(readStartedId(stream)).resolves.toBe("r-42");
  });

  it("rejects when the stream ends without one", async () => {
    const { stream } = sse(['event: phase\ndata: {"phase":"queued"}\n\n', 'event: error\ndata: {"error":"x"}\n\n']);
    await expect(readStartedId(stream)).rejects.toThrow(/started/);
  });

  it("keeps reading the stream to its end after the id is known", async () => {
    const { stream, read } = sse([STARTED, 'event: phase\ndata: {"a":1}\n\n', 'event: complete\ndata: {}\n\n']);
    await expect(readStartedId(stream)).resolves.toBe("abc");
    await vi.waitFor(() => expect(read.closed).toBe(true));
  });
});

describe("startVideoSimulation", () => {
  it("posts the stored video as a new run, past the cache, and resolves at the started event", async () => {
    const fetchMock = vi.fn(async () => new Response(sse([STARTED]).stream, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(startVideoSimulation("user-1/clip.mp4")).resolves.toBe("abc");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/analyze?bypass_cache=true");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json", Accept: "text/event-stream" });
    expect(JSON.parse(init.body as string)).toEqual({
      input_mode: "video_upload",
      content_type: "video",
      video_storage_path: "user-1/clip.mp4",
    });
  });

  it("rejects when the server refuses (a credit wall, an error)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "no credits" }), { status: 402 })));
    await expect(startVideoSimulation("user-1/clip.mp4")).rejects.toThrow(/402/);
  });
});
