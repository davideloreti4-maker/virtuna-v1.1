/**
 * Marketing route-group layout — bare pass-through (D-10).
 *
 * The root layout is the sole owner of the document shell, the font variables
 * (Inter + Newsreader), and base metadata. This file previously duplicated that
 * shell plus a redundant Inter and stale marketing metadata, and rendered the
 * header; all of that was removed. The header now lives in each marketing page
 * (the `/` skeleton owns header + main + footer), and each page exports its own
 * page metadata.
 */
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
