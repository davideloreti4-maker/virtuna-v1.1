"use client"

import { motion } from "motion/react"
import { MoreVertical, Info, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { mockSocieties, type Society, type SocietyStatus } from "@/lib/constants/app-navigation"

// ===========================================
// TYPES
// ===========================================

interface SocietyCardProps {
  society: Society
  onClick?: () => void
}

interface CreateSocietyCardProps {
  onClick?: () => void
}

// ===========================================
// BRAND ICONS (SVG - exact logos)
// ===========================================

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77Z" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

// ===========================================
// STATUS BADGE (Societies.io exact style)
// ===========================================

function StatusBadge({ status }: { status: SocietyStatus }) {
  const variants: Record<SocietyStatus, { label: string; className: string }> = {
    setup: {
      label: "Setup",
      // Orange badge - societies.io style
      className: "bg-[#FF9C39] text-white",
    },
    example: {
      label: "Example",
      // Dark semi-transparent badge - societies.io style
      className: "bg-[rgba(0,0,0,0.5)] text-white",
    },
    active: {
      label: "Active",
      className: "bg-success/20 text-success",
    },
  }

  const variant = variants[status]

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variant.className
      )}
    >
      {variant.label}
    </span>
  )
}

// ===========================================
// THREE DOT MENU
// ===========================================

function ThreeDotMenu({ onClick }: { onClick?: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(e)
      }}
      className={cn(
        "p-1 rounded-md transition-colors",
        "text-app-text-muted hover:text-white hover:bg-white/10"
      )}
    >
      <MoreVertical className="h-4 w-4" />
    </button>
  )
}

// ===========================================
// SOCIETY ICON
// ===========================================

function SocietyIcon({ icon }: { icon?: string }) {
  if (icon === "linkedin") {
    return (
      <div className="flex h-12 w-12 items-center justify-center">
        <LinkedInIcon className="h-10 w-10 text-[#0A66C2]" />
      </div>
    )
  }

  if (icon === "twitter") {
    return (
      <div className="flex h-12 w-12 items-center justify-center">
        <XIcon className="h-9 w-9 text-white" />
      </div>
    )
  }

  // Default icon for target societies
  return (
    <div
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-xl",
        "bg-app-bg-input border border-app-border"
      )}
    >
      <Users className="h-6 w-6 text-app-text-muted" />
    </div>
  )
}

// ===========================================
// SOCIETY CARD
// ===========================================

function SocietyCard({ society, onClick }: SocietyCardProps) {
  const isExample = society.status === "example"

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-start gap-4 p-5",
        "rounded-xl border border-app-border bg-app-bg-card",
        "text-left transition-colors min-h-[180px]",
        "hover:border-app-border hover:bg-app-bg-input",
        "focus:outline-none focus:ring-2 focus:ring-app-accent focus:ring-offset-2 focus:ring-offset-app-bg"
      )}
    >
      {/* Top row: Badge on LEFT, menu on RIGHT */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        {/* Badge always top-LEFT */}
        <StatusBadge status={society.status} />

        {/* 3-dot menu on right for example cards */}
        {isExample && (
          <ThreeDotMenu onClick={() => console.log("Menu clicked")} />
        )}
      </div>

      {/* Icon - positioned below badge area */}
      <div className="mt-6">
        <SocietyIcon icon={society.icon} />
      </div>

      {/* Content */}
      <div className="space-y-1">
        <h3 className="font-medium text-app-text group-hover:text-white transition-colors">
          {society.name}
        </h3>
        <p className="text-sm text-app-text-muted leading-relaxed">
          {society.description}
        </p>
        {society.memberCount && (
          <p className="text-xs text-app-text-muted pt-1">
            {society.memberCount.toLocaleString()} members
          </p>
        )}
      </div>
    </motion.button>
  )
}

// ===========================================
// CREATE SOCIETY CARD (No plus icon - just text)
// ===========================================

function CreateSocietyCard({ onClick }: CreateSocietyCardProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center justify-center",
        "rounded-xl border-2 border-dashed border-app-border bg-transparent",
        "min-h-[180px] text-center transition-colors",
        "hover:border-app-accent hover:bg-app-accent/5",
        "focus:outline-none focus:ring-2 focus:ring-app-accent focus:ring-offset-2 focus:ring-offset-app-bg"
      )}
    >
      {/* Just centered text - no plus icon (societies.io style) */}
      <span className="font-medium text-app-text-muted group-hover:text-app-accent transition-colors">
        Create Target Society
      </span>
    </motion.button>
  )
}

// ===========================================
// SECTION HEADER (with info icon)
// ===========================================

function SectionHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-app-text">{title}</h2>
        {/* Info icon (ⓘ) - societies.io style */}
        <Info className="h-4 w-4 text-app-text-muted cursor-help" />
      </div>
      {description && (
        <p className="text-sm text-app-text-muted mt-1">{description}</p>
      )}
    </div>
  )
}

// ===========================================
// APP HOME PAGE
// ===========================================

export default function AppHomePage() {
  const personalSocieties = mockSocieties.filter((s) => s.type === "personal")
  const targetSocieties = mockSocieties.filter((s) => s.type === "target")

  const handleSocietyClick = (society: Society) => {
    // TODO: Navigate to society detail or open setup modal
    console.log("Society clicked:", society.id)
  }

  const handleCreateSociety = () => {
    // TODO: Open create society modal
    console.log("Create society clicked")
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Personal Societies Section */}
      <section className="mb-10">
        <SectionHeader
          title="Personal Societies"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {personalSocieties.map((society) => (
            <SocietyCard
              key={society.id}
              society={society}
              onClick={() => handleSocietyClick(society)}
            />
          ))}
        </div>
      </section>

      {/* Target Societies Section */}
      <section>
        <SectionHeader
          title="Target Societies"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Create new card first */}
          <CreateSocietyCard onClick={handleCreateSociety} />

          {/* Existing societies */}
          {targetSocieties.map((society) => (
            <SocietyCard
              key={society.id}
              society={society}
              onClick={() => handleSocietyClick(society)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
