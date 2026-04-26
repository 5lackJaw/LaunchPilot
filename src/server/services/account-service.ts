import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AuthRequiredError, AuthService } from "@/server/services/auth-service";

type TableRows = Record<string, unknown>[];

export type AccountOverview = {
  user: {
    id: string;
    email: string | null;
    planTier: string;
    createdAt: string | null;
    stripeCustomerConfigured: boolean;
  };
  productCount: number;
  connectionCount: number;
};

export type AccountExport = AccountOverview & {
  exportedAt: string;
  data: {
    products: TableRows;
    marketingBriefs: TableRows;
    crawlJobs: TableRows;
    crawlResults: TableRows;
    interviewAnswers: TableRows;
    contentAssets: TableRows;
    inboxItems: TableRows;
    inboxItemEvents: TableRows;
    communityThreads: TableRows;
    outreachContacts: TableRows;
    directorySubmissions: TableRows;
    automationPreferences: TableRows;
    keywordRankSnapshots: TableRows;
    trafficSnapshots: TableRows;
    weeklyBriefs: TableRows;
    externalConnections: Array<Record<string, unknown> & { credentialsConfigured: boolean }>;
  };
};

export class AccountService {
  constructor(private readonly supabase: SupabaseClient) {}

  async getOverview(): Promise<AccountOverview> {
    const user = await new AuthService(this.supabase).requireUser();
    const [profile, products, connections] = await Promise.all([
      this.loadProfile(user),
      this.supabase.from("products").select("id", { count: "exact", head: true }),
      this.supabase.from("external_connections").select("id", { count: "exact", head: true }),
    ]);

    if (products.error) {
      throw new AccountReadError(products.error.message);
    }

    if (connections.error) {
      throw new AccountReadError(connections.error.message);
    }

    return {
      user: profile,
      productCount: products.count ?? 0,
      connectionCount: connections.count ?? 0,
    };
  }

  async buildExport(): Promise<AccountExport> {
    const user = await new AuthService(this.supabase).requireUser();
    const admin = createSupabaseAdminClient();
    const overview = await this.getOverview();
    const products = await selectUserRows(admin, "products", "user_id", user.id);
    const productIds = products.map((product) => String(product.id)).filter(Boolean);

    const [
      marketingBriefs,
      crawlJobs,
      crawlResults,
      interviewAnswers,
      contentAssets,
      inboxItems,
      communityThreads,
      outreachContacts,
      directorySubmissions,
      automationPreferences,
      keywordRankSnapshots,
      trafficSnapshots,
      weeklyBriefs,
      externalConnections,
    ] = await Promise.all([
      selectProductRows(admin, "marketing_briefs", productIds),
      selectProductRows(admin, "crawl_jobs", productIds),
      selectProductRows(admin, "crawl_results", productIds),
      selectProductRows(admin, "interview_answers", productIds),
      selectProductRows(admin, "content_assets", productIds),
      selectProductRows(admin, "inbox_items", productIds),
      selectProductRows(admin, "community_threads", productIds),
      selectProductRows(admin, "outreach_contacts", productIds),
      selectProductRows(admin, "directory_submissions", productIds),
      selectProductRows(admin, "automation_preferences", productIds),
      selectProductRows(admin, "keyword_rank_snapshots", productIds),
      selectProductRows(admin, "traffic_snapshots", productIds),
      selectProductRows(admin, "weekly_briefs", productIds),
      selectUserRows(admin, "external_connections", "user_id", user.id),
    ]);

    const inboxItemEvents = await selectProductRows(admin, "inbox_item_events", productIds);

    return {
      ...overview,
      exportedAt: new Date().toISOString(),
      data: {
        products,
        marketingBriefs,
        crawlJobs,
        crawlResults,
        interviewAnswers,
        contentAssets,
        inboxItems,
        inboxItemEvents,
        communityThreads,
        outreachContacts,
        directorySubmissions,
        automationPreferences,
        keywordRankSnapshots,
        trafficSnapshots,
        weeklyBriefs,
        externalConnections: sanitizeConnections(externalConnections),
      },
    };
  }

  async deleteAccount(input: { confirmation: string }) {
    if (input.confirmation !== "DELETE") {
      throw new AccountDeletionError("Type DELETE to confirm account deletion.");
    }

    const user = await new AuthService(this.supabase).requireUser();
    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);

    if (error) {
      throw new AccountDeletionError(error.message);
    }

    await this.supabase.auth.signOut({ scope: "global" });
  }

  private async loadProfile(user: User): Promise<AccountOverview["user"]> {
    const { data, error } = await this.supabase
      .from("users")
      .select("id,email,plan_tier,stripe_customer_id,created_at")
      .eq("id", user.id)
      .single();

    if (error) {
      throw new AccountReadError(error.message);
    }

    return {
      id: data.id,
      email: data.email ?? user.email ?? null,
      planTier: data.plan_tier,
      createdAt: data.created_at,
      stripeCustomerConfigured: Boolean(data.stripe_customer_id),
    };
  }
}

async function selectProductRows(
  supabase: SupabaseClient,
  table: string,
  productIds: string[],
): Promise<TableRows> {
  if (!productIds.length) {
    return [];
  }

  const { data, error } = await supabase.from(table).select("*").in("product_id", productIds);

  if (error) {
    throw new AccountReadError(error.message);
  }

  return (data ?? []) as TableRows;
}

async function selectUserRows(
  supabase: SupabaseClient,
  table: string,
  column: string,
  userId: string,
): Promise<TableRows> {
  const { data, error } = await supabase.from(table).select("*").eq(column, userId);

  if (error) {
    throw new AccountReadError(error.message);
  }

  return (data ?? []) as TableRows;
}

function sanitizeConnections(connections: TableRows) {
  return connections.map((connection) => {
    const { credentials_encrypted: credentialsEncrypted, ...safeConnection } = connection;

    return {
      ...safeConnection,
      credentialsConfigured: Boolean(credentialsEncrypted),
    };
  });
}

export class AccountReadError extends Error {
  constructor(message = "Account data could not be loaded.") {
    super(message);
    this.name = "AccountReadError";
  }
}

export class AccountDeletionError extends Error {
  constructor(message = "Account could not be deleted.") {
    super(message);
    this.name = "AccountDeletionError";
  }
}

export function accountErrorMessage(error: unknown) {
  if (error instanceof AuthRequiredError || error instanceof AccountReadError || error instanceof AccountDeletionError) {
    return error.message;
  }

  if (error instanceof Error && error.message.includes("Supabase URL and secret key")) {
    return "Supabase secret key is not configured. Add SUPABASE_SECRET_KEY in .env.local before exporting or deleting account data.";
  }

  if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
    return "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.";
  }

  return null;
}
