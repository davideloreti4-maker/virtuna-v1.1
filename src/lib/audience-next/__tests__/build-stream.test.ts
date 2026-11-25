/**
 * readBuildStream — the reader of `POST /api/audiences/calibrate`'s server-sent events, on made-up streams
 * written the way the route writes them (`event: name\ndata: JSON\n\n`) and cut the ways a network cuts
 * them: across chunks, mid-line, inside a multi-byte character, with `\r\n`, and with no blank line after
 * the last frame. The one stand-in is the stream itself (the I/O boundary).
 */
import { describe, expect, it } from "vitest";

import { readBuildStream, type BuildEvent } from "../build-stream";

const enc = new TextEncoder();

/** A stream that hands over the given chunks, one read each. */
function streamOf(chunks: ReadonlyArray<string | Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(typeof c === "string" ? enc.encode(c) : c);
      controller.close();
    },
  });
}

/** The bytes of a text, cut into pieces of `size` bytes (a cut can land inside a character). */
function bytesIn(text: string, size: number): Uint8Array[] {
  const all = enc.encode(text);
  const out: Uint8Array[] = [];
  for (let i = 0; i < all.length; i += size) out.push(all.slice(i, i + size));
  return out;
}

async function eventsOf(stream: ReadableStream<Uint8Array>): Promise<BuildEvent[]> {
  const out: BuildEvent[] = [];
  for await (const e of readBuildStream(stream)) out.push(e);
  return out;
}

/** One frame as the route writes it. */
const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const SYNTHESIS = "We read @nia.tests fine — building the audience from it is what failed. Nothing is wrong with the handle; try again.";
const AUDIENCE = { id: "00000000-0000-4000-8000-000000000001", name: "@nia.tests" };
const EVIDENCE = {
  handle: "nia.tests",
  displayName: "Nia",
  avatarUrl: "https://cdn.example.test/nia.jpg",
  followerCount: 48_200,
  heartCount: 1_900_000,
  videoCount: 214,
  verified: false,
  videos: [
    { coverUrl: "https://cdn.example.test/1.jpg", views: 1200 },
    { coverUrl: null, views: 900 },
    { coverUrl: "http://cdn.example.test/3.jpg", views: 800 },
    { coverUrl: "https://cdn.example.test/4.jpg", views: 700 },
    { coverUrl: "javascript:alert(1)", views: 600 },
  ],
};

/** A whole run as the route sends it for a handle: status and stage frames, evidence, done. */
const RUN =
  frame("status", { message: "Reading your followers…" }) +
  frame("stage", { name: "Reading your followers", status: "active" }) +
  frame("evidence", EVIDENCE) +
  frame("status", { message: "Watching your videos…" }) +
  frame("stage", { name: "Reading your followers", status: "done" }) +
  frame("stage", { name: "Watching your videos", status: "active" }) +
  frame("stage", { name: "Watching your videos", status: "done" }) +
  frame("stage", { name: "Building your audience profile", status: "active" }) +
  frame("stage", { name: "Building your audience profile", status: "done" }) +
  frame("done", { audience: AUDIENCE, reveal: { profile: { handle: "nia.tests" }, posts: [] } });

const RUN_EVENTS: BuildEvent[] = [
  { type: "stage", name: "Reading your followers", status: "active" },
  {
    type: "evidence",
    handle: "nia.tests",
    picture: "https://cdn.example.test/nia.jpg",
    covers: ["https://cdn.example.test/1.jpg", "https://cdn.example.test/4.jpg"],
    count: 5,
  },
  { type: "stage", name: "Reading your followers", status: "done" },
  { type: "stage", name: "Watching your videos", status: "active" },
  { type: "stage", name: "Watching your videos", status: "done" },
  { type: "stage", name: "Building your audience profile", status: "active" },
  { type: "stage", name: "Building your audience profile", status: "done" },
  { type: "done", audienceId: AUDIENCE.id },
];

