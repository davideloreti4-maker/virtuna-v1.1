/**
 * Surface icon set — monochrome line-icons (lucide), one system across the start page.
 * Keeps the v3 prototype's "no color emoji" rule: every glyph is `currentColor`, stroke-only.
 */

import {
  ArrowUp,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  Eye,
  Film,
  Flame,
  Layers,
  LayoutGrid,
  MessageCircle,
  Mic,
  Play,
  Plus,
  Repeat,
  Sparkles,
  Sun,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export type SurfaceIconName =
  | "flame"
  | "calendar"
  | "trend"
  | "sparkle"
  | "play"
  | "chat"
  | "repeat"
  | "chevron"
  | "eye"
  | "up"
  | "upright"
  | "plus"
  | "mic"
  | "layers"
  | "film"
  | "check"
  | "layout"
  | "sun";

export const SURFACE_ICONS: Record<SurfaceIconName, LucideIcon> = {
  flame: Flame,
  calendar: CalendarDays,
  trend: TrendingUp,
  sparkle: Sparkles,
  play: Play,
  chat: MessageCircle,
  repeat: Repeat,
  chevron: ChevronRight,
  eye: Eye,
  up: ArrowUp,
  upright: ArrowUpRight,
  plus: Plus,
  mic: Mic,
  layers: Layers,
  film: Film,
  check: Check,
  layout: LayoutGrid,
  sun: Sun,
};

export function SurfaceIcon({
  name,
  size = 16,
  className,
  strokeWidth = 1.7,
}: {
  name: SurfaceIconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = SURFACE_ICONS[name];
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
}
