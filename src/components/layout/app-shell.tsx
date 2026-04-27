"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CreditCard,
  Database,
  FileEdit,
  FileText,
  Hash,
  Inbox,
  LayoutDashboard,
  Plug,
  Search,
  Send,
  Settings,
  Share2,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard",  label: "Dashboard",       icon: LayoutDashboard },
      { href: "/inbox",      label: "Inbox",            icon: Inbox },
    ],
  },
  {
    label: "Channels",
    items: [
      { href: "/content",     label: "Content",         icon: FileText },
      { href: "/seo",         label: "SEO Content",     icon: Search },
      { href: "/community",   label: "Community",       icon: Share2 },
      { href: "/outreach",    label: "Outreach",        icon: Send },
      { href: "/directories", label: "Directories",     icon: Workflow },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics",   label: "Analytics",       icon: BarChart3 },
      { href: "/seo",         label: "Keywords",        icon: Hash },
    ],
  },
  {
    label: "Product",
    items: [
      { href: "/marketing-brief",       label: "Marketing Brief", icon: FileEdit },
      { href: "/settings/connections",  label: "Connections",     icon: Plug },
      { href: "/settings/billing",      label: "Billing",         icon: CreditCard },
      { href: "/settings/preferences",  label: "Preferences",     icon: Settings },
      { href: "/settings/account",      label: "Account data",    icon: Database },
    ],
  },
];

const allNavItems = navGroups.flatMap((g) => g.items);

function LogoIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ fill: "#7C6FF7", flexShrink: 0 }}
    >
      <path
        fillRule="evenodd"
        d="m893.31 405.05c-61.58-150.02-209.09-255.68-381.31-255.68-172.22 0-319.73 105.66-381.31 255.68l-95.7-39.23c77.02-187.66 261.58-319.82 477.01-319.82 215.43 0 399.98 132.16 477.01 319.82zm-381.31-152.11c128.92 0 239.35 79.1 285.45 191.4l-94.25 38.64c-30.87-75.22-104.84-128.2-191.2-128.2-86.36 0-160.32 52.98-191.2 128.2l-94.25-38.64c46.1-112.3 156.53-191.4 285.45-191.4zm243.49 466.41l-241.94 259.65-243.26-261.06 241.94-259.65zm-339.19-2.1l97.89 105.04 95.28-102.25-97.89-105.05z"
      />
    </svg>
  );
}

