import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildMarkdownExport, contentAssetMarkdownFilename } from "@/server/content/markdown-export";
import { AuthRequiredError } from "@/server/services/auth-service";
import { ContentAssetReadError, ContentService } from "@/server/services/content-service";

type RouteContext = {
  params: Promise<{ assetId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { assetId } = await params;
    const supabase = await createSupabaseServerClient();
    const asset = await new ContentService(supabase).getContentAsset({ assetId });

    if (!asset.bodyMd.trim()) {
      return NextResponse.json({ error: "Content asset has no Markdown body to export." }, { status: 409 });
    }

    const body = buildMarkdownExport(asset);
    const filename = contentAssetMarkdownFilename(asset);

    return new Response(body, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid content asset ID." }, { status: 400 });
    }

    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof ContentAssetReadError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return NextResponse.json({ error: "Supabase is not configured yet." }, { status: 500 });
    }

    throw error;
  }
}
