import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AccountService, accountErrorMessage } from "@/server/services/account-service";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const snapshot = await new AccountService(supabase).buildExport();
    const body = JSON.stringify(snapshot, null, 2);
    const date = new Date().toISOString().slice(0, 10);

    return new Response(body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="launchpilot-export-${date}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = accountErrorMessage(error) ?? "Account export failed.";
    const status = message.includes("sign in") ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
