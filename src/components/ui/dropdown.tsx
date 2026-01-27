"use client"

import * as React from "react"
import { motion, AnimatePresence } from "motion/react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

// ===========================================
// DROPDOWN CONTEXT
// ===========================================

interface DropdownContextValue {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  selectedValue: string | null
  setSelectedValue: (value: string | null) => void
}

const DropdownContext = React.createContext<DropdownContextValue | null>(null)

function useDropdown() {
  const context = React.useContext(DropdownContext)
  if (!context) {
    throw new Error("Dropdown components must be used within a Dropdown")
  }
  return context
}

// ===========================================
// DROPDOWN ROOT
// ===========================================

interface DropdownProps {
  children: React.ReactNode
  value?: string | null
  onValueChange?: (value: string) => void
  defaultValue?: string | null
}

export function Dropdown({
  children,
  value,
  onValueChange,
  defaultValue = null,
}: DropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  const selectedValue = value !== undefined ? value : internalValue
  const setSelectedValue = React.useCallback(
    (newValue: string | null) => {
      if (value === undefined) {
        setInternalValue(newValue)
      }
      if (newValue && onValueChange) {
        onValueChange(newValue)
      }
    },
    [value, onValueChange]
  )

  // Close on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Close on escape
  React.useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [])

  return (
    <DropdownContext.Provider
      value={{ isOpen, setIsOpen, selectedValue, setSelectedValue }}
    >
      <div ref={dropdownRef} className="relative">
        {children}
      </div>
    </DropdownContext.Provider>
  )
}

// ===========================================
// DROPDOWN TRIGGER
// ===========================================

interface DropdownTriggerProps {
  children?: React.ReactNode
  placeholder?: string
  className?: string
  collapsed?: boolean
}

export function DropdownTrigger({
  children,
  placeholder = "Select...",
  className,
  collapsed = false,
}: DropdownTriggerProps) {
  const { isOpen, setIsOpen, selectedValue } = useDropdown()

  return (
    <button
      type="button"
      onClick={() => setIsOpen(!isOpen)}
      className={cn(
        "flex w-full items-center justify-between gap-2",
        "rounded-lg border border-app-border bg-app-bg-input",
        "px-3 py-2 text-sm text-app-text",
        "transition-colors hover:bg-white/5",
        "focus:outline-none focus:ring-2 focus:ring-app-accent focus:ring-offset-2 focus:ring-offset-app-bg",
        collapsed && "justify-center px-2",
        className
      )}
      aria-expanded={isOpen}
      aria-haspopup="listbox"
    >
      {!collapsed && (
        <span className="truncate">
          {children || selectedValue || placeholder}
        </span>
      )}
      <ChevronDown
        className={cn(
          "h-4 w-4 shrink-0 text-app-text-muted transition-transform duration-200",
          isOpen && "rotate-180"
        )}
      />
    </button>
  )
}

// ===========================================
// DROPDOWN CONTENT
// ===========================================

interface DropdownContentProps {
  children: React.ReactNode
  className?: string
  align?: "start" | "end" | "center"
}

export function DropdownContent({
  children,
  className,
  align = "start",
}: DropdownContentProps) {
  const { isOpen } = useDropdown()

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className={cn(
            "absolute z-50 mt-1 w-full min-w-[180px]",
            "rounded-lg border border-app-border bg-app-bg-card",
            "py-1 shadow-xl",
            align === "end" && "right-0",
            align === "center" && "left-1/2 -translate-x-1/2",
            className
          )}
          role="listbox"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ===========================================
// DROPDOWN ITEM
// ===========================================

interface DropdownItemProps {
  children: React.ReactNode
  value: string
  className?: string
  disabled?: boolean
  onSelect?: (value: string) => void
}

export function DropdownItem({
  children,
  value,
  className,
  disabled = false,
  onSelect,
}: DropdownItemProps) {
  const { selectedValue, setSelectedValue, setIsOpen } = useDropdown()
  const isSelected = selectedValue === value

  function handleSelect() {
    if (disabled) return
    setSelectedValue(value)
    setIsOpen(false)
    onSelect?.(value)
  }

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      disabled={disabled}
      onClick={handleSelect}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-sm text-left",
        "transition-colors",
        isSelected
          ? "bg-app-accent/10 text-app-accent"
          : "text-app-text hover:bg-white/5",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      {children}
    </button>
  )
}

// ===========================================
// DROPDOWN LABEL
// ===========================================

interface DropdownLabelProps {
  children: React.ReactNode
  className?: string
}

export function DropdownLabel({ children, className }: DropdownLabelProps) {
  return (
    <div
      className={cn(
        "px-3 py-1.5 text-xs font-medium text-app-text-muted uppercase tracking-wider",
        className
      )}
    >
      {children}
    </div>
  )
}

// ===========================================
// DROPDOWN SEPARATOR
// ===========================================

export function DropdownSeparator({ className }: { className?: string }) {
  return (
    <div className={cn("my-1 h-px bg-app-border", className)} role="separator" />
  )
}
