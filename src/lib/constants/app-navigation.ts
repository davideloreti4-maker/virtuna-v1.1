/**
 * App Navigation Constants - Matching societies.io app structure
 *
 * These navigation items match the exact structure found on app.societies.io
 *
 * Last updated: 2026-01-27
 */

import {
  Plus,
  CreditCard,
  Sparkles,
  MessageSquare,
  BookOpen,
  LogOut,
  ChevronDown,
  type LucideIcon,
} from "lucide-react"

// ===========================================
// VIEW TYPES (Current View dropdown)
// ===========================================

export type ViewType =
  | "country"
  | "city"
  | "generation"
  | "role-level"
  | "sector"
  | "role-area"

export interface ViewOption {
  id: ViewType
  label: string
}

export const viewOptions: ViewOption[] = [
  { id: "country", label: "Country" },
  { id: "city", label: "City" },
  { id: "generation", label: "Generation" },
  { id: "role-level", label: "Role Level" },
  { id: "sector", label: "Sector" },
  { id: "role-area", label: "Role Area" },
]

// ===========================================
// CATEGORY FILTERS (per view type)
// ===========================================

export interface CategoryFilter {
  id: string
  label: string
  colorKey: string
}

export const categoryFilters: Record<ViewType, CategoryFilter[]> = {
  country: [
    { id: "us", label: "United States", colorKey: "united-states" },
    { id: "uk", label: "United Kingdom", colorKey: "united-kingdom" },
    { id: "de", label: "Germany", colorKey: "germany" },
    { id: "au", label: "Australia", colorKey: "australia" },
    { id: "ca", label: "Canada", colorKey: "canada" },
    { id: "fr", label: "France", colorKey: "france" },
    { id: "jp", label: "Japan", colorKey: "japan" },
    { id: "br", label: "Brazil", colorKey: "brazil" },
  ],
  city: [
    { id: "nyc", label: "New York", colorKey: "united-states" },
    { id: "london", label: "London", colorKey: "united-kingdom" },
    { id: "sf", label: "San Francisco", colorKey: "united-states" },
    { id: "tokyo", label: "Tokyo", colorKey: "japan" },
    { id: "sydney", label: "Sydney", colorKey: "australia" },
    { id: "berlin", label: "Berlin", colorKey: "germany" },
  ],
  generation: [
    { id: "gen-z", label: "Gen Z", colorKey: "gen-z" },
    { id: "millennial", label: "Millennial", colorKey: "millennial" },
    { id: "gen-x", label: "Gen X", colorKey: "gen-x" },
    { id: "boomer", label: "Baby Boomer", colorKey: "boomer" },
  ],
  "role-level": [
    { id: "entry", label: "Entry Level", colorKey: "entry" },
    { id: "mid", label: "Mid Level", colorKey: "mid" },
    { id: "senior", label: "Senior", colorKey: "senior" },
    { id: "executive", label: "Executive", colorKey: "executive" },
  ],
  sector: [
    { id: "finance", label: "Financial Services", colorKey: "financial-services" },
    { id: "tech", label: "Technology", colorKey: "technology" },
    { id: "healthcare", label: "Healthcare", colorKey: "healthcare" },
    { id: "consulting", label: "Consulting", colorKey: "consulting" },
    { id: "education", label: "Education", colorKey: "education" },
    { id: "retail", label: "Retail", colorKey: "retail" },
    { id: "manufacturing", label: "Manufacturing", colorKey: "manufacturing" },
    { id: "media", label: "Media & Entertainment", colorKey: "media" },
  ],
  "role-area": [
    { id: "engineering", label: "Engineering", colorKey: "technology" },
    { id: "marketing", label: "Marketing", colorKey: "media" },
    { id: "sales", label: "Sales", colorKey: "consulting" },
    { id: "product", label: "Product", colorKey: "united-states" },
    { id: "design", label: "Design", colorKey: "united-kingdom" },
    { id: "operations", label: "Operations", colorKey: "germany" },
  ],
}

// ===========================================
// SIDEBAR ACTIONS
// ===========================================

export interface SidebarAction {
  id: string
  label: string
  icon: LucideIcon
  href?: string
  onClick?: () => void
  variant?: "default" | "primary"
}

export const sidebarActions: SidebarAction[] = [
  {
    id: "create-test",
    label: "Create a new test",
    icon: Plus,
    href: "/app/tests/new",
    variant: "primary",
  },
]

// ===========================================
// SIDEBAR FOOTER LINKS
// ===========================================

export interface SidebarLink {
  id: string
  label: string
  icon: LucideIcon
  href?: string
  onClick?: () => void
  external?: boolean
}

export const sidebarFooterLinks: SidebarLink[] = [
  {
    id: "credits",
    label: "Credits: 2",
    icon: CreditCard,
    href: "/app/credits",
  },
  {
    id: "trial",
    label: "Start Free Trial",
    icon: Sparkles,
    href: "/app/upgrade",
  },
  {
    id: "feedback",
    label: "Leave Feedback",
    icon: MessageSquare,
    href: "/app/feedback",
  },
  {
    id: "guide",
    label: "Product Guide",
    icon: BookOpen,
    href: "/app/guide",
    external: true,
  },
]

export const sidebarLogout: SidebarLink = {
  id: "logout",
  label: "Log Out",
  icon: LogOut,
}

export const appVersion = "2.1"

// ===========================================
// MOCK SOCIETIES DATA
// ===========================================

export type SocietyType = "personal" | "target"
export type SocietyStatus = "setup" | "example" | "active"

export interface Society {
  id: string
  name: string
  description: string
  type: SocietyType
  status: SocietyStatus
  icon?: string
  memberCount?: number
}

export const mockSocieties: Society[] = [
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Your personal LinkedIn network built around the people who engage with your posts.",
    type: "personal",
    status: "setup",
    icon: "linkedin",
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    description: "Your personal X network built around the people who engage with your posts.",
    type: "personal",
    status: "setup",
    icon: "twitter",
  },
  {
    id: "example-1",
    name: "Startup Investors",
    description: "Individuals or firms that provide capital to early-stage companies in exchange for equity ownership.",
    type: "target",
    status: "example",
    memberCount: 1250,
  },
  {
    id: "example-2",
    name: "Tech Professionals",
    description: "Software engineers, designers, and product managers working in the technology sector.",
    type: "target",
    status: "example",
    memberCount: 3400,
  },
]

// ===========================================
// EXPORT ICONS FOR USE IN COMPONENTS
// ===========================================

export { ChevronDown }
