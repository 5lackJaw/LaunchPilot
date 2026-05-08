import type { SupabaseClient } from "@supabase/supabase-js";
import { ConnectionsService } from "@/server/services/connections-service";
import type { AgentStatusHeaderState } from "@/components/agent-status-header";

type AgentChannel = "community" | "outreach" | "directories";

const inboxTypeByChannel: Record<AgentChannel, string> = {
  community: "community_reply",
  outreach: "outreach_email",
  directories: "directory_package",
};

export class AgentStatusService {
  constructor(private readonly supabase: SupabaseClient) {}

  async getHeader(input: {
    productId: string;
    channel: AgentChannel;
    itemUpdatedAts: string[];
  }) {
    const [inboxCount, configured] = await Promise.all([
      this.countPendingInboxItems(input.productId, input.channel),
      this.isConfigured(input.channel),
    ]);
    const state: AgentStatusHeaderState = configured ? "active" : "not_configured";

    return {
      state,
      inboxCount,
      lastRun: formatLastRun(input.itemUpdatedAts),
      nextRun: configured ? "Next weekly cycle" : "Not scheduled",
    };
  }

  private async countPendingInboxItems(productId: string, channel: AgentChannel) {
    const { count, error } = await this.supabase
      .from("inbox_items")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId)
      .eq("item_type", inboxTypeByChannel[channel])
      .eq("status", "pending");

    if (error) {
      throw new AgentStatusReadError(error.message);
    }

    return count ?? 0;
  }

  private async isConfigured(channel: AgentChannel) {
    if (channel === "directories") {
      return true;
    }

    const connections = await new ConnectionsService(this.supabase).listConnections();
    if (channel === "community") {
      return connections.some(
        (connection) =>
          (connection.provider === "reddit" || connection.provider === "hacker_news") &&
          connection.status === "connected",
      );
    }

    return connections.some(
      (connection) => connection.provider === "outreach_email" && connection.status === "connected",
    );
  }
}

export class AgentStatusReadError extends Error {
  constructor(message: string) {
    super(`Agent status could not be loaded: ${message}`);
    this.name = "AgentStatusReadError";
  }
}

function formatLastRun(values: string[]) {
  const latest = values
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];

  if (!latest) {
    return "No runs yet";
  }

  return new Date(latest).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
