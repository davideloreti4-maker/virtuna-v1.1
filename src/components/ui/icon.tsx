import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

/**
 * Icon component props
 */
export interface IconProps {
  /** Phosphor icon component to render */
  icon: PhosphorIcon;
  /** Size in pixels */
  size?: 16 | 20 | 24 | 32;
  /** Icon weight (Phosphor-specific) */
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
  /** Accessible label - REQUIRED for meaningful icons, omit for decorative */
  label?: string;
  /** Additional className */
  className?: string;
}

/**
 * Icon wrapper for Phosphor icons with consistent sizing and accessibility
 *
 * @example
 * ```tsx
 * // Decorative icon (hidden from assistive technology)
 * <Icon icon={MagnifyingGlass} />
 *
 * // Meaningful icon with accessible label
 * <Icon icon={Warning} label="Warning" className="text-warning" />
 *
 * // Icon button usage
 * <Button size="icon" aria-label="Search">
 *   <Icon icon={MagnifyingGlass} size={20} />
 * </Button>
 * ```
 */
export function Icon({
  icon: IconComponent,
  size = 20,
  weight = "regular",
  label,
  className,
}: IconProps): React.ReactElement {
  return (
    <IconComponent
      size={size}
      weight={weight}
      className={className}
      aria-hidden={!label}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
