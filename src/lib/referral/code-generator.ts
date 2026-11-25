import { customAlphabet } from "nanoid";

// Alphanumeric uppercase only (avoid confusion: O vs 0, I vs 1, l vs 1)
export const REFERRAL_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 31 chars
export const REFERRAL_CODE_LENGTH = 8;
const nanoid = customAlphabet(REFERRAL_CODE_ALPHABET, REFERRAL_CODE_LENGTH); // 8 chars = 31^8 = ~850 billion combinations

export function generateReferralCode(): string {
  return nanoid();
}

const REFERRAL_CODE_PATTERN = new RegExp(`^[${REFERRAL_CODE_ALPHABET}]{${REFERRAL_CODE_LENGTH}}$`);

/**
 * True for a text of the form this generator makes. A code that reaches the server from outside (the
 * referral cookie) is checked with this before it is looked up (Earn, ruling 29).
 */
export function isReferralCode(value: unknown): value is string {
  return typeof value === "string" && REFERRAL_CODE_PATTERN.test(value);
}