describe("readBuildStream: the events", () => {
  it("reads a whole run in one chunk; the status frames are dropped (the steps carry the same news)", async () => {
    expect(await eventsOf(streamOf([RUN]))).toEqual(RUN_EVENTS);
  });

  it("maps the evidence: an https picture, the https covers in order, the count of every video", async () => {
    const [e] = await eventsOf(streamOf([frame("evidence", EVIDENCE)]));
    expect(e).toEqual(RUN_EVENTS[1]);
  });

  it("an evidence picture that is empty or not https is no picture; no videos is a count of 0", async () => {
    const events = await eventsOf(
      streamOf([
        frame("evidence", { ...EVIDENCE, avatarUrl: "", videos: [] }),
        frame("evidence", { ...EVIDENCE, avatarUrl: "http://cdn.example.test/nia.jpg", videos: undefined }),
        frame("evidence", { ...EVIDENCE, avatarUrl: "not a link" }),
      ]),
    );
    expect(events.map((e) => (e.type === "evidence" ? [e.picture, e.covers.length, e.count] : null))).toEqual([
      [null, 0, 0],
      [null, 0, 0],
      [null, 2, 5],
    ]);
  });

  it("the too-little-to-read frame", async () => {
    const events = await eventsOf(streamOf([frame("fallback", { reason: "thin", message: "We couldn't read enough from @nia.tests …" })]));
    expect(events).toEqual([{ type: "fallback" }]);
  });

  it("an error carries the server's sentence, or null without one", async () => {
    const events = await eventsOf(
      streamOf([frame("error", { message: SYNTHESIS, retry: true }), frame("error", { retry: true }), frame("error", { message: "   " })]),
    );
    expect(events).toEqual([
      { type: "error", message: SYNTHESIS },
      { type: "error", message: null },
      { type: "error", message: null },
    ]);
  });

  it("done needs the audience's id: without one the frame is skipped", async () => {
    const events = await eventsOf(streamOf([frame("done", { reveal: {} }), frame("done", { audience: { id: "" } }), frame("done", { audience: AUDIENCE })]));
    expect(events).toEqual([{ type: "done", audienceId: AUDIENCE.id }]);
  });

  it("a stage needs a name and one of the three statuses", async () => {
    const events = await eventsOf(
      streamOf([
        frame("stage", { name: "Watching your videos", status: "running" }),
        frame("stage", { status: "active" }),
        frame("stage", { name: "", status: "done" }),
        frame("stage", { name: "Watching your videos", status: "pending" }),
      ]),
    );
    expect(events).toEqual([{ type: "stage", name: "Watching your videos", status: "pending" }]);
  });
});

describe("readBuildStream: what is skipped, and the reading goes on", () => {
  it("an unknown event, a frame without a name, bad JSON, a comment line", async () => {
    const stream = streamOf([
      frame("heartbeat", { at: 1 }) +
        `data: ${JSON.stringify({ name: "Reading your followers", status: "active" })}\n\n` +
        "event: stage\ndata: {not json\n\n" +
        ": a comment the server may send to keep the line open\n\n" +
        "event: stage\n\n" +
        frame("done", { audience: AUDIENCE }),
    ]);
    expect(await eventsOf(stream)).toEqual([{ type: "done", audienceId: AUDIENCE.id }]);
  });

  it("an event name does not carry over to the next frame", async () => {
    const stream = streamOf([`event: done\ndata: {}\n\ndata: ${JSON.stringify({ audience: AUDIENCE })}\n\n`]);
    expect(await eventsOf(stream)).toEqual([]);
  });
});

describe("readBuildStream: frames cut the ways a network cuts them", () => {
  it.each([1, 2, 3, 5, 7, 13, 64])("the run cut into chunks of %i bytes reads the same", async (size) => {
    expect(await eventsOf(streamOf(bytesIn(RUN, size)))).toEqual(RUN_EVENTS);
  });

  it("a cut inside the dash of the synthesis sentence keeps the sentence whole", async () => {
    const text = frame("error", { message: SYNTHESIS, retry: true });
    const bytes = enc.encode(text);
    const dash = enc.encode(text.slice(0, text.indexOf("—"))).length; // the dash's first byte
    for (const cut of [dash + 1, dash + 2]) {
      const events = await eventsOf(streamOf([bytes.slice(0, cut), bytes.slice(cut)]));
      expect(events).toEqual([{ type: "error", message: SYNTHESIS }]);
    }
  });

  it("\\r\\n line ends, also when the \\r and the \\n come in different chunks", async () => {
    const crlf = RUN.replace(/\n/g, "\r\n");
    expect(await eventsOf(streamOf([crlf]))).toEqual(RUN_EVENTS);
    const at = crlf.indexOf("\r\n") + 1;
    expect(await eventsOf(streamOf([crlf.slice(0, at), crlf.slice(at)]))).toEqual(RUN_EVENTS);
  });

  it("`event:` and `data:` with or without the space after the colon", async () => {
    const stream = streamOf([`event:done\ndata:${JSON.stringify({ audience: AUDIENCE })}\n\n`]);
    expect(await eventsOf(stream)).toEqual([{ type: "done", audienceId: AUDIENCE.id }]);
  });

  it("several data lines are one value, joined with a line break", async () => {
    const stream = streamOf(['event: stage\ndata: {"name": "Watching your videos",\ndata: "status": "active"}\n\n']);
    expect(await eventsOf(stream)).toEqual([{ type: "stage", name: "Watching your videos", status: "active" }]);
  });

  it("the last frame with no blank line after it is still read when the stream ends", async () => {
    const last = `event: done\ndata: ${JSON.stringify({ audience: AUDIENCE })}`;
    expect(await eventsOf(streamOf([last]))).toEqual([{ type: "done", audienceId: AUDIENCE.id }]);
    expect(await eventsOf(streamOf([`${last}\n`]))).toEqual([{ type: "done", audienceId: AUDIENCE.id }]);
  });

  it("an empty stream reads nothing", async () => {
    expect(await eventsOf(streamOf([]))).toEqual([]);
  });
});
