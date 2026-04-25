import type { SupabaseClient } from "@supabase/supabase-js";
import {
  batchApproveInboxItemsSchema,
  createInboxItemSchema,
  inboxItemEventSchema,
  inboxItemSchema,
  listInboxItemsSchema,
  reviewInboxItemSchema,
} from "@/server/schemas/inbox";
import type { InboxItem, InboxItemEvent } from "@/server/schemas/inbox";
import { AuthService } from "@/server/services/auth-service";
import { ProductService } from "@/server/services/product-service";

const inboxItemSelect =
  "id,product_id,item_type,source_entity_type,source_entity_id,payload,status,ai_confidence,impact_estimate,review_time_estimate_seconds,created_at,updated_at,reviewed_at";
const inboxEventSelect = "id,inbox_item_id,product_id,actor_user_id,event_type,reason,metadata,created_at";

export class InboxService {
  constructor(private readonly supabase: SupabaseClient) {}

  async createItem(input: unknown): Promise<InboxItem> {
    const parsed = createInboxItemSchema.parse(input);
    await new ProductService(this.supabase).getProduct({ productId: parsed.productId });

    const { data, error } = await this.supabase
      .from("inbox_items")
      .insert({
        product_id: parsed.productId,
        item_type: parsed.itemType,
        source_entity_type: parsed.sourceEntityType ?? null,
        source_entity_id: parsed.sourceEntityId ?? null,
        payload: parsed.payload,
        ai_confidence: parsed.aiConfidence ?? null,
        impact_estimate: parsed.impactEstimate,
        review_time_estimate_seconds: parsed.reviewTimeEstimateSeconds ?? null,
      })
      .select(inboxItemSelect)
      .single();

    if (error) {
      throw new InboxItemCreateError(error.message);
    }

    const item = mapInboxItem(data);
    await this.recordEvent({
      inboxItemId: item.id,
      productId: item.productId,
      eventType: "created",
      metadata: { sourceEntityType: item.sourceEntityType, sourceEntityId: item.sourceEntityId },
    });

    return item;
  }

  async listItems(input: unknown): Promise<InboxItem[]> {
    const parsed = listInboxItemsSchema.parse(input);
    await new ProductService(this.supabase).getProduct({ productId: parsed.productId });

    let query = this.supabase
      .from("inbox_items")
      .select(inboxItemSelect)
      .eq("product_id", parsed.productId)
      .order("created_at", { ascending: false });

    if (parsed.status) {
      query = query.eq("status", parsed.status);
    }

    const { data, error } = await query;

    if (error) {
      throw new InboxItemReadError(error.message);
    }

    return data.map(mapInboxItem);
  }

  async getItem(input: unknown): Promise<InboxItem> {
    const parsed = reviewInboxItemSchema.pick({ inboxItemId: true }).parse(input);
    await new AuthService(this.supabase).requireUser();

    const { data, error } = await this.supabase.from("inbox_items").select(inboxItemSelect).eq("id", parsed.inboxItemId).single();

    if (error) {
      throw new InboxItemReadError(error.message);
    }

    return mapInboxItem(data);
  }

