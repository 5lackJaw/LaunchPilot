"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileEdit, Hash, Inbox, LayoutDashboard, Plug, Search, Send, Settings, Share2, Workflow } from "lucide-react";
import { appConfig } from "@/config/app";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/inbox",     label: "Inbox",     icon: Inbox, badge: "7" },
    ],
  },
  {
    label: "Channels",
    items: [
      { href: "/seo",         label: "SEO Content", icon: Search  },
      { href: "/community",   label: "Community",   icon: Share2  },
      { href: "/outreach",    label: "Outreach",    icon: Send    },
      { href: "/directories", label: "Directories", icon: Workflow },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/keywords",  label: "Keywords",  icon: Hash      },
    ],
  },
  {
    label: "Product",
    items: [
      { href: "/marketing-brief",       label: "Marketing Brief", icon: FileEdit },
      { href: "/settings/connections",  label: "Connections",     icon: Plug     },
      { href: "/settings",              label: "Settings",        icon: Settings },
    ],
  },
];

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className="grid min-h-screen grid-cols-1 bg-background text-foreground md:grid-cols-[220px_1fr]">
      <aside className="hidden border-r bg-card md:flex md:flex-col">
        <div className="flex items-center gap-2.5 border-b px-[18px] py-5">
          <div className="flex size-7 items-center justify-center rounded-[7px] bg-primary font-mono text-[12px] font-medium text-primary-foreground">
            LP
          </div>
          <span className="font-serif text-[17px] text-foreground">{appConfig.name}</span>
        </div>

        <nav className="flex flex-1 flex-col py-1">
          {navGroups.map(group => (
            <NavSection key={group.label} label={group.label} items={group.items} pathname={pathname} />
          ))}
        </nav>

        <div className="flex items-center gap-2.5 border-t px-[18px] py-3">
          <div className="flex size-[26px] shrink-0 items-center justify-center rounded-full border border-primary bg-secondary font-mono text-[10px] text-primary">
            CS
          </div>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-medium">Chris</p>
            <p className="font-mono text-[10.5px] text-muted-foreground">launch plan</p>
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
  pathname,
}: {
  label: string;
  items: Array<{ href: string; label: string; icon: typeof LayoutDashboard; badge?: string }>;
  pathname: string;
}) {
  return (
    <div className="flex flex-col">
      <p className="px-[18px] pb-1 pt-3.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex items-center gap-[9px] px-[18px] py-[7px] text-[13px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              isActive && "text-foreground",
            )}
            style={isActive ? { background: "hsl(var(--primary) / 0.08)" } : undefined}
            aria-current={isActive ? "page" : undefined}
          >
            {isActive && <span className="absolute inset-y-1 left-0 w-[2px] rounded-r-[2px] bg-primary" />}
            <item.icon className="size-[15px] opacity-70" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.badge ? (
              <span className="min-w-[16px] rounded-full bg-amber-400 px-[5px] py-[1px] text-center font-mono text-[9.5px] font-medium text-black">{item.badge}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
