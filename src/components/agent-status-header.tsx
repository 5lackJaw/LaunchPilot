import Link from "next/link";

export type AgentStatusHeaderState = "active" | "paused" | "not_configured";

export function AgentStatusHeader({
  label,
  state,
  lastRun,
  nextRun,
  inboxCount,
  configureHref = "/settings/connections",
}: {
  label: string;
  state: AgentStatusHeaderState;
  lastRun: string;
  nextRun: string;
  inboxCount: number;
  configureHref?: string;
}) {
  const isNotConfigured = state === "not_configured";
  const color = state === "active" ? "var(--lp-teal)" : state === "paused" ? "var(--lp-amber)" : "var(--lp-red)";
  const labelText = state === "active" ? "ACTIVE" : state === "paused" ? "PAUSED" : "NOT CONFIGURED";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.1fr repeat(3, minmax(120px, 0.35fr)) auto",
        gap: "12px",
        alignItems: "center",
        background: "var(--lp-bg3)",
        border: "1px solid var(--lp-border)",
        borderRadius: "10px",
        padding: "12px 16px",
      }}
    >
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "5px" }}>
          Agent status
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--lp-text)", fontWeight: 600 }}>
          {label}
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)", fontSize: "10px", color, padding: "2px 7px", borderRadius: "999px", background: `${color}18`, border: `1px solid ${color}40` }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color }} />
            {labelText}
          </span>
        </div>
      </div>
      <AgentMeta label="Last run" value={lastRun} />
      <AgentMeta label="Next run" value={nextRun} />
      <AgentMeta label="Inbox" value={`${inboxCount} pending`} />
      {isNotConfigured ? (
        <Link href={configureHref} style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-purple-l)", textDecoration: "none", whiteSpace: "nowrap" }}>
          Connect provider →
        </Link>
      ) : (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", whiteSpace: "nowrap" }}>
          monitoring
        </span>
      )}
    </div>
  );
}

function AgentMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "9.5px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-text)" }}>{value}</div>
    </div>
  );
}
