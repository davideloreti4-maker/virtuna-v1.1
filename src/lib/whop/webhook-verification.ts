import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifies Whop webhook signatures using the Svix standard.
 * @param payload - The raw webhook payload as a string
 * @param headers - The Svix headers (svix-id, svix-timestamp, svix-signature)
 * @param secret - The webhook secret (may include whsec_ prefix)
 * @returns true if signature is valid, false otherwise
 */
export function verifyWebhookSignature(
  payload: string,
  headers: {
    "svix-id": string;
    "svix-timestamp": string;
    "svix-signature": string;
  },
  secret: string
): boolean {
  try {
    // 1. Decode the secret: strip whsec_ prefix if present, then base64-decode
    const secretWithoutPrefix = secret.startsWith("whsec_")
      ? secret.slice(6)
      : secret;
    const secretBytes = Buffer.from(secretWithoutPrefix, "base64");

    // 2. Check timestamp tolerance (5 minutes)
    const timestamp = parseInt(headers["svix-timestamp"], 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(currentTime - timestamp);

    if (timeDiff > 300) {
      return false; // Timestamp too old or too far in the future
    }

    // 3. Build the signature content
    const signedContent = `${headers["svix-id"]}.${headers["svix-timestamp"]}.${payload}`;

    // 4. Compute HMAC-SHA256
    const expectedSignature = createHmac("sha256", secretBytes)
      .update(signedContent)
      .digest();

    // 5. Extract v1 signatures from the header
    const signatureHeader = headers["svix-signature"];
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
