import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProductAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const account = await loadShellAccount(user.id, user.email ?? null);

  return <AppShell account={account}>{children}</AppShell>;
}

async function loadShellAccount(userId: string, fallbackEmail: string | null) {
  try {
    const supabase = await createSupabaseServerClient();
    const [{ data: profile }, { data: products }] = await Promise.all([
      supabase.from("users").select("email,plan_tier").eq("id", userId).maybeSingle(),
      supabase.from("products").select("id").eq("user_id", userId),
    ]);
    const productIds = (products ?? []).map((product) => product.id as string);
    let pendingInboxCount = 0;

    if (productIds.length) {
      let query = supabase
        .from("inbox_items")
        .select("id", { count: "exact", head: true })
        .in("product_id", productIds)
        .eq("status", "pending");

      if (process.env.NODE_ENV === "production") {
        query = query.or("source_entity_type.is.null,source_entity_type.neq.dev_seed");
      }

      const { count } = await query;
      pendingInboxCount = count ?? 0;
    }

    return {
      email: typeof profile?.email === "string" ? profile.email : fallbackEmail,
      planTier: typeof profile?.plan_tier === "string" ? profile.plan_tier : null,
      pendingInboxCount,
    };
  } catch {
    return {
      email: fallbackEmail,
      planTier: null,
      pendingInboxCount: 0,
    };
  }
}
