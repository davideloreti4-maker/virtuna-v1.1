import Image from "next/image";
import { cn } from "@/lib/utils";
import { TrafficLights } from "@/components/primitives";

interface BrowserFrameProps {
  /** Image source path */
  src: string;
  /** Alt text for the screenshot */
  alt: string;
  /** Image width */
  width: number;
  /** Image height */
  height: number;
  /** Additional className for the outer container */
  className?: string;
  /** Whether to load with priority */
  priority?: boolean;
}

/**
 * macOS-style browser chrome frame wrapping a product screenshot.
 * Renders traffic lights, URL bar placeholder, and the image
 * inside a styled window with Raycast design tokens.
 */
export function BrowserFrame({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
}: BrowserFrameProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-white/[0.06]",
        "shadow-xl",
        className
      )}
      style={{
        background: "linear-gradient(180deg, #1e1f23 0%, #141517 100%)",
      }}
    >
      {/* Title bar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-white/[0.06]">
        <TrafficLights size="sm" disabled />
        {/* URL bar placeholder */}
        <div className="flex-1 flex justify-center">
          <div className="h-6 max-w-[240px] w-full rounded-md bg-white/[0.05] flex items-center justify-center">
            <span className="text-xs text-foreground-muted truncate px-3">
              app.virtuna.io
            </span>
          </div>
        </div>
        {/* Spacer to balance traffic lights */}
        <div className="w-[52px]" />
      </div>

      {/* Screenshot */}
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="w-full h-auto"
        priority={priority}
      />
    </div>
  );
}
