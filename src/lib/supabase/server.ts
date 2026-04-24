import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env, supabasePublicKey } from "@/config/env";

export async function createSupabaseServerClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !supabasePublicKey) {
    throw new Error("Supabase URL and publishable key are not configured.");
  }

  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, supabasePublicKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Server Components cannot mutate cookies; route handlers and actions can.
        }
      },
      remove(name: string, options) {
        try {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        } catch {
          // Server Components cannot mutate cookies; route handlers and actions can.
        }
      },
    },
  });
}
