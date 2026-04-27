"use client";

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
    <header
      className="flex items-center justify-between"
      style={{
        background: "var(--lp-bg)",
        borderBottom: "1px solid var(--lp-border)",
        padding: "13px 28px",
        minHeight: "64px",
      }}
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="min-w-0">
          {eyebrow ? (
            <p
              className="font-mono uppercase"
              style={{ fontSize: "10px", letterSpacing: "0.08em", color: "var(--lp-muted)", marginBottom: "1px" }}
            >
              {eyebrow}
            </p>
          ) : null}
          <h1
            className="font-serif truncate"
            style={{ fontSize: "22px", fontWeight: 400, letterSpacing: "-0.01em", color: "var(--lp-text)", lineHeight: 1.3 }}
          >
            {title}
          </h1>
        </div>
        {productName ? (
          <div
            className="inline-flex shrink-0 items-center gap-2"
            style={{
              background: "var(--lp-bg3)",
              border: "1px solid var(--lp-border)",
              borderRadius: "8px",
              padding: "6px 10px 6px 9px",
            }}
            aria-label="Current product"
          >
            <span
              className="shrink-0"
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "9999px",
                background: "var(--lp-teal)",
                boxShadow: "0 0 0 3px rgba(45,212,160,0.1)",
                flexShrink: 0,
              }}
              aria-hidden="true"
            />
            <span
              style={{ fontSize: "12.5px", fontWeight: 500, color: "var(--lp-text)", whiteSpace: "nowrap" }}
            >
              {productName}
            </span>
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2 ml-4">{actions}</div>
      ) : null}
    </header>
  );
}

export function RangeTabs({
  active = "30d",
  onChange,
}: {
  active?: string;
  onChange?: (range: string) => void;
}) {
  const ranges = ["7d", "30d", "90d", "all time"];

  return (
    <div
      className="flex items-center gap-1 overflow-x-auto"
      style={{
        background: "var(--lp-bg)",
        borderBottom: "1px solid var(--lp-border)",
        padding: "8px 28px",
      }}
    >
      {ranges.map((range) => {
        const isActive = range === active;
        return (
          <button
            key={range}
            type="button"
            onClick={() => onChange?.(range)}
            aria-current={isActive ? "true" : undefined}
            className="font-mono shrink-0 transition-colors"
            style={{
              fontSize: "11px",
              padding: "4px 10px",
              borderRadius: "5px",
              border: isActive ? "1px solid var(--lp-border2)" : "1px solid transparent",
              background: isActive ? "var(--lp-bg3)" : "transparent",
              color: isActive ? "var(--lp-text)" : "var(--lp-muted)",
              cursor: "pointer",
            }}
          >
            {range}
          </button>
        );
      })}
    </div>
  );
}
