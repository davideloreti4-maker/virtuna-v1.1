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
