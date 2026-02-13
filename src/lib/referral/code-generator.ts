import { customAlphabet } from "nanoid";

// Alphanumeric uppercase only (avoid confusion: O vs 0, I vs 1, l vs 1)
const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 31 chars
const nanoid = customAlphabet(alphabet, 8); // 8 chars = 31^8 = ~850 billion combinations

export function generateReferralCode(): string {
  return nanoid();
}
