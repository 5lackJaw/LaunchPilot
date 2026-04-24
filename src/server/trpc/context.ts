import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function createTRPCContext() {
  return {
    supabase: createSupabaseServerClient,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
