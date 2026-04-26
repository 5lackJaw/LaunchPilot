import type { SupabaseClient } from "@supabase/supabase-js";
import { AuthService } from "@/server/services/auth-service";

type PlanTier = "free" | "launch" | "growth";

type PlanLimits = {
  products: number;
  monthlyCrawls: number;
  monthlyGeneratedActions: number;
  monthlyExecutions: number;
};

const provisionalPlanLimits: Record<PlanTier, PlanLimits> = {
  free: {
    products: 1,
    monthlyCrawls: 5,
    monthlyGeneratedActions: 20,
    monthlyExecutions: 10,
  },
  launch: {
    products: 3,
    monthlyCrawls: 30,
    monthlyGeneratedActions: 200,
    monthlyExecutions: 100,
  },
  growth: {
    products: 10,
    monthlyCrawls: 150,
    monthlyGeneratedActions: 1000,
    monthlyExecutions: 500,
  },
};

export class PlanService {
  constructor(private readonly supabase: SupabaseClient) {}

  async assertCanCreateProduct(): Promise<void> {
    const plan = await this.getCurrentPlan();
    const { count, error } = await this.supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("user_id", plan.userId);

    if (error) {
      throw new PlanLimitError(error.message);
    }

    this.assertUnderLimit({
      label: "products",
      current: count ?? 0,
      increment: 1,
      limit: plan.limits.products,
      tier: plan.tier,
    });
  }

  async assertCanStartCrawl(input: { productId: string }): Promise<void> {
    const plan = await this.getCurrentPlan();
    await this.assertProductBelongsToCurrentUser(input.productId, plan.userId);
    const monthStart = getCurrentMonthStart();

    const { count, error } = await this.supabase
      .from("crawl_jobs")
      .select("id", { count: "exact", head: true })
      .eq("product_id", input.productId)
      .gte("created_at", monthStart);

    if (error) {
      throw new PlanLimitError(error.message);
    }

    this.assertUnderLimit({
      label: "monthly crawls",
      current: count ?? 0,
      increment: 1,
      limit: plan.limits.monthlyCrawls,
      tier: plan.tier,
    });
  }

  async assertCanUseGeneratedAction(input: {
    productId: string;
    actionLabel: string;
    increment?: number;
  }): Promise<void> {
    const plan = await this.getCurrentPlan();
    await this.assertProductBelongsToCurrentUser(input.productId, plan.userId);
    const current = await this.countGeneratedActions(input.productId);

    this.assertUnderLimit({
      label: "monthly generated actions",
      current,
      increment: input.increment ?? 1,
      limit: plan.limits.monthlyGeneratedActions,
      tier: plan.tier,
      actionLabel: input.actionLabel,
    });
  }

  async assertCanExecuteAction(input: {
    productId: string;
    actionLabel: string;
    increment?: number;
  }): Promise<void> {
    const plan = await this.getCurrentPlan();
    await this.assertProductBelongsToCurrentUser(input.productId, plan.userId);
    const current = await this.countExecutedActions(input.productId);

    this.assertUnderLimit({
      label: "monthly executions",
      current,
      increment: input.increment ?? 1,
      limit: plan.limits.monthlyExecutions,
      tier: plan.tier,
      actionLabel: input.actionLabel,
    });
  }

  private async getCurrentPlan(): Promise<{
    userId: string;
    tier: PlanTier;
    limits: PlanLimits;
  }> {
    const user = await new AuthService(this.supabase).requireUser();
    const { data, error } = await this.supabase
      .from("users")
      .select("plan_tier")
      .eq("id", user.id)
      .single();

    if (error) {
      throw new PlanLimitError(error.message);
    }

    const tier = parsePlanTier(data.plan_tier);
    return {
      userId: user.id,
      tier,
      limits: provisionalPlanLimits[tier],
    };
  }

  private async assertProductBelongsToCurrentUser(
    productId: string,
    userId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("user_id", userId)
      .single();

    if (error) {
      throw new PlanLimitError(error.message);
    }
  }

  private async countGeneratedActions(productId: string): Promise<number> {
    const monthStart = getCurrentMonthStart();
    const [content, community, directories, outreach, weekly] =
      await Promise.all([
        this.countRows("content_assets", productId, monthStart),
        this.countRows("community_threads", productId, monthStart),
        this.countRows("directory_submissions", productId, monthStart),
        this.countRows("outreach_contacts", productId, monthStart),
        this.countRows("weekly_briefs", productId, monthStart),
      ]);

    return content + community + directories + outreach + weekly;
  }

  private async countExecutedActions(productId: string): Promise<number> {
    const monthStart = getCurrentMonthStart();
    const [
      publishedContent,
      postedReplies,
      submittedDirectories,
      sentOutreach,
    ] = await Promise.all([
      this.countRows("content_assets", productId, monthStart, "updated_at", {
        column: "status",
        values: ["published"],
      }),
      this.countRows("community_threads", productId, monthStart, "posted_at", {
        column: "status",
        values: ["posted"],
      }),
      this.countRows(
        "directory_submissions",
        productId,
        monthStart,
        "submitted_at",
        {
          column: "status",
          values: ["submitted", "live"],
        },
      ),
      this.countRows(
        "outreach_contacts",
        productId,
        monthStart,
        "last_contact_at",
        {
          column: "status",
          values: ["sent", "opened", "replied", "converted"],
        },
      ),
    ]);

    return (
      publishedContent + postedReplies + submittedDirectories + sentOutreach
    );
  }

  private async countRows(
    table: string,
    productId: string,
    since: string,
    timestampColumn = "created_at",
    statusFilter?: { column: string; values: string[] },
  ): Promise<number> {
    let query = this.supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId)
      .gte(timestampColumn, since);

    if (statusFilter) {
      query = query.in(statusFilter.column, statusFilter.values);
    }

    const { count, error } = await query;

    if (error) {
      throw new PlanLimitError(error.message);
    }

    return count ?? 0;
  }

  private assertUnderLimit(input: {
    label: string;
    current: number;
    increment: number;
    limit: number;
    tier: PlanTier;
    actionLabel?: string;
  }) {
    if (input.current + input.increment <= input.limit) {
      return;
    }

    const actionText = input.actionLabel ? ` for ${input.actionLabel}` : "";
    throw new PlanLimitError(
      `The ${input.tier} plan allows ${input.limit} ${input.label}${actionText}. Current usage is ${input.current}.`,
    );
  }
}

export class PlanLimitError extends Error {
  constructor(message: string) {
    super(`Plan limit reached: ${message}`);
    this.name = "PlanLimitError";
  }
}

function parsePlanTier(value: unknown): PlanTier {
  if (value === "launch" || value === "growth") {
    return value;
  }

  return "free";
}

function getCurrentMonthStart() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}
