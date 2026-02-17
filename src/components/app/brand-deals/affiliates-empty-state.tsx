import { LinkSimple } from "@phosphor-icons/react";

// ---------------------------------------------------------------------------
// AffiliatesEmptyState Component
// ---------------------------------------------------------------------------

/**
 * AffiliatesEmptyState -- Displayed when no active affiliate links exist.
 *
 * Follows the DealsEmptyState pattern from Phase 54 with a centered
 * icon, heading, and guidance text directing users to generate links
 * from available products below.
 *
 * @example
 * ```tsx
 * {activeLinks.length === 0 && <AffiliatesEmptyState />}
 * ```
 */
export function AffiliatesEmptyState(): React.JSX.Element {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-xl border border-border-subtle p-8">
      <LinkSimple
        className="text-foreground-muted"
        size={40}
        weight="thin"
        aria-hidden="true"
      />

      <div className="text-center">
        <h3 className="text-lg font-medium text-foreground">
          No active affiliate links
        </h3>
        <p className="mt-1 text-sm text-foreground-muted">
          Generate your first link from the products below
        </p>
      </div>
    </div>
  );
}
