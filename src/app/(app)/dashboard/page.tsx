"use client";

import { useState } from "react";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Button } from "@/components/ui/button";

// ─── Data ────────────────────────────────────────────────────────────────────

const inboxItems = [
  { type: "article" as const, title: "How to invoice clients in USDC: a freelancer's guide", sub: '1,840 words · targets "usdc invoice freelancer"', confidence: 88, estTraffic: "↑ est. 120 visits/mo", time: "2h ago" },
  { type: "reply"   as const, title: 'r/freelance · "Anyone accepting crypto payments yet?"', sub: "Reddit reply draft · relevance score 82", confidence: 74, estTraffic: null, time: "4h ago" },
  { type: "article" as const, title: "Crypto invoicing vs traditional invoicing: a comparison", sub: '1,200 words · comparison page · targets "crypto invoicing"', confidence: 91, estTraffic: "↑ est. 210 visits/mo", time: "6h ago" },
  { type: "listing" as const, title: "ProductHunt listing package ready", sub: "Tagline · description · 5 screenshots generated", confidence: 95, estTraffic: null, time: "12h ago" },
  { type: "reply"   as const, title: 'HN · "Ask HN: how do you handle international payments?"', sub: "Hacker News reply draft · relevance score 71", confidence: 71, estTraffic: null, time: "1d ago" },
];

const keywords = [
  { keyword: "usdc invoice generator",        position: "#4",  tier: "good", change: "↑ 6",        changeTier: "up",    volume: "880/mo"  },
  { keyword: "crypto invoicing for freelancers", position: "#14", tier: "mid",  change: "↑ 3",        changeTier: "up",    volume: "590/mo"  },
  { keyword: "solana b2b payments",            position: "#19", tier: "mid",  change: "↓ 2",        changeTier: "down",  volume: "320/mo"  },
  { keyword: "invoice paid in crypto",          position: "#7",  tier: "good", change: "↑ 11",       changeTier: "up",    volume: "1.2k/mo" },
  { keyword: "usdc payment for contractors",    position: "new", tier: "new",  change: "→ tracking", changeTier: "track", volume: "440/mo"  },
];

const channels = [
  { iconBg: "#1D9E75", iconChar: "✦", name: "SEO / content",  statusTier: "ok"   as const, statusText: "Running · last publish 2d ago",         queue: "3 in queue", queueTier: "normal" as const, meta: "SLA on track",    connect: false },
  { iconBg: "#FF4500", iconChar: "◎", name: "Reddit",          statusTier: "warn" as const, statusText: "2 replies awaiting approval · 4h",       queue: "2 pending",  queueTier: "warn"   as const, meta: "action needed",  connect: false },
  { iconBg: "#FF6600", iconChar: "⬡", name: "Hacker News",     statusTier: "warn" as const, statusText: "1 reply awaiting approval · 1d",         queue: "1 pending",  queueTier: "warn"   as const, meta: "action needed",  connect: false },
  { iconBg: "#7B6EF6", iconChar: "⊞", name: "Directories",     statusTier: "ok"   as const, statusText: "14 of 80 submitted · auto-pacing",       queue: "66 to go",   queueTier: "muted"  as const, meta: "~3 wks remaining", connect: false },
  { iconBg: "#1A8CD8", iconChar: "◈", name: "X / Twitter",     statusTier: "off"  as const, statusText: "Not connected",                          queue: null,         queueTier: "muted"  as const, meta: null,              connect: true  },
];

const sources = [
  { label: "Organic search", count: 612, pct: 66 },
  { label: "Reddit",         count: 340, pct: 37 },
  { label: "Hacker News",    count: 218, pct: 24 },
  { label: "Directories",    count: 164, pct: 18 },
  { label: "Direct",         count: 112, pct: 12 },
  { label: "Other",          count:  47, pct:  5 },
];

type AutoLevel = "off" | "L1" | "L2";

// ─── Helper components ───────────────────────────────────────────────────────

