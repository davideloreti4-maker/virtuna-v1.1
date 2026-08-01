/**
 * The account read's two real phases, as spine row names.
 *
 * Its own module for the same reason calibration-stages.ts is: the server extractor emits these
 * and a `'use client'` component renders them. Importing `account-read.ts` from the client would
 * drag `ApifyScrapingProvider` — and everything it pulls in — into the browser bundle. tsc is
 * perfectly happy with that; `npm run build` is the gate that is not, and it has bitten this repo
 * before (see the surfaces-import-breaks-prod-build note).
 *
 * Both phases are genuine, independently-resolving Apify runs — the profile typically lands first,
 * the 30-post pull after it. No invented steps.
 */

export const ACCOUNT_READ_PLAN: string[] = [
  'Finding your profile',
  'Reading your last 30 posts',
];
