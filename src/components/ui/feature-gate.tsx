import type { ReactNode } from "react";
import type { VirtunaTier } from "@/lib/whop/config";
import { hasAccessToTier } from "@/lib/whop/config";

interface FeatureGateProps {
  requiredTier: VirtunaTier;
  userTier: VirtunaTier;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ requiredTier, userTier, children, fallback }: FeatureGateProps) {
  if (hasAccessToTier(userTier, requiredTier)) {
    return <>{children}</>;
  }
  return fallback ? <>{fallback}</> : null;
}
