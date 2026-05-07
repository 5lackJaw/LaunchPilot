import { env } from "@/config/env";
import type { ContentAsset } from "@/server/schemas/content";
import { isWebflowLegacyEnvConfigured } from "@/server/publishing/legacy-env-fallback";
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

export type WebflowPublishingCredentials = {
  apiToken: string;
  collectionId: string;
  bodyFieldSlug?: string;
  summaryFieldSlug?: string;
  metaTitleFieldSlug?: string;
  metaDescriptionFieldSlug?: string;
};

export function isWebflowPublishingConfigured() {
  return isWebflowLegacyEnvConfigured();
}

export async function publishContentAssetToWebflow(
  asset: ContentAsset,
  credentials?: WebflowPublishingCredentials | null,
) {
  const apiToken = credentials?.apiToken ?? env.WEBFLOW_API_TOKEN;
  const collectionId = credentials?.collectionId ?? env.WEBFLOW_COLLECTION_ID;

  if (!apiToken || !collectionId || (!credentials && !isWebflowLegacyEnvConfigured())) {
    throw new WebflowPublishError("Webflow publishing requires a connected user account.");
  }

  if (!asset.bodyMd.trim()) {
    throw new WebflowPublishError("Content asset has no Markdown body to publish.");
  }

  const endpoint = new URL(`https://api.webflow.com/v2/collections/${collectionId}/items/bulk`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      isArchived: false,
      isDraft: true,
      fieldData: buildFieldData(asset, credentials),
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

function buildFieldData(asset: ContentAsset, credentials?: WebflowPublishingCredentials | null) {
  const fieldData: Record<string, string> = {
    name: asset.title,
    slug: slugify(asset.title),
  };

  fieldData[credentials?.bodyFieldSlug ?? env.WEBFLOW_BODY_FIELD_SLUG] = markdownToBasicHtml(asset.bodyMd);

  if (asset.metaDescription) {
    fieldData[credentials?.summaryFieldSlug ?? env.WEBFLOW_SUMMARY_FIELD_SLUG] = asset.metaDescription;
    fieldData[credentials?.metaDescriptionFieldSlug ?? env.WEBFLOW_META_DESCRIPTION_FIELD_SLUG] = asset.metaDescription;
  }

  if (asset.metaTitle) {
    fieldData[credentials?.metaTitleFieldSlug ?? env.WEBFLOW_META_TITLE_FIELD_SLUG] = asset.metaTitle;
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
