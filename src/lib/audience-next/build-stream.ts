/**
 * build-stream.ts — reads the server-sent events of `POST /api/audiences/calibrate` (the route writes
 * `event: name\ndata: JSON\n\n` per frame) into the events the building state needs.
 *
 * Pure: no React, no Next, no request of its own; it is handed the response's body. The old screens keep
 * their own copies of this reader; this one is the new screen's.
 *
 * A network may cut a frame anywhere: across chunks, mid-line, inside a multi-byte character (the synthesis
 * sentence carries a dash), between the `\r` and the `\n` of a line end. So the bytes go through one
 * streaming `TextDecoder`, lines are split only once complete, and a frame is handed on at its blank line,
 * or at the end of the stream when the last one has none. A frame that cannot be read (no name, bad JSON,
 * an event this screen does not know, a field missing) is skipped and the reading goes on.
 *
 * `status` frames are dropped: they repeat as a sentence what the `stage` frames say as steps.
 */

export type BuildEvent =
  | { type: "stage"; name: string; status: "pending" | "active" | "done" }
  | { type: "evidence"; handle: string; picture: string | null; covers: string[]; count: number }
  | { type: "fallback" }
  | { type: "error"; message: string | null }
  | { type: "done"; audienceId: string };

const STATUSES: ReadonlySet<string> = new Set(["pending", "active", "done"]);

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const textOf = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value : null);

/** A picture's address only when it is https: anything else (empty, http, a script) is no picture. */
function httpsOf(value: unknown): string | null {
  if (typeof value !== "string" || value === "") return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

/** One frame's event, or null when it cannot be read. */
function eventOf(name: string, data: unknown): BuildEvent | null {
  switch (name) {
    case "stage": {
      if (!isObject(data)) return null;
      const stage = textOf(data.name);
      const status = data.status;
      if (stage === null || typeof status !== "string" || !STATUSES.has(status)) return null;
      return { type: "stage", name: stage, status: status as "pending" | "active" | "done" };
    }
    case "evidence": {
      if (!isObject(data)) return null;
      const handle = textOf(data.handle);
      if (handle === null) return null;
      const videos = Array.isArray(data.videos) ? data.videos : [];
      const covers = videos.map((v) => httpsOf(isObject(v) ? v.coverUrl : null)).filter((c): c is string => c !== null);
      return { type: "evidence", handle, picture: httpsOf(data.avatarUrl), covers, count: videos.length };
    }
    case "fallback":
      return { type: "fallback" };
    case "error":
      return { type: "error", message: isObject(data) ? textOf(data.message) : null };
    case "done": {
      const audience = isObject(data) ? data.audience : null;
      const id = isObject(audience) ? textOf(audience.id) : null;
      return id === null ? null : { type: "done", audienceId: id };
    }
    default:
      return null; // `status`, and any event this screen does not know
  }
}

/** The event of a finished frame (its name and its data lines), or null. */
function dispatch(name: string | null, data: readonly string[]): BuildEvent | null {
  if (name === null || data.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(data.join("\n"));
  } catch {
    return null;
  }
  return eventOf(name, parsed);
}

export async function* readBuildStream(body: ReadableStream<Uint8Array>): AsyncGenerator<BuildEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let name: string | null = null;
  let data: string[] = [];

  /** One complete line: a field of the frame, or (empty) the frame's end. */
  const line = (text: string): BuildEvent | null => {
    if (text === "") {
      const event = dispatch(name, data);
      name = null;
      data = [];
      return event;
    }
    if (text.startsWith(":")) return null; // a comment
    const colon = text.indexOf(":");
    const field = colon === -1 ? text : text.slice(0, colon);
    let value = colon === -1 ? "" : text.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") name = value;
    else if (field === "data") data.push(value);
    return null;
  };

  for (;;) {
    const { done, value } = await reader.read();
    buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
    // At the end a lone `\r` can no longer be the first half of a `\r\n`: it ends the last line.
    const lines = (done ? buffer.replace(/\r$/, "") : buffer).split(/\r?\n/);
    // The last piece is a line still being written, unless the stream has ended.
    buffer = done ? "" : (lines.pop() ?? "");
    for (const text of lines) {
      const event = line(text);
      if (event) yield event;
    }
    if (done) break;
  }
  // The last frame, when nothing marked its end.
  const last = dispatch(name, data);
  if (last) yield last;
}
