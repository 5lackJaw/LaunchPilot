import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BriefGenerationJob } from "@/server/schemas/brief-generation-job";
import type { CrawlJob } from "@/server/schemas/crawl";

type Step = {
  label: string;
  status: "pending" | "running" | "completed" | "failed";
};

export function CrawlWorkflowStatus({ crawlJob }: { crawlJob: CrawlJob | null }) {
  if (!crawlJob) {
    return <p className="text-sm text-muted-foreground">No crawl has started for this product yet.</p>;
  }

  return (
    <WorkflowStatus
      title="Crawl status"
      status={crawlJob.status}
      progressPercent={crawlJob.progressPercent}
      steps={crawlJob.steps}
      updatedAt={crawlJob.updatedAt}
      errorMessage={crawlJob.errorMessage}
    />
  );
}

export function BriefGenerationWorkflowStatus({ job }: { job: BriefGenerationJob | null }) {
  if (!job) {
    return <p className="text-sm text-muted-foreground">No Marketing Brief generation has started for this product yet.</p>;
  }

  return (
    <WorkflowStatus
      title="Marketing Brief generation"
      status={job.status}
      progressPercent={job.progressPercent}
      steps={job.steps}
      updatedAt={job.updatedAt}
      errorMessage={job.errorMessage}
      trailingBadge={job.adminOverride ? "testing override" : undefined}
    />
  );
}

function WorkflowStatus({
  title,
  status,
  progressPercent,
  steps,
  updatedAt,
  errorMessage,
  trailingBadge,
}: {
  title: string;
  status: "queued" | "running" | "completed" | "failed";
  progressPercent: number;
  steps: Step[];
  updatedAt: string;
  errorMessage: string | null;
  trailingBadge?: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-md border bg-secondary p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{getStatusText(status)}</p>
        </div>
        <div className="flex items-center gap-2">
          {trailingBadge ? <Badge variant="warning">{trailingBadge}</Badge> : null}
          <Badge variant={status === "failed" ? "danger" : status === "completed" ? "success" : "secondary"}>
            {status}
          </Badge>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-background">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
        <span>{progressPercent}%</span>
        <span>Updated {new Date(updatedAt).toLocaleString()}</span>
      </div>

      <div className="flex flex-col gap-2">
        {steps.map((step) => (
          <div key={step.label} className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
            <StepIcon status={step.status} />
            <span className="flex-1">{step.label}</span>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">{step.status}</span>
          </div>
        ))}
      </div>

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
    </div>
  );
}

function StepIcon({ status }: { status: Step["status"] }) {
  if (status === "completed") {
    return <CheckCircle2 className="size-4 text-accent" />;
  }

  if (status === "failed") {
    return <XCircle className="size-4 text-destructive" />;
  }

  if (status === "running") {
    return <Loader2 className="size-4 animate-spin text-primary" />;
  }

  return <Circle className="size-4 text-muted-foreground" />;
}

function getStatusText(status: "queued" | "running" | "completed" | "failed") {
  if (status === "queued") {
    return "Queued and waiting for the workflow runner.";
  }

  if (status === "running") {
    return "LaunchBeacon is working. This page updates automatically.";
  }

  if (status === "completed") {
    return "Complete.";
  }

  return "The workflow failed before it finished.";
}
