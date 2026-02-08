"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  className?: string;
}

/**
 * FeatureCard component for the features section.
 * Displays an icon, title, and description in a bordered card.
 *
 * Styling matches societies.io reference:
 * - Padding: 48px vertical, 26px horizontal
 * - Border: 1px solid rgba(255, 255, 255, 0.1)
 * - Icon: ~28-32px, white color
 * - Title: Inter, 18px, medium weight
 * - Description: Inter, 16px, muted color
 */
export function FeatureCard({
  icon,
  title,
  description,
  className,
}: FeatureCardProps) {
  return (
    <div
      className={cn(
        "rounded-[12px] border border-white/[0.06] px-[26px] py-12 transition-colors duration-150 hover:bg-white/[0.02]",
        className
      )}
      style={{
        boxShadow: "rgba(255, 255, 255, 0.05) 0px 1px 0px 0px inset",
      }}
    >
      <div className="mb-6 h-7 w-7 text-white">
        {icon}
      </div>
      <h3 className="mb-3 text-lg font-medium text-white">
        {title}
      </h3>
      <p className="font-sans text-base leading-relaxed text-foreground-muted">
        {description}
      </p>
    </div>
  );
}
