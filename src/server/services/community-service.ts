import type { SupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client";
import {
  communityThreadSchema,
  listCommunityThreadsSchema,
  postCommunityReplySchema,
  requestCommunityReplyGenerationSchema,
  requestCommunityThreadIngestionSchema,
} from "@/server/schemas/community";
import type { CommunityThread } from "@/server/schemas/community";
import { ProductService } from "@/server/services/product-service";

const communityThreadSelect =
  "id,product_id,platform,thread_url,thread_title,thread_author_handle,relevance_score,pain_signal_score,audience_fit_score,recency_score,reply_draft,promotional_score,status,posted_at,provenance,created_at,updated_at";

export class CommunityService {
  constructor(private readonly supabase: SupabaseClient) {}

  async listThreads(input: unknown): Promise<CommunityThread[]> {
    const parsed = listCommunityThreadsSchema.parse(input);
    await new ProductService(this.supabase).getProduct({ productId: parsed.productId });

    let query = this.supabase
      .from("community_threads")
      .select(communityThreadSelect)
      .eq("product_id", parsed.productId)
      .order("relevance_score", { ascending: false })
      .order("created_at", { ascending: false });

    if (parsed.status) {
      query = query.eq("status", parsed.status);
    }

    const { data, error } = await query;

    if (error) {
      throw new CommunityThreadReadError(error.message);
    }

    return data.map(mapCommunityThread);
  }

  async requestThreadIngestion(input: unknown) {
    const parsed = requestCommunityThreadIngestionSchema.parse(input);
    await new ProductService(this.supabase).getProduct({ productId: parsed.productId });

    await inngest.send({
      name: "community_threads/ingestion.requested",
      data: {
        productId: parsed.productId,
      },
    });
  }

  async requestReplyGeneration(input: unknown) {
    const parsed = requestCommunityReplyGenerationSchema.parse(input);
    const thread = await this.getThread({ threadId: parsed.threadId });
    await new ProductService(this.supabase).getProduct({ productId: thread.productId });

    if (!["observed", "drafted", "failed"].includes(thread.status)) {
      throw new CommunityReplyGenerationRequestError("Only observed, drafted, or failed threads can request reply generation.");
    }

    await inngest.send({
      name: "community_reply/generation.requested",
      data: {
        threadId: thread.id,
        productId: thread.productId,
      },
    });
  }

  async postApprovedReply(input: unknown): Promise<CommunityThread> {
    const parsed = postCommunityReplySchema.parse(input);
    const thread = await this.getThread({ threadId: parsed.threadId });
    await new ProductService(this.supabase).getProduct({ productId: thread.productId });

    if (thread.status !== "pending_review" && thread.status !== "approved") {
      throw new CommunityReplyPostError("Only reviewed community reply drafts can be posted.");
    }

    if (!thread.replyDraft?.trim()) {
      throw new CommunityReplyPostError("A reply draft is required before posting.");
    }

    if ((thread.promotionalScore ?? 1) > 0.45) {
      throw new CommunityReplyPostError("Reply promotional risk is too high to post.");
    }

    const postedAt = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("community_threads")
      .update({
        status: "posted",
        posted_at: postedAt,
        provenance: {
          ...thread.provenance,
          posting: {
            adapter: "community-posting-simulated-v0",
            postedAt,
            platform: thread.platform,
          },
        },
      })
      .eq("id", thread.id)
      .select(communityThreadSelect)
      .single();

    if (error) {
      throw new CommunityReplyPostError(error.message);
    }

    return mapCommunityThread(data);
  }

  private async getThread(input: { threadId: string }): Promise<CommunityThread> {
    const { data, error } = await this.supabase
      .from("community_threads")
      .select(communityThreadSelect)
      .eq("id", input.threadId)
      .single();

    if (error) {
      throw new CommunityThreadReadError(error.message);
    }

    return mapCommunityThread(data);
  }
}

export class CommunityThreadReadError extends Error {
  constructor(message: string) {
    super(`Community threads could not be loaded: ${message}`);
    this.name = "CommunityThreadReadError";
  }
}

export class CommunityThreadIngestionRequestError extends Error {
  constructor(message: string) {
    super(`Community thread ingestion could not be requested: ${message}`);
    this.name = "CommunityThreadIngestionRequestError";
  }
}

export class CommunityReplyGenerationRequestError extends Error {
  constructor(message: string) {
    super(`Community reply generation could not be requested: ${message}`);
    this.name = "CommunityReplyGenerationRequestError";
  }
}

export class CommunityReplyPostError extends Error {
  constructor(message: string) {
    super(`Community reply could not be posted: ${message}`);
    this.name = "CommunityReplyPostError";
  }
}

function mapCommunityThread(data: {
  id: string;
  product_id: string;
  platform: string;
  thread_url: string;
  thread_title: string;
  thread_author_handle: string | null;
  relevance_score: number | string;
  pain_signal_score: number | string;
  audience_fit_score: number | string;
  recency_score: number | string;
  reply_draft: string | null;
  promotional_score: number | string | null;
  status: string;
  posted_at: string | null;
  provenance: unknown;
  created_at: string;
  updated_at: string;
}) {
  return communityThreadSchema.parse({
    id: data.id,
    productId: data.product_id,
    platform: data.platform,
    threadUrl: data.thread_url,
    threadTitle: data.thread_title,
    threadAuthorHandle: data.thread_author_handle,
    relevanceScore: Number(data.relevance_score),
    painSignalScore: Number(data.pain_signal_score),
    audienceFitScore: Number(data.audience_fit_score),
    recencyScore: Number(data.recency_score),
    replyDraft: data.reply_draft,
    promotionalScore: data.promotional_score === null ? null : Number(data.promotional_score),
    status: data.status,
    postedAt: data.posted_at,
    provenance: data.provenance,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}
