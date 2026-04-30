"use client";

import { useState, useMemo, useTransition } from "react";
import {
  batchApproveInboxItemsAction,
  clearDevInboxItemsAction,
  seedDevInboxItemsAction,
} from "@/app/(app)/inbox/actions";
import type { InboxItem } from "@/server/schemas/inbox";
import type { Product } from "@/server/schemas/product";

// ── Filter types ──────────────────────────────────────────────────────────────

const FILTERS = ["all", "article", "reply", "listing", "outreach", "copy"] as const;
type Filter = (typeof FILTERS)[number];
type ItemType = Exclude<Filter, "all">;

// ── UI item shape ─────────────────────────────────────────────────────────────

type UIItem = {
  id: string;
  type: ItemType;
  title: string;
  sub: string;
  confidence: number;
  confColor: string;
  impactLabel: string;
  impactColor: string;
  impactBg: string;
  timeAgo: string;
  bulkSafe: boolean;
  // detail pane
  dest: string;
  metaItems: Array<{ text: string; color?: string }>;
  reviewTime: string;
  kdLabel: string;
  kdColor: string;
  kdNote: string;
  approveLabel: string;
  previewText: string;
};

// ── Style constants ───────────────────────────────────────────────────────────

const TYPE_STYLES: Record<ItemType, { bg: string; color: string; border: string }> = {
  article:  { bg: "rgba(124,111,247,0.08)", color: "#A99DF9", border: "rgba(124,111,247,0.15)" },
  reply:    { bg: "rgba(45,212,160,0.10)",  color: "#2DD4A0", border: "rgba(45,212,160,0.15)"  },
  listing:  { bg: "rgba(240,164,41,0.12)",  color: "#F0A429", border: "rgba(240,164,41,0.15)"  },
  outreach: { bg: "rgba(240,96,96,0.12)",   color: "#F06060", border: "rgba(240,96,96,0.15)"   },
  copy:     { bg: "rgba(91,158,246,0.12)",  color: "#5B9EF6", border: "rgba(91,158,246,0.15)"  },
};

const FILTER_ACTIVE: Record<Filter, { color: string; border: string; bg: string }> = {
  all:      { color: "#E8E8EC", border: "#2E2E35",              bg: "#17171A"                    },
  article:  { color: "#A99DF9", border: "rgba(124,111,247,0.30)", bg: "rgba(124,111,247,0.08)"  },
  reply:    { color: "#2DD4A0", border: "rgba(45,212,160,0.30)",  bg: "rgba(45,212,160,0.10)"   },
  listing:  { color: "#F0A429", border: "rgba(240,164,41,0.30)",  bg: "rgba(240,164,41,0.12)"   },
  outreach: { color: "#F06060", border: "rgba(240,96,96,0.30)",   bg: "rgba(240,96,96,0.12)"    },
  copy:     { color: "#5B9EF6", border: "rgba(91,158,246,0.30)",  bg: "rgba(91,158,246,0.12)"   },
};

function confColor(pct: number): string {
  if (pct >= 80) return "#2DD4A0";
  if (pct >= 65) return "#F0A429";
  return "#F06060";
}

function impactStyle(type: ItemType): { color: string; bg: string } {
  if (type === "article") return { color: "#2DD4A0", bg: "rgba(45,212,160,0.10)" };
  if (type === "reply")   return { color: "#5B9EF6", bg: "rgba(91,158,246,0.10)" };
  return { color: "#A99DF9", bg: "rgba(124,111,247,0.08)" };
}

// ── Data mapping ──────────────────────────────────────────────────────────────

function mapItemType(t: InboxItem["itemType"]): ItemType {
  if (t === "content_draft")     return "article";
  if (t === "community_reply")   return "reply";
  if (t === "directory_package") return "listing";
  if (t === "outreach_email")    return "outreach";
  return "copy";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1)  return "<1h ago";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function reviewTime(seconds: number | null): string {
  if (!seconds) return "~1 min";
  return `~${Math.max(1, Math.round(seconds / 60))} min`;
}

