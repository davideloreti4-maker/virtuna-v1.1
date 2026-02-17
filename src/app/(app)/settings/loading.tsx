import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <Skeleton className="h-8 w-32" />
      <div className="flex gap-8">
        <div className="hidden w-48 space-y-2 md:block">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-11 rounded-lg" />
          ))}
        </div>
        <div className="flex-1 space-y-6">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="grid gap-6 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
