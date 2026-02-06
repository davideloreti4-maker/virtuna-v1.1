"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle,
  XCircle,
  Warning,
  Info,
  X,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

// ============================================
// Types
// ============================================

export type ToastVariant = "default" | "success" | "error" | "warning" | "info";

export interface ToastData {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  /** Duration in ms before auto-dismiss. Default 5000. Set 0 for persistent. */
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface UseToast {
  toast: (options: Omit<ToastData, "id">) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

export interface ToastProviderProps {
  children: React.ReactNode;
  /** Maximum visible toasts. Oldest are removed when exceeded. @default 5 */
  maxToasts?: number;
}

// ============================================
// Variant config
// ============================================

const VARIANT_ICON: Record<ToastVariant, React.ReactNode> = {
  default: null,
  success: <CheckCircle size={18} weight="fill" />,
  error: <XCircle size={18} weight="fill" />,
  warning: <Warning size={18} weight="fill" />,
  info: <Info size={18} weight="fill" />,
};

const VARIANT_CLASSES: Record<
  ToastVariant,
  { container: string; icon: string; progress: string }
> = {
  default: {
    container: "border-white/[0.06]",
    icon: "text-foreground-secondary",
    progress: "bg-foreground-secondary",
  },
  success: {
    container: "bg-success/10 border-success/20",
    icon: "text-success",
    progress: "bg-success",
  },
  error: {
    container: "bg-error/10 border-error/20",
    icon: "text-error",
    progress: "bg-error",
  },
  warning: {
    container: "bg-warning/10 border-warning/20",
    icon: "text-warning",
    progress: "bg-warning",
  },
  info: {
    container: "bg-info/10 border-info/20",
    icon: "text-info",
    progress: "bg-info",
  },
};

// ============================================
// Context
// ============================================

interface ToastContextValue {
  toast: (options: Omit<ToastData, "id">) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

// ============================================
// Toast animations (CSS keyframes injected once)
// ============================================

const TOAST_KEYFRAMES = `
@keyframes toast-slide-in-right {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
@keyframes toast-slide-out-right {
  from { transform: translateX(0);    opacity: 1; }
  to   { transform: translateX(100%); opacity: 0; }
}
`;

let keyframesInjected = false;

function injectKeyframes(): void {
  if (keyframesInjected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.textContent = TOAST_KEYFRAMES;
  document.head.appendChild(style);
  keyframesInjected = true;
}

// ============================================
// Individual Toast component
// ============================================

interface ToastProps {
  data: ToastData;
  onDismiss: (id: string) => void;
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ data, onDismiss }, ref) => {
    const [isExiting, setIsExiting] = React.useState(false);
    const [progress, setProgress] = React.useState(100);
    const [isPaused, setIsPaused] = React.useState(false);
    const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
    const elapsedRef = React.useRef(0);
    const lastTickRef = React.useRef(Date.now());

    const variant = data.variant ?? "default";
    const duration = data.duration ?? 5000;
    const config = VARIANT_CLASSES[variant];
    const icon = VARIANT_ICON[variant];

    const handleDismiss = React.useCallback(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(data.id), 150);
    }, [data.id, onDismiss]);

    // Auto-dismiss timer with pause support
    React.useEffect(() => {
      if (duration <= 0) return;

      const tick = (): void => {
        const now = Date.now();
        elapsedRef.current += now - lastTickRef.current;
        lastTickRef.current = now;

        const remaining = Math.max(
          0,
          100 - (elapsedRef.current / duration) * 100
        );
        setProgress(remaining);

        if (remaining <= 0) {
          handleDismiss();
        }
      };

      if (!isPaused) {
        lastTickRef.current = Date.now();
        timerRef.current = setInterval(tick, 50);
      }

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }, [duration, isPaused, handleDismiss]);

    const handleMouseEnter = (): void => {
      if (duration > 0) setIsPaused(true);
    };

    const handleMouseLeave = (): void => {
      if (duration > 0) setIsPaused(false);
    };

    const animationStyle: React.CSSProperties = {
      animation: isExiting
        ? "toast-slide-out-right 150ms ease-in forwards"
        : "toast-slide-in-right 200ms ease-out",
    };

    const reducedMotionStyle: string = isExiting
      ? "motion-reduce:opacity-0"
      : "motion-reduce:opacity-100";

    return (
      <div
        ref={ref}
        role="alert"
        aria-live="polite"
        className={cn(
          "relative flex items-start gap-3 rounded-lg border p-4 shadow-lg",
          config.container,
          reducedMotionStyle
        )}
        style={{
          backgroundColor: "rgba(17, 18, 20, 0.95)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: "0 10px 15px rgba(0,0,0,0.3), rgba(255,255,255,0.1) 0px 1px 0px 0px inset",
          ...animationStyle,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Icon */}
        {icon && (
          <div className={cn("mt-0.5 shrink-0", config.icon)}>{icon}</div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{data.title}</p>
          {data.description && (
            <p className="mt-1 text-xs text-foreground-secondary">
              {data.description}
            </p>
          )}
          {data.action && (
            <button
              type="button"
              onClick={data.action.onClick}
              className="mt-2 rounded bg-white/5 px-2 py-1 text-xs font-medium text-foreground hover:bg-white/10"
            >
              {data.action.label}
            </button>
          )}
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 text-foreground-muted transition-colors hover:text-foreground"
          aria-label="Dismiss toast"
        >
          <X size={16} weight="bold" />
        </button>

        {/* Progress bar */}
        {duration > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-lg">
            <div
              className={cn("h-full transition-[width] duration-50 ease-linear", config.progress)}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    );
  }
);
Toast.displayName = "Toast";

// ============================================
// useToast hook
// ============================================

/**
 * Access the toast system. Must be used within a `<ToastProvider>`.
 *
 * @returns `{ toast, dismiss, dismissAll }`
 *
 * @example
 * ```tsx
 * const { toast } = useToast();
 * toast({ variant: "success", title: "Saved!" });
 * ```
 */
export function useToast(): UseToast {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return context;
}

// ============================================
// ToastProvider
// ============================================

let toastCounter = 0;

function generateToastId(): string {
  toastCounter += 1;
  return `toast-${toastCounter}-${Date.now()}`;
}

/**
 * ToastProvider - Manages toast state and renders the toast container.
 *
 * Place this once in your app layout (e.g., `layout.tsx`) to enable
 * the `useToast()` hook throughout the application.
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * import { ToastProvider } from "@/components/ui/toast";
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <ToastProvider>
 *           {children}
 *         </ToastProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function ToastProvider({
  children,
  maxToasts = 5,
}: ToastProviderProps): React.ReactNode {
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    injectKeyframes();
  }, []);

  const addToast = React.useCallback(
    (options: Omit<ToastData, "id">): string => {
      const id = generateToastId();
      const newToast: ToastData = {
        ...options,
        id,
        variant: options.variant ?? "default",
      };
      setToasts((prev) => {
        const updated = [...prev, newToast];
        // Remove oldest if exceeding maxToasts
        return updated.slice(-maxToasts);
      });
      return id;
    },
    [maxToasts]
  );

  const dismiss = React.useCallback((id: string): void => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = React.useCallback((): void => {
    setToasts([]);
  }, []);

  const contextValue = React.useMemo<ToastContextValue>(
    () => ({ toast: addToast, dismiss, dismissAll }),
    [addToast, dismiss, dismissAll]
  );

  const toastContainer =
    mounted && toasts.length > 0
      ? createPortal(
          <div
            className={cn(
              "fixed top-4 right-4 z-[var(--z-toast)]",
              "flex w-[380px] max-w-[calc(100vw-2rem)] flex-col gap-3"
            )}
            aria-label="Notifications"
          >
            {toasts.map((t) => (
              <Toast key={t.id} data={t} onDismiss={dismiss} />
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {toastContainer}
    </ToastContext.Provider>
  );
}

export { Toast };
