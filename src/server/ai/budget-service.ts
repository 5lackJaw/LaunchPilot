import type { SupabaseClient } from "@supabase/supabase-js";
import { AiBudgetExceededError } from "@/server/ai/errors";
import type { AiProvider, AiTaskClass } from "@/server/ai/types";

type PlanTier = "free" | "launch" | "growth";

type AiBudget = {
  softBudgetUsd: number;
  hardBudgetUsd: number;
};

type ProductOwner = {
  userId: string;
  planTier: PlanTier;
};

type Ledger = {
  id: string;
  usedEstimatedUsd: number;
  usedActualUsd: number;
  softBudgetUsd: number;
  hardBudgetUsd: number;
};

const aiBudgetsByPlan: Record<PlanTier, AiBudget> = {
  free: {
    softBudgetUsd: 0.75,
    hardBudgetUsd: 1,
  },
  launch: {
    softBudgetUsd: 8,
    hardBudgetUsd: 12,
  },
  growth: {
    softBudgetUsd: 30,
    hardBudgetUsd: 45,
  },
};

export class AiBudgetService {
  constructor(private readonly supabase: SupabaseClient) {}

  async prepareUsage(input: {
    productId: string;
    userId?: string;
    taskClass: AiTaskClass;
    estimatedCostUsd: number;
  }): Promise<{ userId: string; ledger: Ledger }> {
    const owner = input.userId
      ? await this.loadPlanForUser(input.userId)
      : await this.loadProductOwner(input.productId);
    const ledger = await this.getOrCreateLedger({
      userId: owner.userId,
      productId: input.productId,
      planTier: owner.planTier,
    });

    if (ledger.usedEstimatedUsd + input.estimatedCostUsd > ledger.hardBudgetUsd) {
      throw new AiBudgetExceededError({
        taskClass: input.taskClass,
        hardBudgetUsd: ledger.hardBudgetUsd,
        usedUsd: ledger.usedEstimatedUsd,
        estimatedCostUsd: input.estimatedCostUsd,
      });
    }

    return { userId: owner.userId, ledger };
  }

  async recordUsage(input: {
    userId: string;
    productId: string;
    taskClass: AiTaskClass;
    provider: AiProvider;
    model: string;
    inputTokens: number | null;
    outputTokens: number | null;
    cachedInputTokens: number | null;
    estimatedCostUsd: number;
    actualCostUsd: number;
    status: "succeeded" | "failed" | "blocked";
    metadata?: Record<string, unknown>;
  }): Promise<string | null> {
    const { data, error } = await this.supabase
      .from("ai_usage_events")
      .insert({
        user_id: input.userId,
        product_id: input.productId,
        task_class: input.taskClass,
        provider: input.provider,
        model: input.model,
        input_tokens: input.inputTokens,
        output_tokens: input.outputTokens,
        cached_input_tokens: input.cachedInputTokens,
        estimated_cost_usd: input.estimatedCostUsd,
        actual_cost_usd: input.actualCostUsd,
        status: input.status,
        metadata: input.metadata ?? {},
      })
      .select("id")
      .single();

    if (error) {
      return null;
    }

    if (input.status === "succeeded") {
      await this.incrementLedgerUsage({
        userId: input.userId,
        productId: input.productId,
        estimatedCostUsd: input.estimatedCostUsd,
        actualCostUsd: input.actualCostUsd,
      });
    }

    return data.id as string;
  }

  private async loadProductOwner(productId: string): Promise<ProductOwner> {
    const { data, error } = await this.supabase
      .from("products")
      .select("user_id")
      .eq("id", productId)
      .single();

    if (error) {
      throw error;
    }

    return this.loadPlanForUser(data.user_id as string);
  }

  private async loadPlanForUser(userId: string): Promise<ProductOwner> {
    const { data, error } = await this.supabase
      .from("users")
      .select("plan_tier")
      .eq("id", userId)
      .single();

    if (error) {
      throw error;
    }

    return {
      userId,
      planTier: parsePlanTier(data.plan_tier),
    };
  }

  private async getOrCreateLedger(input: {
    userId: string;
    productId: string;
    planTier: PlanTier;
  }): Promise<Ledger> {
    const period = getCurrentBillingPeriod();
    const budget = aiBudgetsByPlan[input.planTier];
    const existing = await this.supabase
      .from("ai_budget_ledger")
      .select(
        "id,used_estimated_usd,used_actual_usd,soft_budget_usd,hard_budget_usd",
      )
      .eq("user_id", input.userId)
      .eq("product_id", input.productId)
      .eq("billing_period_start", period.start)
      .maybeSingle();

    if (existing.error) {
      throw existing.error;
    }

    if (existing.data) {
      return mapLedger(existing.data);
    }

    const { data, error } = await this.supabase
      .from("ai_budget_ledger")
      .insert({
        user_id: input.userId,
        product_id: input.productId,
        billing_period_start: period.start,
        billing_period_end: period.end,
        plan_tier: input.planTier,
        soft_budget_usd: budget.softBudgetUsd,
        hard_budget_usd: budget.hardBudgetUsd,
      })
      .select(
        "id,used_estimated_usd,used_actual_usd,soft_budget_usd,hard_budget_usd",
      )
      .single();

    if (error) {
      throw error;
    }

    return mapLedger(data);
  }

  private async incrementLedgerUsage(input: {
    userId: string;
    productId: string;
    estimatedCostUsd: number;
    actualCostUsd: number;
  }): Promise<void> {
    const period = getCurrentBillingPeriod();
    const { data, error } = await this.supabase
      .from("ai_budget_ledger")
      .select("used_estimated_usd,used_actual_usd")
      .eq("user_id", input.userId)
      .eq("product_id", input.productId)
      .eq("billing_period_start", period.start)
      .single();

    if (error) {
      return;
    }

    await this.supabase
      .from("ai_budget_ledger")
      .update({
        used_estimated_usd:
          parseMoney(data.used_estimated_usd) + input.estimatedCostUsd,
        used_actual_usd: parseMoney(data.used_actual_usd) + input.actualCostUsd,
      })
      .eq("user_id", input.userId)
      .eq("product_id", input.productId)
      .eq("billing_period_start", period.start);
  }
}

function mapLedger(data: {
  id: unknown;
  used_estimated_usd: unknown;
  used_actual_usd: unknown;
  soft_budget_usd: unknown;
  hard_budget_usd: unknown;
}): Ledger {
  return {
    id: data.id as string,
    usedEstimatedUsd: parseMoney(data.used_estimated_usd),
    usedActualUsd: parseMoney(data.used_actual_usd),
    softBudgetUsd: parseMoney(data.soft_budget_usd),
    hardBudgetUsd: parseMoney(data.hard_budget_usd),
  };
}

function parsePlanTier(value: unknown): PlanTier {
  if (value === "launch" || value === "growth") {
    return value;
  }

  return "free";
}

function parseMoney(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function getCurrentBillingPeriod(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}
