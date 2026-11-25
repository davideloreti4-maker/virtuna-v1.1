/**
 * "Simulate again" on a run that came back without an audience: the same stored video, simulated
 * as a new run. `POST /api/analyze` answers with a server-sent event stream whose first event is
 * `started` with the new run's id; the page moves to that run's address at once and the result
 * page polls the row until it finishes.
 */

import { reportSession401, SessionExpiredRefusal } from "@/lib/auth/session-expired";
import { CreditWallRefusal, reportCredit402 } from "@/lib/billing/credit-wall";

interface SseEvent {
  event: string;
  data: string;
}

/** Parse one block of an event stream (the lines between two blank lines). */
function parseBlock(block: string): SseEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  return data.length > 0 || event !== "message" ? { event, data: data.join("\n") } : null;
}

function idOf(data: string): string | null {
  try {
    const parsed = JSON.parse(data) as { id?: unknown };
    return typeof parsed.id === "string" && parsed.id.length > 0 ? parsed.id : null;
  } catch {
    return null;
  }
}

/**
 * The id carried by the stream's `started` event. Resolves as soon as it arrives and keeps reading
 * the stream to its end in the background: the run lives on the server for as long as the request
 * does, so the request is not dropped. Rejects if the stream ends without a `started` event.
 */
export function readStartedId(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let found = false;

    const take = (text: string) => {
      buffer += text.replace(/\r\n?/g, "\n");
      let cut = buffer.indexOf("\n\n");
      while (cut >= 0) {
        const event = parseBlock(buffer.slice(0, cut));
        buffer = buffer.slice(cut + 2);
        if (!found && event?.event === "started") {
          const id = idOf(event.data);
          if (id) {
            found = true;
            resolve(id);
          }
        }
        cut = buffer.indexOf("\n\n");
      }
    };

    void (async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          take(decoder.decode(value, { stream: true }));
        }
        take(`${decoder.decode()}\n\n`);
        if (!found) reject(new Error("The stream ended without a started event"));
      } catch (error) {
        if (!found) reject(error instanceof Error ? error : new Error(String(error)));
      } finally {
        reader.releaseLock();
      }
    })();
  });
}

/**
 * Start a new simulation of a stored video. Resolves with the new run's id.
 *
 * Rejects with `SessionExpiredRefusal` when the session is dead and with `CreditWallRefusal` when
 * the allowance is spent; in both cases the app-wide notice has already been raised.
 */
export async function startVideoSimulation(videoPath: string): Promise<string> {
  const response = await fetch("/api/analyze?bypass_cache=true", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ input_mode: "video_upload", content_type: "video", video_storage_path: videoPath }),
  });
  // A paid request, so two refusals are not failures and must not be reported as one:
  // a dead session (the app-wide sign-in notice) and a spent allowance (the credit wall).
  if (reportSession401(response.status)) throw new SessionExpiredRefusal();
  if (response.status === 402) {
    const body: unknown = await response.json().catch(() => null);
    if (reportCredit402(response.status, body)) throw new CreditWallRefusal();
  }
  if (!response.ok || !response.body) {
    throw new Error(`Simulate again failed: ${response.status}`);
  }
  return readStartedId(response.body);
}
