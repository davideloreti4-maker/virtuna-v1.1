import { cn } from "@/lib/utils";

interface SectionWrapperProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  as?: "section" | "div";
}

/**
 * SectionWrapper enforces consistent max-width, horizontal padding,
 * and vertical spacing across all landing page sections.
 *
 * - Max-width: 1152px (72rem) for content alignment
 * - Horizontal padding: 24px mobile, 32px desktop
 * - Vertical spacing: 80px mobile, 96px tablet, 128px desktop
 */
export function SectionWrapper({
  children,
  className,
  id,
  as: Component = "section",
}: SectionWrapperProps): React.ReactNode {
  return (
    <Component
      id={id}
      className={cn(
        "mx-auto w-full max-w-[72rem] px-6 py-20 md:px-8 md:py-24 lg:py-32",
        className
      )}
    >
      {children}
    </Component>
  );
}
