import { SidebarNav } from "./_components/sidebar-nav";

const NAV_ITEMS = [
  { href: "/showcase", label: "Tokens" },
  { href: "/showcase/inputs", label: "Inputs" },
  { href: "/showcase/navigation", label: "Navigation" },
  { href: "/showcase/feedback", label: "Feedback" },
  { href: "/showcase/data-display", label: "Data Display" },
  { href: "/showcase/layout-components", label: "Layout" },
  { href: "/showcase/utilities", label: "Utilities" },
];

export default function ShowcaseLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen">
      <SidebarNav items={NAV_ITEMS} />
      <main className="max-w-5xl flex-1 px-8 py-12 md:px-16 md:py-16">
        {children}
      </main>
    </div>
  );
}
