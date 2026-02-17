import { LinkSimple } from "@phosphor-icons/react";

export function AffiliatesEmptyState(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] mb-4">
        <LinkSimple
          size={32}
          weight="thin"
          className="text-foreground-muted"
          aria-hidden="true"
        />
      </div>
      <h2 className="text-lg font-medium text-foreground mb-1">
        No active affiliate links
      </h2>
      <p className="text-sm text-foreground-muted text-center max-w-sm">
        Generate your first link from the products below
      </p>
    </div>
  );
}
