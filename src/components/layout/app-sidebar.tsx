"use client"

import Link from "next/link"
import { motion } from "motion/react"
import {
  PanelLeftClose,
  PanelLeft,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "@/components/ui/dropdown"
import {
  viewOptions,
  sidebarActions,
  sidebarFooterLinks,
  sidebarLogout,
  appVersion,
  mockSocieties,
  type ViewType,
  type Society,
} from "@/lib/constants/app-navigation"

// ===========================================
// TYPES
// ===========================================

interface AppSidebarProps {
  collapsed: boolean
  onToggle: () => void
  currentView: ViewType
  onViewChange: (view: ViewType) => void
  currentSociety: Society | null
  onSocietyChange: (society: Society) => void
  onLogout?: () => void
}

// ===========================================
// SIDEBAR LOGO
// ===========================================

function SidebarLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/app"
      className="flex items-center gap-2 px-1"
    >
      {/* A icon matching societies.io */}
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-black font-bold text-lg shrink-0">
        A
      </div>
      {!collapsed && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="font-medium text-app-text"
        >
          Artificial Societies
        </motion.span>
      )}
    </Link>
  )
}

// ===========================================
// SIDEBAR TOGGLE
// ===========================================

function SidebarToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg",
        "text-app-text-muted hover:text-app-text hover:bg-white/5",
        "transition-colors"
      )}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      {collapsed ? (
        <PanelLeft className="h-4 w-4" />
      ) : (
        <PanelLeftClose className="h-4 w-4" />
      )}
    </button>
  )
}

// ===========================================
// SIDEBAR LINK ITEM
// ===========================================

interface SidebarLinkItemProps {
  icon: LucideIcon
  label: string
  href?: string
  onClick?: () => void
  collapsed: boolean
  variant?: "default" | "primary"
  external?: boolean
}

function SidebarLinkItem({
  icon: Icon,
  label,
  href,
  onClick,
  collapsed,
  variant = "default",
  external,
}: SidebarLinkItemProps) {
  const content = (
    <>
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="truncate"
        >
          {label}
        </motion.span>
      )}
    </>
  )

  const className = cn(
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
    "transition-colors",
    variant === "primary"
      ? "bg-landing-accent text-white hover:bg-landing-accent-hover"
      : "text-app-text-muted hover:text-app-text hover:bg-white/5",
    collapsed && "justify-center px-2"
  )

  if (href) {
    return (
      <Link
        href={href}
        className={className}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {content}
      </Link>
    )
  }

  return (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  )
}

// ===========================================
// APP SIDEBAR COMPONENT
// ===========================================

export function AppSidebar({
  collapsed,
  onToggle,
  currentView,
  onViewChange,
  currentSociety,
  onSocietyChange,
  onLogout,
}: AppSidebarProps) {
  const targetSocieties = mockSocieties.filter((s) => s.type === "target")
  const selectedViewLabel =
    viewOptions.find((v) => v.id === currentView)?.label || "Country"

  return (
    <motion.aside
      initial={false}
      animate={{
        width: collapsed ? 60 : 230,
      }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "fixed left-0 top-0 h-full z-40",
        "flex flex-col",
        "border-r border-app-border",
        "bg-app-bg-sidebar"
      )}
    >
      {/* Header: Logo + Toggle */}
      <div className="flex items-center justify-between p-4">
        <SidebarLogo collapsed={collapsed} />
        {!collapsed && <SidebarToggle collapsed={collapsed} onToggle={onToggle} />}
      </div>

      {/* Society Selector */}
      <div className="px-3 mb-3">
        {!collapsed && (
          <label className="block text-xs text-app-text-muted mb-1.5 font-medium">
            Current Society
          </label>
        )}
        <Dropdown
          value={currentSociety?.id || null}
          onValueChange={(value) => {
            const society = mockSocieties.find((s) => s.id === value)
            if (society) onSocietyChange(society)
          }}
        >
          <DropdownTrigger
            placeholder="Select Society"
            collapsed={collapsed}
          >
            {!collapsed && currentSociety?.name}
          </DropdownTrigger>
          <DropdownContent>
            {targetSocieties.map((society) => (
              <DropdownItem key={society.id} value={society.id}>
                {society.name}
              </DropdownItem>
            ))}
          </DropdownContent>
        </Dropdown>
      </div>

      {/* View Selector */}
      <div className="px-3 mb-4">
        {!collapsed && (
          <label className="block text-xs text-app-text-muted mb-1.5 font-medium">
            Current View
          </label>
        )}
        <Dropdown
          value={currentView}
          onValueChange={(value) => onViewChange(value as ViewType)}
        >
          <DropdownTrigger collapsed={collapsed}>
            {!collapsed && selectedViewLabel}
          </DropdownTrigger>
          <DropdownContent>
            {viewOptions.map((view) => (
              <DropdownItem key={view.id} value={view.id}>
                {view.label}
              </DropdownItem>
            ))}
          </DropdownContent>
        </Dropdown>
      </div>

      {/* Actions */}
      <div className="px-3 mb-4">
        {sidebarActions.map((action) => (
          <SidebarLinkItem
            key={action.id}
            icon={action.icon}
            label={action.label}
            href={action.href}
            collapsed={collapsed}
            variant={action.variant}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="mx-3 h-px bg-app-border" />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer Links */}
      <div className="px-3 py-4 space-y-1">
        {sidebarFooterLinks.map((link) => (
          <SidebarLinkItem
            key={link.id}
            icon={link.icon}
            label={link.label}
            href={link.href}
            collapsed={collapsed}
            external={link.external}
          />
        ))}

        {/* Logout */}
        <SidebarLinkItem
          icon={sidebarLogout.icon}
          label={sidebarLogout.label}
          onClick={onLogout}
          collapsed={collapsed}
        />
      </div>

      {/* Version */}
      {!collapsed && (
        <div className="px-4 pb-4 text-xs text-app-text-muted">
          Version {appVersion}
        </div>
      )}

      {/* Collapsed toggle at bottom */}
      {collapsed && (
        <div className="flex justify-center pb-4">
          <SidebarToggle collapsed={collapsed} onToggle={onToggle} />
        </div>
      )}
    </motion.aside>
  )
}
