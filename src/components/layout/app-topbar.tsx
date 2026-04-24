import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppTopbar({
  title,
  eyebrow,
  actions,
}: {
  title: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b bg-background px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-4">
        <div className="min-w-0">
          {eyebrow ? <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{eyebrow}</p> : null}
          <h1 className="font-serif text-2xl font-normal text-foreground">{title}</h1>
        </div>
        <button
          type="button"
          className="inline-flex max-w-full items-center gap-2 rounded-md border bg-secondary px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label="Switch product"
          aria-haspopup="listbox"
        >
          <span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_hsl(var(--accent))]" aria-hidden="true" />
          <span className="truncate">OnChainInvoice.com</span>
          <ChevronDown aria-hidden="true" />
        </button>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function RangeTabs({ active = "30d" }: { active?: string }) {
  const ranges = ["7d", "30d", "90d", "all time"];

  return (
    <div className="flex items-center gap-1 border-b bg-background px-6 py-3">
      {ranges.map((range) => (
        <Button key={range} type="button" variant={range === active ? "secondary" : "ghost"} size="sm" aria-current={range === active ? "true" : undefined}>
          {range}
        </Button>
      ))}
    </div>
  );
}
