"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { Heading } from "@/components/ui";

interface NavItem {
  href: string;
  label: string;
}

interface SidebarNavProps {
  items: NavItem[];
}

export function SidebarNav({ items }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 border-r border-border-glass p-6 md:block sticky top-0 h-screen overflow-y-auto">
      <Heading level={4} className="mb-6 text-foreground">
        Virtuna UI
      </Heading>
      <nav>
        <ul className="space-y-1">
          {items.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/showcase" &&
                pathname.startsWith(item.href));

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-accent/10 font-medium text-accent"
                      : "text-foreground-secondary hover:bg-hover hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
