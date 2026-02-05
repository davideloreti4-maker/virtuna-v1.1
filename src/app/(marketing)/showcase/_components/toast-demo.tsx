"use client";

import { Button, ToastProvider, useToast } from "@/components/ui";
import type { ToastVariant } from "@/components/ui";

const TOAST_VARIANTS: { variant: ToastVariant; label: string; description: string }[] = [
  { variant: "default", label: "Default", description: "A neutral notification" },
  { variant: "success", label: "Success", description: "Action completed successfully" },
  { variant: "warning", label: "Warning", description: "Something needs attention" },
  { variant: "error", label: "Error", description: "Something went wrong" },
  { variant: "info", label: "Info", description: "Here is some information" },
];

function ToastButtons() {
  const { toast } = useToast();

  return (
    <div className="flex flex-wrap gap-3">
      {TOAST_VARIANTS.map(({ variant, label, description }) => (
        <Button
          key={variant}
          variant="secondary"
          size="sm"
          onClick={() =>
            toast({
              variant,
              title: `${label} Toast`,
              description,
            })
          }
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

export function ToastDemo() {
  return (
    <ToastProvider>
      <ToastButtons />
    </ToastProvider>
  );
}
