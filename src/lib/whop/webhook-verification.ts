import { createHmac, timingSafeEqual } from "crypto";

/**
 * The three values a Standard Webhooks signature needs, however the sender spelled them.
 *
 * ⚠️ Whop sends the UNPREFIXED **Standard Webhooks** headers — `webhook-id`,
 * `webhook-timestamp`, `webhook-signature`. This module used to read `svix-*` only, so
 * every header resolved to "" and EVERY webhook failed verification with a 401: a customer
 * could pay and never be granted their tier. The signing algorithm below was always right —
 * Standard Webhooks is the spec Svix donated, byte-identical construction — only the header
 * NAMES were wrong. We read `webhook-*` first and keep `svix-*` as a fallback so a Svix-
 * proxied sender (or an old fixture) still verifies.
 */
function readSignatureHeaders(headers: WebhookHeaders): {
  id: string;
  timestamp: string;
  signature: string;
} {
  const get = (name: string): string => {
    if (typeof (headers as Headers).get === "function") {
      return (headers as Headers).get(name) ?? "";
    }
    return (headers as Record<string, string | undefined>)[name] ?? "";
  };

  return {
    id: get("webhook-id") || get("svix-id"),
    timestamp: get("webhook-timestamp") || get("svix-timestamp"),
    signature: get("webhook-signature") || get("svix-signature"),
  };
}

/** Either a real `Headers` object or a plain record of header names to values. */
export type WebhookHeaders = Headers | Record<string, string | undefined>;

/**
 * Verifies Whop webhook signatures (Standard Webhooks / Svix construction).
 * @param payload - The raw webhook payload as a string
 * @param headers - The request headers (`webhook-*`, or legacy `svix-*`)
 * @param secret - The webhook secret (may include whsec_ prefix)
 * @returns true if signature is valid, false otherwise
 */
export function verifyWebhookSignature(
  payload: string,
  headers: WebhookHeaders,
  secret: string
): boolean {
  try {
    const {
      id: webhookId,
      timestamp: webhookTimestamp,
      signature: signatureHeader,
    } = readSignatureHeaders(headers);

    // Fail closed on a missing header rather than HMAC-ing empty strings into a
    // signature that can never match — an explicit false is the same verdict but
    // it costs nothing and says why.
    if (!webhookId || !webhookTimestamp || !signatureHeader) {
      return false;
    }
    // 1. Decode the secret: strip whsec_ prefix if present, then base64-decode
    const secretWithoutPrefix = secret.startsWith("whsec_")
      ? secret.slice(6)
      : secret;
    const secretBytes = Buffer.from(secretWithoutPrefix, "base64");

    // 2. Check timestamp tolerance (5 minutes)
    const timestamp = parseInt(webhookTimestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(currentTime - timestamp);

    if (!Number.isFinite(timestamp) || timeDiff > 300) {
      return false; // Unparseable, too old, or too far in the future
    }

    // 3. Build the signature content
    const signedContent = `${webhookId}.${webhookTimestamp}.${payload}`;

    // 4. Compute HMAC-SHA256
    const expectedSignature = createHmac("sha256", secretBytes)
      .update(signedContent)
      .digest();

    // 5. Extract v1 signatures from the header
    const signatures = signatureHeader.split(" ");

    const v1Signatures = signatures
      .filter((sig) => sig.startsWith("v1,"))
      .map((sig) => sig.slice(3)); // Remove "v1," prefix

    if (v1Signatures.length === 0) {
      return false; // No v1 signatures found
    }

    // 6. Compare using timingSafeEqual
    for (const v1Sig of v1Signatures) {
      try {
        const signatureBytes = Buffer.from(v1Sig, "base64");

        // Ensure both buffers are the same length for timingSafeEqual
        if (signatureBytes.length !== expectedSignature.length) {
          continue;
        }

        if (timingSafeEqual(expectedSignature, signatureBytes)) {
          return true; // Valid signature found
        }
      } catch {
        // Invalid base64 or comparison error, try next signature
        continue;
      }
    }

    // 7. No matching signature found
    return false;
  } catch {
    // Any error during verification should fail closed
    return false;
  }
}

/**
 * Describe WHY a signature was rejected, in terms safe to write to a log.
 *
 * A bare 401 is indistinguishable across every failure this module can have — wrong header
 * names, a secret that is not the one this endpoint signs with, a secret that is not base64,
 * or a signature header that omits the `v1,` scheme. Each needs a different fix and they all
 * look the same from outside. This returns SHAPES ONLY: which header names arrived, byte
 * LENGTHS, scheme names, and clock skew. It never returns the secret, the signature, or the
 * body — a diagnostic that leaks the thing it is diagnosing is worse than no diagnostic.
 */
export function describeSignatureFailure(
  payload: string,
  headers: WebhookHeaders,
  secret: string
): Record<string, unknown> {
  const { id, timestamp, signature } = readSignatureHeaders(headers);
  const stripped = secret.startsWith("whsec_") ? secret.slice(6) : secret;

  // Whop's secret is ASSUMED base64 (Standard Webhooks says so). If it is not, base64
  // decoding does not throw — it silently drops the invalid characters and yields a
  // shorter, wrong key. A decoded length far below the raw length is that tell.
  const decodedBytes = Buffer.from(stripped, "base64").length;

  const parts = signature ? signature.split(" ") : [];
  const schemes = parts.map((p) =>
    p.includes(",") ? p.slice(0, p.indexOf(",")) : "(no scheme prefix)"
  );

  const ts = parseInt(timestamp, 10);

  return {
    headers_present: {
      id: id !== "",
      timestamp: timestamp !== "",
      signature: signature !== "",
    },
    secret_raw_chars: secret.length,
    secret_has_whsec_prefix: secret.startsWith("whsec_"),
    secret_decoded_bytes: decodedBytes,
    secret_trailing_whitespace: secret !== secret.trim(),
    signature_parts: parts.length,
    signature_schemes: schemes,
    clock_skew_seconds: Number.isFinite(ts)
      ? Math.abs(Math.floor(Date.now() / 1000) - ts)
      : null,
    body_bytes: payload.length,
  };
}
