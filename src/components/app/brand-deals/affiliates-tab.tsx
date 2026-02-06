"use client";

import { useState, useMemo, useEffect } from "react";

import type { AffiliateLink, Product } from "@/types/brand-deals";
import { MOCK_AFFILIATE_LINKS, MOCK_PRODUCTS } from "@/lib/mock-brand-deals";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";

import { AffiliateLinkCard } from "./affiliate-link-card";
import { AffiliatesTabSkeleton } from "./affiliates-tab-skeleton";
import { AvailableProductCard } from "./available-product-card";
import { AffiliatesEmptyState } from "./affiliates-empty-state";

// ---------------------------------------------------------------------------
// AffiliatesTab Container
// ---------------------------------------------------------------------------

/**
 * AffiliatesTab -- Container component managing all Affiliates tab state.
 *
 * Manages active affiliate links (initialized from mock data), derives
 * available products by filtering out already-linked products, and handles
 * the Generate Link interaction (adds to active links, shows toast,
 * removes from available products).
 *
 * Renders two sections:
 * 1. **Active Links** -- grid of AffiliateLinkCard with count Badge
 * 2. **Available Products** -- grid of AvailableProductCard with Generate Link CTA
 *
 * @example
 * ```tsx
 * <AffiliatesTab />
 * ```
 */
export function AffiliatesTab(): React.JSX.Element {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [activeLinks, setActiveLinks] = useState<AffiliateLink[]>(MOCK_AFFILIATE_LINKS);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // Derive available products by filtering out products that already have active links
  const availableProducts = useMemo(() => {
    const linkedNames = new Set(activeLinks.map((link) => link.productName));
    return MOCK_PRODUCTS.filter((product) => !linkedNames.has(product.name));
  }, [activeLinks]);

  function handleGenerateLink(product: Product): void {
    const timestamp = Date.now();
    const shortCode = `vtna-${timestamp.toString(36)}`;

    const newLink: AffiliateLink = {
      id: `link-gen-${timestamp}`,
      dealId: "",
      productName: product.name,
      productImage: product.brandLogo,
      url: `https://${product.brandName.toLowerCase().replace(/\s/g, "")}.com/ref/${shortCode}`,
      shortCode,
      clicks: 0,
      conversions: 0,
      earnings: 0,
      commissionRate: product.commissionRate,
      status: "active",
      createdAt: new Date().toISOString().split("T")[0] ?? "",
    };

    setActiveLinks((prev) => [newLink, ...prev]);
    toast({
      variant: "success",
      title: `Affiliate link created for ${product.name}`,
    });
  }

  if (isLoading) return <AffiliatesTabSkeleton />;

  return (
    <div className="space-y-8">
      {/* Active Links section */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Active Links</h2>
          <Badge variant="default" size="sm">
            {activeLinks.length}
          </Badge>
        </div>
        {activeLinks.length === 0 ? (
          <AffiliatesEmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {activeLinks.map((link) => (
              <AffiliateLinkCard key={link.id} link={link} />
            ))}
          </div>
        )}
      </section>

      {/* Available Products section */}
      {availableProducts.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Available Products
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {availableProducts.map((product) => (
              <AvailableProductCard
                key={product.id}
                product={product}
                onGenerateLink={handleGenerateLink}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
