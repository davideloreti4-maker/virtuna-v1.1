"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Menu, X } from "lucide-react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { AppHeader } from "@/components/layout/app-header"
import { cn } from "@/lib/utils"
import {
  mockSocieties,
  type ViewType,
  type Society,
} from "@/lib/constants/app-navigation"
import { createClient } from "@/lib/supabase/client"

// ===========================================
// APP LAYOUT CONTEXT
// ===========================================

interface AppLayoutContextValue {
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  currentView: ViewType
  setCurrentView: (view: ViewType) => void
  currentSociety: Society | null
  setCurrentSociety: (society: Society | null) => void
  selectedCategories: string[]
  toggleCategory: (categoryId: string) => void
}

const AppLayoutContext = React.createContext<AppLayoutContextValue | null>(null)

export function useAppLayout() {
  const context = React.useContext(AppLayoutContext)
  if (!context) {
    throw new Error("useAppLayout must be used within AppLayout")
  }
  return context
}

// ===========================================
// APP LAYOUT COMPONENT
// ===========================================

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const supabase = createClient()

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)

  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  // View state
  const [currentView, setCurrentView] = React.useState<ViewType>("country")

  // Society state - default to first target society
  const [currentSociety, setCurrentSociety] = React.useState<Society | null>(
    mockSocieties.find((s) => s.type === "target") || null
  )

  // Selected category filters
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([])

  // Toggle category selection
  const toggleCategory = React.useCallback((categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    )
  }, [])

  // Reset categories when view changes
  React.useEffect(() => {
    setSelectedCategories([])
  }, [currentView])

  // Close mobile menu on route change or resize
  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false)
      }
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Logout handler
  const handleLogout = React.useCallback(async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }, [supabase, router])

  // Context value
  const contextValue = React.useMemo(
    () => ({
      sidebarCollapsed,
      setSidebarCollapsed,
      currentView,
      setCurrentView,
      currentSociety,
      setCurrentSociety,
      selectedCategories,
      toggleCategory,
    }),
    [
      sidebarCollapsed,
      currentView,
      currentSociety,
      selectedCategories,
      toggleCategory,
    ]
  )

  return (
    <AppLayoutContext.Provider value={contextValue}>
      <div className="dark min-h-screen bg-app-bg">
        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 px-4 flex items-center justify-between border-b border-app-border bg-app-bg">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 -ml-2 text-app-text-muted hover:text-app-text"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
          <span className="font-medium text-app-text">Artificial Societies</span>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar - hidden on mobile unless menu open */}
        <div
          className={cn(
            "md:block",
            mobileMenuOpen ? "block" : "hidden"
          )}
        >
          <AppSidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            currentView={currentView}
            onViewChange={setCurrentView}
            currentSociety={currentSociety}
            onSocietyChange={setCurrentSociety}
            onLogout={handleLogout}
            onMobileClose={() => setMobileMenuOpen(false)}
          />
        </div>

        {/* Main content area */}
        <div
          className={cn(
            "transition-[margin-left] duration-200 ease-out",
            "pt-14 md:pt-0", // Account for mobile header
            "ml-0 md:ml-[230px]", // No margin on mobile, sidebar width on desktop
            sidebarCollapsed && "md:ml-[60px]" // Collapsed sidebar width
          )}
        >
          {/* Top filter bar */}
          <AppHeader
            currentView={currentView}
            selectedCategories={selectedCategories}
            onCategoryToggle={toggleCategory}
          />

          {/* Page content */}
          <main className="min-h-[calc(100vh-56px)]">
            {children}
          </main>
        </div>
      </div>
    </AppLayoutContext.Provider>
  )
}
