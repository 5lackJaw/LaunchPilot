import type { SupabaseClient } from "@supabase/supabase-js";
import {
  automationPreferenceSchema,
  listAutomationPreferencesSchema,
  updateAutomationPreferenceSchema,
} from "@/server/schemas/preferences";
import type { AutomationChannel, AutomationPreference } from "@/server/schemas/preferences";
import { ProductService } from "@/server/services/product-service";

const preferenceSelect = "id,product_id,channel,trust_level,daily_auto_action_limit,review_window_hours,created_at,updated_at";
const channels: AutomationChannel[] = ["content", "community", "directories", "outreach"];

export class PreferencesService {
  constructor(private readonly supabase: SupabaseClient) {}

  async listAutomationPreferences(input: unknown): Promise<AutomationPreference[]> {
    const parsed = listAutomationPreferencesSchema.parse(input);
    await new ProductService(this.supabase).getProduct({ productId: parsed.productId });

    const { data, error } = await this.supabase
      .from("automation_preferences")
      .select(preferenceSelect)
      .eq("product_id", parsed.productId)
      .order("channel", { ascending: true });

    if (error) {
      throw new PreferencesReadError(error.message);
    }

    const byChannel = new Map((data ?? []).map((row) => [row.channel as AutomationChannel, mapPreference(row)]));
    return channels.map((channel) => byChannel.get(channel) ?? defaultPreference(parsed.productId, channel));
  }

  async updateAutomationPreference(input: unknown): Promise<AutomationPreference> {
    const parsed = updateAutomationPreferenceSchema.parse(input);
    await new ProductService(this.supabase).getProduct({ productId: parsed.productId });

    const { data, error } = await this.supabase
      .from("automation_preferences")
      .upsert(
        {
          product_id: parsed.productId,
          channel: parsed.channel,
          trust_level: parsed.trustLevel,
          daily_auto_action_limit: parsed.dailyAutoActionLimit,
          review_window_hours: parsed.reviewWindowHours,
        },
        { onConflict: "product_id,channel" },
      )
      .select(preferenceSelect)
      .single();

    if (error) {
      throw new PreferencesUpdateError(error.message);
    }

    return mapPreference(data);
  }
}

export class PreferencesReadError extends Error {
  constructor(message: string) {
    super(`Automation preferences could not be loaded: ${message}`);
    this.name = "PreferencesReadError";
  }
}

export class PreferencesUpdateError extends Error {
  constructor(message: string) {
    super(`Automation preference could not be updated: ${message}`);
    this.name = "PreferencesUpdateError";
  }
}

function defaultPreference(productId: string, channel: AutomationChannel): AutomationPreference {
  return automationPreferenceSchema.parse({
    id: null,
    productId,
    channel,
    trustLevel: 1,
    dailyAutoActionLimit: 0,
    reviewWindowHours: 24,
    createdAt: null,
    updatedAt: null,
  });
}

function mapPreference(data: {
  id: string;
  product_id: string;
  channel: string;
  trust_level: number;
  daily_auto_action_limit: number;
  review_window_hours: number;
  created_at: string;
  updated_at: string;
}) {
  return automationPreferenceSchema.parse({
    id: data.id,
    productId: data.product_id,
    channel: data.channel,
    trustLevel: data.trust_level,
    dailyAutoActionLimit: data.daily_auto_action_limit,
    reviewWindowHours: data.review_window_hours,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}
