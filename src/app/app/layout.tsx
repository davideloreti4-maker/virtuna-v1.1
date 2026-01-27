"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { AppHeader } from "@/components/layout/app-header"
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
        {/* Sidebar */}
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          currentView={currentView}
          onViewChange={setCurrentView}
          currentSociety={currentSociety}
          onSocietyChange={setCurrentSociety}
          onLogout={handleLogout}
        />

        {/* Main content area */}
        <div
          className="transition-[margin-left] duration-200 ease-out"
          style={{
            marginLeft: sidebarCollapsed ? 60 : 230,
          }}
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
