"use client"

import { motion, AnimatePresence } from "motion/react"
import Link from "next/link"
import { useEffect } from "react"
import { headerNavItems, headerCTA, type NavItemWithChildren } from "@/lib/constants/navigation"

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  // Lock body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-40"
            aria-hidden="true"
          />

          {/* Menu panel */}
          <motion.nav
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed right-0 top-0 bottom-0 w-[280px] bg-[#0d0d0d] z-50 flex flex-col"
          >
            {/* Close button */}
            <div className="flex justify-end p-4">
              <button
                onClick={onClose}
                className="p-2 text-white/80 hover:text-white transition-colors"
                aria-label="Close menu"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Navigation items */}
            <div className="flex-1 px-6 py-4 overflow-y-auto">
              <nav className="space-y-1">
                {headerNavItems.map((item) => (
                  <MobileNavItem key={item.label} item={item} onClose={onClose} />
                ))}
              </nav>
            </div>

            {/* CTA buttons */}
            <div className="p-6 border-t border-landing-border space-y-3">
              <Link
                href={headerCTA.signIn.href}
                onClick={onClose}
                className="block text-center text-[14px] text-white/80 hover:text-white transition-colors py-2"
                {...(headerCTA.signIn.external && {
                  target: "_blank",
                  rel: "noopener noreferrer",
                })}
              >
                {headerCTA.signIn.label}
              </Link>
              <Link
                href={headerCTA.bookMeeting.href}
                onClick={onClose}
                className="block text-center bg-[#E57850] text-white font-medium text-[14px] rounded-[4px] hover:bg-[#d46a45] transition-colors py-3 px-4"
              >
                {headerCTA.bookMeeting.label}
              </Link>
            </div>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  )
}

interface MobileNavItemProps {
  item: NavItemWithChildren
  onClose: () => void
}

function MobileNavItem({ item, onClose }: MobileNavItemProps) {
  // If item has children, render as expandable section
  if (item.children && item.children.length > 0) {
    return (
      <div className="py-2">
        <span className="block text-[14px] text-white/50 uppercase tracking-wider mb-2">
          {item.label}
        </span>
        <div className="space-y-1 pl-2">
          {item.children.map((child) => (
            <Link
              key={child.label}
              href={child.href}
              onClick={onClose}
              className="block text-[16px] text-white/80 hover:text-white transition-colors py-2"
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
      </div>
    )
  }

  // Single link item
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className="block text-[16px] text-white/80 hover:text-white transition-colors py-3"
      {...(item.external && {
        target: "_blank",
        rel: "noopener noreferrer",
      })}
    >
      {item.label}
    </Link>
  )
}