function mapToUI(item: InboxItem): UIItem {
  const type = mapItemType(item.itemType);
  const conf = item.aiConfidence === null ? 70 : Math.round(item.aiConfidence * 100);
  const imp  = impactStyle(type);
  const p    = item.payload as Record<string, unknown>;
  const kw   = typeof p.targetKeyword === "string" ? p.targetKeyword : null;
  const wc   = typeof p.wordCount === "number" ? p.wordCount : null;
  const prev = (item.payload.preview ?? item.payload.suggestedAction ?? "");

  const sub = (() => {
    if (type === "article") {
      const parts = [wc ? `${wc.toLocaleString()} words` : "", kw ? `targets "${kw}"` : ""].filter(Boolean);
      return parts.join(" · ") || "SEO content draft";
    }
    if (type === "reply")    return "Community reply draft";
    if (type === "listing")  return "Directory listing package";
    if (type === "outreach") return "Cold outreach email";
    return "Content action";
  })();

  const dest = (() => {
    if (type === "article")  return "SEO content · blog";
    if (type === "reply")    return "Community reply";
    if (type === "listing")  return "Directory submission";
    if (type === "outreach") return "Cold email outreach";
    return "Content action";
  })();

  const metaItems: UIItem["metaItems"] = [];
  if (wc)  metaItems.push({ text: `${wc.toLocaleString()} words` });
  if (kw)  metaItems.push({ text: `targets: ${kw}`, color: "#A99DF9" });
  metaItems.push({ text: `${conf}% confidence` });
  metaItems.push({ text: `generated ${timeAgo(item.createdAt)}` });

  const kdLabel = conf >= 80 ? "Low" : conf >= 65 ? "Medium" : "High";
  const kdColor = conf >= 80 ? "#2DD4A0" : conf >= 65 ? "#F0A429" : "#6B6B78";

  const approveLabel =
    type === "article"  ? "✓ Approve & publish" :
    type === "reply"    ? "✓ Approve & post"    :
    type === "listing"  ? "✓ Approve & submit"  :
    type === "outreach" ? "✓ Approve & send"    : "✓ Approve";

  return {
    id: item.id,
    type,
    title: item.payload.title ?? item.itemType.replaceAll("_", " "),
    sub,
    confidence: conf,
    confColor:  confColor(conf),
    impactLabel: type === "article" ? "↑ est. traffic" : type === "reply" ? "reach" : "impact",
    impactColor: imp.color,
    impactBg:    imp.bg,
    timeAgo:     timeAgo(item.createdAt),
    bulkSafe:    item.impactEstimate === "high" && (item.aiConfidence ?? 0) >= 0.88,
    dest,
    metaItems,
    reviewTime: reviewTime(item.reviewTimeEstimateSeconds),
    kdLabel,
    kdColor,
    kdNote: "keyword difficulty estimate",
    approveLabel,
    previewText: prev,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Btn({
  variant = "ghost",
  children,
  onClick,
  disabled,
  type = "button",
  style,
}: {
  variant?: "ghost" | "primary" | "success" | "danger";
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  style?: React.CSSProperties;
}) {
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "6px 13px", borderRadius: 7,
    fontSize: 12, fontFamily: "var(--font-sans)", fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1,
    transition: "all 0.12s", border: "none",
  };
  const vs: Record<string, React.CSSProperties> = {
    ghost:   { background: "transparent", color: "var(--lp-muted)", border: "1px solid var(--lp-border)" },
    primary: { background: "var(--lp-purple)", color: "#fff" },
    success: { background: "rgba(45,212,160,0.10)", color: "#2DD4A0", border: "1px solid rgba(45,212,160,0.18)" },
    danger:  { background: "rgba(240,96,96,0.12)", color: "#F06060", border: "1px solid rgba(240,96,96,0.18)" },
  };
  return (
    <button type={type} style={{ ...base, ...vs[variant], ...style }} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function FilterChip({
  f, active, count, onClick,
}: {
  f: Filter; active: boolean; count: number; onClick: () => void;
}) {
  const a = FILTER_ACTIVE[f];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "4px 11px", borderRadius: 20, fontSize: 11,
        fontFamily: "var(--font-mono)", cursor: "pointer", whiteSpace: "nowrap",
        transition: "all 0.1s",
        border: `1px solid ${active ? a.border : "var(--lp-border)"}`,
        color: active ? a.color : "var(--lp-muted)",
        background: active ? a.bg : "transparent",
      }}
    >
      {f} <span style={{ opacity: 0.6 }}>{count}</span>
    </button>
  );
}

