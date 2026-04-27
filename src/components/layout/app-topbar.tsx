import { Button } from "@/components/ui/button";

export function AppTopbar({
  title,
  eyebrow,
  productName,
  actions,
}: {
  title: string;
  eyebrow?: string;
  productName?: string | null;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b bg-background px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-4">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-serif text-2xl font-normal text-foreground">
            {title}
          </h1>
        </div>
        {productName ? (
          <div
            className="inline-flex max-w-full items-center gap-2 rounded-md border bg-secondary px-3 py-2 text-xs font-medium text-foreground"
            aria-label="Current product"
          >
            <span
              className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_hsl(var(--accent))]"
              aria-hidden="true"
            />
            <span className="truncate">{productName}</span>
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

export function RangeTabs({ active = "30d" }: { active?: string }) {
  const ranges = ["7d", "30d", "90d", "all time"];

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b bg-background px-4 py-3 sm:px-6">
      {ranges.map((range) => (
        <Button
          key={range}
          type="button"
          variant={range === active ? "secondary" : "ghost"}
          size="sm"
          aria-current={range === active ? "true" : undefined}
        >
          {range}
        </Button>
      ))}
    </div>
  );
}
