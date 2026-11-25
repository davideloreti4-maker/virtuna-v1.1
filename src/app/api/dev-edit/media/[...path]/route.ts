/**
 * Serves the files of the dev page's edit from `.scratch/media/`, which is outside git. Only in
 * development: it answers 404 in production. A video needs byte ranges, so it gives them.
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { ".mp4": "video/mp4", ".mov": "video/quicktime", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".jpg": "image/jpeg", ".png": "image/png" };

/**
 * A file, or a stretch of it, as a stream: read as the reader asks for more, and let go of when
 * the reader stops. A player takes the part it wants and hangs up, often mid-chunk; Node's own
 * adapter now and then went on writing into the closed stream, which the dev server logged as an
 * uncaught exception (three times in an evening of use, 2026-11-19; never reproduced on demand).
 * Here nothing is written once the reader has stopped.
 */
function streamOf(file: string, stretch?: { start: number; end: number }): ReadableStream<Uint8Array> {
  const source = createReadStream(file, stretch);
  const chunks = source[Symbol.asyncIterator]() as AsyncIterator<Uint8Array>;
  let open = true;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await chunks.next();
        if (!open) return;
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      } catch (error) {
        if (open) controller.error(error);
      }
    },
    cancel() {
      open = false;
      source.destroy();
    },
  });
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  const folder = resolve(process.cwd(), ".scratch", "media");
  const file = normalize(join(folder, ...(await context.params).path));
  if (!file.startsWith(folder + sep) || !existsSync(file) || !statSync(file).isFile() || !TYPES[extname(file)]) return new Response(null, { status: 404 });

  const size = statSync(file).size;
  const head = { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Accept-Ranges": "bytes", "Cache-Control": "no-store" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (!range) return new Response(streamOf(file), { headers: { ...head, "Content-Length": String(size) } });
  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
  if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  return new Response(streamOf(file, { start, end }), {
    status: 206,
    headers: { ...head, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
  });
}