function Sep() {
  return (
    <div style={{ width: 1, height: 16, background: "var(--lp-border)", flexShrink: 0, margin: "0 4px" }} />
  );
}

function InboxCard({
  item, isSelected, isAnimOut, onClick,
}: {
  item: UIItem; isSelected: boolean; isAnimOut: boolean; onClick: () => void;
}) {
  const tb = TYPE_STYLES[item.type];
  return (
    <div
      className={isAnimOut ? "lb-slide-out" : undefined}
      onClick={onClick}
      style={{
        padding: "14px 16px",
        paddingLeft: isSelected ? 14 : 16,
        borderBottom: "1px solid var(--lp-border)",
        borderLeft: `2px solid ${isSelected ? "var(--lp-purple)" : "transparent"}`,
        cursor: "pointer",
        background: isSelected ? "var(--lp-bg3)" : "transparent",
        transition: "background 0.1s",
      }}
    >
      {/* Row 1: checkbox + badge + time */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <input
          type="checkbox"
          style={{ width: 13, height: 13, accentColor: "var(--lp-purple)", cursor: "pointer", flexShrink: 0 }}
          aria-label={`Select ${item.title}`}
          onClick={(e) => e.stopPropagation()}
        />
        <span style={{
          padding: "2px 7px", borderRadius: 4, fontSize: 9, fontFamily: "var(--font-mono)",
          fontWeight: 500, flexShrink: 0, letterSpacing: "0.04em",
          background: tb.bg, color: tb.color, border: `1px solid ${tb.border}`,
        }}>
          {item.type}
        </span>
        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--lp-subtle)", marginLeft: "auto" }}>
          {item.timeAgo}
        </span>
      </div>

      {/* Row 2: title */}
      <div
        className="line-clamp-2"
        style={{ fontSize: "12.5px", fontWeight: 500, color: "var(--lp-text)", lineHeight: 1.4, marginBottom: 4 }}
      >
        {item.title}
      </div>

      {/* Row 3: sub */}
      <div style={{ fontSize: 11, color: "var(--lp-muted)", marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {item.sub}
      </div>

      {/* Row 4: confidence bar + impact */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
          <div style={{ height: 3, width: 56, background: "var(--lp-border2)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${item.confidence}%`, background: item.confColor, borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: "9.5px", fontFamily: "var(--font-mono)", color: "var(--lp-muted)" }}>
            {item.confidence}%
          </span>
        </div>
        <span style={{
          fontSize: "9.5px", fontFamily: "var(--font-mono)", padding: "1px 6px", borderRadius: 3,
          color: item.impactColor, background: item.impactBg,
        }}>
          {item.impactLabel}
        </span>
      </div>
    </div>
  );
}

function DetailHeader({ item }: { item: UIItem }) {
  const tb = TYPE_STYLES[item.type];
  return (
    <div
      className="lb-slide-in"
      style={{ padding: "20px 28px 16px", borderBottom: "1px solid var(--lp-border)", flexShrink: 0 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{
          padding: "2px 7px", borderRadius: 4, fontSize: 9, fontFamily: "var(--font-mono)",
          fontWeight: 500, letterSpacing: "0.04em",
          background: tb.bg, color: tb.color, border: `1px solid ${tb.border}`,
        }}>
          {item.type}
        </span>
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--lp-muted)" }}>
          {item.dest}
        </span>
      </div>
      <div style={{
        fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 400,
        color: "var(--lp-text)", lineHeight: 1.3, marginBottom: 8,
      }}>
        {item.title}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
        {item.metaItems.map((m, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {i > 0 && (
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--lp-muted)", display: "inline-block", margin: "0 6px" }} />
            )}
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: m.color ?? "var(--lp-muted)" }}>
              {m.text}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function DetailActions({
  item, onApprove, onReject,
}: {
  item: UIItem; onApprove: () => void; onReject: () => void;
}) {
  return (
    <div style={{
      padding: "14px 28px", borderBottom: "1px solid var(--lp-border)",
      display: "flex", alignItems: "center", gap: 8,
      flexShrink: 0, background: "var(--lp-bg2)",
    }}>
      <Btn variant="success" onClick={onApprove}>{item.approveLabel}</Btn>
      <Btn variant="ghost" onClick={onReject}>✕ Reject</Btn>
      <Btn variant="ghost">✎ Edit in-app</Btn>
      <Btn variant="ghost">↺ Regenerate</Btn>
      <div style={{ width: 1, height: 20, background: "var(--lp-border)", margin: "0 4px" }} />
      <Btn variant="ghost" style={{ fontSize: 11, color: "var(--lp-muted)" }}>⟩ Skip</Btn>
    </div>
  );
}

function ScoreBlock({
  label, value, valueColor, barWidth, barColor, note, mono = false,
}: {
  label: string; value: string; valueColor: string;
  barWidth?: number; barColor?: string; note?: string; mono?: boolean;
}) {
  return (
    <div style={{
      flex: 1, background: "var(--lp-bg2)", border: "1px solid var(--lp-border)",
      borderRadius: 9, padding: "14px 16px",
    }}>
      <div style={{
        fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--lp-muted)",
        textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: mono ? 18 : 22,
        fontFamily: mono ? "var(--font-mono)" : "var(--font-serif)",
        color: valueColor, lineHeight: 1, marginBottom: 6,
      }}>
        {value}
      </div>
      {barWidth !== undefined ? (
        <div style={{ height: 4, background: "var(--lp-border2)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${barWidth}%`, background: barColor ?? "var(--lp-purple)", borderRadius: 2 }} />
        </div>
      ) : note ? (
        <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--lp-muted)", marginTop: 4 }}>
          {note}
        </div>
      ) : null}
    </div>
  );
}

function ScoreRow({ item }: { item: UIItem }) {
  return (
    <div className="lb-slide-in" style={{ display: "flex", alignItems: "stretch", gap: 12, marginBottom: 20 }}>
      <ScoreBlock
        label="AI confidence"
        value={`${item.confidence}%`}
        valueColor="var(--lp-text)"
        barWidth={item.confidence}
        barColor={item.confColor}
      />
      <ScoreBlock
        label="Est. impact"
        value={item.impactLabel}
        valueColor={item.impactColor}
        barWidth={60}
        barColor={item.impactColor}
      />
      <ScoreBlock
        label="Time to review"
        value={item.reviewTime}
        valueColor="var(--lp-text)"
        note="skim or approve"
        mono
      />
      <ScoreBlock
        label="Keyword difficulty"
        value={item.kdLabel}
        valueColor={item.kdColor}
        note={item.kdNote}
      />
    </div>
  );
}

function ContentPreview({ item }: { item: UIItem }) {
  return (
    <div className="lb-slide-in" style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--lp-muted)",
        textTransform: "uppercase", letterSpacing: "0.07em",
        marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid var(--lp-border)",
      }}>
        Content preview
      </div>
      <div style={{ background: "var(--lp-bg2)", border: "1px solid var(--lp-border)", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ background: "var(--lp-bg3)", padding: "16px 20px", borderBottom: "1px solid var(--lp-border)" }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 17, color: "var(--lp-text)", lineHeight: 1.4, marginBottom: 6 }}>
            {item.title}
          </div>
          <div style={{ display: "flex", gap: 10, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--lp-muted)" }}>
            <span>{item.dest}</span>
          </div>
        </div>
        <div style={{ padding: "16px 20px" }}>
          {item.previewText ? (
            <p style={{ fontSize: 12, color: "var(--lp-muted)", lineHeight: 1.7 }}>
              {item.previewText}
            </p>
          ) : (
            <p style={{ fontSize: 12, color: "var(--lp-muted)", lineHeight: 1.7, fontStyle: "italic" }}>
              No preview available. Open the full item to review the content.
            </p>
          )}
        </div>
        <div style={{
          textAlign: "center", padding: 10, fontSize: 11,
          fontFamily: "var(--font-mono)", color: "var(--lp-purple-l)",
          cursor: "pointer", borderTop: "1px solid var(--lp-border)",
        }}>
          View full content ↓
        </div>
      </div>
    </div>
  );
}

const REJECT_REASONS = ["Wrong tone", "Off-brand", "Wrong keyword focus", "Too promotional", "Poor quality", "Other"];

function RejectDrawer({
  reason, note, onSelectReason, onNoteChange, onConfirm, onCancel,
}: {
  reason: string | null; note: string;
  onSelectReason: (r: string) => void;
  onNoteChange: (n: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ background: "var(--lp-bg3)", borderTop: "1px solid var(--lp-border)", padding: "14px 28px", flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#F06060", marginBottom: 6 }}>
        Why are you rejecting this?
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {REJECT_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onSelectReason(r)}
            style={{
              padding: "4px 10px",
              border: `1px solid ${reason === r ? "rgba(240,96,96,0.40)" : "var(--lp-border2)"}`,
              borderRadius: 5, fontSize: 11, fontFamily: "var(--font-sans)",
              color: reason === r ? "#F06060" : "var(--lp-muted)",
              background: reason === r ? "rgba(240,96,96,0.12)" : "transparent",
              cursor: "pointer", transition: "all 0.1s",
            }}
          >
            {r}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Optional: add a note to guide regeneration…"
          style={{
            flex: 1, background: "var(--lp-bg2)", border: "1px solid var(--lp-border2)",
            borderRadius: 6, padding: "7px 11px", fontSize: 12, color: "var(--lp-text)",
            fontFamily: "var(--font-sans)", outline: "none",
          }}
        />
        <Btn variant="danger" onClick={onConfirm}>Reject &amp; regenerate</Btn>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function InboxClient({
  items: persistedItems,
  product,
  canUseDevSeed,
}: {
  items: InboxItem[];
  product: Product | null;
  batchApproved?: string;
  batchError?: string;
  devSeeded?: string;
  devSeedCleared?: string;
  devSeedError?: string;
  canUseDevSeed: boolean;
}) {
  const [filter, setFilter]         = useState<Filter>("all");
  const [dismissed, setDismissed]   = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [animOut, setAnimOut]       = useState<Set<string>>(new Set());
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [, startTransition] = useTransition();

  const allItems    = useMemo(() => persistedItems.map(mapToUI), [persistedItems]);
  const activeItems = useMemo(() => allItems.filter((i) => !dismissed.has(i.id)), [allItems, dismissed]);
  const visibleItems = useMemo(
    () => filter === "all" ? activeItems : activeItems.filter((i) => i.type === filter),
    [activeItems, filter],
  );
  const highConfItems = useMemo(() => activeItems.filter((i) => i.bulkSafe), [activeItems]);

  // Prefer explicit selection; fall back to first visible item
  const detailId = (selectedId && activeItems.find((i) => i.id === selectedId))
    ? selectedId
    : (visibleItems[0]?.id ?? null);
  const detailItem = detailId ? (activeItems.find((i) => i.id === detailId) ?? null) : null;

  function dismiss(id: string) {
    setAnimOut((s) => new Set(Array.from(s).concat(id)));
    setTimeout(() => {
      setDismissed((s) => new Set(Array.from(s).concat(id)));
      setAnimOut((s) => { const n = new Set(Array.from(s)); n.delete(id); return n; });
      const idx = visibleItems.findIndex((i) => i.id === id);
      const next = visibleItems[idx + 1] ?? visibleItems[idx - 1];
      setSelectedId(next?.id ?? null);
    }, 300);
  }

  function handleApprove() {
    if (!detailId) return;
    const id = detailId;
    dismiss(id);
    setRejectOpen(false);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("inboxItemIds", id);
      await batchApproveInboxItemsAction(fd);
    });
  }

  function handleApproveAll() {
    highConfItems.forEach((item) => {
      const id = item.id;
      dismiss(id);
      startTransition(async () => {
        const fd = new FormData();
        fd.append("inboxItemIds", id);
        await batchApproveInboxItemsAction(fd);
      });
    });
  }

  function handleReject() {
    if (!detailId) return;
    dismiss(detailId);
    setRejectOpen(false);
    setRejectReason(null);
    setRejectNote("");
  }

  return (
    <main style={{
      display: "flex", flexDirection: "column",
      height: "100vh", overflow: "hidden",
      background: "var(--lp-bg)",
    }}>

      {/* ── Topbar ─────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "15px 24px", borderBottom: "1px solid var(--lp-border)",
        background: "var(--lp-bg)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <h1 style={{
            fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 400,
            color: "var(--lp-text)", display: "flex", alignItems: "center", gap: 10,
          }}>
            Approval inbox
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 11, color: "#F0A429",
              background: "rgba(240,164,41,0.12)", border: "1px solid rgba(240,164,41,0.18)",
              padding: "2px 8px", borderRadius: 10,
            }}>
              {activeItems.length} pending
            </span>
          </h1>

          {product && (
            <button type="button" style={{
              background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: 8,
              padding: "6px 10px 6px 9px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
              fontFamily: "var(--font-sans)", color: "var(--lp-text)",
            }}>
              <span style={{
                width: 6, height: 6, background: "#2DD4A0", borderRadius: "50%", flexShrink: 0,
                boxShadow: "0 0 0 3px rgba(45,212,160,0.08)",
              }} />
              <span style={{ fontSize: "12.5px", fontWeight: 500, color: "var(--lp-text)", maxWidth: 140, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {product.name}
              </span>
              <span style={{ color: "var(--lp-muted)", fontSize: 10 }}>⌄</span>
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Btn variant="ghost" onClick={handleApproveAll} disabled={!highConfItems.length}>
            ✓ Approve all high-confidence ({highConfItems.length})
          </Btn>
          <Btn variant="ghost">↓ Skip all</Btn>
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "10px 24px", borderBottom: "1px solid var(--lp-border)",
        background: "var(--lp-bg2)", flexShrink: 0, overflowX: "auto",
      }}>
        <FilterChip f="all" active={filter === "all"} count={activeItems.length} onClick={() => setFilter("all")} />
        <Sep />
        {(["article", "reply", "listing", "outreach", "copy"] as const).map((f) => (
          <FilterChip
            key={f} f={f} active={filter === f}
            count={activeItems.filter((i) => i.type === f).length}
            onClick={() => setFilter(f)}
          />
        ))}
        <Sep />
        <span style={{ marginLeft: "auto", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--lp-muted)", flexShrink: 0 }}>
          newest first ↓
        </span>
      </div>

      {/* ── Two-pane ───────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", flex: 1, overflow: "hidden" }}>

        {/* List pane */}
        <div style={{ borderRight: "1px solid var(--lp-border)", overflowY: "auto", background: "var(--lp-bg2)" }}>
          {visibleItems.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--lp-muted)", lineHeight: 1.7 }}>
              {activeItems.length ? "No items match this filter" : "No pending items"}
            </div>
          ) : visibleItems.map((item) => (
            <InboxCard
              key={item.id}
              item={item}
              isSelected={item.id === detailId}
              isAnimOut={animOut.has(item.id)}
              onClick={() => { setSelectedId(item.id); setRejectOpen(false); }}
            />
          ))}
        </div>

        {/* Detail pane */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--lp-bg)" }}>
          {detailItem ? (
            <>
              <DetailHeader item={detailItem} />
              <DetailActions
                item={detailItem}
                onApprove={handleApprove}
                onReject={() => setRejectOpen(true)}
              />
              <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
                <ScoreRow item={detailItem} />
                <ContentPreview item={detailItem} />
              </div>
              {rejectOpen && (
                <RejectDrawer
                  reason={rejectReason}
                  note={rejectNote}
                  onSelectReason={setRejectReason}
                  onNoteChange={setRejectNote}
                  onConfirm={handleReject}
                  onCancel={() => { setRejectOpen(false); setRejectReason(null); setRejectNote(""); }}
                />
              )}
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--lp-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              {activeItems.length ? "Select an item to review" : "✓ All items reviewed"}
            </div>
          )}
        </div>
      </div>

      {/* Dev seed panel */}
      {canUseDevSeed && product && (
        <div style={{ position: "fixed", bottom: 16, right: 16, zIndex: 50 }}>
          <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border2)", borderRadius: 8, padding: "8px 12px", display: "flex", gap: 8 }}>
            <form action={seedDevInboxItemsAction}>
              <input type="hidden" name="productId" value={product.id} />
              <Btn variant="ghost" type="submit" style={{ fontSize: 11 }}>Seed test data</Btn>
            </form>
            <form action={clearDevInboxItemsAction}>
              <input type="hidden" name="productId" value={product.id} />
              <Btn variant="ghost" type="submit" style={{ fontSize: 11 }}>Clear seeds</Btn>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
