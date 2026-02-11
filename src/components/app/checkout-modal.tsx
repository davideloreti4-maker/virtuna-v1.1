"use client";

import { useState, useEffect } from "react";
import { WhopCheckoutEmbed } from "@whop/checkout/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  planId: "starter" | "pro";
  onComplete?: () => void;
}

export function CheckoutModal({
  open,
  onClose,
  planId,
  onComplete,
}: CheckoutModalProps) {
  const [checkoutConfigId, setCheckoutConfigId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch checkout config when modal opens
  useEffect(() => {
    if (!open) return;

    const fetchCheckoutConfig = async () => {
      setLoading(true);
      setError(null);
      setCheckoutConfigId(null);

      try {
        const res = await fetch("/api/whop/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId }),
        });

        if (!res.ok) {
          throw new Error(`Failed to create checkout session: ${res.statusText}`);
        }

        const data = await res.json();
        setCheckoutConfigId(data.checkoutConfigId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load checkout");
      } finally {
        setLoading(false);
      }
    };

    fetchCheckoutConfig();
  }, [open, planId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setCheckoutConfigId(null);
      setLoading(false);
      setError(null);
    }
  }, [open]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  };

  const handleComplete = () => {
    onComplete?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="lg" className="p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>
            Upgrade to {planId === "pro" ? "Pro" : "Starter"}
          </DialogTitle>
          <DialogDescription>
            Complete your payment to unlock {planId === "pro" ? "Pro" : "Starter"} features.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-sm text-zinc-400">Loading checkout...</div>
            </div>
          )}
          {error && (
            <div className="text-sm text-red-400 py-4">{error}</div>
          )}
          {checkoutConfigId && (
            <WhopCheckoutEmbed
              sessionId={checkoutConfigId}
              theme="dark"
              skipRedirect
              onComplete={handleComplete}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
