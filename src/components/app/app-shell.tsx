"use client";

import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";

import { AuthGuard } from "./auth-guard";
import { Sidebar } from "./sidebar";
import { SidebarToggle } from "./sidebar-toggle";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Client-side app shell wrapper.
 *
 * Layout: main uses padding-left (not margin-left) so its box extends
 * behind the fixed sidebar. Pages that want glass-visible backgrounds
 * can use negative margin to bleed into the sidebar area.
 *
 * --sidebar-offset CSS var is set on main so children can reference it.
 *
 * State managed via useSidebarStore (Zustand persist).
 */
export function AppShell({ children }: AppShellProps) {
  const isOpen = useSidebarStore((s) => s.isOpen);

  return (
    <AuthGuard>
      <div className="h-screen bg-background">
        <SidebarToggle />
        <Sidebar />
        <main
          className={cn(
            "h-full overflow-auto",
            "transition-[padding-left] duration-300 ease-[var(--ease-out-cubic)]",
            isOpen ? "md:pl-[284px]" : "md:pl-0",
          )}
          style={{
            "--sidebar-offset": isOpen ? "284px" : "0px",
          } as React.CSSProperties}
        >
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