function MetricCard({ label, period, value, delta, deltaType, children }: {
  label: string; period: string; value: string; delta: string;
  deltaType: "up" | "down" | "neutral"; children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-[10px] border bg-card p-4 transition-colors hover:border-border/60">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">{label}</span>
        <span className="font-mono text-[9.5px] tracking-[0.03em]" style={{ color: "hsl(240 7% 30%)" }}>{period}</span>
      </div>
      <div className="font-serif text-[28px] leading-none text-foreground">{value}</div>
      <div className={`mt-1.5 font-mono text-[11.5px] ${
        deltaType === "up" ? "text-teal-400" : deltaType === "down" ? "text-red-400" : "text-muted-foreground"
      }`}>{delta}</div>
      {children}
    </div>
  );
}

function SparklineLine({ values }: { values: number[] }) {
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 120},${v}`).join(" ");
  return (
    <svg viewBox="0 0 120 28" fill="none" aria-hidden className="mt-3 h-7 w-full">
      <polyline points={pts} stroke="hsl(var(--accent) / 0.25)" strokeWidth="1.5" fill="none" />
      <polyline points={pts} stroke="hsl(var(--accent))" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparklineBar({ values, color }: { values: number[]; color: "purple" | "teal" }) {
  const max = Math.max(...values);
  const barW = 14;
  const gap = (120 - barW * values.length) / (values.length - 1);
  const fill = color === "purple" ? "hsl(var(--primary))" : "hsl(var(--accent))";
  return (
    <svg viewBox="0 0 120 28" fill="none" aria-hidden className="mt-3 h-7 w-full">
      {values.map((v, i) => {
        const h = (v / max) * 26;
        return <rect key={i} x={i * (barW + gap)} y={28 - h} width={barW} height={h} fill={fill} rx="2" opacity={0.3 + (i / values.length) * 0.7} />;
      })}
    </svg>
  );
}

const typeStyle = {
  article: { bg: "hsl(var(--primary) / 0.08)", color: "hsl(246 88% 80%)", border: "hsl(var(--primary) / 0.2)" },
  reply:   { bg: "hsl(var(--accent) / 0.06)",  color: "hsl(var(--accent))", border: "hsl(var(--accent) / 0.2)" },
  listing: { bg: "hsl(38 86% 50% / 0.08)",     color: "hsl(38 86% 62%)",   border: "hsl(38 86% 50% / 0.2)" },
  outreach:{ bg: "hsl(0 82% 66% / 0.08)",      color: "hsl(0 82% 66%)",    border: "hsl(0 82% 66% / 0.2)" },
};

function InboxItem({ item }: { item: (typeof inboxItems)[number] }) {
  const ts = typeStyle[item.type];
  const confColor = item.type === "listing" ? "hsl(38 86% 62%)" : "hsl(var(--accent))";
  return (
    <div className="group relative flex cursor-pointer items-start gap-3 border-b px-[18px] py-3 last:border-b-0 hover:bg-secondary">
      <div className="mt-[3px] shrink-0">
        <input type="checkbox" className="size-[13px] cursor-pointer accent-primary" aria-label={`Select "${item.title}"`} onClick={e => e.stopPropagation()} />
      </div>
      <span className="mt-[2px] shrink-0 rounded px-[7px] py-[2px] font-mono text-[9.5px] font-medium tracking-[0.03em] border" style={{ background: ts.bg, color: ts.color, borderColor: ts.border }}>
        {item.type}
      </span>
      <div className="min-w-0 flex-1 pr-2">
        <div className="truncate text-[13px] font-medium text-foreground">{item.title}</div>
        <div className="mt-[3px] text-[11.5px] text-muted-foreground">{item.sub}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
          <div className="h-[3px] w-[60px] overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full" style={{ width: `${item.confidence}%`, background: confColor }} />
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">{item.confidence}% confidence</span>
          {item.estTraffic && <span className="font-mono text-[10px]" style={{ color: "hsl(var(--accent))" }}>{item.estTraffic}</span>}
          <span className="ml-auto font-mono text-[10.5px]" style={{ color: "hsl(240 7% 32%)" }}>{item.time}</span>
        </div>
      </div>
      {/* Inline actions: reveal on hover */}
      <div
        className="pointer-events-none absolute right-[18px] top-1/2 flex -translate-y-1/2 translate-x-2 items-center gap-1.5 opacity-0 transition-all duration-150 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100"
        style={{ background: "linear-gradient(90deg, transparent 0%, hsl(240 7% 11%) 25%)", paddingLeft: 40 }}
      >
        <button type="button" onClick={e => e.stopPropagation()} className="rounded-[5px] border border-border bg-transparent px-2.5 py-[5px] font-sans text-[11px] font-medium text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground">Edit</button>
        <button type="button" onClick={e => e.stopPropagation()} aria-label="Reject" className="w-[26px] rounded-[5px] border border-border bg-transparent py-[5px] text-center font-sans text-[11px] text-muted-foreground transition-colors hover:border-red-400 hover:text-red-400">✕</button>
        <button type="button" onClick={e => e.stopPropagation()} className="rounded-[5px] border px-2.5 py-[5px] font-sans text-[11px] font-medium text-white transition-colors hover:brightness-110" style={{ background: "hsl(163 50% 36%)", borderColor: "hsl(163 50% 36%)" }}>Approve ✓</button>
      </div>
    </div>
  );
}

const statusDotColor = { ok: "hsl(var(--accent))", warn: "hsl(38 86% 62%)", idle: "hsl(240 7% 30%)", off: "hsl(var(--muted-foreground))" };

function ChannelRow({ ch }: { ch: (typeof channels)[number] }) {
  return (
    <div className="grid cursor-pointer items-center border-b px-[18px] py-3 last:border-b-0 hover:bg-secondary" style={{ gridTemplateColumns: "28px 1fr auto", gap: 12 }}>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[14px] text-white" style={{ background: ch.iconBg }}>{ch.iconChar}</div>
      <div>
        <div className="text-[12.5px] font-medium text-foreground">{ch.name}</div>
        <div className="mt-[3px] flex items-center gap-[5px] font-mono text-[10.5px] text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: statusDotColor[ch.statusTier], opacity: ch.statusTier === "off" ? 0.4 : 1 }} />
          {ch.statusText}
        </div>
      </div>
      <div className="flex flex-col items-end gap-[3px]">
        {ch.connect ? (
          <button type="button" className="border-none bg-transparent font-mono text-[11px]" style={{ color: "hsl(246 88% 80%)" }}>Connect →</button>
        ) : (
          <>
            <span className={`font-mono text-[11px] ${ch.queueTier === "warn" ? "text-amber-400" : ch.queueTier === "muted" ? "text-muted-foreground" : "text-foreground"}`}>{ch.queue}</span>
            <span className="font-mono text-[9.5px]" style={{ color: "hsl(240 7% 32%)" }}>{ch.meta}</span>
          </>
        )}
      </div>
    </div>
  );
}

function AutopilotPanel() {
  const [levels, setLevels] = useState<AutoLevel[]>(["L2", "L1", "off"]);
  const rows = [
    { label: "SEO content",        sub: "L2 = auto-publish high confidence" },
    { label: "Community replies",  sub: "L1 = draft only, you approve" },
    { label: "Outreach",           sub: "Off = no automated outreach" },
  ];
  return (
    <div className="overflow-hidden rounded-[10px] border bg-card">
      <div className="border-b px-[18px] py-3.5">
        <span className="text-[13px] font-medium text-foreground">⊙ Autopilot</span>
      </div>
      <div className="flex flex-col gap-3.5 px-[18px] pb-4 pt-3.5">
        {rows.map((row, i) => (
          <div key={row.label} className="grid items-center gap-3" style={{ gridTemplateColumns: "1fr auto" }}>
            <div>
              <div className="text-[12.5px] text-foreground">{row.label}</div>
              <div className="mt-[2px] font-mono text-[10px] text-muted-foreground">{row.sub}</div>
            </div>
            <div role="radiogroup" aria-label={`${row.label} autopilot level`} className="inline-flex rounded-[6px] border bg-secondary p-[2px]">
              {(["off", "L1", "L2"] as AutoLevel[]).map((level) => {
                const sel = levels[i] === level;
                return (
                  <button
                    key={level}
                    role="radio"
                    aria-checked={sel}
                    onClick={() => setLevels(prev => prev.map((v, idx) => (idx === i ? level : v)))}
                    className={`rounded-[4px] px-[9px] py-1 font-mono text-[10.5px] tracking-[0.02em] transition-all duration-100 ${
                      sel
                        ? level === "L1" ? "bg-amber-400/10 text-amber-400"
                        : level === "L2" ? "bg-teal-400/10 text-teal-400"
                        : "bg-card text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between gap-2 border-t pt-3 text-[11.5px] text-muted-foreground">
          <span>Next run</span>
          <span className="font-mono text-[11px] text-foreground">Mon Apr 28 · 09:00 CET</span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <AppTopbar
        title="Dashboard"
        actions={
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11.5px] text-muted-foreground">Week of Apr 21, 2026</span>
            <Button variant="outline" size="sm">↻ Refresh</Button>
            <Button size="sm">+ Add product</Button>
          </div>
        }
      />

      <div className="flex flex-col gap-5 p-7">

        {/* ── Insight / Brief bar ── */}
        <div
          className="flex items-start gap-4 rounded-[9px] border p-4"
          style={{ borderLeftWidth: 3, borderLeftColor: "hsl(var(--primary))", background: "linear-gradient(180deg, hsl(240 7% 11%) 0%, hsl(240 7% 8%) 100%)" }}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border text-base" style={{ background: "hsl(var(--primary) / 0.08)", borderColor: "hsl(var(--primary) / 0.15)", color: "hsl(246 88% 80%)" }}>
            ⚡
          </div>
          <div className="flex-1">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: "hsl(246 88% 80%)" }}>Insight · this week</p>
            <p className="mb-1.5 font-serif text-[18px] leading-snug text-foreground">One Reddit thread is driving most of your growth.</p>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              Of the <strong className="font-medium text-foreground">+478 visits</strong> added this week,{" "}
              <strong className="font-medium text-foreground">312 (65%)</strong> trace back to a single r/freelance comment posted Tuesday.
              The thread is still active — consider a follow-up reply within 24h while it&apos;s ranking. SEO is steady but
              contributing less than expected; the <em>&ldquo;usdc invoice generator&rdquo;</em> article needs internal links to push past position #4.
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm">Draft follow-up reply</Button>
              <Button size="sm" variant="outline">See attribution detail</Button>
            </div>
          </div>
        </div>

        {/* ── Metrics row ── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="Visitors" period="Apr 14–20" value="1,847" delta="↑ 34% wk-over-wk" deltaType="up">
            <SparklineLine values={[22, 18, 20, 14, 10, 6, 4]} />
          </MetricCard>
          <MetricCard label="Articles published" period="Apr 14–20" value="3" delta="↑ 1 vs prior week" deltaType="up">
            <SparklineBar values={[6, 10, 8, 14, 10, 18]} color="purple" />
          </MetricCard>
          <MetricCard label="Replies posted" period="Apr 14–20" value="8" delta="↑ 3 vs prior week" deltaType="up">
            <SparklineBar values={[6, 10, 8, 14, 12, 20]} color="teal" />
          </MetricCard>
          <MetricCard label="Inbox pending" period="right now" value="7" delta="~ 8 min to review" deltaType="neutral">
            <div className="mt-3 flex items-center gap-1" aria-label="Breakdown by type">
              <div className="h-[5px] flex-[3] rounded bg-primary opacity-90" />
              <div className="h-[5px] flex-[2] rounded opacity-85" style={{ background: "hsl(var(--accent))" }} />
              <div className="h-[5px] flex-[1] rounded bg-amber-400 opacity-85" />
              <div className="h-[5px] flex-[1] rounded bg-red-400 opacity-75" />
            </div>
            <div className="mt-1.5 flex gap-2 font-mono text-[10px]">
              <span style={{ color: "hsl(246 88% 80%)" }}>3 articles</span>
              <span style={{ color: "hsl(var(--accent))" }}>2 replies</span>
              <span className="text-amber-400">1 listing</span>
              <span className="text-red-400">1 email</span>
            </div>
          </MetricCard>
        </div>

        {/* ── Lower grid ── */}
        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">

          {/* Left column */}
          <div className="flex flex-col gap-4">

            {/* Approval inbox */}
            <div className="overflow-hidden rounded-[10px] border bg-card">
              <div className="flex items-center justify-between gap-2 border-b px-[18px] py-[14px]">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-foreground">◫ Approval inbox</span>
                  <span className="rounded border px-[7px] py-[2px] font-mono text-[9.5px] font-medium" style={{ background: "hsl(38 86% 50% / 0.08)", color: "hsl(38 86% 62%)", borderColor: "hsl(38 86% 50% / 0.2)" }}>
                    7 pending
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" className="cursor-pointer border-none bg-transparent px-1 py-[2px] font-mono text-[11.5px]" style={{ color: "hsl(246 88% 80%)" }}>
                    Approve all high-confidence (3)
                  </button>
                  <span className="text-muted" style={{ color: "hsl(240 7% 25%)" }}>·</span>
                  <button type="button" className="cursor-pointer border-none bg-transparent px-1 py-[2px] font-mono text-[11.5px] text-muted-foreground transition-colors hover:text-foreground">
                    View all →
                  </button>
                </div>
              </div>
              {inboxItems.map(item => <InboxItem key={item.title} item={item} />)}
            </div>

            {/* Keyword positions */}
            <div className="overflow-hidden rounded-[10px] border bg-card">
              <div className="flex items-center justify-between border-b px-[18px] py-[14px]">
                <span className="text-[13px] font-medium text-foreground">◈ Keyword positions</span>
                <button type="button" className="border-none bg-transparent font-mono text-[11.5px]" style={{ color: "hsl(246 88% 80%)" }}>Full report →</button>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["Keyword", "Position", "Change", "Volume"].map(h => (
                      <th key={h} className="border-b px-[18px] py-[9px] text-left font-mono text-[10.5px] font-normal uppercase tracking-[0.05em] text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((kw, i) => (
                    <tr key={kw.keyword} className="hover:bg-secondary">
                      <td className={`px-[18px] py-2.5 text-[12.5px] text-foreground ${i < keywords.length - 1 ? "border-b" : ""}`}>{kw.keyword}</td>
                      <td className={`px-[18px] py-2.5 font-mono text-[12px] ${i < keywords.length - 1 ? "border-b" : ""} ${kw.tier === "good" ? "font-medium text-teal-400" : kw.tier === "mid" ? "text-amber-400" : "text-purple-300"}`}>{kw.position}</td>
                      <td className={`px-[18px] py-2.5 font-mono text-[10.5px] ${i < keywords.length - 1 ? "border-b" : ""} ${kw.changeTier === "up" ? "text-teal-400" : kw.changeTier === "down" ? "text-red-400" : "text-purple-300"}`}>{kw.change}</td>
                      <td className={`px-[18px] py-2.5 font-mono text-[12px] text-muted-foreground ${i < keywords.length - 1 ? "border-b" : ""}`}>{kw.volume}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">

            {/* Channel health */}
            <div className="overflow-hidden rounded-[10px] border bg-card">
              <div className="flex items-center justify-between border-b px-[18px] py-[14px]">
                <span className="text-[13px] font-medium text-foreground">◉ Channel health</span>
                <span className="font-mono text-[10.5px] text-muted-foreground">last action 14m ago</span>
              </div>
              {channels.map(ch => <ChannelRow key={ch.name} ch={ch} />)}
            </div>

            {/* Traffic by source */}
            <div className="overflow-hidden rounded-[10px] border bg-card">
              <div className="flex items-center justify-between border-b px-[18px] py-[14px]">
                <span className="text-[13px] font-medium text-foreground">∿ Traffic by source</span>
                <button type="button" className="border-none bg-transparent font-mono text-[11.5px]" style={{ color: "hsl(246 88% 80%)" }}>Analytics →</button>
              </div>
              <div className="px-[18px] pt-1 pb-3.5">
                {sources.map((src, i) => (
                  <div key={src.label} className={`grid items-center gap-2.5 py-[7px] ${i < sources.length - 1 ? "border-b" : ""}`} style={{ gridTemplateColumns: "90px 1fr 48px" }}>
                    <span className="text-[12px] text-foreground">{src.label}</span>
                    <div className="h-[5px] overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full" style={{ width: `${src.pct}%`, background: "hsl(var(--accent))", opacity: 0.25 + (src.pct / 66) * 0.75 }} />
                    </div>
                    <span className="text-right font-mono text-[11px] text-muted-foreground">{src.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Autopilot */}
            <AutopilotPanel />

          </div>
        </div>
      </div>
    </main>
  );
}
