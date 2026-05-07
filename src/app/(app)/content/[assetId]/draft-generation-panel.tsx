"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  cancelArticleGenerationAction,
  requestArticleGenerationAction,
} from "@/app/(app)/content/[assetId]/actions";
import type { ContentGenerationProvenance } from "@/server/content/generation-state";

type Props = {
  assetId: string;
  assetStatus: string;
  generation: ContentGenerationProvenance | null;
  flashComplete: boolean;
};

export function DraftGenerationPanel({ assetId, assetStatus, generation, flashComplete }: Props) {
  const router = useRouter();
  const [hideComplete, setHideComplete] = useState(false);
  const running = generation?.status === "queued" || generation?.status === "running";
  const failed = generation?.status === "failed";
  const showComplete = generation?.status === "completed" && flashComplete && !hideComplete;
  const canGenerate = ["draft", "pending_review", "rejected", "failed"].includes(assetStatus) && !running;

  useEffect(() => {
    if (!showComplete) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHideComplete(true);
      router.replace(`/content/${assetId}`);
      router.refresh();
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [assetId, router, showComplete]);

  return (
    <form action={requestArticleGenerationAction}>
      <input type="hidden" name="assetId" value={assetId} />
      <DraftGenerationSubmitArea
        canGenerate={canGenerate}
        generation={generation}
        failed={failed}
        running={running}
        showComplete={showComplete}
      />
    </form>
  );
}

function DraftGenerationSubmitArea({
  canGenerate,
  generation,
  failed,
  running,
  showComplete,
}: {
  canGenerate: boolean;
  generation: ContentGenerationProvenance | null;
  failed: boolean;
  running: boolean;
  showComplete: boolean;
}) {
  const { pending } = useFormStatus();

  if (pending) {
    return (
      <InlineProgress
        title="Starting article generation..."
        stepLabel="Queueing content workflow..."
        progressPercent={5}
        stepIndex={1}
        stepCount={5}
      />
    );
  }

  if (showComplete) {
    return <InlineComplete label="Draft generated · just now" />;
  }

  if (running && generation) {
    return (
      <InlineProgress
        title={generation.status === "queued" ? "Article generation queued..." : "Generating article draft..."}
        stepLabel={getCurrentStepLabel(generation.steps, "Researching search intent...")}
        progressPercent={generation.progressPercent}
        stepIndex={getCurrentStepIndex(generation.steps)}
        stepCount={generation.steps.length || 5}
        canCancel
      />
    );
  }

  if (failed && generation) {
    return (
      <div style={failedBoxStyle}>
        <div style={{ display: "flex", gap: "9px", alignItems: "flex-start" }}>
          <span style={{ color: "var(--lp-red)", fontFamily: "var(--font-mono)", fontSize: "13px" }}>!</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <strong style={{ color: "var(--lp-text)", fontSize: "12.5px", fontWeight: 600 }}>
              Article generation failed
            </strong>
            <span style={{ color: "var(--lp-muted2)", fontSize: "11.5px", lineHeight: 1.5 }}>
              This usually resolves on retry.
            </span>
            {generation.errorMessage ? (
              <details style={{ color: "var(--lp-muted)", fontSize: "11px", lineHeight: 1.5 }}>
                <summary>View raw log</summary>
                <code style={{ display: "block", marginTop: "6px", whiteSpace: "pre-wrap" }}>
                  {generation.errorMessage}
                </code>
              </details>
            ) : null}
          </div>
        </div>
        <button type="submit" style={primaryButtonStyle}>
          Retry generation
        </button>
      </div>
    );
  }

  return (
    <button type="submit" disabled={!canGenerate} style={{ ...primaryButtonStyle, opacity: canGenerate ? 1 : 0.5 }}>
      Generate draft
    </button>
  );
}

function InlineProgress({
  title,
  stepLabel,
  progressPercent,
  stepIndex,
  stepCount,
  canCancel,
}: {
  title: string;
  stepLabel: string;
  progressPercent: number;
  stepIndex: number;
  stepCount: number;
  canCancel?: boolean;
}) {
  return (
    <div style={progressBoxStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "12.5px", fontWeight: 500, color: "var(--lp-text)" }}>
          {title}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)" }}>
          Step {stepIndex} of {stepCount}
        </span>
      </div>
      <div style={{ height: "3px", overflow: "hidden", borderRadius: "9999px", background: "var(--lp-bg4)" }}>
        <div
          style={{
            height: "100%",
            width: `${Math.min(Math.max(progressPercent, 4), 100)}%`,
            background: "var(--lp-purple)",
            borderRadius: "9999px",
          }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-muted2)" }}>{stepLabel}</span>
        {canCancel ? (
          <button
            type="submit"
            formAction={cancelArticleGenerationAction}
            style={{ border: "none", background: "transparent", color: "var(--lp-muted)", fontFamily: "var(--font-sans)", fontSize: "11.5px", padding: 0, cursor: "pointer" }}
          >
            Cancel
          </button>
        ) : (
          <span
            aria-hidden="true"
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "9999px",
              background: "var(--lp-purple)",
              opacity: 0.75,
              animation: "pulse 1.2s ease-in-out infinite",
            }}
          />
        )}
      </div>
    </div>
  );
}

function InlineComplete({ label }: { label: string }) {
  return <div style={completeBoxStyle}>{label}</div>;
}

function getCurrentStepLabel(steps: ContentGenerationProvenance["steps"], fallback: string) {
  const running = steps.find((step) => step.status === "running");
  const pending = steps.find((step) => step.status === "pending");
  return `${running?.label ?? pending?.label ?? fallback}`;
}

function getCurrentStepIndex(steps: ContentGenerationProvenance["steps"]) {
  const runningIndex = steps.findIndex((step) => step.status === "running");
  if (runningIndex >= 0) {
    return runningIndex + 1;
  }

  const pendingIndex = steps.findIndex((step) => step.status === "pending");
  if (pendingIndex >= 0) {
    return pendingIndex + 1;
  }

  return Math.max(steps.length, 1);
}

const primaryButtonStyle = {
  width: "100%",
  fontFamily: "var(--font-sans)",
  fontSize: "12.5px",
  fontWeight: 500,
  color: "#fff",
  background: "var(--lp-purple)",
  border: "none",
  borderRadius: "7px",
  padding: "8px 14px",
  cursor: "pointer",
};

const progressBoxStyle = {
  border: "1px solid var(--lp-border)",
  borderRadius: "7px",
  background: "var(--lp-bg3)",
  padding: "11px 12px",
  display: "flex",
  flexDirection: "column" as const,
  gap: "8px",
};

const completeBoxStyle = {
  border: "1px solid rgba(45,212,160,0.25)",
  borderRadius: "7px",
  background: "rgba(45,212,160,0.10)",
  color: "var(--lp-teal)",
  fontFamily: "var(--font-sans)",
  fontSize: "12.5px",
  fontWeight: 500,
  padding: "11px 12px",
};

const failedBoxStyle = {
  border: "1px solid rgba(255,84,102,0.25)",
  borderLeft: "3px solid var(--lp-red)",
  borderRadius: "7px",
  background: "rgba(255,84,102,0.10)",
  padding: "11px 12px",
  display: "flex",
  flexDirection: "column" as const,
  gap: "10px",
};
