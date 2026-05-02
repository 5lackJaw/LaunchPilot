"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  cancelBriefGenerationForBriefAction,
  cancelCrawlForBriefAction,
  crawlProductForBriefAction,
  generateMarketingBriefNowAction,
} from "@/app/(app)/marketing-brief/actions";
import type { BriefGenerationJob } from "@/server/schemas/brief-generation-job";
import type { CrawlJob } from "@/server/schemas/crawl";

type Props = {
  productId: string;
  hasBrief: boolean;
  crawlJob: CrawlJob | null;
  briefGenerationJob: BriefGenerationJob | null;
  currentBriefVersion: number | null;
  flashCrawlComplete: boolean;
  flashBriefComplete: boolean;
};

export function WorkflowActionPanel({
  productId,
  hasBrief,
  crawlJob,
  briefGenerationJob,
  currentBriefVersion,
  flashCrawlComplete,
  flashBriefComplete,
}: Props) {
  const router = useRouter();
  const crawlRunning = crawlJob?.status === "queued" || crawlJob?.status === "running";
  const briefRunning = briefGenerationJob?.status === "queued" || briefGenerationJob?.status === "running";

  useEffect(() => {
    if (!flashCrawlComplete && !flashBriefComplete) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      router.replace("/marketing-brief");
      router.refresh();
    }, flashBriefComplete ? 3000 : 5000);

    return () => window.clearTimeout(timeoutId);
  }, [flashBriefComplete, flashCrawlComplete, router]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {hasBrief ? (
        <Link href={`/onboarding/brief?productId=${productId}`} style={secondaryButtonStyle}>
          Edit brief fields
        </Link>
      ) : null}

      <form action={crawlProductForBriefAction}>
        <input type="hidden" name="productId" value={productId} />
        <CrawlSubmitArea
          disabled={crawlRunning}
          job={crawlJob}
          flashComplete={flashCrawlComplete}
        />
      </form>

      <form action={generateMarketingBriefNowAction}>
        <input type="hidden" name="productId" value={productId} />
        <BriefSubmitArea
          disabled={briefRunning}
          job={briefGenerationJob}
          currentBriefVersion={currentBriefVersion}
          flashComplete={flashBriefComplete}
        />
      </form>

      <Link href="/settings/products" style={ghostButtonStyle}>
        Manage product
      </Link>
    </div>
  );
}

function CrawlSubmitArea({
  disabled,
  job,
  flashComplete,
}: {
  disabled: boolean;
  job: CrawlJob | null;
  flashComplete: boolean;
}) {
  const { pending } = useFormStatus();

  if (pending) {
    return <InlineProgress title="Starting product crawl..." stepLabel="Queueing crawl workflow..." progressPercent={8} stepIndex={1} stepCount={3} />;
  }

  if (flashComplete) {
    return <InlineComplete label="Crawl complete · just now" compact />;
  }

  if (disabled && job) {
    return (
      <InlineProgress
        title={job.status === "queued" ? "Crawl queued..." : "Fetching product page..."}
        stepLabel={getCurrentStepLabel(job.steps, "Extracting page signals...")}
        progressPercent={job.progressPercent}
        stepIndex={getCurrentStepIndex(job.steps)}
        stepCount={job.steps.length || 3}
        cancelAction={cancelCrawlForBriefAction}
        productId={job.productId}
        compact
      />
    );
  }

  return (
    <button type="submit" style={secondaryButtonElementStyle}>
      Re-crawl product URL
    </button>
  );
}

