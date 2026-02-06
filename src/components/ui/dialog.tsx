"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Dialog root component. Controls open/close state.
 *
 * @example
 * ```tsx
 * <Dialog>
 *   <DialogTrigger asChild>
 *     <Button>Open Dialog</Button>
 *   </DialogTrigger>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>Confirm Action</DialogTitle>
 *       <DialogDescription>This cannot be undone.</DialogDescription>
 *     </DialogHeader>
 *     <p>Are you sure?</p>
 *     <DialogFooter>
 *       <DialogClose asChild>
 *         <Button variant="secondary">Cancel</Button>
 *       </DialogClose>
 *       <Button variant="primary">Confirm</Button>
 *     </DialogFooter>
 *   </DialogContent>
 * </Dialog>
 * ```
 */
const Dialog = DialogPrimitive.Root;

/**
 * Dialog trigger — opens the dialog when clicked.
 * Use `asChild` to compose with your own button component.
 */
const DialogTrigger = DialogPrimitive.Trigger;

/**
 * Dialog portal — renders dialog content into a portal at the end of the DOM.
 */
const DialogPortal = DialogPrimitive.Portal;

/**
 * Dialog close — closes the dialog when clicked.
 * Use `asChild` to compose with your own button component.
 */
const DialogClose = DialogPrimitive.Close;

/**
 * Dialog overlay — blurred dark backdrop behind the dialog content.
 *
 * Uses `z-[var(--z-modal-backdrop)]` (300) from the design system z-index scale.
 * Includes both `backdropFilter` and `WebkitBackdropFilter` for Safari compatibility.
 * Animates in/out with fade using Radix data-state attributes.
 */
const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[var(--z-modal-backdrop)] bg-black/60",
      // Animations
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    style={{
      backdropFilter: "blur(4px)",
      WebkitBackdropFilter: "blur(4px)",
    }}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * Size variants for DialogContent controlling max-width.
 */
const dialogContentVariants = cva(
  [
    // Positioning — centered fixed overlay
    "fixed left-[50%] top-[50%] z-[var(--z-modal)]",
    "translate-x-[-50%] translate-y-[-50%]",
    "w-full",
    // Solid dark surface (Raycast modals are opaque, not glass)
    "rounded-lg border border-border-glass",
    "bg-surface-elevated shadow-xl",
    // Animations
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
    "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
    "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
    "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
    // Duration
    "duration-200",
  ],
  {
    variants: {
      /**
       * Size variant controlling maximum width.
       * - `sm`: max-w-sm (384px)
       * - `md`: max-w-md (448px) — default
       * - `lg`: max-w-lg (512px)
       * - `xl`: max-w-xl (576px)
       * - `full`: 90vw/90vh with overflow scroll
       */
      size: {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-xl",
        full: "max-w-[90vw] max-h-[90vh] overflow-auto",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

/**
 * DialogContent props — extends Radix Dialog Content with size variant.
 */
export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof dialogContentVariants> {}

/**
 * Dialog content panel — solid dark surface rendered over the overlay.
 *
 * Features:
 * - Opaque dark bg with inset shadow highlight (Raycast pattern)
 * - 5 size variants: sm, md (default), lg, xl, full
 * - Radix-managed focus trap and scroll lock (no manual implementation)
 * - Scale + fade animation on open/close via data-state
 * - Uses `z-[var(--z-modal)]` (400) from the design system z-index scale
 *
 * @example
 * ```tsx
 * <DialogContent size="lg">
 *   <DialogHeader>
 *     <DialogTitle>Settings</DialogTitle>
 *   </DialogHeader>
 *   <SettingsForm />
 * </DialogContent>
 * ```
 */
const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, size, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(dialogContentVariants({ size, className }))}
      style={{
        boxShadow: "0 20px 25px rgba(0,0,0,0.15), 0 10px 10px rgba(0,0,0,0.1), rgba(255,255,255,0.05) 0px 1px 0px 0px inset",
      }}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

/**
 * Dialog header — flex column container for title and description.
 * Provides consistent padding (p-6 pb-0) across all dialog sizes.
 */
const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element => (
  <div
    className={cn("flex flex-col gap-1.5 p-6 pb-0", className)}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

/**
 * Dialog footer — right-aligned container for action buttons.
 * Provides consistent padding (p-6 pt-4) and gap between buttons.
 */
const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element => (
  <div
    className={cn("flex justify-end gap-3 p-6 pt-4", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

/**
 * Dialog title — styled heading for the dialog.
 * Uses `text-lg font-semibold` with foreground color.
 */
const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

/**
 * Dialog description — secondary text below the title.
 * Uses `text-sm` with secondary foreground color.
 */
const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-foreground-secondary", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  dialogContentVariants,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
