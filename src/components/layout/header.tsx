"use client"

import { useState } from "react"
import { motion, useScroll, useMotionValueEvent } from "motion/react"
import Link from "next/link"
import { Container } from "./container"
import { MobileMenu } from "./mobile-menu"
import { headerNavItems, headerCTA, type NavItemWithChildren } from "@/lib/constants/navigation"

export function Header() {
  const [hidden, setHidden] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { scrollY } = useScroll()

  // Hide header on scroll down, show on scroll up
  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() ?? 0
    if (latest > previous && latest > 150) {
      setHidden(true)
    } else {
      setHidden(false)
    }
  })

  return (
    <>
      <motion.header
        variants={{
          visible: { y: 0 },
          hidden: { y: "-100%" },
        }}
        animate={hidden ? "hidden" : "visible"}
        transition={{ duration: 0.35, ease: "easeInOut" }}
        className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]"
      >
        {/* Subtle grey separator line matching societies.io */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background: 'linear-gradient(90deg, transparent, #262626 15%, #262626 85%, transparent)',
          }}
        />
        <Container>
          <div className="flex h-[66px] items-center justify-between">
            {/* Logo + Brand Name */}
            <Link href="/" className="flex items-center gap-2">
              {/* Lambda/A logo icon matching societies.io */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                className="text-white"
              >
                <path
                  d="M12 4L4 20h3.5l4.5-10 4.5 10H20L12 4z"
                  fill="currentColor"
                />
              </svg>
              <span className="text-[16px] font-medium text-white">
                Artificial Societies
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              {headerNavItems.map((item) => (
                <NavItem key={item.label} item={item} />
              ))}
            </nav>

            {/* Right side - Auth buttons (desktop) */}
            <div className="hidden md:flex items-center gap-6">
              <Link
                href={headerCTA.signIn.href}
                className="text-[14px] text-white hover:text-white/80 transition-colors"
                {...(headerCTA.signIn.external && {
                  target: "_blank",
                  rel: "noopener noreferrer",
                })}
              >
                {headerCTA.signIn.label}
              </Link>
              <Link
                href={headerCTA.bookMeeting.href}
                className="inline-flex items-center justify-center bg-[#E57850] text-white font-medium text-[14px] rounded-[4px] hover:bg-[#d46a45] px-4 py-2"
                style={{ transition: 'background-color 0.2s' }}
              >
                {headerCTA.bookMeeting.label}
              </Link>
            </div>

            {/* Mobile hamburger button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-white/80 hover:text-white transition-colors"
              aria-label="Open menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </Container>
      </motion.header>

      {/* Mobile menu */}
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </>
  )
}

interface NavItemProps {
  item: NavItemWithChildren
}

function NavItem({ item }: NavItemProps) {
  const [isOpen, setIsOpen] = useState(false)

  // If item has children, render as dropdown
  if (item.children && item.children.length > 0) {
    return (
      <div
        className="relative"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        <button className="flex items-center gap-1 text-[14px] text-white/80 hover:text-white transition-colors">
          {item.label}
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <div className="absolute top-full left-0 mt-2 w-48 py-2 bg-[#1a1a1a] rounded-lg shadow-lg border border-landing-border">
            {item.children.map((child) => (
              <Link
                key={child.label}
                href={child.href}
                className="block px-4 py-2 text-[14px] text-white/80 hover:text-white hover:bg-white/5 transition-colors"
                {...(child.external && {
                  target: "_blank",
                  rel: "noopener noreferrer",
                })}
              >
                {child.label}
                {child.external && (
                  <svg
                    className="inline-block ml-1 w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Single link item
  return (
    <Link
      href={item.href}
      className="text-[14px] text-white/80 hover:text-white transition-colors"
      {...(item.external && {
        target: "_blank",
        rel: "noopener noreferrer",
      })}
    >
      {item.label}
    </Link>
  )
}
