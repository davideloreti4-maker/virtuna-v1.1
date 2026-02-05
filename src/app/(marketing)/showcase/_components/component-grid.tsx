import { cn } from "@/lib/utils";

interface ComponentGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

const columnClasses: Record<2 | 3 | 4, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

export function ComponentGrid({
  children,
  columns = 3,
  className,
}: ComponentGridProps) {
  return (
    <div className={cn("grid gap-6", columnClasses[columns], className)}>
      {children}
    </div>
  );
}
