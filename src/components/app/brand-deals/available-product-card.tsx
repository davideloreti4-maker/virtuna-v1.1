import type { Product } from "@/types/brand-deals";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AvailableProductCardProps {
  /** The product available for affiliate link generation */
  product: Product;
  /** Callback when user clicks "Generate Link" */
  onGenerateLink: (product: Product) => void;
}

// ---------------------------------------------------------------------------
// AvailableProductCard Component
// ---------------------------------------------------------------------------

/**
 * AvailableProductCard -- Presentational component for a product available
 * for affiliate link generation.
 *
 * Displays brand info, product name, a hero commission rate percentage,
 * and a "Generate Link" CTA button.
 *
 * @example
 * ```tsx
 * <AvailableProductCard
 *   product={product}
 *   onGenerateLink={handleGenerateLink}
 * />
 * ```
 */
export function AvailableProductCard({
  product,
  onGenerateLink,
}: AvailableProductCardProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface-elevated p-5",
        "transition-all duration-200",
        "hover:border-border-hover hover:-translate-y-px hover:shadow-md",
      )}
    >
      {/* Brand logo + name */}
      <div className="mb-3 flex items-center gap-2.5">
        <Avatar
          src={product.brandLogo}
          alt={`${product.brandName} logo`}
          fallback={product.brandName.slice(0, 2).toUpperCase()}
          size="xs"
        />
        <span className="text-sm font-medium text-foreground-secondary">
          {product.brandName}
        </span>
      </div>

      {/* Product name */}
      <h3 className="mb-2 text-sm font-semibold text-foreground">
        {product.name}
      </h3>

      {/* Hero commission rate */}
      <div className="mb-4 text-center">
        <div className="text-2xl font-bold text-green-400">
          {product.commissionRate}%
        </div>
        <span className="text-[10px] uppercase tracking-wider text-foreground-muted">
          Commission
        </span>
      </div>

      {/* Generate Link CTA */}
      <Button
        variant="primary"
        size="sm"
        className="w-full"
        onClick={() => onGenerateLink(product)}
      >
        Generate Link
      </Button>
    </div>
  );
}
