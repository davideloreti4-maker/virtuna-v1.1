/**
 * The account read's two real phases, as spine row names.
 *
 * Its own module for the same reason calibration-stages.ts is: the server extractor emits these
 * and a `'use client'` component renders them. Importing `account-read.ts` from the client would
 * drag `ApifyScrapingProvider` — and everything it pulls in — into the browser bundle. tsc is
 * perfectly happy with that; `npm run build` is the gate that is not, and it has bitten this repo
 * before (see the surfaces-import-breaks-prod-build note).
 *
 * Both phases are genuine, independently-resolving Apify runs. **They race, and either can win** —
 * a live billed run measured the 30-post pull returning at 19.1s and the profile at 37.2s, the
 * opposite of what this comment used to assert ("the profile typically lands first"). That wrong
 * premise is what made row 2 flash active→done in one tick. Neither row may be sequenced off the
 * other's promise; each reports its own. No invented steps.
 */

export const ACCOUNT_READ_PLAN: string[] = [
  'Finding your profile',
  'Reading your last 30 posts',
];
