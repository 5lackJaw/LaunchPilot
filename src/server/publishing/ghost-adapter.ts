import { createHmac } from "node:crypto";
import { env } from "@/config/env";
import type { ContentAsset } from "@/server/schemas/content";
import { markdownToBasicHtml } from "@/server/publishing/markdown-to-html";

type GhostPostResponse = {
  posts?: Array<{
    id: string;
    url?: string;
    status?: string;
  }>;
  errors?: Array<{
    message?: string;
  }>;
};

export function isGhostPublishingConfigured() {
  return Boolean(env.GHOST_ADMIN_URL && env.GHOST_ADMIN_API_KEY);
}

export async function publishContentAssetToGhost(asset: ContentAsset) {
  if (!env.GHOST_ADMIN_URL || !env.GHOST_ADMIN_API_KEY) {
    throw new GhostPublishError("Ghost publishing is not configured.");
  }

  if (!asset.bodyMd.trim()) {
    throw new GhostPublishError("Content asset has no Markdown body to publish.");
  }

  const token = createGhostAdminToken(env.GHOST_ADMIN_API_KEY);
  const endpoint = new URL("/ghost/api/admin/posts/", normalizeGhostUrl(env.GHOST_ADMIN_URL));
  endpoint.searchParams.set("source", "html");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Ghost ${token}`,
      "accept-version": env.GHOST_API_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      posts: [
        {
          title: asset.title,
          html: markdownToBasicHtml(asset.bodyMd),
          status: "draft",
          custom_excerpt: asset.metaDescription ?? undefined,
          meta_title: asset.metaTitle ?? undefined,
          meta_description: asset.metaDescription ?? undefined,
        },
      ],
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as GhostPostResponse;

  if (!response.ok) {
    const message = payload.errors?.[0]?.message ?? `Ghost returned HTTP ${response.status}.`;
    throw new GhostPublishError(message);
  }

  const post = payload.posts?.[0];
  if (!post?.id) {
    throw new GhostPublishError("Ghost response did not include a post ID.");
  }

  return {
    providerPostId: post.id,
    publishedUrl: post.url ?? null,
    providerStatus: post.status ?? "draft",
  };
}

export class GhostPublishError extends Error {
  constructor(message: string) {
    super(`Ghost publish failed: ${message}`);
    this.name = "GhostPublishError";
  }
}

function createGhostAdminToken(apiKey: string) {
  const [id, secret] = apiKey.split(":");

  if (!id || !secret) {
    throw new GhostPublishError("Ghost Admin API key must use the id:secret format.");
  }

  const header = base64Url(JSON.stringify({ alg: "HS256", kid: id, typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64Url(JSON.stringify({ aud: "/admin/", exp: now + 5 * 60, iat: now }));
  const signature = createHmac("sha256", Buffer.from(secret, "hex"))
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function normalizeGhostUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
