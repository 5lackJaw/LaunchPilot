import { createClient } from "@supabase/supabase-js";
import { env, supabaseSecretKey } from "@/config/env";

export function createSupabaseAdminClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !supabaseSecretKey) {
    throw new Error("Supabase URL and secret key are not configured.");
  }

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