export function AppShell({
  children,
  account,
}: Readonly<{
  children: React.ReactNode;
  account?: {
    email?: string | null;
    planTier?: string | null;
    pendingInboxCount?: number;
  };
}>) {
  const pathname = usePathname();
  const badge = account?.pendingInboxCount ? String(account.pendingInboxCount) : undefined;
  const email = account?.email ?? "Signed in";
  const initials = getInitials(email);
  const planLabel = account?.planTier ? `${account.planTier} plan` : "free plan";

  return (
    <div
      className="grid min-h-screen grid-cols-1 md:grid-cols-[220px_1fr]"
      style={{ background: "var(--lp-bg)" }}
    >
      {/* ── Mobile header ─────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 md:hidden"
        style={{ background: "var(--lp-bg2)", borderBottom: "1px solid var(--lp-border)" }}
      >
        <div className="flex items-center gap-[9px] px-[18px] py-3">
          <LogoIcon size={22} />
          <span className="t-wordmark">LaunchBeacon</span>
        </div>
        <nav
          className="flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Primary navigation"
        >
          {allNavItems.map((item) => (
            <MobileNavLink
              key={`${item.href}-${item.label}`}
              item={{ ...item, badge: item.href === "/inbox" ? badge : undefined }}
              pathname={pathname}
            />
          ))}
        </nav>
      </header>

      {/* ── Desktop sidebar ───────────────────────────────────────────── */}
      <aside
        className="hidden md:flex md:flex-col sticky top-0 h-screen"
        style={{ background: "var(--lp-bg2)", borderRight: "1px solid var(--lp-border)", width: "220px" }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-[9px] shrink-0"
          style={{ padding: "17px 18px 14px", borderBottom: "1px solid var(--lp-border)" }}
        >
          <LogoIcon size={24} />
          <span className="t-wordmark">LaunchBeacon</span>
        </div>

        {/* Nav groups */}
        <nav className="flex flex-1 flex-col overflow-y-auto py-1" aria-label="Primary navigation">
          {navGroups.map((group) => (
            <NavSection
              key={group.label}
              label={group.label}
              items={group.items.map((item) => ({
                ...item,
                badge: item.href === "/inbox" ? badge : undefined,
              }))}
              pathname={pathname}
            />
          ))}
        </nav>

        {/* Account footer */}
        <div
          className="flex items-center gap-[9px] shrink-0"
          style={{ padding: "10px 18px", borderTop: "1px solid var(--lp-border)" }}
        >
          <div
            className="flex size-[26px] shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-medium"
            style={{
              border: "1px solid var(--lp-purple)",
              background: "rgba(124,111,247,0.10)",
              color: "var(--lp-purple-l)",
            }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate" style={{ fontSize: "12.5px", fontWeight: 500, color: "var(--lp-text)" }}>
              {email}
            </p>
            <p className="font-mono text-[10px]" style={{ color: "var(--lp-muted)" }}>
              {planLabel}
            </p>
          </div>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function getInitials(value: string) {
  const local = value.split("@")[0] ?? value;
  const parts = local.split(/[.\-_\s]+/).filter(Boolean);
  if (!parts.length) return "LB";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function MobileNavLink({
  item,
  pathname,
}: {
  item: { href: string; label: string; icon: typeof LayoutDashboard; badge?: string };
  pathname: string;
}) {
  const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

  return (
    <Link
      href={item.href}
      className={cn(
        "relative flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-[12px] transition-colors",
        isActive
          ? "font-medium"
          : "text-[color:var(--lp-muted)]"
      )}
      style={
        isActive
          ? { background: "rgba(124,111,247,0.08)", color: "var(--lp-text)" }
          : undefined
      }
      aria-current={isActive ? "page" : undefined}
    >
      <item.icon className="size-[14px]" style={{ opacity: isActive ? 1 : 0.65 }} />
      <span>{item.label}</span>
      {item.badge ? <InboxBadge count={item.badge} /> : null}
    </Link>
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
      <p
        className="font-mono uppercase"
        style={{ fontSize: "10px", letterSpacing: "0.08em", color: "var(--lp-muted)", padding: "12px 18px 3px" }}
      >
        {label}
      </p>
      {items.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
        return (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            className="group relative flex items-center gap-[9px] transition-colors"
            style={{
              padding: "7px 18px",
              fontSize: "13px",
              fontWeight: isActive ? 500 : 400,
              color: isActive ? "var(--lp-text)" : "var(--lp-muted)",
              background: isActive ? "rgba(124,111,247,0.08)" : undefined,
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = "var(--lp-bg3)";
                (e.currentTarget as HTMLElement).style.color = "#C8C8CE";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = "";
                (e.currentTarget as HTMLElement).style.color = "var(--lp-muted)";
              }
            }}
            aria-current={isActive ? "page" : undefined}
          >
            {isActive && (
              <span
                className="absolute left-0"
                style={{
                  top: "4px",
                  bottom: "4px",
                  width: "2px",
                  background: "var(--lp-purple)",
                  borderRadius: "0 2px 2px 0",
                }}
              />
            )}
            <item.icon
              className="size-[15px] shrink-0"
              style={{ opacity: isActive ? 1 : 0.65 }}
            />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.badge ? <InboxBadge count={item.badge} /> : null}
          </Link>
        );
      })}
    </div>
  );
}

function InboxBadge({ count }: { count: string }) {
  return (
    <span
      className="font-mono font-medium shrink-0"
      style={{
        fontSize: "9.5px",
        background: "var(--lp-amber)",
        color: "#000",
        padding: "1px 5px",
        borderRadius: "10px",
      }}
    >
      {count}
    </span>
  );
}
