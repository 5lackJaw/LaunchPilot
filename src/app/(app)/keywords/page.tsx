import { AppTopbar } from "@/components/layout/app-topbar";

/* ── Static demo data — replace with real GSC integration when available ── */

const DEMO_KEYWORDS = [
  { keyword: "usdc invoice generator", url: "/blog/usdc-invoice-generator-freelancers", pos: 4, change: 6, volume: 880, kd: "low", intent: "commercial", cluster: "stablecoin payments", clusterColor: "#7C6FF7", hist: [40, 50, 55, 70, 75, 85, 92] },
  { keyword: "invoice paid in crypto", url: "/blog/how-to-invoice-clients-usdc", pos: 7, change: 11, volume: 1200, kd: "mid", intent: "informational", cluster: "stablecoin payments", clusterColor: "#7C6FF7", hist: [20, 30, 40, 55, 70, 85, 90] },
  { keyword: "best usdc payment tools 2026", url: "/blog/best-usdc-payment-tools-remote-teams", pos: 7, change: 11, volume: 590, kd: "low", intent: "commercial", cluster: "payment tooling", clusterColor: "#F0A429", hist: [18, 25, 45, 60, 72, 88, 90] },
  { keyword: "usdc invoice freelancer", url: "/blog/usdc-invoice-generator-freelancers", pos: 4, change: 3, volume: 880, kd: "low", intent: "commercial", cluster: "stablecoin payments", clusterColor: "#7C6FF7", hist: [65, 70, 72, 78, 82, 88, 92] },
  { keyword: "crypto invoicing for freelancers", url: "/blog/how-to-invoice-clients-usdc", pos: 14, change: 3, volume: 590, kd: "mid", intent: "informational", cluster: "invoicing comparison", clusterColor: "#2DD4A0", hist: [40, 45, 48, 50, 52, 55, 58] },
  { keyword: "solana b2b payments guide", url: "/blog/solana-b2b-payment-guide", pos: 19, change: -2, volume: 320, kd: "mid", intent: "informational", cluster: "b2b crypto", clusterColor: "#5B9EF6", hist: [55, 52, 50, 48, 46, 44, 42] },
  { keyword: "crypto invoicing vs traditional", url: "/blog/crypto-invoicing-vs-traditional", pos: 19, change: -2, volume: 1400, kd: "mid", intent: "informational", cluster: "invoicing comparison", clusterColor: "#2DD4A0", hist: [50, 48, 50, 47, 45, 43, 42] },
  { keyword: "usdc payment for contractors", url: "—", pos: 0, change: 0, volume: 440, kd: "low", intent: "commercial", cluster: "stablecoin payments", clusterColor: "#7C6FF7", hist: [4, 4, 4, 4, 4, 4, 4] },
  { keyword: "how to invoice in crypto 2026", url: "—", pos: 42, change: 0, volume: 980, kd: "mid", intent: "informational", cluster: "invoicing how-to", clusterColor: "#E879B8", hist: [12, 12, 13, 12, 12, 11, 12] },
];

const DEMO_CLUSTERS = [
  { name: "Stablecoin payments", color: "#7C6FF7", count: 8, avgPos: "#11", trend: 4.1, up: true },
  { name: "Invoicing comparison",  color: "#2DD4A0", count: 5, avgPos: "#16", trend: 1.8, up: true },
  { name: "Payment tooling",       color: "#F0A429", count: 4, avgPos: "#14", trend: 6.2, up: true },
  { name: "B2B crypto",            color: "#5B9EF6", count: 3, avgPos: "#19", trend: 2.0, up: false },
  { name: "Invoicing how-to",      color: "#E879B8", count: 3, avgPos: "#38", trend: 0,   up: null },
];

const DEMO_MOVERS = [
  { keyword: "invoice paid in crypto",        from: 18, to: 7,  change: 11,  up: true },
  { keyword: "best usdc payment tools 2026",  from: 18, to: 7,  change: 11,  up: true },
  { keyword: "usdc invoice generator",        from: 10, to: 4,  change: 6,   up: true },
  { keyword: "crypto invoicing for freelancers", from: 17, to: 14, change: 3, up: true },
  { keyword: "solana b2b payments guide",     from: 17, to: 19, change: 2,   up: false },
];

