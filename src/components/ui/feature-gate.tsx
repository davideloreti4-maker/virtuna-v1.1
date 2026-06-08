import type { ReactNode } from "react";
import type { NumenTier } from "@/lib/whop/config";
import { hasAccessToTier } from "@/lib/whop/config";

interface FeatureGateProps {
  requiredTier: NumenTier;
  userTier: NumenTier;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ requiredTier, userTier, children, fallback }: FeatureGateProps) {
  if (hasAccessToTier(userTier, requiredTier)) {
    return <>{children}</>;
  }
  return fallback ? <>{fallback}</> : null;
}
