/**
 * Text-file ingest (IN-01 / ASVS V5 / V12) — the untrusted-bytes boundary for
 * `.txt` / `.md` uploads on the General path.
 *
 * `validateUpload` hardens the upload BEFORE any read: it allowlists extension AND
 * MIME (never trusts one alone — V12) and enforces a byte cap (V5 DoS) — all before
 * a single byte is decoded. `readTextFile` validates, then reads the file fully
 * in-memory via `file.text()` (zero parser dependencies, D-05) and trims.
 *
 * ⚠️ Pitfall 3 / T-04-02-01: `file.name` is provenance ONLY — it is NEVER
 * interpolated into a filesystem or storage path. Text is read in-memory; there is
 * no storage path at all on this surface.
 *
 * Caps/allowlists are LOCAL to this leaf module (each leaf owns its own caps) so the
 * vision module (Plan 03) stays independent for parallel execution — no cross-module
 * sharing.
 */

/** Max accepted text upload — 1 MB (V5: oversize/decompression DoS). */
export const MAX_TEXT_BYTES = 1 * 1024 * 1024;

/** Allowed file extensions (lowercased, dot-prefixed). */
export const TEXT_EXT = new Set([".txt", ".md"]);

/**
 * Allowed MIME types. `""` is tolerated because browsers often omit a MIME for
 * `.md`; the extension allowlist still gates those (V12: extension AND MIME).
 */
export const ALLOWED_TEXT = new Set(["text/plain", "text/markdown", ""]);

/**
 * Reject a text upload at the trust boundary BEFORE any read (V5 / V12). Throws on:
 *   - extension not in `TEXT_EXT`
 *   - a truthy `file.type` not in `ALLOWED_TEXT` (disguised/spoofed file)
 *   - `file.size` over `MAX_TEXT_BYTES`
 *
 * `file.name` is read for its extension ONLY — never used as a path (Pitfall 3).
 */
export function validateUpload(file: File): void {
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  if (!TEXT_EXT.has(ext)) {
    throw new Error(`Unsupported file extension "${ext}". Allowed: .txt, .md`);
  }

  // Allowlist MIME AND extension — never trust one alone (V12).
  if (file.type && !ALLOWED_TEXT.has(file.type)) {
    throw new Error(`Unsupported MIME type "${file.type}".`);
  }

  // Size cap enforced BEFORE any read (V5 DoS).
  if (file.size > MAX_TEXT_BYTES) {
    throw new Error(
      `File too large (${file.size} bytes). Maximum is ${MAX_TEXT_BYTES} bytes.`
    );
  }
}

/**
 * Read an allowed `.txt` / `.md` `File` into trimmed UTF-8 text. Validates the
 * upload first (caps before read), then reads fully in-memory with zero parser
 * dependencies (D-05). Throws (via `validateUpload`) on a bad extension, wrong MIME,
 * or oversize file.
 */
export async function readTextFile(file: File): Promise<string> {
  validateUpload(file);
  return (await file.text()).trim();
}
