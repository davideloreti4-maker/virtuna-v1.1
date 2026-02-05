import { cn } from "@/lib/utils";

interface TokenSwatchProps {
  name: string;
  cssVar: string;
  semantic?: string;
  className?: string;
}

export function TokenSwatch({
  name,
  cssVar,
  semantic,
  className,
}: TokenSwatchProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="h-10 w-10 shrink-0 rounded-md border border-border-glass"
        style={{ backgroundColor: `var(--${cssVar})` }}
      />
      <div className="min-w-0">
        <p className="truncate font-mono text-xs text-foreground">{name}</p>
        <p className="truncate font-mono text-xs text-foreground-muted">
          var(--{cssVar})
        </p>
        {semantic && (
          <p className="truncate text-xs text-foreground-muted">{semantic}</p>
        )}
      </div>
    </div>
  );
}

interface TokenRowProps {
  name: string;
  value: string;
  preview?: React.ReactNode;
}

export function TokenRow({ name, value, preview }: TokenRowProps) {
  return (
    <div className="flex items-center gap-4">
      {preview && <div className="shrink-0">{preview}</div>}
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-xs text-foreground">{name}</p>
        <p className="truncate font-mono text-xs text-foreground-muted">
          {value}
        </p>
      </div>
    </div>
  );
}