export default function KeywordsPage() {
  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--lp-bg)" }}>

      <AppTopbar
        title="Keywords"
        eyebrow="Insights · Google Search Console connected"
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <GhostBtn>↓ Export CSV</GhostBtn>
            <SecBtn>⟳ Refresh positions</SecBtn>
          </div>
        }
      />

      <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 40px", display: "flex", flexDirection: "column", gap: "22px" }}>

        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px" }}>
          {[
            { label: "Tracked keywords",     value: "23",    delta: "↑ 5 new this week",        deltaColor: "#2DD4A0" },
            { label: "Avg. position",         value: "#14",   delta: "↑ 3.2 avg improvement",    deltaColor: "#2DD4A0" },
            { label: "Page 1 keywords",       value: "4",     delta: "↑ 2 new to page 1",         deltaColor: "#2DD4A0" },
            { label: "Total search volume",   value: "12.4k", delta: "across all tracked",        deltaColor: "var(--lp-muted)" },
            { label: "Estimated clicks / mo", value: "840",   delta: "↑ 34% vs prior period",    deltaColor: "#2DD4A0" },
          ].map((kpi) => (
            <div key={kpi.label} style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", padding: "16px 18px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "9.5px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>{kpi.label}</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "28px", color: "var(--lp-text)", letterSpacing: "-0.01em", lineHeight: 1, marginBottom: "5px" }}>{kpi.value}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: kpi.deltaColor }}>{kpi.delta}</div>
            </div>
          ))}
        </div>

        {/* Main keyword table */}
        <div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "14px", marginBottom: "12px" }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "3px" }}>Position tracking</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "18px", fontWeight: 400, color: "var(--lp-text)", letterSpacing: "-0.01em" }}>All tracked keywords · weekly SERP positions</div>
            </div>
          </div>

          <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", fontWeight: 500, color: "var(--lp-text)" }}>
                ◈ Keywords
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", padding: "2px 7px", background: "var(--lp-bg4)", borderRadius: "4px", fontWeight: 400 }}>
                  {DEMO_KEYWORDS.length} tracked
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <TabBtn active>All</TabBtn>
                <TabBtn>Page 1 <span style={{ opacity: 0.6 }}>·4</span></TabBtn>
                <TabBtn>Page 2 <span style={{ opacity: 0.6 }}>·6</span></TabBtn>
                <TabBtn>Page 3+ <span style={{ opacity: 0.6 }}>·5</span></TabBtn>
                <TabBtn>Unranked <span style={{ opacity: 0.6 }}>·8</span></TabBtn>
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[
                    { label: "Keyword",      align: "left",  w: "30%" },
                    { label: "Position",     align: "right", w: "9%" },
                    { label: "7d change",    align: "left",  w: "9%" },
                    { label: "Volume",       align: "right", w: "9%" },
                    { label: "Difficulty",   align: "left",  w: "9%" },
                    { label: "Intent",       align: "left",  w: "8%" },
                    { label: "Cluster",      align: "left",  w: "14%" },
                    { label: "7-day history",align: "left",  w: "12%" },
                  ].map((h) => (
                    <th key={h.label} style={{
                      fontFamily: "var(--font-mono)", fontSize: "9.5px", fontWeight: 400,
                      textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--lp-muted)",
                      textAlign: h.align as "left" | "right", padding: "10px 18px",
                      borderBottom: "1px solid var(--lp-border)", background: "var(--lp-bg2)",
                      width: h.w,
                    }}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEMO_KEYWORDS.map((kw) => {
                  const isNew = kw.pos === 0;
                  const posColor = isNew ? "#A99DF9" : kw.pos <= 10 ? "#2DD4A0" : kw.pos <= 30 ? "#F0A429" : "var(--lp-muted)";
                  const posLabel = isNew ? "—" : `#${kw.pos}`;
                  const kdColor = kw.kd === "low" ? "#2DD4A0" : kw.kd === "mid" ? "#F0A429" : "#F06060";
                  const kdBg = kw.kd === "low" ? "rgba(45,212,160,0.10)" : kw.kd === "mid" ? "rgba(240,164,41,0.12)" : "rgba(240,96,96,0.12)";
                  const kdBorder = kw.kd === "low" ? "rgba(45,212,160,0.25)" : kw.kd === "mid" ? "rgba(240,164,41,0.25)" : "rgba(240,96,96,0.25)";
                  return (
                    <tr key={kw.keyword} style={{ borderBottom: "1px solid var(--lp-border)", cursor: "pointer" }}>
                      <td style={{ padding: "12px 18px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontSize: "13px", color: "var(--lp-text)", fontWeight: 500 }}>{kw.keyword}</span>
                          <span style={{ fontSize: "11px", color: "var(--lp-muted)", fontFamily: "var(--font-mono)", maxWidth: "280px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {kw.url}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 18px", textAlign: "right", verticalAlign: "middle" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 500, color: posColor }}>{posLabel}</span>
                      </td>
                      <td style={{ padding: "12px 18px", verticalAlign: "middle" }}>
                        <MovBadge change={kw.change} isNew={isNew} />
                      </td>
                      <td style={{ padding: "12px 18px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--lp-text)", verticalAlign: "middle" }}>
                        {kw.volume.toLocaleString()}
                      </td>
                      <td style={{ padding: "12px 18px", verticalAlign: "middle" }}>
                        <span style={{ display: "inline-block", fontFamily: "var(--font-mono)", fontSize: "10.5px", padding: "2px 8px", borderRadius: "9999px", fontWeight: 500, border: `1px solid ${kdBorder}`, color: kdColor, background: kdBg }}>
                          {kw.kd === "low" ? "Low" : kw.kd === "mid" ? "Med" : "High"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 18px", verticalAlign: "middle" }}>
                        <span style={{ display: "inline-block", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted2)", padding: "1px 7px", borderRadius: "4px", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)" }}>
                          {kw.intent}
                        </span>
                      </td>
                      <td style={{ padding: "12px 18px", verticalAlign: "middle" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-muted2)", padding: "2px 8px", borderRadius: "4px", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "2px", background: kw.clusterColor, flexShrink: 0, display: "block" }} />
                          {kw.cluster}
                        </span>
                      </td>
                      <td style={{ padding: "12px 18px", verticalAlign: "middle" }}>
                        <HistBars bars={kw.hist} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom 3-col grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>

          {/* Position distribution */}
          <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--lp-text)" }}>Position distribution</div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", padding: "2px 7px", background: "var(--lp-bg4)", borderRadius: "4px" }}>23 kws</span>
            </div>
            <div style={{ padding: "18px" }}>
              {[
                { label: "Page 1",   count: 4,  pct: 17, color: "#2DD4A0" },
                { label: "Page 2",   count: 6,  pct: 26, color: "#F0A429" },
                { label: "Page 3–5", count: 5,  pct: 22, color: "var(--lp-muted)" },
                { label: "Unranked", count: 8,  pct: 35, color: "var(--lp-subtle)" },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", width: "64px", flexShrink: 0, textAlign: "right" }}>{row.label}</div>
                  <div style={{ flex: 1, height: "18px", background: "var(--lp-bg4)", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${row.pct}%`, background: row.color, borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 6px" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "9.5px", color: "#fff", fontWeight: 500 }}>{row.count}</span>
                    </div>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: row.color === "var(--lp-muted)" || row.color === "var(--lp-subtle)" ? "var(--lp-muted)" : row.color, width: "28px", flexShrink: 0 }}>{row.pct}%</div>
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 18px", borderTop: "1px solid var(--lp-border)", fontSize: "12px", color: "var(--lp-muted)", lineHeight: 1.6 }}>
              <span style={{ color: "#2DD4A0", fontFamily: "var(--font-mono)", fontWeight: 500 }}>+2</span> keywords moved to page 1 this week. Target: <span style={{ color: "var(--lp-text)", fontWeight: 500 }}>8 page-1 keywords</span> by end of Q2.
            </div>
          </div>

          {/* Cluster health */}
          <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--lp-text)" }}>Cluster health</div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", padding: "2px 7px", background: "var(--lp-bg4)", borderRadius: "4px" }}>5 clusters</span>
            </div>
            <div>
              {DEMO_CLUSTERS.map((cl, i) => {
                const posColor = parseInt(cl.avgPos.replace("#", "")) <= 10 ? "#2DD4A0"
                  : parseInt(cl.avgPos.replace("#", "")) <= 20 ? "#F0A429"
                  : "var(--lp-muted)";
                const trendColor = cl.up === true ? "#2DD4A0" : cl.up === false ? "#F06060" : "var(--lp-muted)";
                const trendLabel = cl.up === true ? `↑ ${cl.trend}` : cl.up === false ? `↓ ${cl.trend}` : "→ 0";
                return (
                  <div key={cl.name} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 18px", borderBottom: i < DEMO_CLUSTERS.length - 1 ? "1px solid var(--lp-border)" : "none", cursor: "pointer" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: cl.color, flexShrink: 0, display: "block" }} />
                    <span style={{ flex: 1, fontSize: "12.5px", fontWeight: 500, color: "var(--lp-text)" }}>{cl.name}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-muted)", marginRight: "6px" }}>{cl.count} kws</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 500, color: posColor }}>{cl.avgPos}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: trendColor, marginLeft: "6px" }}>{trendLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Biggest movers */}
          <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--lp-text)" }}>Biggest movers · 7 days</div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", padding: "2px 7px", background: "var(--lp-bg4)", borderRadius: "4px" }}>top 5</span>
            </div>
            <div>
              {DEMO_MOVERS.map((mv, i) => (
                <div key={mv.keyword} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 18px", borderBottom: "1px solid var(--lp-border)", borderTopStyle: i === 4 ? "dashed" : "solid" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: mv.up ? "var(--lp-subtle)" : "#F06060", width: "18px", flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: "12.5px", color: mv.up ? "var(--lp-text)" : "var(--lp-muted2)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {mv.keyword}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", flexShrink: 0 }}>#{mv.from} → #{mv.to}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 500, flexShrink: 0, padding: "2px 7px", borderRadius: "4px", color: mv.up ? "#2DD4A0" : "#F06060", background: mv.up ? "rgba(45,212,160,0.10)" : "rgba(240,96,96,0.12)" }}>
                    {mv.up ? "↑" : "↓"} {mv.change}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 18px", borderTop: "1px solid var(--lp-border)", fontSize: "12px", color: "var(--lp-muted)", lineHeight: 1.6 }}>
              <span style={{ color: "var(--lp-text)", fontWeight: 500 }}>Net movement:</span>{" "}
              <span style={{ color: "#2DD4A0", fontFamily: "var(--font-mono)" }}>+29 positions</span> across all tracked keywords this week.
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}

/* ── Sub-components ── */

function MovBadge({ change, isNew }: { change: number; isNew: boolean }) {
  if (isNew) return <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontFamily: "var(--font-mono)", fontSize: "11px", padding: "2px 7px", borderRadius: "4px", color: "#A99DF9", background: "rgba(124,111,247,0.08)" }}>new</span>;
  if (change === 0) return <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontFamily: "var(--font-mono)", fontSize: "11px", padding: "2px 7px", borderRadius: "4px", color: "var(--lp-muted)" }}>→</span>;
  const up = change > 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontFamily: "var(--font-mono)", fontSize: "11px", padding: "2px 7px", borderRadius: "4px", color: up ? "#2DD4A0" : "#F06060", background: up ? "rgba(45,212,160,0.10)" : "rgba(240,96,96,0.12)" }}>
      {up ? "↑" : "↓"} {Math.abs(change)}
    </span>
  );
}

function HistBars({ bars }: { bars: number[] }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "24px" }}>
      {bars.map((pct, i) => {
        const color = pct < 15 ? "#3A3A44" : pct < 45 ? "#F06060" : pct < 65 ? "#F0A429" : "#2DD4A0";
        return (
          <div key={i} style={{ width: "6px", borderRadius: "2px 2px 0 0", background: color, height: `${Math.max(pct, 4)}%`, transition: "height 0.2s" }} />
        );
      })}
    </div>
  );
}

function GhostBtn({ children }: { children: React.ReactNode }) {
  return (
    <button style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "0 14px", height: "32px", borderRadius: "7px", fontSize: "12.5px", fontWeight: 500, background: "transparent", color: "var(--lp-muted2)", border: "1px solid var(--lp-border)", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
      {children}
    </button>
  );
}

function SecBtn({ children }: { children: React.ReactNode }) {
  return (
    <button style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "0 14px", height: "32px", borderRadius: "7px", fontSize: "12.5px", fontWeight: 500, background: "var(--lp-bg3)", color: "var(--lp-text)", border: "1px solid var(--lp-border)", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
      {children}
    </button>
  );
}

function TabBtn({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button style={{ padding: "5px 11px", fontFamily: "var(--font-mono)", fontSize: "11px", color: active ? "var(--lp-text)" : "var(--lp-muted)", border: `1px solid ${active ? "var(--lp-border2)" : "transparent"}`, borderRadius: "6px", background: active ? "var(--lp-bg4)" : "transparent", cursor: "pointer" }}>
      {children}
    </button>
  );
}
