import { env } from "@/config/env";
import type { ContentAsset } from "@/server/schemas/content";
import { isWordPressLegacyEnvConfigured } from "@/server/publishing/legacy-env-fallback";
import { markdownToBasicHtml } from "@/server/publishing/markdown-to-html";

type WordPressPostResponse = {
  id?: number;
  link?: string;
  status?: string;
  message?: string;
  code?: string;
};

export type WordPressPublishingCredentials = {
  siteUrl: string;
  username: string;
  applicationPassword: string;
};

export function isWordPressPublishingConfigured() {
  return isWordPressLegacyEnvConfigured();
}

export async function publishContentAssetToWordPress(
  asset: ContentAsset,
  credentials?: WordPressPublishingCredentials | null,
) {
  const siteUrl = credentials?.siteUrl ?? env.WORDPRESS_SITE_URL;
  const username = credentials?.username ?? env.WORDPRESS_USERNAME;
  const applicationPassword = credentials?.applicationPassword ?? env.WORDPRESS_APPLICATION_PASSWORD;

  if (
    !siteUrl ||
    !username ||
    !applicationPassword ||
    (!credentials && !isWordPressLegacyEnvConfigured())
  ) {
    throw new WordPressPublishError("WordPress publishing requires a connected user account.");
  }

  if (!asset.bodyMd.trim()) {
    throw new WordPressPublishError("Content asset has no Markdown body to publish.");
  }

  const endpoint = new URL("/wp-json/wp/v2/posts", normalizeWordPressUrl(siteUrl));
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${username}:${applicationPassword}`).toString("base64")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: asset.title,
      content: markdownToBasicHtml(asset.bodyMd),
      excerpt: asset.metaDescription ?? undefined,
      status: "draft",
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as WordPressPostResponse;

  if (!response.ok) {
    throw new WordPressPublishError(payload.message ?? payload.code ?? `WordPress returned HTTP ${response.status}.`);
  }

  if (!payload.id) {
    throw new WordPressPublishError("WordPress response did not include a post ID.");
  }

  return {
    providerPostId: String(payload.id),
    publishedUrl: payload.link ?? null,
    providerStatus: payload.status ?? "draft",
  };
}

export class WordPressPublishError extends Error {
  constructor(message: string) {
    super(`WordPress publish failed: ${message}`);
    this.name = "WordPressPublishError";
  }
}

function normalizeWordPressUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
