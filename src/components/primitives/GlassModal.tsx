"use client";

import { cn } from "@/lib/utils";
import { X } from "@phosphor-icons/react";
import {
  useEffect,
  useRef,
  type ReactNode,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

export interface GlassModalProps {
  /** Open state */
  open: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Modal description */
  description?: string;
  /** Size variant */
  size?: ModalSize;
  /** Hide close button */
  hideCloseButton?: boolean;
  /** Close on backdrop click */
  closeOnBackdropClick?: boolean;
  /** Close on escape key */
  closeOnEscape?: boolean;
  /** Additional className for the modal */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
  /** Modal content */
  children: ReactNode;
  /** Footer content */
  footer?: ReactNode;
}

// Size configurations
const sizeConfig: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  full: "max-w-[90vw] max-h-[90vh]",
};

/**
 * GlassModal - Raycast-style modal dialog.
 *
 * Features:
 * - Solid opaque dark panel (no glass/blur on modal itself)
 * - Blurred backdrop
 * - Header/body/footer sections
 * - Size variants (sm, md, lg, xl, full)
 * - ESC to close and click outside to close options
 * - Focus trap
 *
 * @example
 * // Basic modal
 * const [open, setOpen] = useState(false);
 *
 * <GlassModal
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   title="Confirm Action"
 *   description="Are you sure you want to proceed?"
 *   footer={
 *     <>
 *       <button onClick={() => setOpen(false)}>Cancel</button>
 *       <button onClick={handleConfirm}>Confirm</button>
 *     </>
 *   }
 * >
 *   <p>This action cannot be undone.</p>
 * </GlassModal>
 *
 * @example
 * // Large modal with custom content
 * <GlassModal
 *   open={open}
 *   onClose={handleClose}
 *   size="lg"
 *   title="Settings"
 * >
 *   <SettingsForm />
 * </GlassModal>
 */
export function GlassModal({
  open,
  onClose,
  title,
  description,
  size = "md",
  hideCloseButton = false,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  className,
  style,
  children,
  footer,
}: GlassModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Handle escape key
  useEffect(() => {
    if (!open || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, closeOnEscape, onClose]);

  // Focus management
  useEffect(() => {
    if (open) {
      // Store current focus
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus modal
      modalRef.current?.focus();
      // Prevent body scroll
      document.body.style.overflow = "hidden";
    } else {
      // Restore focus
      previousFocusRef.current?.focus();
      // Restore body scroll
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!open) return null;

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        aria-describedby={description ? "modal-description" : undefined}
        tabIndex={-1}
        className={cn(
          "relative w-full",
          sizeConfig[size],
          // Raycast modal: solid opaque dark bg, 12px radius, 6% border
          "rounded-[12px]",
          "border border-[rgba(255,255,255,0.06)]",
          "shadow-[var(--shadow-elevated)]",
          // Animation
          "animate-scale-in",
          // Focus
          "focus:outline-none",
          className
        )}
        style={{
          backgroundColor: "var(--color-surface-elevated, #222326)",
          boxShadow:
            "var(--shadow-elevated), rgba(255,255,255,0.1) 0 1px 0 0 inset",
          ...style,
        }}
      >
        {/* Header */}
        {(title || !hideCloseButton) && (
          <div className="flex items-start justify-between gap-4 p-6 border-b border-white/5">
            <div>
              {title && (
                <h2
                  id="modal-title"
                  className="text-[18px] font-semibold text-[var(--color-fg)]"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  id="modal-description"
                  className="mt-1 text-[14px] text-[var(--color-fg-300)]"
                >
                  {description}
                </p>
              )}
            </div>
            {!hideCloseButton && (
              <button
                onClick={onClose}
                className={cn(
                  "flex-shrink-0 p-1.5 -m-1.5 rounded-[var(--rounding-sm)]",
                  "text-[var(--color-fg-400)] hover:text-[var(--color-fg)]",
                  "hover:bg-white/5",
                  "transition-all duration-[var(--duration-fast)]",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-transparent)]"
                )}
                aria-label="Close modal"
              >
                <X size={20} weight="bold" />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-white/5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }

  return null;
}
