"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type WorkflowNotification = {
  id: string;
  kind: "crawl" | "brief" | "article";
  status: "queued" | "running" | "completed" | "failed";
  title: string;
  detail: string;
  href: string;
  progressPercent: number | null;
  stepLabel: string | null;
  updatedAt: string;
};

const POLL_MS = 5000;
const DISMISSED_KEY = "launchbeacon.dismissedWorkflowNotifications";

export function WorkflowNotifications() {
  const [items, setItems] = useState<WorkflowNotification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") {
      return new Set();
    }
    const stored = window.sessionStorage.getItem(DISMISSED_KEY);
    try {
      return new Set(stored ? JSON.parse(stored) as string[] : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/workflow-notifications", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { notifications?: WorkflowNotification[] };
        if (!cancelled) {
          setItems(payload.notifications ?? []);
        }
      } catch {
        // Notifications are auxiliary; page workflows remain server-owned.
      }
    }

    void load();
    const interval = window.setInterval(load, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const visibleItems = useMemo(
    () => items.filter((item) => !dismissed.has(item.id)).slice(0, 3),
    [dismissed, items],
  );

  if (!visibleItems.length) {
    return null;
  }

  function dismiss(id: string) {
    setDismissed((current) => {
      const next = new Set(current).add(id);
      window.sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        top: "14px",
        right: "14px",
        zIndex: 60,
        width: "min(360px, calc(100vw - 28px))",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        pointerEvents: "none",
      }}
    >
      {visibleItems.map((item) => (
        <WorkflowNotificationCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
      ))}
    </div>
  );
}

function WorkflowNotificationCard({
  item,
  onDismiss,
}: {
  item: WorkflowNotification;
  onDismiss: () => void;
}) {
  const isRunning = item.status === "queued" || item.status === "running";
  const color = item.status === "failed" ? "var(--lp-red)" : item.status === "completed" ? "var(--lp-teal)" : "var(--lp-purple)";

  return (
    <div
      style={{
        pointerEvents: "auto",
        border: "1px solid var(--lp-border)",
        borderLeft: `3px solid ${color}`,
        borderRadius: "8px",
        background: "var(--lp-bg3)",
        boxShadow: "0 14px 42px rgba(0,0,0,0.28)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "10px 12px 9px", display: "flex", flexDirection: "column", gap: "7px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "12.5px", color: "var(--lp-text)", fontWeight: 600 }}>
              {item.title}
            </div>
            <div style={{ marginTop: "3px", fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-muted)", lineHeight: 1.45 }}>
              {item.stepLabel ?? item.detail}
            </div>
          </div>
          {!isRunning ? (
            <button
              type="button"
              aria-label="Dismiss workflow notification"
              onClick={onDismiss}
              style={{ border: "none", background: "transparent", color: "var(--lp-muted)", fontSize: "14px", lineHeight: 1, cursor: "pointer", padding: "1px 2px" }}
            >
              ×
            </button>
          ) : null}
        </div>

        {isRunning ? (
          <div style={{ height: "3px", overflow: "hidden", borderRadius: "9999px", background: "var(--lp-bg4)" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.min(Math.max(item.progressPercent ?? 8, 4), 100)}%`,
                background: "var(--lp-purple)",
                borderRadius: "9999px",
              }}
            />
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)" }}>
            {formatStatus(item.status)}
          </span>
          <Link
            href={item.href}
            style={{ fontFamily: "var(--font-sans)", fontSize: "11.5px", color: "var(--lp-purple-l)", textDecoration: "none", fontWeight: 500 }}
          >
            {item.status === "completed" ? "Review" : item.status === "failed" ? "Open issue" : "Open"}
          </Link>
        </div>
      </div>
    </div>
  );
}

function formatStatus(status: WorkflowNotification["status"]) {
  if (status === "queued") {
    return "queued";
  }

  if (status === "running") {
    return "running";
  }

  if (status === "completed") {
    return "complete";
  }

  return "failed";
}
