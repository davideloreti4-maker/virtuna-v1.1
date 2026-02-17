import type { Product } from "@/types/brand-deals";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AvailableProductCardProps {
  product: Product;
  onGenerateLink: (product: Product) => void;
}

// ---------------------------------------------------------------------------
// AvailableProductCard Component
// ---------------------------------------------------------------------------

export function AvailableProductCard({
  product,
  onGenerateLink,
}: AvailableProductCardProps): React.JSX.Element {
  return (
    <Card
      tabIndex={0}
      role="article"
      aria-label={`${product.brandName} - ${product.name}: ${product.commissionRate}% commission`}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onGenerateLink(product);
        }
      }}
      className={cn(
        "p-5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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
        <div className="text-2xl font-semibold text-success">
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
    </Card>
  );
}
