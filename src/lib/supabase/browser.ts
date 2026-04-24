import { createBrowserClient } from "@supabase/ssr";
import { env, supabasePublicKey } from "@/config/env";

export function createSupabaseBrowserClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !supabasePublicKey) {
    throw new Error("Supabase URL and publishable key are not configured.");
  }

  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, supabasePublicKey);
}
