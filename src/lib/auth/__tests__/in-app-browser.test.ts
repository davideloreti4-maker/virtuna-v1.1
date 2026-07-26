/**
 * in-app-browser.test.ts — the funnel's identity gate.
 *
 * A false negative here (we say "real browser", it is actually a webview) shows the
 * visitor a Google button that Google will refuse, at the exact moment they were
 * ready to pay. So the real UA strings are pinned, per source app.
 */

import { describe, it, expect } from "vitest";
import {
  isInAppBrowser,
  isGoogleOAuthAvailable,
} from "@/lib/auth/in-app-browser";

/** Real-world UA strings, kept verbatim — abbreviating them defeats the point. */
const IN_APP = {
  tiktok_ios:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_34.5.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/US",
  tiktok_android:
    "Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 BytedanceWebview/d8a21c6",
  tiktok_trill:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 trill_2022905030 JsSdk/2.0",
  instagram_ios:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0.0.28.107 (iPhone14,2; iOS 17_4; en_US)",
  facebook_ios:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/452.0.0.36.107]",
  snapchat:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/12.72.0.42",
  android_generic_wv:
    "Mozilla/5.0 (Linux; Android 12; Pixel 6 Build/SQ3A.220705.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/103.0.0.0 Mobile Safari/537.36",
} as const;

const REAL_BROWSER = {
  ios_safari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  android_chrome:
    "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  mac_chrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  windows_firefox:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
} as const;

describe("isInAppBrowser", () => {
  for (const [name, ua] of Object.entries(IN_APP)) {
    it(`detects ${name}`, () => {
      expect(isInAppBrowser(ua)).toBe(true);
    });
  }

  for (const [name, ua] of Object.entries(REAL_BROWSER)) {
    it(`does NOT flag ${name}`, () => {
      expect(isInAppBrowser(ua)).toBe(false);
    });
  }

  it("treats a missing UA as a real browser", () => {
    // Fail open: a bot or a stripped UA should not be denied the Google button.
    // The OTP path works either way, so the optimistic default costs nothing.
    expect(isInAppBrowser(null)).toBe(false);
    expect(isInAppBrowser(undefined)).toBe(false);
    expect(isInAppBrowser("")).toBe(false);
  });

  it("does not mistake desktop Safari's 'Version/' token for a webview", () => {
    // Guard against a lazy /Version\/4.0/ style pattern creeping in — Android
    // WebView and desktop Safari both carry a Version token.
    expect(isInAppBrowser(REAL_BROWSER.ios_safari)).toBe(false);
  });
});

describe("isGoogleOAuthAvailable", () => {
  it("hides Google inside every in-app browser", () => {
    for (const ua of Object.values(IN_APP)) {
      expect(isGoogleOAuthAvailable(ua)).toBe(false);
    }
  });

  it("offers Google in real browsers", () => {
    for (const ua of Object.values(REAL_BROWSER)) {
      expect(isGoogleOAuthAvailable(ua)).toBe(true);
    }
  });
});
