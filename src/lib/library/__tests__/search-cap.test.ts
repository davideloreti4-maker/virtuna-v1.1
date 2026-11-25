/**
 * The search text's cap in two places: the address's
 * (`LIBRARY_Q_MAX`, a pure module the client reads) and the server's (`LIBRARY_SEARCH_MAX`, in the
 * server-only page reader, which the client must not import). They are one number: an address
 * holding more than the server searches would ask for a text the list never shows. Only this test
 * reads both. The page reader's service client is made only when a page is read, never on import.
 */
import { describe, expect, it } from "vitest";

import { LIBRARY_SEARCH_MAX } from "../library-page";
import { LIBRARY_Q_MAX, librarySearchText } from "../library-view";

describe("the search cap", () => {
  it("is the same in the address and on the server", () => {
    expect(LIBRARY_Q_MAX).toBe(LIBRARY_SEARCH_MAX);
  });

  it("the address cuts where the server does", () => {
    expect(Array.from(librarySearchText("x".repeat(LIBRARY_SEARCH_MAX + 20)))).toHaveLength(LIBRARY_SEARCH_MAX);
  });
});
