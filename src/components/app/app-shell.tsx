"use client";

import { AuthGuard } from "./auth-guard";
import { Sidebar, SidebarHamburger } from "@/components/sidebar/Sidebar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <AuthGuard>
      <div className="h-screen bg-background">
        <SidebarHamburger />
        <Sidebar />
        <main
          className="h-full overflow-auto"
          style={{ "--sidebar-offset": "0px" } as React.CSSProperties}
        >
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