function BriefSubmitArea({
  disabled,
  job,
  currentBriefVersion,
  flashComplete,
}: {
  disabled: boolean;
  job: BriefGenerationJob | null;
  currentBriefVersion: number | null;
  flashComplete: boolean;
}) {
  const { pending } = useFormStatus();

  if (pending) {
    return <InlineProgress title="Starting brief generation..." stepLabel="Queueing generation workflow..." progressPercent={8} stepIndex={1} stepCount={4} prominent />;
  }

  if (flashComplete) {
    return <InlineComplete label={currentBriefVersion ? `Brief v${currentBriefVersion} generated · just now` : "Brief generated · just now"} />;
  }

  if (disabled && job) {
    return (
      <InlineProgress
        title={job.status === "queued" ? "Brief generation queued..." : "Generating marketing brief..."}
        stepLabel={getCurrentStepLabel(job.steps, "Analyzing audience...")}
        progressPercent={job.progressPercent}
        stepIndex={getCurrentStepIndex(job.steps)}
        stepCount={job.steps.length || 4}
        cancelAction={cancelBriefGenerationForBriefAction}
        productId={job.productId}
        prominent
      />
    );
  }

  return (
    <button type="submit" style={primaryButtonStyle}>
      Regenerate from latest crawl
    </button>
  );
}

function InlineProgress({
  title,
  stepLabel,
  progressPercent,
  stepIndex,
  stepCount,
  cancelAction,
  productId,
  compact,
  prominent,
}: {
  title: string;
  stepLabel: string;
  progressPercent: number;
  stepIndex: number;
  stepCount: number;
  cancelAction?: (formData: FormData) => void | Promise<void>;
  productId?: string;
  compact?: boolean;
  prominent?: boolean;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--lp-border)",
        borderRadius: "7px",
        background: prominent ? "var(--lp-bg3)" : "var(--lp-bg4)",
        padding: prominent ? "11px 12px" : "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: compact ? "6px" : "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "12.5px", fontWeight: 500, color: "var(--lp-text)" }}>{title}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)" }}>
          Step {stepIndex} of {stepCount}
        </span>
      </div>
      <div style={{ height: "3px", overflow: "hidden", borderRadius: "9999px", background: "var(--lp-bg4)" }}>
        <div style={{ height: "100%", width: `${Math.min(Math.max(progressPercent, 4), 100)}%`, background: "var(--lp-purple)", borderRadius: "9999px" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-muted2)" }}>{stepLabel}</span>
        {cancelAction && productId ? (
          <button
            type="submit"
            formAction={cancelAction}
            style={{ border: "none", background: "transparent", color: "var(--lp-muted)", fontFamily: "var(--font-sans)", fontSize: "11.5px", padding: 0, cursor: "pointer" }}
          >
            Cancel
          </button>
        ) : (
          <span aria-hidden="true" style={{ width: "6px", height: "6px", borderRadius: "9999px", background: "var(--lp-purple)", opacity: 0.75, animation: "pulse 1.2s ease-in-out infinite" }} />
        )}
      </div>
    </div>
  );
}

function InlineComplete({ label, compact }: { label: string; compact?: boolean }) {
  return (
    <div
      style={{
        border: "1px solid rgba(45,212,160,0.25)",
        borderRadius: "7px",
        background: "rgba(45,212,160,0.10)",
        color: "var(--lp-teal)",
        fontFamily: "var(--font-sans)",
        fontSize: "12.5px",
        fontWeight: 500,
        padding: compact ? "8px 10px" : "11px 12px",
      }}
    >
      {label}
    </div>
  );
}

function getCurrentStepLabel(steps: Array<{ label: string; status: string }>, fallback: string) {
  const running = steps.find((step) => step.status === "running");
  const pending = steps.find((step) => step.status === "pending");
  return `${running?.label ?? pending?.label ?? fallback}`;
}

function getCurrentStepIndex(steps: Array<{ label: string; status: string }>) {
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

const secondaryButtonStyle = {
  width: "100%",
  fontFamily: "var(--font-sans)",
  fontSize: "12.5px",
  fontWeight: 500,
  color: "var(--lp-text)",
  background: "var(--lp-bg3)",
  border: "1px solid var(--lp-border)",
  borderRadius: "7px",
  padding: "8px 14px",
  textAlign: "left" as const,
  textDecoration: "none",
};

const secondaryButtonElementStyle = {
  ...secondaryButtonStyle,
  cursor: "pointer",
};

const ghostButtonStyle = {
  ...secondaryButtonStyle,
  color: "var(--lp-muted2)",
  background: "transparent",
};

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
  textAlign: "left" as const,
  cursor: "pointer",
};
