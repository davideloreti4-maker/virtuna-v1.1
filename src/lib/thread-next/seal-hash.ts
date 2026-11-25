/**
 * seal-hash.ts — the key of a text simulation's result page (thread answers step 2, spec §4): the first
 * 10 characters of the base64url SHA-256 of the trimmed text. ONE function for every link a card draws
 * and for the endpoint that finds the seal, so the two agree by construction.
 *
 * Async because Web Crypto is the only SHA-256 both runtimes have (no hash library ships to the client).
 * A browser exposes `crypto.subtle` in secure contexts only (https, localhost).
 *
 * Pure: no React.
 */

const SEAL_HASH_LENGTH = 10;
const SEAL_HASH = /^[A-Za-z0-9_-]{10}$/;

export async function sealHashOf(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text.trim()));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "").slice(0, SEAL_HASH_LENGTH);
}

export function isSealHash(key: string): boolean {
  return SEAL_HASH.test(key);
}
