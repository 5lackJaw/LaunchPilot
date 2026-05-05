"use client";

import { useFormStatus } from "react-dom";

export function DraftOpportunitySubmit({
  label = "+ Draft",
  variant = "compact",
}: {
  label?: string;
  variant?: "compact" | "primary";
}) {
  const { pending } = useFormStatus();
  const primary = variant === "primary";

  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: primary ? "7px 14px" : "4px 10px",
        borderRadius: primary ? "7px" : "5px",
        fontFamily: primary ? "var(--font-sans)" : "var(--font-mono)",
        fontSize: primary ? "12.5px" : "10.5px",
        fontWeight: primary ? 500 : 400,
        color: pending ? "var(--lp-muted)" : primary ? "#fff" : "var(--lp-purple-l)",
        background: pending ? "var(--lp-bg4)" : primary ? "var(--lp-purple)" : "var(--lp-purple-dim)",
        border: primary ? "none" : `1px solid ${pending ? "var(--lp-border)" : "rgba(124,111,247,0.2)"}`,
        cursor: pending ? "default" : "pointer",
      }}
    >
      {pending ? "Starting..." : label}
    </button>
  );
}
