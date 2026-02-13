import { AppShell } from "@/components/app";
import { ToastProvider } from "@/components/ui/toast";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ToastProvider>
      <AppShell>
        {children}
      </AppShell>
    </ToastProvider>
  );
}
