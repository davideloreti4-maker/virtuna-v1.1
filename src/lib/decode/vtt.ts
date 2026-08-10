/**
 * vtt.ts — turn TikTok's FREE native subtitle track into plain speech text.
 *
 * Why this exists: `qwen3.7-flash` is sighted but DEAF (see engine/qwen/client.ts), so the spoken
 * hook — usually the whole hook in short-form — cannot reach it as audio. TikTok publishes a free
 * WEBVTT track for many videos (`downloadSubtitlesOptions: "DOWNLOAD_SUBTITLES"`, no AI charge),
 * which `remapClockworksVideo` already stores as `VideoData.subtitleUrl` but nothing ever read.
 * Measured 2026-08-10: 71% of real videos carry one, and 12/12 of those parsed cleanly.
 *
 * TWO WIRE FORMATS. `tiktokLink` serves WEBVTT for some videos and a JSON utterance list for
 * others — measured 2026-08-10, @thefounderadvisor's track came back as
 * `{"utterances":[{"text":…,"start_time":…,"text_color":"#FFFFFFFF"}]}`. The line-based filter
 * below has no opinion about JSON, so it passed all 13,472 characters through as "speech" and
 * the decode prompt carried 5,401 tokens of styling metadata. Sniff the shape first.
 *
 * Every failure returns null rather than throwing: a missing transcript downgrades the decode
 * (spec D5), it does not fail the request.
 */

/** TikTok's JSON subtitle payload: spoken text plus timing and styling we do not want. */
function parseUtteranceJson(raw: string): string | null {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  const utterances = Array.isArray(parsed)
    ? parsed
    : (parsed as { utterances?: unknown })?.utterances;
  if (!Array.isArray(utterances)) return null;
  return utterances
    .map((u) => (u as { text?: unknown })?.text)
    .filter((t): t is string => typeof t === "string")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseVtt(raw: string): string {
  const fromJson = parseUtteranceJson(raw);
  if (fromJson !== null) return fromJson;

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
