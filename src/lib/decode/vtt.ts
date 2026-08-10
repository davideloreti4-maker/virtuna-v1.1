/**
 * vtt.ts — turn TikTok's FREE native subtitle track into plain speech text.
 *
 * Why this exists: `qwen3.7-flash` is sighted but DEAF (see engine/qwen/client.ts), so the spoken
 * hook — usually the whole hook in short-form — cannot reach it as audio. TikTok publishes a free
 * WEBVTT track for many videos (`downloadSubtitlesOptions: "DOWNLOAD_SUBTITLES"`, no AI charge),
 * which `remapClockworksVideo` already stores as `VideoData.subtitleUrl` but nothing ever read.
 * Measured 2026-08-10: 71% of real videos carry one, and 12/12 of those parsed cleanly.
 *
 * Every failure returns null rather than throwing: a missing transcript downgrades the decode
 * (spec D5), it does not fail the request.
 */

export function parseVtt(raw: string): string {
  return raw
    .split(/\r?\n/)
    .filter(
      (l) =>
        l.trim() &&
        !/^WEBVTT/i.test(l) &&
        !/^\d+$/.test(l.trim()) &&
        !/-->/.test(l) &&
        !/^(NOTE|STYLE|REGION)/i.test(l),
    )
    .map((l) => l.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchTranscript(
  url: string,
  deps: { fetchFn?: typeof fetch } = {},
): Promise<string | null> {
  const fetchFn = deps.fetchFn ?? fetch;
  try {
    const res = await fetchFn(url);
    if (!res.ok) return null;
    const text = parseVtt(await res.text());
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
