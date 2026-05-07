import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError, AuthService } from "@/server/services/auth-service";
import { getContentGenerationState } from "@/server/content/generation-state";

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

const RECENT_WINDOW_MS = 10 * 60 * 1000;

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    await new AuthService(supabase).requireUser();
    const [crawlJobs, briefJobs, contentAssets] = await Promise.all([
      supabase
        .from("crawl_jobs")
        .select("id,status,progress_percent,steps,error_message,updated_at,completed_at,products(name)")
        .order("updated_at", { ascending: false })
        .limit(8),
      supabase
        .from("brief_generation_jobs")
        .select("id,status,progress_percent,steps,error_message,updated_at,completed_at,products(name)")
        .order("updated_at", { ascending: false })
        .limit(8),
      supabase
        .from("content_assets")
        .select("id,title,provenance,updated_at,products(name)")
        .order("updated_at", { ascending: false })
        .limit(12),
    ]);

    const notifications: WorkflowNotification[] = [
      ...mapWorkflowRows({
        rows: crawlJobs.data ?? [],
        kind: "crawl",
        titleForStatus: {
          queued: "Product crawl queued",
          running: "Crawling product site",
          completed: "Product crawl complete",
          failed: "Product crawl failed",
        },
        href: "/marketing-brief",
      }),
      ...mapWorkflowRows({
        rows: briefJobs.data ?? [],
        kind: "brief",
        titleForStatus: {
          queued: "Brief generation queued",
          running: "Generating Marketing Brief",
          completed: "Marketing Brief ready",
          failed: "Brief generation failed",
        },
        href: "/marketing-brief",
      }),
      ...mapArticleRows(contentAssets.data ?? []),
    ]
      .filter(shouldShowNotification)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, 4);

    return NextResponse.json({ notifications });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ notifications: [] }, { status: 401 });
    }

    return NextResponse.json({ notifications: [] }, { status: 200 });
  }
}

function mapWorkflowRows(input: {
  rows: Array<Record<string, unknown>>;
  kind: "crawl" | "brief";
  titleForStatus: Record<WorkflowNotification["status"], string>;
  href: string;
}): WorkflowNotification[] {
  const mapped: Array<WorkflowNotification | null> = input.rows
    .map((row) => {
      const status = parseStatus(row.status);
      if (!status) {
        return null;
      }

      const productName = getProductName(row.products);
      const stepLabel = getStepLabel(row.steps);
      const notification: WorkflowNotification = {
        id: `${input.kind}:${row.id}`,
        kind: input.kind,
        status,
        title: input.titleForStatus[status],
        detail:
          status === "failed"
            ? getErrorMessage(row.error_message)
            : productName
              ? `${productName}${stepLabel ? ` · ${stepLabel}` : ""}`
              : stepLabel ?? "Workflow state updated",
        href: input.href,
        progressPercent: typeof row.progress_percent === "number" ? row.progress_percent : null,
        stepLabel,
        updatedAt: String(row.updated_at ?? new Date().toISOString()),
      };
      return notification;
    });

  return mapped.filter((item): item is WorkflowNotification => item !== null);
}

function mapArticleRows(rows: Array<Record<string, unknown>>): WorkflowNotification[] {
  const mapped: Array<WorkflowNotification | null> = rows
    .map((row) => {
      const provenance = row.provenance && typeof row.provenance === "object" && !Array.isArray(row.provenance)
        ? (row.provenance as Record<string, unknown>)
        : {};
      const generation = getContentGenerationState(provenance);
      if (!generation) {
        return null;
      }

      const title = typeof row.title === "string" && row.title.trim() ? row.title : "Article draft";
      const notification: WorkflowNotification = {
        id: `article:${row.id}:${generation.updatedAt}`,
        kind: "article",
        status: generation.status,
        title: toArticleTitle(generation.status),
        detail:
          generation.status === "failed"
            ? generation.errorMessage ?? "Article generation failed."
            : title,
        href: `/content/${row.id}`,
        progressPercent: generation.progressPercent,
        stepLabel: getStepLabel(generation.steps),
        updatedAt: generation.updatedAt || String(row.updated_at ?? new Date().toISOString()),
      };
      return notification;
    });

  return mapped.filter((item): item is WorkflowNotification => item !== null);
}

function shouldShowNotification(item: WorkflowNotification) {
  if (item.status === "queued" || item.status === "running") {
    return true;
  }

  return Date.now() - Date.parse(item.updatedAt) < RECENT_WINDOW_MS;
}

function parseStatus(value: unknown): WorkflowNotification["status"] | null {
  if (value === "queued" || value === "running" || value === "completed" || value === "failed") {
    return value;
  }

  return null;
}

function getProductName(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0]?.name === "string" ? value[0].name : null;
  }

  return value && typeof value === "object" && "name" in value && typeof value.name === "string"
    ? value.name
    : null;
}

function getStepLabel(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const active = value.find((step) =>
    step &&
    typeof step === "object" &&
    "status" in step &&
    (step.status === "running" || step.status === "pending")
  );
  return active && typeof active === "object" && "label" in active && typeof active.label === "string"
    ? active.label
    : null;
}

function getErrorMessage(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value
    : "This usually resolves on retry.";
}

function toArticleTitle(status: WorkflowNotification["status"]) {
  if (status === "queued") {
    return "Article generation queued";
  }

  if (status === "running") {
    return "Generating article draft";
  }

  if (status === "completed") {
    return "Article draft is ready";
  }

  return "Article generation failed";
}