  async reviewItem(input: unknown): Promise<InboxItem> {
    const parsed = reviewInboxItemSchema.parse(input);
    const user = await new AuthService(this.supabase).requireUser();
    const current = await this.getItem({ inboxItemId: parsed.inboxItemId });

    if (current.status !== "pending") {
      throw new InboxItemReviewError("Only pending inbox items can be reviewed.");
    }

    const { data, error } = await this.supabase
      .from("inbox_items")
      .update({
        status: parsed.status,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", parsed.inboxItemId)
      .eq("status", "pending")
      .select(inboxItemSelect)
      .single();

    if (error) {
      throw new InboxItemReviewError(error.message);
    }

    const item = mapInboxItem(data);
    await this.recordEvent({
      inboxItemId: item.id,
      productId: item.productId,
      actorUserId: user.id,
      eventType: parsed.status,
      reason: parsed.reason,
      metadata: { previousStatus: current.status },
    });

    return item;
  }

  async batchApproveSupported(input: unknown): Promise<InboxItem[]> {
    const parsed = batchApproveInboxItemsSchema.parse(input);
    const uniqueIds = Array.from(new Set(parsed.inboxItemIds));
    const items = await Promise.all(uniqueIds.map((inboxItemId) => this.getItem({ inboxItemId })));
    const eligibleItems = items.filter(isBatchApprovalEligible);

    if (!eligibleItems.length) {
      throw new InboxItemReviewError("No selected inbox items are eligible for batch approval.");
    }

    const approvedItems: InboxItem[] = [];

    for (const item of eligibleItems) {
      const approved = await this.reviewItem({
        inboxItemId: item.id,
        status: "approved",
        reason: "Batch approved as high-confidence item.",
      });
      approvedItems.push(approved);
    }

    return approvedItems;
  }

  async listEvents(input: unknown): Promise<InboxItemEvent[]> {
    const parsed = reviewInboxItemSchema.pick({ inboxItemId: true }).parse(input);
    const item = await this.getItem({ inboxItemId: parsed.inboxItemId });

    const { data, error } = await this.supabase
      .from("inbox_item_events")
      .select(inboxEventSelect)
      .eq("inbox_item_id", item.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new InboxEventReadError(error.message);
    }

    return data.map(mapInboxEvent);
  }

  private async recordEvent(input: {
    inboxItemId: string;
    productId: string;
    actorUserId?: string;
    eventType: "created" | "approved" | "rejected" | "skipped" | "auto_executed" | "failed";
    reason?: string;
    metadata?: Record<string, unknown>;
  }) {
    const { error } = await this.supabase.from("inbox_item_events").insert({
      inbox_item_id: input.inboxItemId,
      product_id: input.productId,
      actor_user_id: input.actorUserId ?? null,
      event_type: input.eventType,
      reason: input.reason ?? null,
      metadata: input.metadata ?? {},
    });

    if (error) {
      throw new InboxEventCreateError(error.message);
    }
  }
}

export class InboxItemCreateError extends Error {
  constructor(message: string) {
    super(`Inbox item could not be created: ${message}`);
    this.name = "InboxItemCreateError";
  }
}

export class InboxItemReadError extends Error {
  constructor(message: string) {
    super(`Inbox items could not be loaded: ${message}`);
    this.name = "InboxItemReadError";
  }
}

export class InboxItemReviewError extends Error {
  constructor(message: string) {
    super(`Inbox item could not be reviewed: ${message}`);
    this.name = "InboxItemReviewError";
  }
}

export class InboxEventCreateError extends Error {
  constructor(message: string) {
    super(`Inbox event could not be created: ${message}`);
    this.name = "InboxEventCreateError";
  }
}

export class InboxEventReadError extends Error {
  constructor(message: string) {
    super(`Inbox events could not be loaded: ${message}`);
    this.name = "InboxEventReadError";
  }
}

function mapInboxItem(data: {
  id: string;
  product_id: string;
  item_type: string;
  source_entity_type: string | null;
  source_entity_id: string | null;
  payload: unknown;
  status: string;
  ai_confidence: number | string | null;
  impact_estimate: string;
  review_time_estimate_seconds: number | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
}) {
  return inboxItemSchema.parse({
    id: data.id,
    productId: data.product_id,
    itemType: data.item_type,
    sourceEntityType: data.source_entity_type,
    sourceEntityId: data.source_entity_id,
    payload: data.payload,
    status: data.status,
    aiConfidence: data.ai_confidence === null ? null : Number(data.ai_confidence),
    impactEstimate: data.impact_estimate,
    reviewTimeEstimateSeconds: data.review_time_estimate_seconds,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    reviewedAt: data.reviewed_at,
  });
}

function mapInboxEvent(data: {
  id: string;
  inbox_item_id: string;
  product_id: string;
  actor_user_id: string | null;
  event_type: string;
  reason: string | null;
  metadata: unknown;
  created_at: string;
}) {
  return inboxItemEventSchema.parse({
    id: data.id,
    inboxItemId: data.inbox_item_id,
    productId: data.product_id,
    actorUserId: data.actor_user_id,
    eventType: data.event_type,
    reason: data.reason,
    metadata: data.metadata,
    createdAt: data.created_at,
  });
}

function isBatchApprovalEligible(item: InboxItem) {
  return item.status === "pending" && item.impactEstimate === "high" && (item.aiConfidence ?? 0) >= 0.88;
}
