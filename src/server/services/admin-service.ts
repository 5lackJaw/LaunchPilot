import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/config/env";

export type AdminAccountMode = "free" | "launch" | "growth" | "god";
export type EffectivePlanTier = "free" | "launch" | "growth";

export function isInternalAdmin(user: User) {
  return isInternalAdminIdentity({ id: user.id, email: user.email ?? null });
}

export function isInternalAdminIdentity(input: { id: string; email?: string | null }) {
  const ids = parseList(env.INTERNAL_ADMIN_USER_IDS);
  const emails = parseList(env.INTERNAL_ADMIN_EMAILS).map((email) => email.toLowerCase());
  const email = input.email?.toLowerCase();

  return ids.includes(input.id) || Boolean(email && emails.includes(email));
}

export async function getAdminAccountMode(input: {
  supabase: SupabaseClient;
  user: User;
}): Promise<AdminAccountMode | null> {
  if (!isInternalAdmin(input.user)) {
    return null;
  }

  const { data, error } = await input.supabase
    .from("users")
    .select("admin_account_mode")
    .eq("id", input.user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return parseAdminAccountMode(data?.admin_account_mode);
}

export async function getEffectivePlanForUser(input: {
  supabase: SupabaseClient;
  user: User;
  persistedPlanTier: unknown;
}): Promise<{
  effectiveTier: EffectivePlanTier;
  adminMode: AdminAccountMode | null;
  restrictionsDisabled: boolean;
}> {
  const adminMode = await getAdminAccountMode({
    supabase: input.supabase,
    user: input.user,
  });

  if (adminMode === "god") {
    return {
      effectiveTier: "growth",
      adminMode,
      restrictionsDisabled: true,
    };
  }

  if (adminMode === "free" || adminMode === "launch" || adminMode === "growth") {
    return {
      effectiveTier: adminMode,
      adminMode,
      restrictionsDisabled: false,
    };
  }

  return {
    effectiveTier: parseEffectivePlanTier(input.persistedPlanTier),
    adminMode,
    restrictionsDisabled: false,
  };
}

function parseList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseAdminAccountMode(value: unknown): AdminAccountMode | null {
  if (value === "free" || value === "launch" || value === "growth" || value === "god") {
    return value;
  }

  return null;
}

function parseEffectivePlanTier(value: unknown): EffectivePlanTier {
  if (value === "launch" || value === "growth") {
    return value;
  }

  return "free";
}
