import { cn } from "@/lib/utils";

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: "default" | "narrow" | "wide";
  as?: React.ElementType;
}

const sizeClasses = {
  default: "max-w-7xl",
  narrow: "max-w-4xl",
  wide: "max-w-screen-2xl",
} as const;

/**
 * Container component for consistent content width constraints.
 * Provides responsive padding and max-width based on size variant.
 */
export function Container({
  children,
  className,
  size = "default",
  as: Component = "div",
}: ContainerProps): React.ReactNode {
  return (
    <Component
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8",
        sizeClasses[size],
        className
      )}
    >
      {children}
    </Component>
  );
}
