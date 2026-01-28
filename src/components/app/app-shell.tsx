"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { AuthGuard } from "./auth-guard";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Client-side app shell wrapper.
 *
 * Manages:
 * - Mobile menu open/close state
 * - AuthGuard wrapper for skeleton loading
 * - Sidebar and MobileNav integration
 *
 * This is extracted from the layout to keep the root layout
 * as a server component (for metadata and fonts).
 */
export function AppShell({ children }: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <AuthGuard>
      <div className="flex h-screen bg-[#0A0A0A]">
        <MobileNav onMenuClick={() => setMobileMenuOpen(true)} />
        <Sidebar
          mobileOpen={mobileMenuOpen}
          onMobileOpenChange={setMobileMenuOpen}
        />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
