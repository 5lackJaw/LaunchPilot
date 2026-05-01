import { env } from "@/config/env";

export function isLegacyPublishingEnvFallbackEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    env.ENABLE_LEGACY_PUBLISHING_ENV_FALLBACK === "1"
  );
}

export function isGhostLegacyEnvConfigured() {
  return (
    isLegacyPublishingEnvFallbackEnabled() &&
    Boolean(env.GHOST_ADMIN_URL && env.GHOST_ADMIN_API_KEY)
  );
}

export function isWordPressLegacyEnvConfigured() {
  return (
    isLegacyPublishingEnvFallbackEnabled() &&
    Boolean(
      env.WORDPRESS_SITE_URL &&
        env.WORDPRESS_USERNAME &&
        env.WORDPRESS_APPLICATION_PASSWORD,
    )
  );
}

export function isWebflowLegacyEnvConfigured() {
  return (
    isLegacyPublishingEnvFallbackEnabled() &&
    Boolean(env.WEBFLOW_API_TOKEN && env.WEBFLOW_COLLECTION_ID)
  );
}
