import type { SupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client";
import { AuthService } from "@/server/services/auth-service";
import { crawlJobSchema } from "@/server/schemas/crawl";
import { productIdSchema } from "@/server/schemas/product";

const initialSteps = [
  { label: "Fetch product URL", status: "pending" },
  { label: "Extract page signals", status: "pending" },
  { label: "Prepare brief inputs", status: "pending" },
] as const;

export class CrawlService {
  constructor(private readonly supabase: SupabaseClient) {}

  async startCrawl(input: unknown) {
    const { productId } = productIdSchema.parse(input);
    await new AuthService(this.supabase).requireUser();

    const { data, error } = await this.supabase
      .from("crawl_jobs")
      .insert({
        product_id: productId,
        status: "queued",
        progress_percent: 0,
        steps: initialSteps,
      })
      .select("id,product_id,status,progress_percent,steps,error_message,created_at,updated_at,completed_at")
      .single();

    if (error) {
      throw new CrawlStartError(error.message);
    }

    const job = mapCrawlJob(data);

    try {
      await inngest.send({
        name: "product/crawl.requested",
        data: {
          productId: job.productId,
          crawlJobId: job.id,
        },
      });
    } catch (error) {
      await this.supabase
        .from("crawl_jobs")
        .update({
          status: "failed",
          progress_percent: 0,
          error_message: "Workflow event dispatch failed.",
        })
        .eq("id", job.id);

      throw error;
    }

    return job;
  }

  async getLatestCrawlJob(input: unknown) {
    const { productId } = productIdSchema.parse(input);
    await new AuthService(this.supabase).requireUser();

    const { data, error } = await this.supabase
      .from("crawl_jobs")
      .select("id,product_id,status,progress_percent,steps,error_message,created_at,updated_at,completed_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new CrawlReadError(error.message);
    }

    return data ? mapCrawlJob(data) : null;
  }
}

export class CrawlStartError extends Error {
  constructor(message: string) {
    super(`Crawl could not be started: ${message}`);
    this.name = "CrawlStartError";
  }
}

export class CrawlReadError extends Error {
  constructor(message: string) {
    super(`Crawl status could not be loaded: ${message}`);
    this.name = "CrawlReadError";
  }
}

function mapCrawlJob(data: {
  id: string;
  product_id: string;
  status: string;
  progress_percent: number;
  steps: unknown;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}) {
  return crawlJobSchema.parse({
    id: data.id,
    productId: data.product_id,
    status: data.status,
    progressPercent: data.progress_percent,
    steps: data.steps,
    errorMessage: data.error_message,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    completedAt: data.completed_at,
  });
}
