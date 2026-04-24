import Link from "next/link";
import { BarChart3, BookOpenText, Inbox, LayoutDashboard, Search, Send, Settings, Share2, Workflow } from "lucide-react";
import { appConfig } from "@/config/app";
import { cn } from "@/lib/utils";

const primaryNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox, badge: "7" },
  { href: "/content", label: "Content", icon: BookOpenText },
  { href: "/seo", label: "SEO", icon: Search },
  { href: "/community", label: "Community", icon: Share2 },
  { href: "/outreach", label: "Outreach", icon: Send },
  { href: "/directories", label: "Directories", icon: Workflow },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

const settingsNav = [{ href: "/settings/connections", label: "Settings", icon: Settings }];

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-background text-foreground md:grid-cols-[220px_1fr]">
      <aside className="hidden border-r bg-card md:flex md:flex-col">
        <div className="flex items-center gap-3 border-b px-4 py-5">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary font-mono text-xs font-medium text-primary-foreground">
            LP
          </div>
          <span className="font-serif text-base text-foreground">{appConfig.name}</span>
        </div>

        <div className="m-3 flex items-center gap-2 rounded-md border bg-secondary px-3 py-2">
          <span className="size-1.5 rounded-full bg-accent" />
          <span className="truncate text-xs font-medium">Example product</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
          <NavSection label="Work" items={primaryNav} />
          <div className="mt-auto">
            <NavSection label="Account" items={settingsNav} />
          </div>
        </nav>

        <div className="flex items-center gap-3 border-t px-4 py-4">
          <div className="flex size-7 items-center justify-center rounded-full border border-primary bg-secondary font-mono text-[10px] text-primary">
            CK
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">Founder</p>
            <p className="font-mono text-[10px] text-muted-foreground">Free plan</p>
          </div>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function NavSection({
  label,
  items,
}: {
  label: string;
  items: Array<{ href: string; label: string; icon: typeof LayoutDashboard; badge?: string }>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 pt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
            item.href === "/dashboard" && "text-foreground",
          )}
        >
          <item.icon />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.badge ? (
            <span className="rounded-full bg-accent px-1.5 py-0.5 font-mono text-[10px] text-accent-foreground">{item.badge}</span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
