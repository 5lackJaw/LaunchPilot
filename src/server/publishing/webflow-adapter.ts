import { env } from "@/config/env";
import type { ContentAsset } from "@/server/schemas/content";
import { markdownToBasicHtml } from "@/server/publishing/markdown-to-html";

type WebflowItemResponse = {
  id?: string;
  isDraft?: boolean;
  fieldData?: Record<string, unknown>;
  items?: Array<{
    id?: string;
    isDraft?: boolean;
    fieldData?: Record<string, unknown>;
  }>;
  message?: string;
  details?: unknown;
};

export function isWebflowPublishingConfigured() {
  return Boolean(env.WEBFLOW_API_TOKEN && env.WEBFLOW_COLLECTION_ID);
}

export async function publishContentAssetToWebflow(asset: ContentAsset) {
  if (!env.WEBFLOW_API_TOKEN || !env.WEBFLOW_COLLECTION_ID) {
    throw new WebflowPublishError("Webflow publishing is not configured.");
  }

  if (!asset.bodyMd.trim()) {
    throw new WebflowPublishError("Content asset has no Markdown body to publish.");
  }

  const endpoint = new URL(`https://api.webflow.com/v2/collections/${env.WEBFLOW_COLLECTION_ID}/items/bulk`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.WEBFLOW_API_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      isArchived: false,
      isDraft: true,
      fieldData: buildFieldData(asset),
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as WebflowItemResponse;

  if (!response.ok) {
    throw new WebflowPublishError(payload.message ?? `Webflow returned HTTP ${response.status}.`);
  }

  const item = payload.items?.[0] ?? payload;
  if (!item.id) {
    throw new WebflowPublishError("Webflow response did not include an item ID.");
  }

  return {
    providerPostId: item.id,
    publishedUrl: null,
    providerStatus: item.isDraft ?? true ? "draft" : "staged",
  };
}

export class WebflowPublishError extends Error {
  constructor(message: string) {
    super(`Webflow publish failed: ${message}`);
    this.name = "WebflowPublishError";
  }
}

function buildFieldData(asset: ContentAsset) {
  const fieldData: Record<string, string> = {
    name: asset.title,
    slug: slugify(asset.title),
  };

  fieldData[env.WEBFLOW_BODY_FIELD_SLUG] = markdownToBasicHtml(asset.bodyMd);

  if (asset.metaDescription) {
    fieldData[env.WEBFLOW_SUMMARY_FIELD_SLUG] = asset.metaDescription;
    fieldData[env.WEBFLOW_META_DESCRIPTION_FIELD_SLUG] = asset.metaDescription;
  }

  if (asset.metaTitle) {
    fieldData[env.WEBFLOW_META_TITLE_FIELD_SLUG] = asset.metaTitle;
  }

  return fieldData;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
}
