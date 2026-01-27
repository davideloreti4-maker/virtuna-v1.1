"use client"

import * as React from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import {
  categoryFilters,
  type ViewType,
  type CategoryFilter,
} from "@/lib/constants/app-navigation"
import { categoryColors } from "@/lib/constants/design-tokens"

// ===========================================
// TYPES
// ===========================================

interface AppHeaderProps {
  currentView: ViewType
  selectedCategories: string[]
  onCategoryToggle: (categoryId: string) => void
}

// ===========================================
// CATEGORY PILL (Societies.io style with dot indicator)
// ===========================================

interface CategoryPillProps {
  filter: CategoryFilter
  isSelected: boolean
  onClick: () => void
}

function CategoryPill({ filter, isSelected, onClick }: CategoryPillProps) {
  const colorKey = filter.colorKey as keyof typeof categoryColors
  const dotColor = categoryColors[colorKey] || "#6366F1"

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "shrink-0 flex items-center gap-2 px-4 py-1.5 text-sm font-medium",
        "rounded-full transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-1 focus:ring-offset-transparent",
        // Always semi-transparent dark background (societies.io style)
        "bg-[rgba(21,21,21,0.314)]",
        isSelected ? "text-white" : "text-app-text-muted hover:text-white"
      )}
    >
      {/* Colored dot indicator */}
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: dotColor }}
      />
      {filter.label}
    </motion.button>
  )
}

// ===========================================
// APP HEADER COMPONENT
// ===========================================

export function AppHeader({
  currentView,
  selectedCategories,
  onCategoryToggle,
}: Omit<AppHeaderProps, "sidebarCollapsed">) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const filters = categoryFilters[currentView] || []

  return (
    <header
      className={cn(
        "sticky top-0 z-30",
        "h-14 px-4",
        "flex items-center",
        "border-b border-app-border",
        "bg-app-bg/80 backdrop-blur-md"
      )}
    >
      {/* Scrollable pill container */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-2 overflow-x-auto scrollbar-hide"
        style={{
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {filters.map((filter) => (
          <CategoryPill
            key={filter.id}
            filter={filter}
            isSelected={selectedCategories.includes(filter.id)}
            onClick={() => onCategoryToggle(filter.id)}
          />
        ))}
      </div>

      {/* Fade edge for scroll indication */}
      <div
        className="pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-app-bg to-transparent"
        aria-hidden="true"
      />
    </header>
  )
}
