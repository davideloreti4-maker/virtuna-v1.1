/**
 * Navigation Constants - Matching societies.io structure
 *
 * These navigation items match the exact structure found on societies.io
 * Links to unbuilt pages route to /coming-soon
 * Auth links route to /login or /signup
 *
 * Last updated: 2026-01-27
 */

export interface NavItem {
  label: string
  href: string
  external?: boolean
}

export interface NavItemWithChildren extends NavItem {
  children?: NavItem[]
}

// ===========================================
// HEADER NAVIGATION
// ===========================================

export const headerNavItems: NavItemWithChildren[] = [
  {
    label: "Resources",
    href: "/coming-soon",
    children: [
      { label: "Documentation", href: "/coming-soon" },
      { label: "Research Report", href: "https://storage.googleapis.com/as-website-assets/Artificial%20Societies%20Survey%20Eval%20Report%20Jan26.pdf", external: true },
    ],
  },
]

// CTA buttons in header
export const headerCTA = {
  signIn: {
    label: "Sign in",
    href: "https://app.societies.io",
    external: true,
  },
  bookMeeting: {
    label: "Book a Meeting",
    href: "/contact",
  },
}

// ===========================================
// FOOTER NAVIGATION
// ===========================================

export interface FooterSection {
  title: string
  links: NavItem[]
}

export const footerLinks: FooterSection[] = [
  {
    title: "Legal",
    links: [
      { label: "Privacy Notice", href: "/privacy-notice" },
      { label: "Terms of Service", href: "/terms-of-service" },
      { label: "Subprocessors", href: "/subprocessors" },
    ],
  },
]

// Social links
export const socialLinks: NavItem[] = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/artificial-societies",
    external: true,
  },
  {
    label: "X (Twitter)",
    href: "https://x.com/societiesio",
    external: true,
  },
]

// Footer contact
export const footerContact = {
  email: "founders@societies.io",
  copyright: "Artificial Societies",
}
